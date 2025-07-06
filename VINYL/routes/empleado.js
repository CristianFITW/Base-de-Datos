const express = require('express');
const router = express.Router();
const multer = require('multer');
const mm = require('music-metadata');
const fs = require('fs');
const { sql, poolPromise } = require('../db'); // Asegúrate que db.js exporte poolPromise y sql

// Middleware para validar empleado
function soloEmpleado(req, res, next) {
  if (req.session.usuario && (req.session.usuario.tipo === 'Empleado' || req.session.usuario.tipo === 'E')) {
    return next();
  }
  res.status(403).send('Acceso denegado. Solo empleados.');
}

// Configuración multer para subir archivos en carpeta "uploads"
const upload = multer({ dest: 'uploads/' });

// Formulario para subir disco (GET)
router.get('/registro-vinilo', soloEmpleado, (req, res) => {
  res.render('empleado/registro-vinilo'); // Vista con formulario para subir archivo
});

// Registro disco (POST)
router.post('/registro-vinilo', soloEmpleado, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('Archivo no subido');
  }

  try {
    const metadata = await mm.parseFile(req.file.path);

    const common = metadata.common;
    const format = metadata.format;

    const nombreCancion = common.title || 'Desconocido';
    const album = common.album || 'Desconocido';
    const artista = common.artist || 'Desconocido';
    const genero = (common.genre && common.genre.length > 0) ? common.genre[0] : 'Desconocido';
    const anio = common.year || null;

    let portadaBuffer = null;
    if (common.picture && common.picture.length > 0) {
      portadaBuffer = common.picture[0].data;
    }

    const audioBuffer = fs.readFileSync(req.file.path);

    const pool = await poolPromise;

    // Insertar o buscar Artista
    let result = await pool.request()
      .input('nombre', sql.NVarChar, artista)
      .query('SELECT ArtistaID FROM Artista WHERE Nombre = @nombre');
    let artistaID;
    if (result.recordset.length > 0) {
      artistaID = result.recordset[0].ArtistaID;
    } else {
      result = await pool.request()
        .input('nombre', sql.NVarChar, artista)
        .query('INSERT INTO Artista (Nombre) OUTPUT INSERTED.ArtistaID VALUES (@nombre)');
      artistaID = result.recordset[0].ArtistaID;
    }

    // Insertar o buscar Género
    result = await pool.request()
      .input('nombre', sql.NVarChar, genero)
      .query('SELECT GeneroID FROM GeneroMusical WHERE Nombre = @nombre');
    let generoID;
    if (result.recordset.length > 0) {
      generoID = result.recordset[0].GeneroID;
    } else {
      result = await pool.request()
        .input('nombre', sql.NVarChar, genero)
        .query('INSERT INTO GeneroMusical (Nombre) OUTPUT INSERTED.GeneroID VALUES (@nombre)');
      generoID = result.recordset[0].GeneroID;
    }

// Validar portada para SQL Server
const portadaParam = (portadaBuffer && Buffer.isBuffer(portadaBuffer)) ? portadaBuffer : null;

result = await pool.request()
  .input('titulo', sql.NVarChar, album)
  .input('artistaID', sql.Int, artistaID)
  .input('generoID', sql.Int, generoID)
  .input('anio', sql.Int, anio)
  .input('precio', sql.Decimal(10, 2), 0)
  .input('portada', sql.VarBinary(sql.MAX), portadaParam)
  .query(`INSERT INTO DiscoVinilo (Titulo, ArtistaID, GeneroID, Anio, Precio, Portada)
          OUTPUT INSERTED.DiscoID
          VALUES (@titulo, @artistaID, @generoID, @anio, @precio, @portada)`);


    const discoID = result.recordset[0].DiscoID;

    // Insertar Canción
    await pool.request()
      .input('discoID', sql.Int, discoID)
      .input('titulo', sql.NVarChar, nombreCancion)
        .input('duracion', sql.NVarChar, format.duration ? new Date(format.duration * 1000).toISOString().substr(11, 8) : null)
      .input('audio', sql.VarBinary(sql.MAX), audioBuffer)
      .query(`INSERT INTO Cancion (DiscoID, Titulo, Duracion, Audio)
              VALUES (@discoID, @titulo, @duracion, @audio)`);

    // Eliminar archivo temporal
    fs.unlinkSync(req.file.path);

    res.send('Vinilo registrado con éxito');
  } catch (error) {
    console.error('Error en registro de vinilo:', error);
    res.status(500).send('Error al procesar el archivo');
  }
});

module.exports = router;
