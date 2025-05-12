const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

const JWT_SECRET = '8aD2&hK!vRz9$Tg5@wLp#EwX7BvZ^L6c';

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

        res.status(201).json({ token });
    } catch (error) {
        console.error(error);
        if (error.code === '23505') { // PostgreSQL code for unique violation
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

module.exports = router;
