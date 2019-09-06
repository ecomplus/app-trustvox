// send order from e-com.plus to trustvox
module.exports = (axios) => {
  return (storeId, storeToken, body) => {
    return axios({
      url: `stores/${storeId}/orders`,
      method: 'POST',
      headers: {
        'Authorization': `token ${storeToken}`
      },
      data: body
    })
  }
}
