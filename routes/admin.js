// routes/admin.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db'); // PostgreSQL connection
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

require('dotenv').config(); // Ensure you have JWT_SECRET loaded

// POST /admin/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    const admin = result.rows[0];

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin not found' });
    }

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    const token = jwt.sign(
      { id: admin.id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      success: true,
      token,
      role: admin.role,
      message: 'Login successful'
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// GET all admins
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, created_at FROM admins ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching admins:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/create', authenticateToken, async (req, res) => {
  const { username, password, role } = req.body;
  const creatorRole = req.user?.role;

  // Only super admins can create new admins
  if (creatorRole !== 'super') {
    return res.status(403).json({ message: 'Unauthorized: Only super admins can create new admins' });
  }
   if (!username || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const allowedRoles = ['content', 'nutritionist'];
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ message: 'Invalid role. Only content or nutritionist allowed' });
  }

  try {
    const existing = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO admins (username, password_hash, role) VALUES ($1, $2, $3)',
      [username, hashedPassword, role]
    );

    res.status(201).json({ message: 'Admin created successfully' });
  } catch (err) {
    console.error('Error creating admin:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;
