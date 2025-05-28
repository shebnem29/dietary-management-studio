const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth");

router.patch("/update-profile", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { sex, birthday } = req.body;

  const validOptions = ["Male", "Female", "Pregnant", "Breastfeeding"];
  if (!validOptions.includes(sex)) {
    return res.status(400).json({ message: "Invalid sex option" });
  }

  if (birthday && isNaN(Date.parse(birthday))) {
    return res.status(400).json({ message: "Invalid birthday format" });
  }

  try {
    await db.query(
      "UPDATE users SET sex = $1, birthday = $2 WHERE id = $3",
      [sex, birthday || null, userId]
    );

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;