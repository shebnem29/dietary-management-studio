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
router.get('/last-body-metrics', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await db.query(
      `SELECT bmi, body_fat, created_at
       FROM user_stats
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No body metrics found for user' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching last body metrics:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;
