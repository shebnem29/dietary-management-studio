require('dotenv').config();
const axios = require('axios');
const db = require('../db');

const API_KEY = process.env.SPOONACULAR_API_KEY;

async function syncRecipes() {
  try {
    const categories = await db.query('SELECT * FROM categories');

    for (const category of categories.rows) {
      console.log(`Fetching recipes for ${category.name}...`);

      // Step 1: Fetch recipes by category
      const { data: searchData } = await axios.get(
        `https://api.spoonacular.com/recipes/complexSearch`,
        {
          params: {
            diet: category.api_param,
            number: 5,
            apiKey: API_KEY
          }
        }
      );

      for (const recipe of searchData.results) {
        // Step 2: Get full recipe details
        const { data: recipeData } = await axios.get(
          `https://api.spoonacular.com/recipes/${recipe.id}/information`,
          {
            params: { apiKey: API_KEY }
          }
        );

        // Step 3: Insert into recipes table
        const recipeInsert = await db.query(
          `INSERT INTO recipes (spoonacular_id, title, image, summary, ready_in_minutes, servings, price_per_serving, health_score, source_name, source_url, spoonacular_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (spoonacular_id) DO NOTHING RETURNING id`,
          [
            recipeData.id,
            recipeData.title,
            recipeData.image,
            recipeData.summary,
            recipeData.readyInMinutes,
            recipeData.servings,
            recipeData.pricePerServing,
            recipeData.healthScore,
            recipeData.sourceName,
            recipeData.sourceUrl,
            recipeData.spoonacularSourceUrl
          ]
        );

        const recipeId = recipeInsert.rows[0]?.id;
        if (!recipeId) continue; // skip if already exists

        // Step 4: Link to category
        await db.query(
          `INSERT INTO recipe_categories (recipe_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [recipeId, category.id]
        );

        // Step 5: Insert ingredients
        for (const ing of recipeData.extendedIngredients || []) {
          await db.query(
            `INSERT INTO ingredients (recipe_id, name, original, amount, unit, aisle, image)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [recipeId, ing.name, ing.original, ing.amount, ing.unit, ing.aisle, ing.image]
          );
        }

        // Step 6: Insert instructions
        const steps = recipeData.analyzedInstructions?.[0]?.steps || [];
        for (const step of steps) {
          await db.query(
            `INSERT INTO instructions (recipe_id, step_number, description)
             VALUES ($1, $2, $3)`,
            [recipeId, step.number, step.step]
          );
        }

        // Step 7: Insert tags
        const tags = [];
        if (recipeData.cheap) tags.push('cheap');
        if (recipeData.veryHealthy) tags.push('very_healthy');
        if (recipeData.veryPopular) tags.push('very_popular');
        if (recipeData.sustainable) tags.push('sustainable');

        for (const tagName of tags) {
          const tagRes = await db.query(
            `INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
            [tagName]
          );
          await db.query(
            `INSERT INTO recipe_tags (recipe_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [recipeId, tagRes.rows[0].id]
          );
        }

        // Step 8: Insert dish types
        for (const dishType of recipeData.dishTypes || []) {
          const typeRes = await db.query(
            `INSERT INTO dish_types (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
            [dishType]
          );
          await db.query(
            `INSERT INTO recipe_dish_types (recipe_id, dish_type_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [recipeId, typeRes.rows[0].id]
          );
        }

        // Step 9: Insert occasions
        for (const occasion of recipeData.occasions || []) {
          const occRes = await db.query(
            `INSERT INTO occasions (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
            [occasion]
          );
          await db.query(
            `INSERT INTO recipe_occasions (recipe_id, occasion_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [recipeId, occRes.rows[0].id]
          );
        }

        console.log(`✅ Saved recipe: ${recipeData.title}`);
      }
    }

    console.log("🎉 Done syncing all recipes.");
    process.exit();
  } catch (err) {
    console.error('❌ Error syncing recipes:', err.message);
    process.exit(1);
  }
}

syncRecipes();
