const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");
// POST or PATCH - save user preference
// PATCH /api/user-macros
router.patch("/", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { protein_ratio, fat_ratio, carb_ratio } = req.body;

  const total = protein_ratio + fat_ratio + carb_ratio;
  if (Math.abs(total - 1) > 0.001) {
    return res.status(400).json({ message: "Macro ratios must total 100%" });
  }

  try {
    const existing = await db.query("SELECT id FROM user_macros WHERE user_id = $1", [userId]);

    if (existing.rowCount > 0) {
      await db.query(
        `UPDATE user_macros 
         SET protein_ratio = $1, fat_ratio = $2, carb_ratio = $3, updated_at = NOW() 
         WHERE user_id = $4`,
        [protein_ratio, fat_ratio, carb_ratio, userId]
      );
    } else {
      await db.query(
        `INSERT INTO user_macros (user_id, protein_ratio, fat_ratio, carb_ratio, created_at) 
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, protein_ratio, fat_ratio, carb_ratio]
      );
    }

    res.json({ message: "Macros updated" });
  } catch (err) {
    console.error("Failed to update macros:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// GET - fetch user's macro preference
router.get("/", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT protein_ratio, fat_ratio, carb_ratio FROM user_macros WHERE user_id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "No macros set" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Macro fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
