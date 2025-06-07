const express = require('express');
const router = express.Router();
const pool = require('../db'); // your PostgreSQL pool
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, async (req, res) => {
  const user_id = req.user.id; // this comes from the decoded token

  const {
    food_id,
    quantity,
    unit,
    date,
    meal_type,
    meal_type_id
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO food_logs 
        (user_id, food_id, quantity, unit, date, meal_type, meal_type_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [user_id, food_id, quantity, unit, date, meal_type, meal_type_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error inserting food log:', err);
    res.status(500).json({ message: 'Server error adding food log' });
  }
});

module.exports = router;
