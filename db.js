// db.js
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'dietary-management-studio',
  password: '290101Sebnem', 
  port: 5432,
});

module.exports = pool;
