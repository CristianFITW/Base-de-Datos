const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../db');

// Lista todos los vinilos con filtros
router.get('/vinilos', async (req, res) => {
  try {
    const pool = await poolPromise;

    const { genero, artista, anioDesde, anioHasta, ordenarGenero, ordenarArtista } = req.query;

    let query = `
      SELECT d.DiscoID, d.Titulo, a.Nombre AS Artista, g.Nombre AS Genero, d.Anio, d.Precio
      FROM DiscoVinilo d
      JOIN Artista a ON d.ArtistaID = a.ArtistaID
      JOIN GeneroMusical g ON d.GeneroID = g.GeneroID
      WHERE 1=1
    `;

    if (genero) {
      query += ` AND g.Nombre = @genero `;
    }
    if (artista) {
      query += ` AND a.Nombre = @artista `;
    }
    if (anioDesde) {
      query += ` AND d.Anio >= @anioDesde `;
    }
    if (anioHasta) {
      query += ` AND d.Anio <= @anioHasta `;
    }

    if (ordenarGenero) {
      query += ordenarGenero === 'asc' ? ' ORDER BY g.Nombre ASC ' : ' ORDER BY g.Nombre DESC ';
    } else if (ordenarArtista) {
      query += ordenarArtista === 'asc' ? ' ORDER BY a.Nombre ASC ' : ' ORDER BY a.Nombre DESC ';
    } else {
      query += ' ORDER BY d.Titulo ASC ';
    }

    const request = pool.request();
    if (genero) request.input('genero', sql.NVarChar, genero);
    if (artista) request.input('artista', sql.NVarChar, artista);
    if (anioDesde) request.input('anioDesde', sql.Int, anioDesde);
    if (anioHasta) request.input('anioHasta', sql.Int, anioHasta);

    const vinilosResult = await request.query(query);

    // Para los select de filtro
    const generosResult = await pool.request().query('SELECT Nombre FROM GeneroMusical ORDER BY Nombre ASC');
    const artistasResult = await pool.request().query('SELECT Nombre FROM Artista ORDER BY Nombre ASC');

    res.render('vinilos-lista', {
      vinilos: vinilosResult.recordset,
      generos: generosResult.recordset,
      artistas: artistasResult.recordset,
      filtros: req.query
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener lista de vinilos');
  }
});

// Muestra detalle de un vinilo con portada y reproductor
router.get('/vinilo/:id', async (req, res) => {
  const discoID = parseInt(req.params.id);
  try {
    const pool = await poolPromise;

    const discoResult = await pool.request()
      .input('id', sql.Int, discoID)
      .query(`SELECT d.DiscoID, d.Titulo, d.Anio, d.Precio,
                     a.Nombre AS Artista, g.Nombre AS Genero,
                     d.Portada
              FROM DiscoVinilo d
              JOIN Artista a ON d.ArtistaID = a.ArtistaID
              JOIN GeneroMusical g ON d.GeneroID = g.GeneroID
              WHERE d.DiscoID = @id`);

    if (discoResult.recordset.length === 0) {
      return res.status(404).send('Vinilo no encontrado');
    }

    const disco = discoResult.recordset[0];

    const cancionResult = await pool.request()
      .input('id', sql.Int, discoID)
      .query(`SELECT TOP 1 Titulo, Duracion, Audio FROM Cancion WHERE DiscoID = @id`);

    let cancion = null;
    if (cancionResult.recordset.length > 0) {
      cancion = cancionResult.recordset[0];
    }

    let portadaBase64 = null;
    if (disco.Portada) {
      portadaBase64 = Buffer.from(disco.Portada).toString('base64');
    }

    let audioBase64 = null;
    if (cancion && cancion.Audio) {
      audioBase64 = Buffer.from(cancion.Audio).toString('base64');
    }

    // Imprime los primeros 50 caracteres del base64 de portada para verificar
    console.log('Portada base64:', portadaBase64 ? portadaBase64.substring(0, 50) + '...' : 'No hay portada');

    // Validación para agregar al carrito
    const puedeAgregar = req.session.usuario && req.session.usuario.tipo === 'U';

    res.render('vinilo-detalle', {
      disco,
      cancion,
      portadaBase64,
      audioBase64,
      puedeAgregar
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener vinilo');
  }
});

router.post('/agregar-carrito/:id', (req, res) => {
  if (!req.session.usuario || req.session.usuario.tipo !== 'U') {
    return res.status(403).send('Solo usuarios pueden agregar al carrito');
  }

  const discoID = parseInt(req.params.id);
  if (!req.session.carrito) req.session.carrito = [];

  if (!req.session.carrito.includes(discoID)) {
    req.session.carrito.push(discoID);
  }

  res.redirect('/carrito');
});

module.exports = router;
