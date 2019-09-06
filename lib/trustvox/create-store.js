// create a new store at trustvox
module.exports = (axios) => {
  return (body) => {
    return axios({
      url: 'stores',
      method: 'POST',
      headers: {
        'Authorization': `token ${process.env.TRUSTVOX_TOKEN}`
      },
      data: body
    })
  }
}
