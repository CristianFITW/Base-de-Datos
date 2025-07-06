const express = require('express');
const router = express.Router();

// Middleware para verificar usuario
function soloUsuario(req, res, next) {
  if (req.session.usuario && req.session.usuario.tipo === 'U') {
    return next();
  }
  return res.status(403).send('Solo los usuarios pueden usar el carrito.');
}

// Inicializar carrito si no existe
router.use((req, res, next) => {
  if (!req.session.carrito) {
    req.session.carrito = [];
  }
  next();
});

router.post('/agregar', soloUsuario, (req, res) => {
  const discoID = parseInt(req.body.discoID);
  if (!isNaN(discoID)) {
    req.session.carrito.push({ discoID });
  }
  res.redirect('/'); // O redirige a /carrito si ya tienes esa vista
});

module.exports = router;
