// routes/categories.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM public.categories'); // force schema
      console.log('Fetched categories:', result.rows); // Log to Render logs
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching categories:', err); // This will show up in logs
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
// UPDATE a category by ID (only for content managers)
router.put('/:id', authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'content') {
    return res.status(403).json({ message: 'Only content managers can update categories' });
  }

  const { id } = req.params;
  const { name } = req.body;

  try {
    const result = await pool.query(
      'UPDATE public.categories SET name = $1 WHERE id = $2 RETURNING *',
      [name, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE a category by ID (only for content managers)
router.delete('/:id', authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'content') {
    return res.status(403).json({ message: 'Only content managers can delete categories' });
  }

  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM public.categories WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully', category: result.rows[0] });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
module.exports = router;
