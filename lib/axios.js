const axios = require('axios')
// axios HTTP client
// https://github.com/axios/axios
// create an instance using the config defaults provided by the library
const instance = axios.create({
  baseURL: 'http://trustvox.com.br/api/',
  // up to 60s timeout
  timeout: 60000
})
// always JSON for request with body data
;['post', 'patch', 'get'].forEach(method => {
  instance.defaults.headers[method]['Accept'] = 'application/vnd.trustvox-v2+json'
})

module.exports = instance
