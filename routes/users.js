const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");

// PATCH /api/users/update-profile
router.patch("/update-profile", authenticateToken	, async (req, res) => {
  const userId = req.user.id;
  const { sex, height, weight, birthday, activity_level_id, physiological_state } = req.body;

  const validOptions = ["male", "female"];
  const validStates = ["none", "pregnant", "breastfeeding", "menopause"];

  if (sex && !validOptions.includes(sex)) {
    return res.status(400).json({ message: "Invalid sex option" });
  }

  if (physiological_state && !validStates.includes(physiological_state)) {
    return res.status(400).json({ message: "Invalid physiological state" });
  }

  if (height && (typeof height !== "number" || height <= 0)) {
    return res.status(400).json({ message: "Invalid height value" });
  }

  if (weight && (typeof weight !== "number" || weight <= 0)) {
    return res.status(400).json({ message: "Invalid weight value" });
  }

  if (birthday) {
    const date = new Date(birthday);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ message: "Invalid birthday value" });
    }
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
    if (weight) {
      fields.push(`weight = $${i++}`);
      values.push(weight);
    }
    if (birthday) {
      fields.push(`birthday = $${i++}`);
      values.push(birthday);
    }
    if (activity_level_id) {
      fields.push(`activity_level_id = $${i++}`);
      values.push(activity_level_id);
    }
    if (physiological_state) {
      fields.push(`physiological_state = $${i++}`);
      values.push(physiological_state);
    }
    if (fields.length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    values.push(userId);
    const query = `UPDATE users SET ${fields.join(", ")} WHERE id = $${i}`;
    await db.query(query, values);

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/me", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT sex, height, weight, birthday, activity_level_id FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    // Calculate age from birthday
    const birthDate = new Date(user.birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    res.json({
      sex: user.sex,
      height: user.height,
      weight: user.weight,
      age: age,
      activity_level_id: user.activity_level_id,
    });
  } catch (err) {
    console.error("Fetch User Profile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
module.exports = router;
