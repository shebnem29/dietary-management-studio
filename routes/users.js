const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth"); // if you have this

// PATCH /api/users/update-profile
router.patch("/update-profile", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { sex, height } = req.body;

  const validOptions = ["Male", "Female", "Pregnant", "Breastfeeding"];
  if (sex && !validOptions.includes(sex)) {
    return res.status(400).json({ message: "Invalid sex option" });
  }

  if (height && (typeof height !== "number" || height <= 0)) {
    return res.status(400).json({ message: "Invalid height value" });
  }

  try {
    const fields = [];
    const values = [];
    let i = 1;

    if (sex) {
      fields.push(`sex = $${i++}`);
      values.push(sex);
    }
    if (height) {
      fields.push(`height = $${i++}`);
      values.push(height);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    values.push(userId); // For WHERE clause
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}`;
    await db.query(query, values);

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router; 