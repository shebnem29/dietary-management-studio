// index.js
const express = require('express');
const cors = require('cors');
const app = express();
const categoriesRoute = require('./routes/categories');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Welcome to the Dietary Management API');
});

app.use('/categories', categoriesRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
