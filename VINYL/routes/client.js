const express = require('express');
const router = express.Router();

// Página principal de clientes
router.get('/', (req, res) => {
  res.render('client/home'); // Asegúrate de que exista views/client/home.ejs
});

module.exports = router;
