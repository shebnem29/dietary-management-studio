const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");
router.get('/stats/user-growth', authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'super') {
    return res.status(403).json({ message: 'Only super admins can view user growth data' });
  }

  const groupBy = req.query.groupBy || 'week'; // default to week
  const validGroups = ['week', 'month', 'year'];

  if (!validGroups.includes(groupBy)) {
    return res.status(400).json({ message: 'Invalid groupBy value' });
  }

  try {
    const result = await db.query(`
      SELECT 
        DATE_TRUNC('${groupBy}', created_at) AS period,
        COUNT(*) AS user_count
      FROM users
      GROUP BY period
      ORDER BY period ASC;
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching user growth:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/stats/sex-distribution', authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'super') {
    return res.status(403).json({ message: 'Only super admins can view sex distribution' });
  }

  try {
    const result = await db.query(`
      SELECT sex, COUNT(*) AS count
      FROM users
      WHERE sex IS NOT NULL
      GROUP BY sex;
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sex distribution:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/stats/average-bmi', authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'super') {
    return res.status(403).json({ message: 'Only super admins can view average BMI' });
  }

  const groupBy = req.query.groupBy || 'week'; // 'week', 'month', or 'year'
  const validGroups = ['week', 'month', 'year'];

  if (!validGroups.includes(groupBy)) {
    return res.status(400).json({ message: 'Invalid groupBy value' });
  }

  try {
    const result = await db.query(`
      SELECT 
        DATE_TRUNC($1, created_at) AS period,
        ROUND(AVG(bmi)::numeric, 2) AS average_bmi
      FROM user_stats
      WHERE bmi IS NOT NULL
      GROUP BY period
      ORDER BY period;
    `, [groupBy]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching average BMI:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// POST /api/users/ping
router.post('/ping', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    await db.query(
      'UPDATE users SET last_active_at = NOW() WHERE id = $1',
      [userId]
    );
    res.json({ message: 'Activity updated' });
  } catch (err) {
    console.error('Error updating activity', err);
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;
