const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth");

router.patch("/weight", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { goal_weight } = req.body;

  if (!goal_weight || typeof goal_weight !== "number" || goal_weight <= 0) {
    return res.status(400).json({ message: "Invalid goal weight" });
  }

  try {
    await db.query(
      "INSERT INTO user_goals (user_id, goal_weight) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET goal_weight = EXCLUDED.goal_weight",
      [userId, goal_weight]
    );

    res.json({ message: "Goal weight updated successfully" });
  } catch (err) {
    console.error("Goal Weight Update Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
