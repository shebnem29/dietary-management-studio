const express = require('express');
const router = express.Router();
const pool = require('../db'); // PostgreSQL pool

router.get('/', async (req, res) => {
  const { category } = req.query;

  try {
    const result = await pool.query(
      `
      SELECT nl.id, nl.name, nl.unit
      FROM nutrient_labels nl
      JOIN nutrient_categories nc ON nl.category_id = nc.id
      WHERE nc.name = $1
      ORDER BY nl.name ASC
      `,
      [category]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching nutrient labels:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
