const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth"); // if you have this

// PATCH /api/users/update-profile
router.patch("/update-profile", authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { sex, height } = req.body;
  
    const validSexOptions = ["Male", "Female", "Pregnant", "Breastfeeding"];
    if (sex && !validSexOptions.includes(sex)) {
      return res.status(400).json({ message: "Invalid sex option" });
    }
  
    if (height && (typeof height !== "number" || height < 50 || height > 300)) {
      return res.status(400).json({ message: "Invalid height value" });
    }
  
    try {
      const updates = [];
      const values = [];
      let index = 1;
  
      if (sex) {
        updates.push(`sex = $${index++}`);
        values.push(sex);
      }
  
      if (height) {
        updates.push(`height = $${index++}`);
        values.push(height);
      }
  
      if (updates.length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
  
      values.push(userId);
      const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $${index}`;
      await db.query(query, values);
  
      res.json({ message: "Profile updated successfully" });
    } catch (err) {
      console.error("Update Profile Error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  

module.exports = router;
