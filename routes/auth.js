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

module.exports = router;
