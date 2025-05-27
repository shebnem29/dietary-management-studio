const pool = require('./db');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

function extractNumber(text) {
  const match = text.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

function parseMinutes(timeText) {
  let minutes = 0;
  const hrMatch = timeText.match(/(\d+)\s*hr/);
  const minMatch = timeText.match(/(\d+)\s*min/);
  if (hrMatch) minutes += parseInt(hrMatch[1]) * 60;
  if (minMatch) minutes += parseInt(minMatch[1]);
  return minutes;
}

function parseIngredient(ingredientText) {
  const regex = /^(\d+(?:[\d\/\.\s]*)?)?\s*([a-zA-Z]+)?\s+(.*)/;
  const match = ingredientText.match(regex);

  if (match) {
    const amountRaw = match[1]?.trim() || null;
    const unit = match[2]?.trim().toLowerCase() || null;
    const name = match[3].split(/[,:(]/)[0].trim().toLowerCase();

    let amount = null;
    if (amountRaw) {
      if (amountRaw.includes('/')) {
        const parts = amountRaw.trim().split(' ');
        let total = 0;
        for (const part of parts) {
          if (part.includes('/')) {
            const [num, denom] = part.split('/').map(Number);
            total += num / denom;
          } else {
            total += parseFloat(part);
          }
        }
        amount = total;
      } else {
        amount = parseFloat(amountRaw);
      }
    }

    return { name, amount, unit };
  } else {
    return {
      name: ingredientText.split(/[,:(]/)[0].trim().toLowerCase(),
      amount: null,
      unit: null
    };
  }
}

function calculateHealthScore(nutrients) {
  const kcal = extractNumber(nutrients['kcal']) || 0;
  const fat = extractNumber(nutrients['fat']) || 0;
  const sugars = extractNumber(nutrients['sugars']) || 0;
  const fibre = extractNumber(nutrients['fibre']) || 0;
  const protein = extractNumber(nutrients['protein']) || 0;
  const salt = extractNumber(nutrients['salt']) || 0;

  let score = 100;
  score -= Math.min(kcal / 20, 20);
  score -= Math.min(fat * 2, 20);
  score -= Math.min(sugars * 2, 20);
  score -= Math.min(salt * 10, 20);
  score += Math.min(fibre * 2, 15);
  score += Math.min(protein * 2, 15);

  return Math.max(0, Math.min(100, Math.round(score)));
}

async function scrapeRecipe(url) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const title = $('h1.heading-1').text().trim();
  const summary = $('#recipe-masthead-description .editor-content p').text().trim();

  let prep_time = '', cook_time = '', serves = '', difficulty = '';
  $('.recipe-cook-and-prep-details__item').each((i, el) => {
    const text = $(el).text().toLowerCase();
    if (text.includes('prep')) prep_time = $(el).find('time').text().trim();
    else if (text.includes('cook')) cook_time = $(el).find('time').text().trim();
    else if (text.includes('serves')) serves = $(el).text().replace('Serves', '').trim();
    else if (text.includes('easy') || text.includes('medium') || text.includes('hard')) difficulty = $(el).text().trim();
  });

  const tags = [];
  $('.post-header--masthead__tags-item').each((i, el) => {
    tags.push($(el).text().trim());
  });

  const ingredients = [];
  $('#ingredients-list li.ingredients-list__item').each((i, el) => {
    const main = $(el).clone().children('div').remove().end().text().trim();
    const note = $(el).find('.ingredients-list__item-note').text().trim();
    ingredients.push(note ? `${main} (${note})` : main);
  });
  $('section h3:contains("To serve")').next('ul').find('li').each((i, el) => {
    const main = $(el).clone().children('div').remove().end().text().trim();
    const note = $(el).find('.ingredients-list__item-note').text().trim();
    ingredients.push(note ? `${main} (${note})` : main);
  });

  const nutrients = {};
  $('ul.nutrition-list li.nutrition-list__item').each((i, el) => {
    const key = $(el).find('span.fw-600').text().trim().toLowerCase();
    const value = $(el).text().replace(key, '').trim();
    nutrients[key] = value;
  });

  const steps = [];
  $('ul.method-steps__list li.method-steps__list-item').each((i, el) => {
    const step = $(el).find('p').text().trim();
    if (step) steps.push(step);
  });

  return {
    title, summary, prep_time, cook_time, serves, difficulty,
    tags, ingredients, nutrients, steps
  };
}

async function insertRecipe(url) {
  const recipeData = await scrapeRecipe(url);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const readyInMinutes =
      parseMinutes(recipeData.prep_time || '') + parseMinutes(recipeData.cook_time || '');
    const servings = parseInt(recipeData.serves.match(/\d+/)?.[0] || '1', 10);
    const healthScore = calculateHealthScore(recipeData.nutrients);

    const recipeRes = await client.query(
      `INSERT INTO recipes (title, summary, ready_in_minutes, servings, health_score)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        recipeData.title,
        recipeData.summary,
        readyInMinutes || 60,
        servings,
        healthScore
      ]
    );
    const recipeId = recipeRes.rows[0].id;

    for (const [key, rawValue] of Object.entries(recipeData.nutrients)) {
      await client.query(
        `INSERT INTO nutrients (recipe_id, name, amount, unit)
         VALUES ($1, $2, $3, $4)`,
        [recipeId, key, extractNumber(rawValue), 'g']
      );
    }

    const insertedIngredients = new Set();

    for (const ing of recipeData.ingredients) {
      const { name, amount, unit } = parseIngredient(ing);
    
      if (!name || name.length < 2) continue; // skip blank or invalid names
    
      let ingredientId;
      const existing = await client.query(
        `SELECT id FROM ingredients WHERE name = $1`,
        [name]
      );
    
      if (existing.rows.length > 0) {
        ingredientId = existing.rows[0].id;
      } else {
        const insertRes = await client.query(
          `INSERT INTO ingredients (name) VALUES ($1) RETURNING id`,
          [name]
        );
        ingredientId = insertRes.rows[0].id;
      }
    
      const key = `${recipeId}-${ingredientId}`;
      if (insertedIngredients.has(key)) continue;
      insertedIngredients.add(key);
    
      await client.query(
        `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, original, amount, unit)
         VALUES ($1, $2, $3, $4, $5)`,
        [recipeId, ingredientId, ing, amount, unit]
      );
    }

    for (let i = 0; i < recipeData.steps.length; i++) {
      await client.query(
        `INSERT INTO instructions (recipe_id, step_number, description) VALUES ($1, $2, $3)`,
        [recipeId, i + 1, recipeData.steps[i]]
      );
    }

    const categoriesRes = await client.query(`SELECT id, name FROM categories`);
    const categoryMap = new Map(categoriesRes.rows.map(row => [row.name.toLowerCase(), row.id]));

    const recipeCategories = [];
    const recipeTags = [];

    for (const tag of recipeData.tags) {
      const lower = tag.toLowerCase();
      if (categoryMap.has(lower)) {
        recipeCategories.push({ name: tag, id: categoryMap.get(lower) });
      } else {
        recipeTags.push(tag);
      }
    }

    for (const cat of recipeCategories) {
      await client.query(
        `INSERT INTO recipe_categories (recipe_id, category_id) VALUES ($1, $2)`,
        [recipeId, cat.id]
      );
    }

    for (const name of recipeTags) {
      const tagRes = await client.query(`SELECT id FROM tags WHERE name ILIKE $1`, [name]);
      let tagId;
      if (tagRes.rows.length > 0) {
        tagId = tagRes.rows[0].id;
      } else {
        const newTag = await client.query(
          `INSERT INTO tags (name) VALUES ($1) RETURNING id`,
          [name]
        );
        tagId = newTag.rows[0].id;
      }
      await client.query(
        `INSERT INTO recipe_tags (recipe_id, tag_id) VALUES ($1, $2)`,
        [recipeId, tagId]
      );
    }

    const dishTypeIds = [10, 11, 12];
    for (const dishTypeId of dishTypeIds) {
      await client.query(
        `INSERT INTO recipe_dish_types (recipe_id, dish_type_id) VALUES ($1, $2)`,
        [recipeId, dishTypeId]
      );
    }

    await client.query('COMMIT');
    console.log(`✅ Inserted: ${recipeData.title}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error inserting recipe:', e);
  } finally {
    client.release();
  }
}

async function insertMultipleRecipes(urls) {
  for (const url of urls) {
    console.log(`🔄 Starting: ${url}`);
    await insertRecipe(url);
  }
}

// 🟢 Call this function with your URLs here
const recipeUrls = [
  'https://www.bbcgoodfood.com/recipes/vegan-apple-crumble',
  'https://www.bbcgoodfood.com/recipes/satay-sweet-potato-curry',
  'https://www.bbcgoodfood.com/recipes/vegan-mug-cake',
  'https://www.bbcgoodfood.com/recipes/vegan-shepherds-pie',
  'https://www.bbcgoodfood.com/recipes/hasselback-potatoes',
  'https://www.bbcgoodfood.com/recipes/vegan-brownies',
  'https://www.bbcgoodfood.com/recipes/vegan-jambalaya',
  'https://www.bbcgoodfood.com/recipes/sticky-toffee-pear-pudding',
  'https://www.bbcgoodfood.com/recipes/vegan-chocolate-party-traybake',
  'https://www.bbcgoodfood.com/recipes/paprika-potato-wedges',

  'https://www.bbcgoodfood.com/recipes/vegan-kale-pesto-pasta',
  'https://www.bbcgoodfood.com/recipes/vegan-ginger-loaf-cake',
  'https://www.bbcgoodfood.com/recipes/jackfruit-bolognese-vegan-parmesan',
  'https://www.bbcgoodfood.com/recipes/asparagus-lemon-spaghetti-peas',
  'https://www.bbcgoodfood.com/recipes/vegan-katsu-curry',
  'https://www.bbcgoodfood.com/recipes/vegan-cookies-cream-cake',
  'https://www.bbcgoodfood.com/recipes/butter-beans-with-kale-lemon-chilli-garlic',
  'https://www.bbcgoodfood.com/recipes/mint-basil-griddled-peach-salad',
  'https://www.bbcgoodfood.com/recipes/vegan-meatballs',
  'https://www.bbcgoodfood.com/recipes/raspberry-mousse',

  'https://www.bbcgoodfood.com/recipes/cacik',
  'https://www.bbcgoodfood.com/recipes/black-bean-pineapple-salad-bowl',
  'https://www.bbcgoodfood.com/recipes/juicy-prawn-lemongrass-burgers',
  'https://www.bbcgoodfood.com/recipes/roast-chicken-for-weeknight-leftovers',
  'https://www.bbcgoodfood.com/recipes/green-goddess-avocado-salad',
  'https://www.bbcgoodfood.com/recipes/air-fryer-lamb-chops',
  'https://www.bbcgoodfood.com/recipes/cinnamon-balls',
  'https://www.bbcgoodfood.com/recipes/cauliflower-puree',
  'https://www.bbcgoodfood.com/recipes/beetroot-juice',
  'https://www.bbcgoodfood.com/recipes/gluten-free-salmon-pasta',

  'https://www.bbcgoodfood.com/recipes/rose-pomegranate-jellies-with-cardamom-panna-cotta',
  'https://www.bbcgoodfood.com/recipes/healthy-gluten-free-fish-chips',
  'https://www.bbcgoodfood.com/recipes/baked-eggs-with-spinach-tomatoes-ricotta-basil',
  'https://www.bbcgoodfood.com/recipes/air-fryer-spiced-carrot-fries',
  'https://www.bbcgoodfood.com/recipes/raw-lemon-cheesecake',
  'https://www.bbcgoodfood.com/recipes/gluten-free-pancakes',
  'https://www.bbcgoodfood.com/recipes/sweet-melon-curry-leaf-burrata-salad',
  'https://www.bbcgoodfood.com/recipes/date-banana-rum-loaf',
  'https://www.bbcgoodfood.com/recipes/goats-cheese-watercress-quiche',
  'https://www.bbcgoodfood.com/recipes/spice-crusted-aubergines-peppers-pilaf',

  'https://www.bbcgoodfood.com/recipes/roasted-vegetables',
  'https://www.bbcgoodfood.com/recipes/pink-eggs-beetroot-with-yogurt-chilli-butter',
  'https://www.bbcgoodfood.com/recipes/ginger-cookie-sandwiches-lemon-mascarpone',
  'https://www.bbcgoodfood.com/recipes/butternut-soup-crispy-sage-apple-croutons',
  'https://www.bbcgoodfood.com/recipes/keto-vanilla-cake',
  'https://www.bbcgoodfood.com/recipes/coconut-cupcakes',
  'https://www.bbcgoodfood.com/recipes/chicken-mango-noodle-salad',
  'https://www.bbcgoodfood.com/recipes/pineapple-smoothie',
  'https://www.bbcgoodfood.com/recipes/vanilla-lemongrass-creme-brulee',
  'https://www.bbcgoodfood.com/recipes/gluten-free-chilli-cornbread',

];

insertMultipleRecipes(recipeUrls);
