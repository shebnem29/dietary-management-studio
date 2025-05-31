const express = require("express");
const router = express.Router();
const db = require("../db");
const {authMiddleware} = require("../middleware/auth");
// POST or PATCH - save user preference
router.patch("/", authMiddleware, async (req, res) => {
  const { protein_ratio, fat_ratio, carb_ratio } = req.body;
  const userId = req.user.id;

  if (protein_ratio + fat_ratio + carb_ratio !== 1) {
    return res.status(400).json({ message: "Macros must total 100%" });
  }

  try {
    await db.query(
      `INSERT INTO user_macros (user_id, protein_ratio, fat_ratio, carb_ratio)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET protein_ratio = EXCLUDED.protein_ratio,
           fat_ratio = EXCLUDED.fat_ratio,
           carb_ratio = EXCLUDED.carb_ratio`,
      [userId, protein_ratio, fat_ratio, carb_ratio]
    );

    res.json({ message: "Macro preferences saved" });
  } catch (err) {
    console.error("Macro save error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET - fetch user's macro preference
router.get("/", authMiddleware, async (req, res) => {
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
