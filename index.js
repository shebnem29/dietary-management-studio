// index.js
const express = require('express');
const cors = require('cors');
const app = express();
const categoriesRoute = require('./routes/categories');

app.use(cors());
app.use(express.json());

app.use('/categories', categoriesRoute);

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
