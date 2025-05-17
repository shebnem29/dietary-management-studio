// routes/recipes.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all recipes or filter by category
router.get('/', async (req, res) => {
    const { category } = req.query;

    try {
        let result;

        if (category) {
            result = await db.query(
                `
       SELECT recipes.*
FROM recipes
JOIN recipe_categories ON recipes.id = recipe_categories.recipe_id
JOIN categories ON recipe_categories.category_id = categories.id
WHERE categories.name = $1
        `,
                [category]
            );
        } else {
            result = await db.query('SELECT * FROM recipes ORDER BY id DESC');
        }

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching recipes:', err);
        res.status(500).json({ error: 'Failed to fetch recipes' });
    }
});

module.exports = router;
