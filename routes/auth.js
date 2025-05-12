const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const sgMail = require('@sendgrid/mail');
const router = express.Router();

const JWT_SECRET = '8aD2&hK!vRz9$Tg5@wLp#EwX7BvZ^L6c';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

router.post('/register', async (req, res) => {
    const { name, email, password, tipsOptIn } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            'INSERT INTO users (name, email, password, tips_opt_in) VALUES ($1, $2, $3, $4)',
            [name, email, hashedPassword, tipsOptIn || false]
        );

        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });
        await sgMail.send({
            to: email,
            from: 'snacksmartapp@gmail.com',
            templateId: process.env.SENDGRID_TEMPLATE_ID,
            dynamic_template_data: {
              name,
              verify_link: `https://dietary-management-studio.onrender.com/api/auth/verify?token=${token}`
            },
          });
      
          res.status(201).json({ message: 'User registered. Please verify your email.' });
      
        } catch (error) {
          console.error(error);
          if (error.code === '23505') {
            res.status(400).json({ message: 'Email already registered' });
          } else {
            res.status(500).json({ message: 'Internal server error' });
          }
        }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        if (!user.verified) {
            return res.status(403).json({ message: 'Please verify your email before logging in.' });
          }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1d' });
        res.status(200).json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});
router.get('/verify', async (req, res) => {
    const { token } = req.query;
  
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const email = decoded.email;
  
      await db.query('UPDATE users SET verified = true WHERE email = $1', [email]);
  
      res.send('✅ Email verified! You can now log in to SnackSmart.');
    } catch (err) {
      console.error(err);
      res.status(400).send('❌ Verification link is invalid or expired.');
    }
  });
  
module.exports = router;
