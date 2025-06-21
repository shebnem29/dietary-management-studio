const express = require('express');
const router = express.Router();
const pool = require('../db'); // Your PostgreSQL connection
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config();

router.post('/foods', authenticateToken, async (req, res) => {
  const { name, brand, serving_size_g, nutrients, source = 'user', category_id } = req.body;

  if (!name || !serving_size_g || !nutrients || typeof nutrients !== 'object') {
    return res.status(400).json({ message: 'Missing or invalid fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO foods (name, brand, serving_size_g, nutrients, source, created_at, category_id)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       RETURNING *`,
      [name, brand, serving_size_g, nutrients, source, category_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add food error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});