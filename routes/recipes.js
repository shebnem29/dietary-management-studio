// routes/recipes.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all recipes
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM recipes ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

module.exports = router;
