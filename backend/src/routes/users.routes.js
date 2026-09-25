import express from "express";
import pool from "../config/db.js";

const router = express.Router();

/**
 * @openapi
 * /usuarios:
 *   get:
 *     summary: Obtener todos los usuarios
 *     tags:
 *       - Usuarios
 *     responses:
 *       200:
 *         description: Lista de usuarios
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM usuarios");
    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener usuarios",
      error: error.message
    });
  }
});

/**
 * @openapi
 * /usuarios:
 *   post:
 *     summary: Crear un usuario
 *     tags:
 *       - Usuarios
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - apellido
 *               - email
 *               - password_hash
 *             properties:
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               email:
 *                 type: string
 *               password_hash:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario creado
 */
router.post("/", async (req, res) => {
  try {
    const { nombre, apellido, email, password_hash } = req.body;

    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash)
       VALUES (?, ?, ?, ?)`,
      [nombre, apellido, email, password_hash]
    );

    res.status(201).json({
      message: "Usuario creado correctamente",
      id: result.insertId
    });

  } catch (error) {
    res.status(500).json({
      message: "Error al crear usuario",
      error: error.message
    });
  }
});


export default router;
