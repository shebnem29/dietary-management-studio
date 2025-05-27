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
router.get('/:id/ingredients', async (req, res) => {
    const recipeId = req.params.id;
    try {
      const query = `
        SELECT i.name, ri.original, ri.amount, ri.unit
        FROM recipe_ingredients ri
        JOIN ingredients i ON ri.ingredient_id = i.id
        WHERE ri.recipe_id = $1
      `;
      const { rows } = await db.query(query, [recipeId]);
      console.log(rows)
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch ingredients' });
    }
  });
module.exports = router;
