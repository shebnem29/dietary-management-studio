const jwt = require("jsonwebtoken");
require('dotenv').config();

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  console.log("🪙 Received Token:", token);
  console.log("🔐 JWT Secret:", process.env.JWT_SECRET);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Decoded Token:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ JWT Verification Error:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = { authenticateToken };
