const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../db');

// Mostrar carrito con botón Pagar
router.get('/carrito', async (req, res) => {
  if (!req.session.usuario || req.session.usuario.tipo !== 'U') {
    return res.status(403).send('Solo usuarios pueden acceder al carrito');
  }

  const carrito = req.session.carrito || [];
  if (carrito.length === 0) {
    return res.render('carrito', { items: [], total: 0 });
  }

  try {
    const pool = await poolPromise;
    const ids = carrito.map(id => parseInt(id)).join(',');
    const result = await pool.request()
      .query(`
        SELECT d.DiscoID, d.Titulo, a.Nombre AS Artista, d.Precio
        FROM DiscoVinilo d
        JOIN Artista a ON d.ArtistaID = a.ArtistaID
        WHERE d.DiscoID IN (${ids})
      `);

    const total = result.recordset.reduce((sum, item) => sum + parseFloat(item.Precio), 0);
    res.render('carrito', { items: result.recordset, total });

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener carrito');
  }
});

// Mostrar formulario para seleccionar empleado antes de pagar
router.get('/carrito/pagar', async (req, res) => {
  if (!req.session.usuario || req.session.usuario.tipo !== 'U') {
    return res.status(403).send('Solo usuarios pueden pagar');
  }
  try {
    const pool = await poolPromise;
    const empleadosResult = await pool.request()
      .query('SELECT e.PersonaID AS EmpleadoPersonaID, p.Nombre FROM Empleado e JOIN Persona p ON e.PersonaID = p.PersonaID');

    res.render('carrito-pagar', { empleados: empleadosResult.recordset });

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al cargar empleados');
  }
});

// Procesar pago y vaciar carrito
router.post('/carrito/pagar', async (req, res) => {
  if (!req.session.usuario || req.session.usuario.tipo !== 'U') {
    return res.status(403).send('Solo usuarios pueden pagar');
  }

  const empleadoPersonaID = parseInt(req.body.empleadoID);
  const carrito = req.session.carrito || [];

  console.log('Empleado seleccionado:', empleadoPersonaID);
  console.log('Carrito:', carrito);

  if (!empleadoPersonaID || carrito.length === 0) {
    return res.status(400).send('Empleado o carrito inválido');
  }

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Obtener precios de discos
      const ids = carrito.map(id => parseInt(id)).join(',');
      const preciosResult = await pool.request()
        .query(`SELECT DiscoID, Precio FROM DiscoVinilo WHERE DiscoID IN (${ids})`);

      // Mapa discoID -> precio
      const preciosMap = {};
      preciosResult.recordset.forEach(row => {
        preciosMap[row.DiscoID] = parseFloat(row.Precio);
      });

      // Calcular total
      const total = Object.values(preciosMap).reduce((acc, p) => acc + p, 0);

      // Insertar venta con total
      const ventaResult = await transaction.request()
        .input('usuarioID', sql.Int, req.session.usuario.id)
        .input('empleadoID', sql.Int, empleadoPersonaID)
        .input('total', sql.Decimal(10, 2), total)
        .query(`
          INSERT INTO Venta (UsuarioID, EmpleadoID, Total)
          OUTPUT INSERTED.VentaID
          VALUES (@usuarioID, @empleadoID, @total)
        `);

      const ventaID = ventaResult.recordset[0].VentaID;

      // Insertar detalles con precio unitario
      for (const discoID of carrito) {
        const precioUnitario = preciosMap[discoID];
        await transaction.request()
          .input('ventaID', sql.Int, ventaID)
          .input('discoID', sql.Int, parseInt(discoID))
          .input('cantidad', sql.Int, 1)
          .input('precioUnitario', sql.Decimal(10, 2), precioUnitario)
          .query(`
            INSERT INTO VentaDetalle (VentaID, DiscoID, Cantidad, PrecioUnitario)
            VALUES (@ventaID, @discoID, @cantidad, @precioUnitario)
          `);
      }

      await transaction.commit();
      req.session.carrito = [];
res.send(`
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Compra Exitosa</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: url('/img_fondo/f1.jpg') no-repeat center center fixed;
        background-size: cover;
        font-family: 'Segoe UI', sans-serif;
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
      }

      body::before {
        content: "";
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background-color: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(5px);
        z-index: -1;
      }

      .mensaje {
        background-color: rgba(255, 255, 255, 0.08);
        padding: 40px;
        border-radius: 20px;
        text-align: center;
        box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
      }

      h1 {
        margin-bottom: 20px;
        font-size: 2rem;
      }

      a {
        display: inline-block;
        margin-top: 20px;
        padding: 12px 24px;
        background-color: rgba(255, 255, 255, 0.2);
        color: white;
        text-decoration: none;
        border-radius: 12px;
        font-weight: bold;
        transition: background 0.3s ease;
      }

      a:hover {
        background-color: rgba(255, 255, 255, 0.4);
      }
    </style>
  </head>
  <body>
    <div class="mensaje">
      <h1>✅ ¡Compra realizada con éxito!</h1>
      <p>Gracias por tu compra en la tienda de vinilos.</p>
      <a href="/vinilos">Seguir comprando</a>
    </div>
  </body>
  </html>
`);

    } catch (err) {
      await transaction.rollback();
      throw err;
    }

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al procesar compra');
  }
});

module.exports = router;
