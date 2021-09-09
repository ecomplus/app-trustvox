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
    //logger.log(JSON.stringify(trigger))

    if (!trigger.resource_id) {
      return res.send(ECHO_SKIP)
    }

    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        return appSdk
          .apiRequest(storeId, `orders/${trigger.resource_id}.json`)
          .then(({ response }) => ({ order: response.data, configObj }))
      })

      .then(async ({ order, configObj }) => {
        if (order.fulfillment_status &&
          order.fulfillment_status.current &&
          order.fulfillment_status.current === 'delivered') {
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
                const photosUrls = []
                product.pictures.forEach(picture => {
                  if (picture.zoom) {
                    const { url } = picture.zoom
                    if (!url.endsWith('.webp')) {
                      photosUrls.push(url)
                    }
                  }
                })
                let productId = product.sku

                if (product.hidden_metafields) {
                  const meta = product.hidden_metafields.find(metafield => metafield.field === 'trustvox_id')
                  if (meta && meta.value) {
                    productId = meta.value
                  }
                }

                trustVoxItens.push({
                  name: product.name,
                  id: productId,
                  url: product.permalink || `https://${store.domain}/${product.slug}`,
                  price: product.price,
                  photos_urls: photosUrls,
                  tags: [productId],
                  extra: {
                    sku: product.sku
                  }
                })
              })
            promises.push(promise)
          }

          const trustAuth = await getStore(storeId).catch(err => console.error(err))

          const tvStoreId = configObj.trustvox_store_id || trustAuth.trustvox_store_id
          const tvStoreToken = configObj.store_token || trustAuth.store_token

          Promise
            .all(promises)
            .then(() => {
              const buyers = (order.buyers && order.buyers[0]) || {}
              let data = {
                'order_id': order._id,
                'delivery_date': (order.fulfillment_status && order.fulfillment_status.updated_at) || order.updated_at,
                'client': {
                  'first_name': buyers.name ? buyers.name.given_name : buyers.display_name,
                  'last_name': buyers.name ? buyers.name.given_name : undefined,
                  'email': buyers.main_email,
                  'phone_number': buyers.phones ? buyers.phones[0].number : undefined
                },
                'items': trustVoxItens
              }
              return trustvox.sales.new(tvStoreId, tvStoreToken, data)
            })
            .then(resp => {
              logger.log(`--> New order #${order.number} / #${storeId} / ${resp.data && resp.data.order_id}`)
            })
            .catch(err => {
              const { response } = err
              let message = err.message
              if (response && response.data) {
                message = JSON.stringify(response.data)
              }
              logger.error(`--> Trustvox Err for order #${order.number} / #${storeId}`, message)
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
