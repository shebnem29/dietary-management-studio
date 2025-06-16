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
module.exports = router;
