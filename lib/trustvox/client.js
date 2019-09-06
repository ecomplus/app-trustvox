const axios = require('./../axios')

const client = {
  store: {
    create: body => require('./create-store')(axios)(body),
    find: domain => require('./stores-exist')(axios)(domain)
  },
  sales: {
    new: (storeId, storeToken, body) => require('./sales')(axios)(storeId, storeToken, body)
  }
}

module.exports = client
