const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken } = require('../middleware/auth');

// PATCH /api/user/preferences
router.patch("/", authenticateToken, async (req, res) => {
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
    await client.query("DELETE FROM user_favorite_cuisines WHERE user_id = $1", [userId]);
    for (const cuisineId of cuisine_ids || []) {
      await client.query("INSERT INTO user_favorite_cuisines (user_id, cuisine_id) VALUES ($1, $2)", [userId, cuisineId]);
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
router.get("/", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const [dietRes, allergyRes, cuisineRes] = await Promise.all([
      db.query(`SELECT diet_category_id FROM user_preferences WHERE user_id = $1`, [userId]),
      db.query(`SELECT allergen_id FROM user_allergies WHERE user_id = $1`, [userId]),
      db.query(`SELECT cuisine_id FROM user_favorite_cuisines WHERE user_id = $1`, [userId]),
    ]);

    res.status(200).json({
      diet_category_id: dietRes.rows[0]?.diet_category_id || null,
      allergen_ids: allergyRes.rows.map((r) => r.allergen_id),
      cuisine_ids: cuisineRes.rows.map((r) => r.cuisine_id),
    });
  } catch (err) {
    console.error("Error fetching preferences:", err);
    res.status(500).json({ message: "Failed to fetch preferences." });
  }
});
module.exports = router;
