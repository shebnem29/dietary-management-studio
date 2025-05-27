const fs = require('fs');
const pool = require('./db');
require('dotenv').config();

async function generateImageMapJSON() {
  const client = await pool.connect();

  try {
    const res = await client.query('SELECT title FROM recipes ORDER BY title');

    const imageMap = {};
    for (const row of res.rows) {
      imageMap[row.title] = "";
    }

    fs.writeFileSync('recipeImageMap.json', JSON.stringify(imageMap, null, 2));
    console.log('✅ recipeImageMap.json created!');
  } catch (err) {
    console.error('❌ Error generating image map:', err);
  } finally {
    client.release();
  }
}

generateImageMapJSON();
