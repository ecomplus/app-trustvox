'use strict'
const trustvox = require('./../../lib/trustvox/client')
const { getStore } = require('./../../lib/database')
const logger = require('console-files')
const getConfig = require('./../../lib/store-api/get-config')
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'

module.exports = appSdk => {
  return (req, res) => {
    const { storeId } = req
    /*
    Treat E-Com Plus trigger body here
    // https://developers.e-com.plus/docs/api/#/store/triggers/
    */
    const trigger = req.body

    if (trigger.subresource !== 'fulfillments') {
      return res.send(ECHO_SKIP)
    }

    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        return appSdk
          .apiRequest(storeId, `orders/${trigger.resource_id}.json`)
          .then(resp => ({ order: resp.response.data, configObj }))
      })

      .then(async ({ order, configObj }) => {
        const { fulfillments } = order
        if (fulfillments &&
          fulfillments.find(fulfillment => fulfillment.status === 'delivered') &&
          configObj.trustvox_store_id &&
          configObj.store_token) {
          const store = await appSdk
            .apiRequest(storeId, '/stores/me.json', 'GET')
            .then(store => store.response.data)

          const { items } = order
          const promises = []
          const trustVoxItens = []
          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            const promise = appSdk
              .apiRequest(storeId, `products/${item.product_id}.json`, 'GET')
              .then(resp => resp.response.data)
              .then(product => {
                const { pictures } = product
                const image = pictures.map(picture => picture.normal && picture.normal.url)
                let productId = product.sku

                if (product.hidden_metafields) {
                  let meta = product.hidden_metafields.find(metafield => metafield.field === 'trustvox_id')
                  productId = meta.value || productId
                }

                trustVoxItens.push({
                  'name': product.name,
                  'id': productId,
                  'url': product.permalink || `${store.homepage}/${product.slug}`,
                  'price': product.price,
                  'photos_urls': image,
                  'tags': [productId],
                  'extra': {
                    'sku': product.sku
                  }
                })
              })
            promises.push(promise)
          }

          Promise
            .all(promises)
            .then(() => {
              return getStore(storeId)
            })
            .then(trustAuth => {
              const buyers = order.buyers[0] || {}
              let data = {
                'order_id': order._id,
                'delivery_date': order.fulfillment_status.updated_at || order.updated_at,
                'client': {
                  'first_name': buyers.name.given_name,
                  'last_name': buyers.name.family_name,
                  'email': buyers.main_email,
                  'phone_number': buyers.phones[0].number
                },
                'items': trustVoxItens
              }
              return trustvox.sales.new(trustAuth.trustvox_store_id, trustAuth.store_token, data)
            })
            .then(resp => {
              logger.log(`--> New order #${order.number} / #${storeId}`)
            })
            .catch(err => {
              logger.error(`--> Trustvox Err for order #${order.number} / #${storeId}`, err.response.data)
            })
        }
      })

      .then(() => res.send(ECHO_SUCCESS))

      .catch(err => {
        logger.error(err)
        if (err.name === ECHO_SKIP) {
          // trigger ignored by app configuration
          res.send(ECHO_SKIP)
        } else {
          // logger.error(err)
          // request to Store API with error response
          // return error status code
          res.status(500)
          let { message } = err
          res.send({
            error: ECHO_API_ERROR,
            message
          })
        }
      })
  }
}
