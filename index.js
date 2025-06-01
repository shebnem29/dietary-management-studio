const express = require('express');
const cors = require('cors');
const app = express();
const categoriesRoute = require('./routes/categories');
const recipesRoute = require('./routes/recipes')
const authRoutes = require('./routes/auth');
const userRoutes = require("./routes/users");
const metadataRoutes = require("./routes/metadata");
const userGoalsRoutes = require("./routes/userGoals")
const userMacros = require("./routes/user-macros")
const updateRoutes = require('./routes/update');
const pool = require('./db'); // ← add this
require('dotenv').config();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Welcome to the Dietar Management API');
});

app.use('/categories', categoriesRoute);
app.use('/recipes', recipesRoute)
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes);
app.use("/api/metadata", metadataRoutes);
app.use("/api/user-goals", userGoalsRoutes)
app.use("/api/user-macros", userMacros);
app.use('/api/account', updateRoutes);

// ✅ Fetch and log categories on server startup
pool.query('SELECT * FROM categories')
  .then(result => {
    console.log('Categories table rows:');
    console.log(result.rows);
  })
  .catch(err => {
    console.error('Error fetching categories:', err);
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
