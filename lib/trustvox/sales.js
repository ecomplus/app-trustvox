// send order from e-com.plus to trustvox
module.exports = (axios) => {
  return (storeId, storeToken, body) => {
    return axios({
      url: `stores/${storeId}/orders`,
      method: 'POST',
      headers: {
        'Authorization': `token ${storeToken}`,
        'Accept': 'application/vnd.trustvox.com; version=1',
        'Content-Type': 'application/json'
      },
      data: body
    })
  }
}
