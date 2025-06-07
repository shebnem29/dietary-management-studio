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

module.exports = router;
