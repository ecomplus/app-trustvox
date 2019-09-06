module.exports = (axios) => {
  return (domain) => {
    let url = `stores?url=${domain}`
    return axios({
      url: url,
      method: 'GET',
      headers: {
        'Authorization': `token ${process.env.TRUSTVOX_TOKEN}`
      }
    }).then(result => result.data)
  }
}
