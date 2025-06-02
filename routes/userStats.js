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
    // Get user profile info
    const userResult = await db.query(
      'SELECT weight, height FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];
    if (!user || !user.weight || !user.height) {
      return res.status(400).json({ message: 'Incomplete user profile data' });
    }

    const heightInMeters = user.height / 100;
    const bmi = user.weight / (heightInMeters * heightInMeters);

    // Try to get optional body fat from user_stats if exists
    const statsResult = await db.query(
      `SELECT body_fat, created_at
       FROM user_stats
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    const bodyFatData = statsResult.rows[0] || {};

    res.json({
      bmi: parseFloat(bmi.toFixed(1)),
      body_fat: bodyFatData.body_fat ?? null,
      created_at: bodyFatData.created_at ?? null,
    });
  } catch (err) {
    console.error('Error fetching body metrics:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
