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
const userStatsRoutes = require('./routes/userStats');
const nutrientLabelRoutes = require('./routes/nutrientLabels');
const mealTypesRoute = require('./routes/mealTypes');
const foodRoutes = require('./routes/foods');
const foodLogRoutes = require('./routes/food-logs');
const userPreferencesRoutes = require("./routes/userPreferences");
const adminRoutes = require('./routes/admin');
const adminDashboardRoutes = require('./routes/adminPanelDashboardStats')
const adminAnalyticsRoutes = require('./routes/adminAnalyticsRoutes')
const favoriteRoutes = require('./routes/favorites');
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
app.use('/api/user-stats', userStatsRoutes);
app.use('/api/nutrient-labels', nutrientLabelRoutes);
app.use('/api/meal-types', mealTypesRoute);
app.use('/api/foods', foodRoutes);
app.use('/api/food-logs', foodLogRoutes);
app.use("/api/user/preferences", userPreferencesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/adminDashboard', adminDashboardRoutes)
app.use('/adminAnalytics', adminAnalyticsRoutes)
app.use('/favorites', favoriteRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
