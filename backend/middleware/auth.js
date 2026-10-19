const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { httpError } = require("./errors");

function bearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

async function resolveUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw httpError(401, "Invalid token");
  }
  return User.findById(decoded.id);
}

// Requires a valid token for an existing, enabled account.
async function auth(req, _res, next) {
  const user = await resolveUser(req);
  if (!user) throw httpError(401, "No token");
  if (!user.active) throw httpError(401, "This account is disabled. Contact the CSD office.");
  req.user = user;
  next();
}

// Attaches req.user when a token is present, otherwise continues anonymously.
async function optionalAuth(req, _res, next) {
  req.user = await resolveUser(req);
  next();
}

function allow(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(httpError(401, "Unauthorized"));
    if (!roles.includes(req.user.role)) return next(httpError(403, "Forbidden"));
    next();
  };
}

module.exports = { auth, optionalAuth, allow };
