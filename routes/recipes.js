// routes/recipes.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
router.get('/list-all-recipes', authenticateToken, async (req, res) => {
   const requesterRole = req.user?.role;
  if (requesterRole !== 'content') {
    return res.status(403).json({ message: 'Only content managers can search foods' });
  }
  try {
    const query = `
      SELECT 
        r.id,
        r.title,
        r.image,
        r.summary,
        r.ready_in_minutes,
        r.servings,
        r.price_per_serving,
        r.health_score,

        (
          SELECT string_agg(ri.original, ', ')
          FROM recipe_ingredients ri
          WHERE ri.recipe_id = r.id
        ) AS ingredients,

        (
          SELECT string_agg(i.description, E'\n')
          FROM instructions i
          WHERE i.recipe_id = r.id
        ) AS instructions,

        (
          SELECT json_object_agg(n.name, json_build_object('amount', n.amount, 'unit', n.unit))
          FROM nutrients n
          WHERE n.recipe_id = r.id
        ) AS nutrients

      FROM recipes r
      ORDER BY r.id DESC
    `;

    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching full recipe list:', err);
    res.status(500).json({ error: 'Failed to fetch full recipe list' });
  }
});
// GET all recipes or filter by category
router.get('/', async (req, res) => {
    const { category } = req.query;

    try {
        let result;

        // Build base query with joins to get cuisines and allergens
        let query = `
            SELECT 
                r.*, 
                COALESCE(json_agg(DISTINCT rc.cuisine_id) FILTER (WHERE rc.cuisine_id IS NOT NULL), '[]') AS cuisine_ids,
                COALESCE(json_agg(DISTINCT ia.allergen_id) FILTER (WHERE ia.allergen_id IS NOT NULL), '[]') AS allergen_ids
            FROM recipes r
            LEFT JOIN recipe_cuisines rc ON r.id = rc.recipe_id
            LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
            LEFT JOIN ingredient_allergens ia ON ri.ingredient_id = ia.ingredient_id
        `;

        const values = [];

        // If category is passed, add filtering JOINs
        if (category) {
            query += `
                JOIN recipe_categories rcat ON r.id = rcat.recipe_id
                JOIN categories c ON rcat.category_id = c.id
                WHERE c.name = $1
            `;
            values.push(category);
        }

        query += `
            GROUP BY r.id
            ORDER BY r.id DESC
        `;

        result = await db.query(query, values);

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
  // GET instructions by recipe ID
router.get('/:id/instructions', async (req, res) => {
    const recipeId = req.params.id;
  
    try {
      const query = `
        SELECT step_number, description
        FROM instructions
        WHERE recipe_id = $1
        ORDER BY step_number ASC
      `;
      const { rows } = await db.query(query, [recipeId]);
      res.json(rows);
    } catch (err) {
      console.error('Error fetching instructions:', err);
      res.status(500).json({ error: 'Failed to fetch instructions' });
    }
  });
  
module.exports = router;
