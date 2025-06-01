const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// POST /api/user-stats
router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { bmi, bodyFat } = req.body;

  if (!bmi && !bodyFat) {
    return res.status(400).json({ message: 'BMI or Body Fat is required' });
  }

  try {
    await db.query(
      'INSERT INTO user_stats (user_id, bmi, body_fat) VALUES ($1, $2, $3)',
      [userId, bmi || null, bodyFat || null]
    );
    res.status(201).json({ message: 'User stats recorded' });
  } catch (err) {
    console.error('Insert user stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
