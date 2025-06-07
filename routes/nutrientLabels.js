const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT nc.name AS category, nl.name, nl.unit
      FROM nutrient_labels nl
      JOIN nutrient_categories nc ON nl.category_id = nc.id
      ORDER BY nc.name, nl.name
    `);

    // Group by category
    const grouped = result.rows.reduce((acc, row) => {
      if (!acc[row.category]) acc[row.category] = [];
      acc[row.category].push({ name: row.name, unit: row.unit });
      return acc;
    }, {});

    res.json(grouped);
  } catch (err) {
    console.error('Error fetching nutrient labels:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
