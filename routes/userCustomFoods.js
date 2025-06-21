const express = require('express');
const router = express.Router();
const pool = require('../db'); // Your PostgreSQL connection
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config();

router.post('/', authenticateToken, async (req, res) => {
  const { name, brand, serving_size_g, nutrients, source = 'user', category_id } = req.body;
  const user_id = req.user.id; // ⬅️ Grab the authenticated user ID

  if (!name || !serving_size_g || !nutrients || typeof nutrients !== 'object') {
    return res.status(400).json({ message: 'Missing or invalid fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO foods (name, brand, serving_size_g, nutrients, source, created_at, category_id, user_id)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
       RETURNING *`,
      [name, brand, serving_size_g, nutrients, source, category_id || null, user_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add food error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.get('/', authenticateToken, async (req, res) => {
  const user_id = req.user.id;

  try {
    const result = await pool.query(
      `SELECT * FROM foods
       WHERE source = 'user' AND user_id = $1
       ORDER BY created_at DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching custom foods:', err);
    res.status(500).json({ message: 'Failed to fetch custom foods' });
  }
});
module.exports = router;
