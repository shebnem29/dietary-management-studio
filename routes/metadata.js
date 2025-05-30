const express = require("express");
const router = express.Router();
const db = require("../db");

// GET /api/metadata/activity-levels
router.get("/activity-levels", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, label, value, description, example FROM activity_levels ORDER BY id"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching activity levels:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
