const express = require('express');
const router = express.Router();
const pool = require('../db'); // Your PostgreSQL connection

router.get('/', async (req, res) => {
  const { search } = req.query;

  try {
    if (!search || search.length < 2) {
      return res.status(400).json({ error: 'Search query too short' });
    }

   const result = await pool.query(
  `SELECT id, name, nutrients, serving_size_g FROM foods WHERE LOWER(name) LIKE LOWER($1) ORDER BY name LIMIT 20`,
  [`%${search}%`]
);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching foods:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`SELECT id, name, nutrients, serving_size_g FROM foods WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Food not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching food by ID:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
router.get('/list-all-foods', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM foods ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching foods:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
