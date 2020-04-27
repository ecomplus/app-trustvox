const logger = require('console-files')
const sqlite = require('sqlite3').verbose()
// create necessary tables
const dbFilename = process.env.ECOM_AUTH_DB || './db.sqlite'
const db = new sqlite.Database(dbFilename, err => {
  const error = err => {
    // debug and destroy Node process
    logger.error(err)
    process.exit(1)
  }

  if (err) {
    error(err)
  } else {
    // try to run first query creating table
    db.run(
      `
      CREATE TABLE IF NOT EXISTS trustvox_app_auth (
        id                INTEGER  PRIMARY KEY AUTOINCREMENT,
        created_at        DATETIME DEFAULT (CURRENT_TIMESTAMP),
        trustvox_store_id INTEGER  NOT NULL,
        store_token       STRING   NOT NULL,
        store_id          INTEGER  NOT NULL,
        link              STRING
      );    
      `, err => {
        if (err) {
          error(err)
        }
      })
  }
})

module.exports = {
  getStore: (storeId) => {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM trustvox_app_auth WHERE store_id = ? ORDER BY id DESC LIMIT 1`
      db.get(query, storeId, (err, row) => {
        if (err) {
          logger.error(err)
          reject(err)
        } else if (row) {
          // found with success
          // resolve the promise returning respective store and order IDs
          resolve(row)
        } else {
          let err = new Error('not found')
          reject(err)
        }
      })
    })
  },
  addStore: (trustvox_store_id, store_token, store_id, link) => {
    return new Promise((resolve, reject) => {
      let query = `INSERT INTO trustvox_app_auth 
      (trustvox_store_id,store_token,store_id,link) 
      VALUES(?,?,?,?)`
      db.run(query, [trustvox_store_id, store_token, store_id, link], (err) => {
        if (err) {
          reject(err)
        }
        resolve()
      })
    })
  }
}
