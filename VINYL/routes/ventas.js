const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../db');
// Ventas por empleado
router.get('/ventas/empleados', async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT 
        p.Nombre + ' ' + p.ApellidoPaterno AS Empleado, 
        SUM(vd.Cantidad) AS TotalDiscosVendidos
      FROM VentaDetalle vd
      JOIN Venta v ON vd.VentaID = v.VentaID
      JOIN Empleado e ON v.EmpleadoID = e.PersonaID
      JOIN Persona p ON e.PersonaID = p.PersonaID
      GROUP BY p.Nombre, p.ApellidoPaterno
      ORDER BY TotalDiscosVendidos DESC;
    `);

    res.render('ventas-empleados', {
      empleados: result.recordset
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener ventas por empleado');
  }
});

router.get('/ventas/estadisticas', async (req, res) => {
  try {
    const pool = await poolPromise;

    // Discos más vendidos (top 10)
    const discosResult = await pool.request()
      .query(`
        SELECT TOP 10
          d.DiscoID,
          d.Titulo,
          a.Nombre AS Artista,
          SUM(vd.Cantidad) AS TotalVentas
        FROM VentaDetalle vd
        JOIN Venta v ON vd.VentaID = v.VentaID
        JOIN DiscoVinilo d ON vd.DiscoID = d.DiscoID
        JOIN Artista a ON d.ArtistaID = a.ArtistaID
        GROUP BY d.DiscoID, d.Titulo, a.Nombre
        ORDER BY TotalVentas DESC
      `);

    // Ventas por mes
    const ventasMesResult = await pool.request()
      .query(`
        SELECT 
          YEAR(v.Fecha) AS Anio,
          MONTH(v.Fecha) AS Mes,
          SUM(vd.Cantidad) AS TotalDiscosVendidos
        FROM VentaDetalle vd
        JOIN Venta v ON vd.VentaID = v.VentaID
        GROUP BY YEAR(v.Fecha), MONTH(v.Fecha)
        ORDER BY Anio DESC, Mes DESC
      `);

    // Género musical más vendido
    const generoResult = await pool.request()
      .query(`
        SELECT TOP 1
          g.Nombre AS Genero,
          SUM(vd.Cantidad) AS TotalVentas
        FROM VentaDetalle vd
        JOIN Venta v ON vd.VentaID = v.VentaID
        JOIN DiscoVinilo d ON vd.DiscoID = d.DiscoID
        JOIN GeneroMusical g ON d.GeneroID = g.GeneroID
        GROUP BY g.Nombre
        ORDER BY TotalVentas DESC
      `);

    res.render('ventas-estadisticas', {
      discos: discosResult.recordset,
      ventasMes: ventasMesResult.recordset,
      generoTop: generoResult.recordset[0] || null
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener estadísticas de ventas');
  }
});

module.exports = router;
