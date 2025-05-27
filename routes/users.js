const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth"); // if you have this

// PATCH /api/users/update-profile
router.patch("/update-profile", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { sex } = req.body;

  const validOptions = ["Male", "Female", "Pregnant", "Breastfeeding"];
  if (!validOptions.includes(sex)) {
    return res.status(400).json({ message: "Invalid sex option" });
  }

  try {
    await db.query("UPDATE users SET sex = $1 WHERE id = $2", [sex, userId]);
    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
