const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { badRequest } = require("../middleware/errors");

const CONTACT_RE = /^(09|\+639)\d{9}$/;
const PROGRAMS = [
  "BS Computer Science",
  "BS Information Technology",
  "BS Information Technology major in Animation",
  "BS Information Systems",
  "Associate in Computer Technology",
];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const BLOCKS = ["A", "B", "C", "D"];
const MIN_PASSWORD_LENGTH = 12;

function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function normalizeStudentNo(value) {
  return String(value || "").trim().replace(/-/g, "");
}

function validateRegistration(body) {
  body = body || {};
  const password = String(body.password || "");
  const name = String(body.name || "").trim();
  const address = String(body.address || "").trim();
  const contact = String(body.contact || "").replace(/[\s-]/g, "");
  const studentNoDigits = normalizeStudentNo(body.studentNo);
  const program = String(body.program || "").trim();
  const year = String(body.year || "").trim();
  const block = String(body.block || "").trim();

  if (name.length < 3) throw badRequest("Enter your full name.");
  if (address.length < 5) throw badRequest("Enter your complete address.");
  if (!CONTACT_RE.test(contact)) throw badRequest("Use a valid mobile number, e.g. 0917 123 4567.");
  if (!/^\d{9}$/.test(studentNoDigits)) throw badRequest("Use the format 2023-01482.");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`Choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw badRequest("Password must be no more than 72 bytes.");
  }
  if (body.termsAccepted !== true) {
    throw badRequest("Accept the Terms & Conditions and Privacy Policy to register.");
  }
  if (!PROGRAMS.includes(program)) throw badRequest("Choose your program.");
  if (!YEARS.includes(year)) throw badRequest("Choose your year level.");
  if (!BLOCKS.includes(block)) throw badRequest("Choose your block.");

  return {
    password,
    name,
    address,
    contact,
    studentNo: `${studentNoDigits.slice(0, 4)}-${studentNoDigits.slice(4)}`,
    program,
    year,
    block,
  };
}

// POST /api/auth/register
exports.register = async (req, res) => {
  const profile = validateRegistration(req.body);

  if (await User.exists({ studentNo: profile.studentNo })) {
    throw badRequest("That student ID number is already registered. Try logging in instead.");
  }

  const password = await bcrypt.hash(profile.password, 10);
  delete profile.password;
  const user = await User.create({
    ...profile,
    password,
    role: "student",
    active: true,
    termsAcceptedAt: new Date(),
  });

  res.status(201).json({
    message: "Student registered successfully",
    token: signToken(user),
    user: user.toJSON(),
  });
};

// POST /api/auth/login  { role?, identifier, password }
exports.login = async (req, res) => {
  const identifier = String(req.body.identifier || "").trim();
  const password = String(req.body.password || "");
  const role = req.body.role === "admin" ? "admin" : "student";

  if (!identifier || !password) throw badRequest("Please enter both your ID and password.");

  if (role === "admin") {
    const admin = await User.findOne({ username: identifier.toLowerCase(), role: "admin" });
    const valid = admin && (await bcrypt.compare(password, admin.password));
    if (!valid) throw badRequest("Invalid admin credentials.");

    return res.json({
      message: "Login successful",
      token: signToken(admin),
      role: "admin",
      user: { id: admin._id.toString(), name: admin.name, role: "Administrator" },
    });
  }

  const student = await User.findOne({ studentNo: identifier, role: "student" });
  if (!student) throw badRequest("No student found with that ID number.");
  if (!student.active) throw badRequest("This account is disabled. Contact the CSD office.");
  if (!(await bcrypt.compare(password, student.password))) throw badRequest("Incorrect password.");

  res.json({
    message: "Login successful",
    token: signToken(student),
    role: "student",
    user: student.toJSON(),
  });
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json(req.user.toJSON());
};
