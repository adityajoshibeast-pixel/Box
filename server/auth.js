const jwt = require("jsonwebtoken");

const COOKIE_NAME = "menu_admin_token";
const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function createToken() {
  return jwt.sign({ role: "admin" }, SECRET, { expiresIn: "7d" });
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, SECRET);
    return payload.role === "admin";
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

module.exports = { createToken, verifyToken, requireAdmin, COOKIE_NAME };