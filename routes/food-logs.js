const express = require('express');
const router = express.Router();
const pool = require('../db'); // your PostgreSQL pool
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, async (req, res) => {
  const user_id = req.user.id;
  const {
    food_id,
    quantity,
    unit,
    date,
    meal_type,
    meal_type_id
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insert into food_logs
    const foodLogResult = await client.query(
      `INSERT INTO food_logs 
        (user_id, food_id, quantity, unit, date, meal_type, meal_type_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [user_id, food_id, quantity, unit, date, meal_type, meal_type_id]
    );

    const log = foodLogResult.rows[0];

    // 2. Get nutrients JSON and serving size from foods table
    const foodResult = await client.query(
      `SELECT nutrients, serving_size_g FROM foods WHERE id = $1`,
      [food_id]
    );

    const food = foodResult.rows[0];
    if (!food) throw new Error("Food not found");

    const { nutrients, serving_size_g } = food;
    const unitValue = parseFloat(unit); // ✅ Convert "100 g" or "1 g" to a number
const servingSizeG = serving_size_g || 100;
const totalGrams = quantity * unitValue; // ✅ calculate total grams
const multiplier = totalGrams / servingSizeG; // ✅ accurate for all units

    // 3. Extract macros from nutrients JSON
    const protein = (nutrients?.["Protein"]?.value || 0) * multiplier;
    const carbs = (nutrients?.["Carbohydrate, by difference"]?.value || 0) * multiplier;
    const fat = (nutrients?.["Total lipid (fat)"]?.value || 0) * multiplier;
    const calories = (carbs * 4) + (protein * 4) + (fat * 9);

    // 4. Upsert into daily_summaries
    await client.query(
      `
      INSERT INTO daily_summaries (user_id, date, calories, protein, carbs, fat)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        calories = daily_summaries.calories + EXCLUDED.calories,
        protein = daily_summaries.protein + EXCLUDED.protein,
        carbs = daily_summaries.carbs + EXCLUDED.carbs,
        fat = daily_summaries.fat + EXCLUDED.fat,
        updated_at = NOW()
      `,
      [user_id, date, calories, protein, carbs, fat]
    );

    await client.query('COMMIT');

    res.status(201).json(log);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error logging food and updating summary:', err);
    res.status(500).json({ message: 'Server error adding food log' });
  } finally {
    client.release();
  }
});

router.get('/', authenticateToken, async (req, res) => {
  const user_id = req.user.id;

  try {
let requestedDate = req.query.date;
if (!requestedDate) {
  requestedDate = new Date().toISOString().split('T')[0];
}
console.log("🔍 Requested date:", requestedDate);
    const result = await pool.query(
      `
      SELECT
        fl.id,
        fl.meal_type,
        fl.quantity,
        fl.unit,
        fl.date,
        f.name AS food_name,
        f.nutrients,
        f.serving_size_g
      FROM food_logs fl
      JOIN foods f ON fl.food_id = f.id
      WHERE fl.user_id = $1 AND fl.date = $2
      ORDER BY fl.meal_type, fl.created_at
      `,
      [user_id, requestedDate]
    );

    const logsWithCalories = result.rows.map((row) => {
      let nutrients = row.nutrients;
      if (typeof nutrients === 'string') {
        try {
          nutrients = JSON.parse(nutrients);
        } catch (err) {
          nutrients = {};
        }
      }

      const quantity = parseFloat(row.quantity);
      const unitGrams = parseFloat(row.unit); // '1 g' → 1, '100 g' → 100
      const baseServing = row.serving_size_g || 100;

      const totalGrams = quantity * unitGrams;
      const multiplier = totalGrams / baseServing;

      const protein = (nutrients['Protein']?.value || 0) * multiplier;
      const fat = (nutrients['Total lipid (fat)']?.value || 0) * multiplier;
      const carbs = (nutrients['Carbohydrate, by difference']?.value || 0) * multiplier;
      const calories = (protein * 4) + (carbs * 4) + (fat * 9);

      return {
        id: row.id,
        meal_type: row.meal_type,
        quantity,
        unit: row.unit,
        date: row.date,
        food_name: row.food_name,
        calories,
        protein,
        carbs,
        fat
      };
    });

    res.json(logsWithCalories);
  } catch (err) {
    console.error('❌ Error fetching food logs:', err);
    res.status(500).json({ message: 'Server error fetching food logs' });
  }
});
router.delete('/:id', authenticateToken, async (req, res) => {
  const user_id = req.user.id;
  const logId = req.params.id;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get the food log to be deleted
    const logRes = await client.query(
      `
      SELECT fl.*, f.nutrients, f.serving_size_g
      FROM food_logs fl
      JOIN foods f ON fl.food_id = f.id
      WHERE fl.id = $1 AND fl.user_id = $2
      `,
      [logId, user_id]
    );

    const log = logRes.rows[0];
    if (!log) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Food log not found' });
    }

    // 2. Calculate nutrition
    let nutrients = log.nutrients;
    if (typeof nutrients === 'string') {
      nutrients = JSON.parse(nutrients);
    }

    const quantity = parseFloat(log.quantity);
    const unitGrams = parseFloat(log.unit);
    const baseServing = log.serving_size_g || 100;
    const totalGrams = quantity * unitGrams;
    const multiplier = totalGrams / baseServing;

    const protein = (nutrients['Protein']?.value || 0) * multiplier;
    const fat = (nutrients['Total lipid (fat)']?.value || 0) * multiplier;
    const carbs = (nutrients['Carbohydrate, by difference']?.value || 0) * multiplier;
    const calories = (protein * 4) + (carbs * 4) + (fat * 9);

    // 3. Subtract from daily_summaries
    await client.query(
      `
      UPDATE daily_summaries
      SET
        calories = GREATEST(calories - $1, 0),
        protein = GREATEST(protein - $2, 0),
        carbs = GREATEST(carbs - $3, 0),
        fat = GREATEST(fat - $4, 0),
        updated_at = NOW()
      WHERE user_id = $5 AND date = $6
      `,
      [calories, protein, carbs, fat, user_id, log.date]
    );

    // 4. Delete the log
    await client.query('DELETE FROM food_logs WHERE id = $1 AND user_id = $2', [logId, user_id]);

    await client.query('COMMIT');
    res.status(200).json({ message: 'Food log deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error deleting food log:', err);
    res.status(500).json({ message: 'Server error deleting food log' });
  } finally {
    client.release();
  }
});

router.get('/nutrients-summary', authenticateToken, async (req, res) => {
  const user_id = req.user.id;
  const requestedDate = req.query.date || new Date().toISOString().split('T')[0];

  try {
    const result = await pool.query(
      `
      SELECT
        fl.quantity,
        fl.unit,
        f.nutrients,
        f.serving_size_g
      FROM food_logs fl
      JOIN foods f ON fl.food_id = f.id
      WHERE fl.user_id = $1 AND fl.date = $2
      `,
      [user_id, requestedDate]
    );

    const summary = {};

    result.rows.forEach(row => {
      let nutrients = row.nutrients;
      if (typeof nutrients === 'string') {
        try {
          nutrients = JSON.parse(nutrients);
        } catch {
          nutrients = {};
        }
      }

      const quantity = parseFloat(row.quantity);
      const unitGrams = parseFloat(row.unit); // e.g., 100 from '100 g'
      const baseServing = row.serving_size_g || 100;
      const totalGrams = quantity * unitGrams;
      const multiplier = totalGrams / baseServing;

      for (const [nutrient, { value, unit }] of Object.entries(nutrients || {})) {
        if (!summary[nutrient]) {
          summary[nutrient] = { value: 0, unit };
        }
        summary[nutrient].value += (value || 0) * multiplier;
      }
    });

    // Round all values for cleaner display
    for (const nutrient in summary) {
      summary[nutrient].value = parseFloat(summary[nutrient].value.toFixed(3));
    }

    res.json(summary);
  } catch (err) {
    console.error('❌ Error building nutrient summary:', err);
    res.status(500).json({ message: 'Server error generating nutrient summary' });
  }
});

module.exports = router;
