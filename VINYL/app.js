const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

// Rutas
const authRoutes = require('./routes/auth');
const empleadoRoutes = require('./routes/empleado');
const viniloRoutes = require('./routes/vinilo');
const clientRoutes = require('./routes/client');
const cartRoutes = require('./routes/cart');           // Carrito y pagos
const ventasRoutes = require('./routes/ventas');        // Ventas totales por empleado
const estadisticasRoutes = require('./routes/estadisticas'); // Estadísticas: discos más vendidos, ventas por mes, género

const app = express();

// Configuración de vistas y archivos estáticos
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

// Configuración de sesión
app.use(session({
  secret: 'vinyl-secret',
  resave: false,
  saveUninitialized: false
}));

// Variables globales para las vistas
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  res.locals.empleado = req.session.empleado || null;
  next();
});

// Rutas
app.use('/auth', authRoutes);
app.use('/empleado', empleadoRoutes);
app.use('/', cartRoutes);           // Debe ir antes de vinilo para evitar choque con /carrito
app.use('/', viniloRoutes);
app.use('/', clientRoutes);
app.use('/', ventasRoutes);         // Ruta para ventas por empleado
app.use('/', estadisticasRoutes);   // Ruta para estadísticas

// Servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
