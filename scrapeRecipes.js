const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeRecipe(url) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Title, image, summary
    const title = $('h1.heading-1').text().trim();
    const summary = $('#recipe-masthead-description .editor-content p').text().trim();

    // Prep time, cook time, servings, difficulty
    let prep_time = '';
    let cook_time = '';
    let serves = '';
    let difficulty = '';

    $('.recipe-cook-and-prep-details__item').each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text.includes('prep')) {
        prep_time = $(el).find('time').text().trim();
      } else if (text.includes('cook')) {
        cook_time = $(el).find('time').text().trim();
      } else if (text.includes('serves')) {
        serves = $(el).text().trim().replace('Serves', '').trim();
      } else if (text.includes('easy') || text.includes('medium') || text.includes('hard')) {
        difficulty = $(el).text().trim();
      }
    });

    // Tags (e.g., vegan, dairy-free)
    const tags = [];
    $('.post-header--masthead__tags-item').each((i, el) => {
      tags.push($(el).text().trim());
    });

    // Ingredients
    const ingredients = [];
    $('#ingredients-list li.ingredients-list__item').each((i, el) => {
      const main = $(el).clone().children('div').remove().end().text().trim();
      const note = $(el).find('.ingredients-list__item-note').text().trim();
      ingredients.push(note ? `${main} (${note})` : main);
    });

    $('section h3:contains("To serve")').next('ul').find('li').each((i, el) => {
      const item = $(el).clone().children('div').remove().end().text().trim();
      const note = $(el).find('.ingredients-list__item-note').text().trim();
      ingredients.push(note ? `${item} (${note})` : item);
    });

    // Nutrients
    const nutrients = {};
    $('ul.nutrition-list li.nutrition-list__item').each((i, el) => {
      const key = $(el).find('span.fw-600').text().trim().toLowerCase();
      const value = $(el).text().replace(key, '').trim();
      if (key) nutrients[key] = value;
    });

    // Steps
    const steps = [];
    $('ul.method-steps__list li.method-steps__list-item').each((i, el) => {
      const stepText = $(el).find('p').text().trim();
      if (stepText) steps.push(stepText);
    });

    // Final object
    const recipe = {
      title,
      summary,
      prep_time,
      cook_time,
      serves,
      difficulty,
      tags,
      ingredients,
      nutrients,
      steps
    };

    console.log(recipe);
    return recipe;

  } catch (err) {
    console.error('Error scraping recipe:', err.message);
  }
}

scrapeRecipe('https://www.bbcgoodfood.com/recipes/vegan-shepherds-pie');
