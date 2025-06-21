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
router.get('/food-categories', authenticateToken, async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM food_categories'); // force schema
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching categories:', err); // This will show up in logs
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
router.post('/import-usda', authenticateToken, async (req, res) => {
  const requesterRole = req.user?.role;
  if (requesterRole !== 'content') {
    return res.status(403).json({ message: 'Only content managers can import foods' });
  }

  const { fdcIds } = req.body;
  if (!Array.isArray(fdcIds) || fdcIds.length === 0) {
    return res.status(400).json({ message: 'Missing or invalid fdcIds array' });
  }

  let importedCount = 0;

  try {
    for (const fdcId of fdcIds) {
      const usdaRes = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${USDA_API_KEY}`);
      const foodData = await usdaRes.json();

      if (!usdaRes.ok || !foodData.description) {
        console.warn(`Skipping FDC ID ${fdcId} due to invalid response`);
        continue;
      }

     const nutrients = {};
for (const item of foodData.foodNutrients || []) {
  const name = item.nutrient?.name;
  const value = item.amount;
  const unit = item.nutrient?.unitName;

  if (name && value !== null && value !== undefined) {
    nutrients[name] = { value, unit };
  }
}
    

    await pool.query(
  `INSERT INTO foods (name, brand, serving_size_g, nutrients, source, created_at, category_id)
   VALUES ($1, $2, $3, $4, $5, NOW(), NULL)`,
  [foodData.description, foodData.brandOwner || '', 100, nutrients, 'usda']
);

      importedCount++;
    }

    res.json({ message: 'Import complete', importedCount });
  } catch (err) {
    console.error('USDA import error:', err);
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
router.get('/:id', authenticateToken,  async (req, res) => {
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
