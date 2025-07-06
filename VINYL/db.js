const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'n0m3l0',
  server: 'localhost',
  database: 'viniles1',
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Conectado a SQL Server');
    return pool;
  })
  .catch(err => console.log('Error en conexión a SQL Server', err));

module.exports = {
  sql, poolPromise
};
