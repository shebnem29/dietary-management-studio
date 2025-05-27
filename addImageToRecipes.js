const fs = require('fs');
const pool = require('./db');
require('dotenv').config();

async function updateRecipeImages() {
  const client = await pool.connect();

  try {
    const imageMap = JSON.parse(fs.readFileSync('recipeImageMap.json', 'utf-8'));

    await client.query('BEGIN');

    let successCount = 0;
    let failCount = 0;

    for (const [title, imageUrl] of Object.entries(imageMap)) {
      if (!imageUrl) continue;

      const normalizedTitle = title.trim();

      const res = await client.query(
        `UPDATE recipes
         SET image = $1
   WHERE title ILIKE '%' || $2 || '%'`,
        [imageUrl, normalizedTitle]
      );

      if (res.rowCount === 0) {
        console.warn(`⚠️ No match for title: "${title}"`);
        failCount++;
      } else {
        console.log(`✅ Updated image for: "${title}"`);
        successCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`\n🎯 Done! ${successCount} updated, ${failCount} skipped.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating recipe images:', err);
  } finally {
    client.release();
  }
}

updateRecipeImages();
