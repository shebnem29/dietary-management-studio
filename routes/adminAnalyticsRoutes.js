const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");
router.get('/food-log-frequency', authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'super') {
    return res.status(403).json({ message: 'Only super admins can access food log frequency' });
  }

  try {
    const result = await db.query(`
      SELECT 
        f.id AS food_id,
        f.name AS food_name,
        COUNT(*) AS log_count
      FROM food_logs fl
      JOIN foods f ON fl.food_id = f.id
      GROUP BY f.id, f.name
      ORDER BY log_count DESC;
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching food log frequency:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// POST /api/track-feature
router.post('/track-feature', authenticateToken, async (req, res) => {
  const { feature } = req.body;
  const userId = req.user.id;

  if (!feature) return res.status(400).json({ message: 'Feature is required' });

  try {
    await db.query(`
      INSERT INTO feature_usage_logs (user_id, feature)
      VALUES ($1, $2)
    `, [userId, feature]);

    res.status(200).json({ message: 'Feature tracked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to track feature' });
  }
});

router.get('/feature-usage-breakdown', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        feature,
        COUNT(DISTINCT user_id) AS user_count
      FROM feature_usage_logs
      GROUP BY feature
    `);

    // Get total user count
    const totalUsersResult = await db.query(`SELECT COUNT(*) FROM users`);
    const totalUsers = parseInt(totalUsersResult.rows[0].count);

    const result = rows.map(row => ({
      feature: row.feature,
      percentage: ((row.user_count / totalUsers) * 100).toFixed(1), // e.g., 75.0%
    }));

    res.json(result);
  } catch (err) {
    console.error("Error fetching usage breakdown:", err);
    res.status(500).json({ message: "Failed to fetch breakdown" });
  }
});


module.exports = router;
