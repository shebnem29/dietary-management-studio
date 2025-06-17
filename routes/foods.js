const express = require('express');
const router = express.Router();
const pool = require('../db'); // Your PostgreSQL connection
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config();

const USDA_API_KEY = process.env.USDA_API_KEY;
console.log(USDA_API_KEY)
router.get('/list-all-foods', authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'content') {
    return res.status(403).json({ message: 'Only content managers can view foods' });
  }

  const sort = req.query.sort || '';
  const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase() : '';

  let baseQuery = 'SELECT * FROM foods';
  const params = [];

  if (search) {
    baseQuery += ' WHERE LOWER(name) LIKE $1';
    params.push(`%${search}%`);
  }

  if (sort === 'name') {
    baseQuery += ' ORDER BY name ASC';
  }

  try {
    const result = await pool.query(baseQuery, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching foods:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/search', authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'content') {
    return res.status(403).json({ message: 'Only content managers can search foods' });
  }

  const query = req.query.q;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ message: 'Missing or invalid search query' });
  }

  try {
    const usdaRes = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=10&api_key=${USDA_API_KEY}`
    );
    const data = await usdaRes.json();

    if (!usdaRes.ok) {
      return res.status(500).json({ message: 'USDA API error', detail: data });
    }

    // Optionally simplify the result here
    const simplified = data.foods.map(food => ({
      fdcId: food.fdcId,
      description: food.description,
      brandName: food.brandName,
      servingSize: food.servingSize,
      servingSizeUnit: food.servingSizeUnit,
      nutrients: food.foodNutrients?.map(n => ({
        name: n.nutrientName,
        amount: n.value,
        unit: n.unitName,
      }))
    }));

    res.json(simplified);
  } catch (err) {
    console.error('USDA search error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
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
module.exports = router;
