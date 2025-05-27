const jwt = require("jsonwebtoken");
require('dotenv').config();

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  console.log("🪙 Received Token:", token); // ← Log the raw token
  console.log("🔐 JWT Secret:", process.env.JWT_SECRET); // ← Log the secret being used

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Decoded Token:", decoded); // ← Log decoded token
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ JWT Verification Error:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};
