'use strict'
const trustvox = require('./../../lib/trustvox/client')
const { getStore } = require('./../../lib/database')
// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

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
    if (trigger.fields && trigger.fields.includes('fulfillment_status')) {
      appSdk.apiRequest(storeId, `orders/${trigger.resource_id}.json`, 'GET')

        .then(result => {
          let order = result.response.data
          if (order.fulfillment_status.current === 'delivered') {
            let promises = []
            let items = []

            for (let i = 0; i < order.items.length; i++) {
              let requests = appSdk.apiRequest(storeId, `products/${order.items[i].product_id}.json`, 'GET')
                .then(resp => {
                  let product = resp.response.data
                  let image = product.pictures.map(image => image.normal.url)
                  let productId = null
                  if (product.hasOwnProperty('hidden_metafields')) {
                    let meta = product.hidden_metafields.find(meta => meta.field === 'trustvox_id')
                    productId = meta.value || product.sku
                  } else {
                    productId = product.sku
                  }
                  items.push({
                    'name': product.name,
                    'id': productId,
                    'url': product.permalink || '',
                    'price': product.price,
                    'photos_urls': image,
                    'tags': [productId],
                    'extra': {
                      'sku': product.sku
                    }
                  })
                })
              promises.push(requests)
            }
            Promise.all(promises).then(() => {
              getStore(storeId)
                .then(auth => {
                  let payload = {
                    'order_id': order._id,
                    'delivery_date': order.fulfillment_status.updated_at,
                    'client': {
                      'first_name': order.buyers[0].name.given_name,
                      'last_name': order.buyers[0].name.family_name,
                      'email': order.buyers[0].main_email,
                      'phone_number': order.buyers[0].phones[0].number
                    },
                    'items': items
                  }
                  return trustvox.sales.new(auth.trustvox_store_id, auth.store_token, payload)
                    .then(resp => console.log('Sucess', resp))
                    .catch(err => console.error('busseta', err.response))
                })
            })
              .catch(err => console.error('eerrrr', err))
          }
        })
    } else {
      // all done
      res.send(ECHO_SKIP)
    }
  }
}
