const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const sgMail = require('@sendgrid/mail');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;;
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

router.post('/register', async (req, res) => {
    const { name, email, password, tipsOptIn } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const existingUser = result.rows[0];

        // 🔁 If user already exists
        if (existingUser) {
            if (existingUser.verified) {
                return res.status(400).json({ message: 'Email already registered' });
            } else {
                // 🔁 Resend verification code
                const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
                await db.query('UPDATE users SET email_verification_code = $1 WHERE email = $2', [newVerificationCode, email]);

                await sgMail.send({
                    to: email,
                    from: 'snacksmartapp@gmail.com',
                    templateId: process.env.SENDGRID_TEMPLATE_ID,
                    dynamic_template_data: {
                        name: existingUser.name,
                        code: newVerificationCode
                    },
                });

                return res.status(200).json({ message: 'User already registered but not verified. New verification code sent.' });
            }
        }

        // 🆕 Register new user
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        await db.query(
            'INSERT INTO users (name, email, password, tips_opt_in, email_verification_code) VALUES ($1, $2, $3, $4, $5)',
            [name, email, hashedPassword, tipsOptIn || false, verificationCode]
        );

        await sgMail.send({
            to: email,
            from: 'snacksmartapp@gmail.com',
            templateId: process.env.SENDGRID_TEMPLATE_ID,
            dynamic_template_data: {
                name,
                code: verificationCode
            },
        });

        res.status(201).json({ message: 'User registered. Please verify your email.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.sex, u.birthday, u.height, u.weight, u.activity_level_id,
         g.goal_weight, g.weekly_rate_kg,
         m.protein_ratio
  FROM users u
  LEFT JOIN user_goals g ON u.id = g.user_id
  LEFT JOIN user_macros m ON u.id = m.user_id
  WHERE u.email = $1
`, [email]);

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

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({
      token,
      sex: user.sex,
      birthday: user.birthday,
      height: user.height,
      weight: user.weight,
  activity_level_id: user.activity_level_id, 
      physiological_state: user.physiological_state,
       goal_weight: user.goal_weight,
  weekly_rate_kg: user.weekly_rate_kg,
  macro_set:
    user.protein_ratio !== null &&
    user.fat_ratio !== null &&
    user.carb_ratio !== null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;

    try {
        const result = await db.query('SELECT email_verification_code FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.email_verification_code === code) {
            await db.query('UPDATE users SET verified = true, email_verification_code = NULL WHERE email = $1', [email]);
            return res.status(200).json({ message: '✅ Email verified!' });
        } else {
            return res.status(400).json({ message: '❌ Invalid verification code' });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});
router.post('/resend-code', async (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1 AND verified = false', [email]);
        const user = result.rows[0];
        if (!user) return res.status(404).json({ message: 'User not found or already verified' });

        await db.query('UPDATE users SET email_verification_code = $1 WHERE email = $2', [code, email]);

        await sgMail.send({
            to: email,
            from: 'snacksmartapp@gmail.com',
            templateId: process.env.SENDGRID_TEMPLATE_ID,
            dynamic_template_data: {
                name: user.name,
                code
            },
        });

        res.status(200).json({ message: 'Verification code resent.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});
module.exports = router;
