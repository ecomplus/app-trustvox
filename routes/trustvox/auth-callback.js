const logger = require('console-files')
const { getStore, addStore } = require('./../../lib/database')
const trustvox = require('./../../lib/trustvox/client')
module.exports = appSdk => {
  return async (req, res) => {
    let storeId = req.query.storeId || req.query.x_store_id || parseInt(req.get('x-store-id'), 10)
    if (!storeId || isNaN(storeId)) {
      res.status(400)
      res.set('Content-Type', 'text/html')
      res.send(Buffer.from('<p>Store Id not found</p>'))
    }

    let store = await getStore(storeId).catch(() => console.log('Store not found'))
    if (!store) {
      appSdk.apiRequest(storeId, '/stores/me.json', 'GET')

        .then(resp => {
          let me = resp.response.data
          let domain = me.homepage
          return trustvox.store.find(domain)

            .then(result => {
              // not found
              if (result.errors) {
                // create new store
                let payload = {}
                payload.name = me.name
                payload.email = me.contact_email
                payload.url = me.homepage
                payload.platform_name = 'Outra plataforma'

                switch (me.doc_type) {
                  case 'cnpj':
                    payload.cnpj = payload.doc_type
                    break
                  default:
                    payload.cpf = payload.doc_type
                    break
                }
                trustvox.store.create(payload)

                  .then(store => {
                    addStore(store.id, store.store_token, storeId, store.links[3].href)
                    res.redirect(301, store.links[3].href)
                  })
              } else {
                addStore(result.id, result.store_token, storeId, result.links[0].href)
                res.redirect(301, store.links[0].href)
              }
            })
        })

        .catch(error => {
          let msg = 'TrustVox Auth Callback Error'
          logger.error(msg, error)
          res.status(400)
          res.set('Content-Type', 'text/html')
          res.send(msg)
        })
    } else {
      // if installed, redirect to trustvox account
      res.redirect(301, store.link)
    }
  }
}
