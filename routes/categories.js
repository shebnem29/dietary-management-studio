// routes/categories.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM public.categories'); // force schema
      console.log('Fetched categories:', result.rows); // Log to Render logs
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching categories:', err); // This will show up in logs
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  

module.exports = router;
