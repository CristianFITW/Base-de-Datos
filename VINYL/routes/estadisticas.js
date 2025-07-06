const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../db');

// Ruta para estadísticas generales
router.get('/estadisticas', async (req, res) => {
  try {
    const pool = await poolPromise;

    // 10 discos más vendidos
    const discosVendidos = await pool.request()
      .query(`
        SELECT TOP 10 d.Titulo, SUM(vd.Cantidad) AS TotalVentas
        FROM VentaDetalle vd
        JOIN DiscoVinilo d ON vd.DiscoID = d.DiscoID
        GROUP BY d.Titulo
        ORDER BY TotalVentas DESC
      `);

    // Ventas por mes (año-mes y suma total)
    const ventasPorMes = await pool.request()
      .query(`
        SELECT 
          FORMAT(v.Fecha, 'yyyy-MM') AS Mes,
          SUM(vd.Cantidad) AS TotalVentas
        FROM Venta v
        JOIN VentaDetalle vd ON v.VentaID = vd.VentaID
        GROUP BY FORMAT(v.Fecha, 'yyyy-MM')
        ORDER BY Mes DESC
      `);

    // Top 10 géneros musicales más vendidos
    const generosMasVendidos = await pool.request()
      .query(`
        SELECT TOP 10 gm.Nombre AS NombreGenero, SUM(vd.Cantidad) AS TotalVentas
        FROM VentaDetalle vd
        JOIN DiscoVinilo d ON vd.DiscoID = d.DiscoID
        JOIN GeneroMusical gm ON d.GeneroID = gm.GeneroID
        GROUP BY gm.Nombre
        ORDER BY TotalVentas DESC
      `);

    res.render('estadisticas', {
      discos: discosVendidos.recordset,
      ventasMes: ventasPorMes.recordset,
      generos: generosMasVendidos.recordset
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener estadísticas');
  }
});

module.exports = router;
