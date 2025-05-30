const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth");

// PATCH /api/users/update-profile
router.patch("/update-profile", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { sex, height, weight, birthday, activity_level_id, physiological_state } = req.body;

  const validOptions = ["male", "female"];
  const validStates = ["none", "pregnant", "breastfeeding", "menopause"];
  const validActivityLevels = [
    "Sedentary (office job)",
    "Light Exercise (1-2 days/week)",
    "Moderate Exercise (3-5 days/week)",
    "Heavy Exercise (6-7 days/week)",
    "Athlete (2x per day)",
  ];
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

module.exports = router;
