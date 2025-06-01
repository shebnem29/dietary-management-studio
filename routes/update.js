const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// PATCH - Update user name or email
router.patch('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { name, email } = req.body;

  if (!name && !email) {
    return res.status(400).json({ message: 'Nothing to update' });
  }

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }

    if (email) {
      fields.push(`email = $${idx++}`);
      values.push(email);
    }

    values.push(userId);

    const updateQuery = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`;
    await db.query(updateQuery, values);

    res.status(200).json({ message: 'Account details updated successfully' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
