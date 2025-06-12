const express = require("express");
const router = express.Router();
const db = require("../db");

// GET /api/metadata/activity-levels
router.get("/activity-levels", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, label, value, description, example, multiplier FROM activity_levels ORDER BY id"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching activity levels:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/macro-options", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM diet_presets");

    // Optional: return grams per 1000 kcal to front-end (or calculate later on frontend)
    const options = result.rows.map((diet) => ({
      name: diet.name,
      protein_ratio: diet.protein_ratio,
      fat_ratio: diet.fat_ratio,
      carb_ratio: diet.carb_ratio,
    }));

    res.json({ options });
  } catch (err) {
    console.error("Fetch macro presets error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/diet-types", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name FROM categories ORDER BY id"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching diet types:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/allergens", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name FROM allergens ORDER BY id"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching allergens:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/cuisines", async (req, res) => {
  try {
    const result = await db.query("SELECT id, name FROM cuisines ORDER BY name ASC");
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching cuisines:", err);
    res.status(500).json({ message: "Server error" });
  }
});
module.exports = router;
