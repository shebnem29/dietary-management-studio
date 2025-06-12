const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticate = require("../middleware/auth");

// PATCH /api/user/preferences
router.patch("/", authenticate, async (req, res) => {
  const userId = req.user.id;
  const { diet_category_id, allergen_ids, cuisine_ids } = req.body;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // 1. Upsert diet preference
    await client.query(`
      INSERT INTO user_preferences (user_id, diet_category_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET diet_category_id = EXCLUDED.diet_category_id, updated_at = NOW()
    `, [userId, diet_category_id]);

    // 2. Replace user allergies
    await client.query("DELETE FROM user_allergies WHERE user_id = $1", [userId]);
    for (const allergenId of allergen_ids || []) {
      await client.query("INSERT INTO user_allergies (user_id, allergen_id) VALUES ($1, $2)", [userId, allergenId]);
    }

    // 3. Replace user cuisines
    await client.query("DELETE FROM user_cuisines WHERE user_id = $1", [userId]);
    for (const cuisineId of cuisine_ids || []) {
      await client.query("INSERT INTO user_cuisines (user_id, cuisine_id) VALUES ($1, $2)", [userId, cuisineId]);
    }

    await client.query("COMMIT");
    res.status(200).json({ message: "Preferences saved." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving preferences:", err);
    res.status(500).json({ message: "Failed to save preferences." });
  } finally {
    client.release();
  }
});

module.exports = router;
