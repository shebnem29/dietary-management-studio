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

router.patch("/weekly-rate", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { weekly_rate_kg } = req.body;

  if (typeof weekly_rate_kg !== "number") {
    return res.status(400).json({ message: "Invalid weekly rate" });
  }

  try {
    // Get current and goal weight
    const userResult = await db.query(
      `SELECT u.weight, g.goal_weight
       FROM users u
       JOIN user_goals g ON u.id = g.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: "User or goal not found" });
    }

    const { weight, goal_weight } = userResult.rows[0];

    // Determine goal type
    let goalType = "maintenance";
    if (goal_weight < weight) goalType = "cut";
    else if (goal_weight > weight) goalType = "bulk";

    // Validate rate based on goal type
    if (
      (goalType === "cut" && weekly_rate_kg >= 0) ||
      (goalType === "bulk" && weekly_rate_kg <= 0) ||
      (goalType === "maintenance" && weekly_rate_kg !== 0)
    ) {
      return res.status(400).json({ message: `Invalid rate for ${goalType} goal` });
    }

    // Save to DB
    await db.query(
      `UPDATE user_goals SET weekly_rate_kg = $1 WHERE user_id = $2`,
      [weekly_rate_kg, userId]
    );

    res.json({ message: "Weekly rate updated successfully", goalType });
  } catch (err) {
    console.error("Weekly Rate Update Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
