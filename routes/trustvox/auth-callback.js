const logger = require('console-files')
const { getStore, addStore } = require('./../../lib/database')
const trustvox = require('./../../lib/trustvox/client')
const getConfig = require('./../../lib/store-api/get-config')

module.exports = appSdk => {
  return async (req, res) => {
    const storeId = req.query.storeId || req.query.x_store_id || parseInt(req.get('x-store-id'), 10)

    if (!storeId || isNaN(storeId)) {
      res.status(400)
      res.set('Content-Type', 'text/html')
      return res.send(Buffer.from('<p>Store Id not found</p>'))
    }

    const store = await getStore(storeId).catch(() => console.log('Store not found'))

    if (store) {
      return res.redirect(301, store.link)
    }

    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        return appSdk
          .apiRequest(storeId, '/stores/me.json', 'GET')
          .then(resp => ({ data: resp.response.data, configObj }))
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
        const msg = `
          <style> 
            .error {
                display: flex;
                width: 100%;
                height: 100vh;
                justify-content: center;
                align-items: center;
                font-size: 1.5rem;
                opacity: .8;
            }
          </style>
          <div class="error"> 
            <h6>Não foi possível completar a configuração do aplicativo utizando a url configurada no app. <br> Verique a url configurada no aplicativo e tente realizar a authenticação novamente <br> ou informe o erro na <a href="https://community.e-com.plus/">comunidade</a>.</h6>
          </div>
        `
        logger.error(msg, error)
        res.status(500)
        res.set('Content-Type', 'text/html')
        return res.send(msg)
      })
  }
}
