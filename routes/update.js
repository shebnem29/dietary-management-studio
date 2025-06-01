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
router.patch('/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const userRes = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const user = userRes.rows[0];

    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNew, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;
