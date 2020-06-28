const logger = require('console-files')
const { getStore, addStore } = require('./../../lib/database')
const trustvox = require('./../../lib/trustvox/client')
const getConfig = require('./../../lib/store-api/get-config')
const path = require('path')

module.exports = (appSdk) => {
  return async (req, res) => {
    const storeId = parseInt(req.query.storeId || req.query.x_store_id || req.get('x-store-id'), 10)

    if (!storeId) {
      return res.status(409).send('missing store_id')
    }

    const localStore = await getStore(storeId).catch(() => console.log('Not auth'))

    // saved in db
    if (localStore) {
      return res.redirect(301, localStore.link)
    }

    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        return appSdk
          .apiRequest(storeId, '/stores/me.json', 'GET')
          .then(({ response }) => ({ data: response.data, configObj }))
      })

      .then(async ({ data, configObj }) => {
        const storeUrl = configObj.store_url || data.homepage
        const trustvoxAccount = await trustvox.store.find(storeUrl)

        if (!trustvoxAccount.errors) {
          // exist
          return addStore(trustvoxAccount.id, trustvoxAccount.store_token, storeId, trustvoxAccount.links[0].href)
            .then(() => res.redirect(301, trustvoxAccount.links[0].href)).catch(e => console.log(e))

        } else {
          const newAccount = {
            name: data.name,
            email: data.contact_email,
            url: data.homepage,
            platform_name: 'Outra plataforma'
          }

          switch (data.doc_type) {
            case 'cnpj':
              newAccount.cnpj = newAccount.doc_number
              break
            default:
              newAccount.cpf = newAccount.doc_number
              break
          }

          return trustvox.store.create(newAccount)
            .then(store => {
              return addStore(store.id, store.store_token, storeId, store.links[3].href)
                .then(() => res.redirect(301, store.links[3].href))
            })
        }
      })

      .catch(error => {
        logger.error(error)
        res.status(500)
        return res.sendFile(path.join(__dirname, '../../assets', 'callback-error.html'))
      })
  }
}
