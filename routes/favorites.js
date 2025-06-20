const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// 🔐 GET all favorites for current user
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(`
      SELECT r.id, r.title, r.image, r.ready_in_minutes, r.servings
      FROM favorites f
      JOIN recipes r ON f.recipe_id = r.id
      WHERE f.user_id = $1
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch favorites:', err);
    res.status(500).json({ message: 'Failed to fetch favorites' });
  }
});

// ❤️ POST add to favorites
router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { recipeId } = req.body;

  if (!recipeId) {
    return res.status(400).json({ message: 'recipeId is required' });
  }

  try {
    await db.query(`
      INSERT INTO favorites (user_id, recipe_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, recipe_id) DO NOTHING
    `, [userId, recipeId]);

    res.status(201).json({ message: 'Recipe favorited' });
  } catch (err) {
    console.error('Failed to add favorite:', err);
    res.status(500).json({ message: 'Failed to add favorite' });
  }
});

// 💔 DELETE remove from favorites
router.delete('/:recipeId', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const recipeId = req.params.recipeId;

  try {
    const result = await db.query(`
      DELETE FROM favorites
      WHERE user_id = $1 AND recipe_id = $2
    `, [userId, recipeId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Favorite not found' });
    }

    res.json({ message: 'Favorite removed' });
  } catch (err) {
    console.error('Failed to remove favorite:', err);
    res.status(500).json({ message: 'Failed to remove favorite' });
  }
});

// ❓ GET check if favorited
router.get('/:recipeId', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const recipeId = req.params.recipeId;

  try {
    const result = await db.query(`
      SELECT 1 FROM favorites
      WHERE user_id = $1 AND recipe_id = $2
    `, [userId, recipeId]);

    res.json({ isFavorited: result.rowCount > 0 });
  } catch (err) {
    console.error('Failed to check favorite:', err);
    res.status(500).json({ message: 'Failed to check favorite' });
  }
});

module.exports = router;