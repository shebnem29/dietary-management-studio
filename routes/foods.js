const express = require('express');
const router = express.Router();
const pool = require('../db'); // Your PostgreSQL connection
const { authenticateToken } = require('../middleware/auth');
router.get('/list-all-foods', authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'content') {
    return res.status(403).json({ message: 'Only content managers can view foods' });
  }

  const sort = req.query.sort || ''; // 'name', 'protein', 'carbs', 'fat'

  // Base query
  const search = req.query.search?.toLowerCase() || '';
let baseQuery = 'SELECT * FROM foods';
let params = [];

if (search) {
  baseQuery += ' WHERE LOWER(name) LIKE $1';
  params.push(`%${search}%`);
}

// Add sorting
if (sort === 'name') {
  baseQuery += ' ORDER BY name ASC';
} else if (['protein', 'carbs', 'fat'].includes(sort)) {
  baseQuery += ` ORDER BY (nutrients->>'${getNutrientKey(sort)}')::float DESC`;
} else {
  baseQuery += ' ORDER BY id DESC';
}

  try {
    const result = await pool.query(baseQuery);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching foods:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function getNutrientKey(sortKey) {
  switch (sortKey) {
    case 'protein':
      return 'Protein';
    case 'carbs':
      return 'Carbohydrate, by difference';
    case 'fat':
      return 'Total lipid (fat)';
    default:
      return '';
  }
}

// UPDATE a food by ID (content managers only)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, brand, serving_size_g } = req.body;
  const requesterRole = req.user?.role;

  if (requesterRole !== 'content') {
    return res.status(403).json({ message: 'Only content managers can update foods' });
  }

  try {
    const result = await pool.query(
      `UPDATE public.foods
       SET name = $1, brand = $2, serving_size_g = $3
       WHERE id = $4 RETURNING *`,
      [name, brand, serving_size_g, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Food not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating food:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE a food by ID
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
 const requesterRole = req.user?.role;

  if (requesterRole !== 'content') {
    return res.status(403).json({ message: 'Only content managers can update foods' });
  }
  try {
    const result = await pool.query('DELETE FROM public.foods WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Food not found' });
    }

    res.json({ message: '🗑️ Food deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error('Error deleting food:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  const { search } = req.query;

  try {
    if (!search || search.length < 2) {
      return res.status(400).json({ error: 'Search query too short' });
    }

   const result = await pool.query(
  `SELECT id, name, nutrients, serving_size_g FROM foods WHERE LOWER(name) LIKE LOWER($1) ORDER BY name LIMIT 20`,
  [`%${search}%`]
);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching foods:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`SELECT id, name, nutrients, serving_size_g FROM foods WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Food not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching food by ID:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
