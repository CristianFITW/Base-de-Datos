const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const sql = require('mssql'); // Usando mssql para conectar a SQL Server

// Configuración de conexión (ajusta con tus datos)
const dbConfig = {
  user: 'sa',
  password: 'n0m3l0',
  server: 'localhost',
  database: 'viniles1',
  options: { trustServerCertificate: true }
};
// Página de registro (GET)
router.get('/register', (req, res) => {
  res.render('auth/register'); // formulario EJS para registro con campos persona + correo + contraseña + tipoUsuario
});

// Registro (POST)
router.post('/register', async (req, res) => {
  const {
    nombre, apellidoPaterno, apellidoMaterno, direccion,
    telefono, cp, correo, sexo, fechaNacimiento, tipoUsuario,
    password
  } = req.body;

  try {
    // Validar campos mínimos
    if (!nombre || !apellidoPaterno || !correo || !password || !tipoUsuario) {
      return res.status(400).send('Faltan campos obligatorios');
    }

    // Conectar DB
    let pool = await sql.connect(dbConfig);

    // Verificar que no exista correo
    let result = await pool.request()
      .input('correo', sql.NVarChar, correo)
      .query('SELECT PersonaID FROM Acceso WHERE Correo = @correo');

    if (result.recordset.length > 0) {
      return res.status(400).send('Correo ya registrado');
    }

    // Insertar en Persona
    result = await pool.request()
      .input('nombre', sql.NVarChar, nombre)
      .input('apellidoPaterno', sql.NVarChar, apellidoPaterno)
      .input('apellidoMaterno', sql.NVarChar, apellidoMaterno)
      .input('direccion', sql.NVarChar, direccion)
      .input('telefono', sql.NVarChar, telefono)
      .input('cp', sql.NVarChar, cp)
      .input('correo', sql.NVarChar, correo)
      .input('sexo', sql.Char, sexo)
      .input('fechaNacimiento', sql.Date, fechaNacimiento)
      .input('tipoUsuario', sql.Char, tipoUsuario)
      .query(`
        INSERT INTO Persona (Nombre, ApellidoPaterno, ApellidoMaterno, Direccion, Telefono, CP, Correo, Sexo, FechaNacimiento, TipoUsuario)
        VALUES (@nombre, @apellidoPaterno, @apellidoMaterno, @direccion, @telefono, @cp, @correo, @sexo, @fechaNacimiento, @tipoUsuario);
        SELECT SCOPE_IDENTITY() AS PersonaID;
      `);

    const personaID = result.recordset[0].PersonaID;

    // Insertar en Acceso con hash de password
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    await pool.request()
      .input('personaID', sql.Int, personaID)
      .input('correo', sql.NVarChar, correo)
      .input('passwordHash', sql.NVarChar, hash)
      .query(`INSERT INTO Acceso (PersonaID, Correo, PasswordHash) VALUES (@personaID, @correo, @passwordHash)`);

    // Insertar en tabla Empleado o Usuario según tipoUsuario
    if (tipoUsuario === 'E') {
      await pool.request()
        .input('personaID', sql.Int, personaID)
        .query(`INSERT INTO Empleado (PersonaID) VALUES (@personaID)`);
    } else if (tipoUsuario === 'U') {
      await pool.request()
        .input('personaID', sql.Int, personaID)
        .query(`INSERT INTO Usuario (PersonaID) VALUES (@personaID)`);
    }

res.send(`
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Registro Exitoso</title>
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
        margin: 10px;
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
      <h1>¡Registro con éxito!</h1>
      <p>Ya puedes iniciar sesión.</p>
      <a href="/auth/login">Iniciar sesión</a>
      <a href="/">Ir al inicio</a>
    </div>
  </body>
  </html>
`);


  } catch (err) {
    console.error(err);
    res.status(500).send('Error en servidor');
  }
});

// Login (GET)
router.get('/login', (req, res) => {
  res.render('auth/login'); // formulario login con correo y contraseña
});

// Login (POST)
router.post('/login', async (req, res) => {
  const { correo, password } = req.body;

  try {
    if (!correo || !password) {
      return res.status(400).send('Correo y contraseña son requeridos');
    }

    const pool = await sql.connect(dbConfig);

    // Buscar usuario por correo
    const result = await pool.request()
      .input('correo', sql.NVarChar, correo)
      .query(`
        SELECT p.PersonaID, p.Nombre, p.ApellidoPaterno, p.TipoUsuario, a.PasswordHash
        FROM Persona p
        INNER JOIN Acceso a ON p.PersonaID = a.PersonaID
        WHERE a.Correo = @correo
      `);

    if (result.recordset.length === 0) {
      return res.status(401).send('Usuario no encontrado');
    }

    const user = result.recordset[0];

    // Verificar contraseña
    const match = await bcrypt.compare(password, user.PasswordHash);
    if (!match) {
      return res.status(401).send('Contraseña incorrecta');
    }

    // Guardar datos en sesión
// Guardar datos en sesión (usando el tipo real: 'E' o 'U')
req.session.usuario = {
  id: user.PersonaID,
  nombre: user.Nombre,
  apellido: user.ApellidoPaterno,
  tipo: user.TipoUsuario // ✅ Guarda 'E' o 'U' directamente
};


    res.redirect('/'); // o donde quieras mandar después de login

  } catch (err) {
    console.error(err);
    res.status(500).send('Error en servidor');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;
