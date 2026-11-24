const bcrypt = require("bcrypt");
const Loan = require("../models/Loan");
const Laptop = require("../models/Laptop");
const User = require("../models/User");
const Setting = require("../models/Setting");
const { badRequest, httpError } = require("../middleware/errors");
const { assertLoanWindow } = require("./loanController");
const { readProfile, readNewPassword } = require("./authController");

const SETTINGS_ID = "system";

// Returns the shared settings document, creating the default one on first use.
async function loadSettings() {
  return (await Setting.findById(SETTINGS_ID)) || Setting.create({ _id: SETTINGS_ID });
}

// Optional ?page=&limit= pagination. Returns null when the client did not ask for it.
function readPage(query) {
  const page = Number(query.page);
  if (!Number.isInteger(page) || page < 1) return null;
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  return { page, limit, skip: (page - 1) * limit };
}

/* --------------------------------- loans --------------------------------- */

function shapeLoan(loan) {
  const json = loan.toJSON();
  const student = loan.studentId?.toJSON ? loan.studentId.toJSON() : null;
  const laptop = loan.laptopId?.toJSON ? loan.laptopId.toJSON() : null;
  return {
    ...json,
    studentId: student?.id ?? null,
    laptopId: laptop?.id ?? null,
    student,
    laptop,
  };
}

// Admin view: loan + embedded student + embedded laptop (the console shows both).
exports.listLoans = async (req, res) => {
  const page = readPage(req.query);
  const base = Loan.find().populate("studentId").populate("laptopId").sort({ createdAt: -1 });

  if (!page) return res.json((await base).map(shapeLoan));

  const [loans, total] = await Promise.all([
    base.skip(page.skip).limit(page.limit),
    Loan.countDocuments(),
  ]);
  res.json({ items: loans.map(shapeLoan), total, page: page.page, limit: page.limit });
};

// POST /api/admin/loans/:id/return
exports.forceReturn = async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw httpError(404, "Loan not found.");

  loan.returned = true;
  await loan.save();
  res.json(loan.toJSON());
};

// PATCH /api/admin/loans/:id/approve
exports.approveLoan = async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw httpError(404, "Loan not found.");
  if (loan.cancelled || loan.returned) throw badRequest("This reservation can no longer be confirmed.");
  if (loan.approved === true) throw badRequest("This reservation is already confirmed.");
  if (+loan.end < Date.now()) throw badRequest("This reservation has already expired.");

  const clash = await Loan.exists({
    _id: { $ne: loan._id },
    laptopId: loan.laptopId,
    approved: true,
    cancelled: false,
    returned: false,
    start: { $lt: loan.end },
    end: { $gt: loan.start },
  });
  if (clash) throw badRequest("Another confirmed loan already covers that time.");

  loan.approved = true;
  await loan.save();
  res.json(loan.toJSON());
};

// PATCH /api/admin/loans/:id/decline
exports.declineLoan = async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw httpError(404, "Loan not found.");
  if (loan.returned) throw badRequest("This loan was already returned.");
  if (loan.cancelled) throw badRequest("This reservation was already declined.");

  loan.cancelled = true;
  loan.declineReason = String(req.body?.reason || "").trim().slice(0, 200);
  await loan.save();
  res.json(loan.toJSON());
};

// PATCH /api/admin/loans/:id/dates
exports.updateLoanDates = async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw httpError(404, "Loan not found.");
  if (loan.cancelled || loan.returned) throw badRequest("This loan can no longer be changed.");

  const from = new Date(req.body?.start);
  const to = new Date(req.body?.end);
  assertLoanWindow(from, to, { allowPast: true });
  if (to < new Date()) throw badRequest("Return time can't be in the past.");

  const clash = await Loan.exists({
    _id: { $ne: loan._id },
    laptopId: loan.laptopId,
    cancelled: false,
    returned: false,
    start: { $lt: to },
    end: { $gt: from },
  });
  if (clash) throw badRequest("Another loan for this laptop already covers that time.");

  loan.start = from;
  loan.end = to;
  await loan.save();
  res.json(loan.toJSON());
};

/* -------------------------------- laptops -------------------------------- */

const LAPTOP_FIELDS = ["model", "cpu", "ram", "storage"];

function readLaptopFields(body, { partial = false } = {}) {
  const fields = {};
  for (const key of LAPTOP_FIELDS) {
    if (partial && body[key] === undefined) continue;
    const value = String(body[key] || "").trim();
    if (!value) throw badRequest("Please fill in all fields.");
    fields[key] = value;
  }
  if (body.tag !== undefined) fields.tag = String(body.tag || "").trim();
  if (body.maintenance !== undefined) fields.maintenance = Boolean(body.maintenance);
  return fields;
}

async function nextAssetTag() {
  const tags = await Laptop.find({ tag: /^CSD-LT-\d+$/ }, { tag: 1 });
  const max = tags.reduce((acc, { tag }) => Math.max(acc, Number(tag.split("-").pop())), 0);
  return `CSD-LT-${String(max + 1).padStart(3, "0")}`;
}

// POST /api/admin/laptops
exports.createLaptop = async (req, res) => {
  const fields = readLaptopFields(req.body);
  if (!fields.tag) fields.tag = await nextAssetTag();

  const laptop = await Laptop.create(fields);
  res.status(201).json(laptop.toJSON());
};

// PUT /api/admin/laptops/:id
exports.updateLaptop = async (req, res) => {
  const laptop = await Laptop.findById(req.params.id);
  if (!laptop) throw httpError(404, "Laptop not found.");

  const fields = readLaptopFields(req.body, { partial: true });

  if (fields.tag) {
    const taken = await Laptop.exists({ _id: { $ne: laptop._id }, tag: fields.tag });
    if (taken) throw badRequest("That asset tag is already in use.");
  }

  Object.assign(laptop, fields);
  await laptop.save();
  res.json(laptop.toJSON());
};

// DELETE /api/admin/laptops/:id
exports.deleteLaptop = async (req, res) => {
  const laptop = await Laptop.findById(req.params.id);
  if (!laptop) throw httpError(404, "Laptop not found.");

  await laptop.deleteOne();
  res.json({ ok: true, id: laptop._id.toString() });
};

// PATCH /api/admin/laptops/:id/maintenance
exports.toggleMaintenance = async (req, res) => {
  const laptop = await Laptop.findById(req.params.id);
  if (!laptop) throw httpError(404, "Laptop not found.");

  const now = new Date();
  const onLoan = await Loan.exists({
    laptopId: laptop._id,
    cancelled: false,
    returned: false,
    start: { $lte: now },
    end: { $gte: now },
  });
  if (onLoan && !laptop.maintenance) {
    throw badRequest("Cannot send a laptop to maintenance while it is on loan.");
  }

  laptop.maintenance = !laptop.maintenance;
  laptop.maintenanceNote = laptop.maintenance ? String(req.body?.note || "").trim().slice(0, 200) : "";
  laptop.maintenanceUpdatedAt = new Date();
  await laptop.save();
  res.json(laptop.toJSON());
};

/* -------------------------------- students ------------------------------- */

// GET /api/admin/students
exports.listStudents = async (req, res) => {
  const page = readPage(req.query);
  const query = User.find({ role: "student" }).sort({ createdAt: 1 });
  if (page) query.skip(page.skip).limit(page.limit);

  const [students, total] = await Promise.all([
    query,
    page ? User.countDocuments({ role: "student" }) : Promise.resolve(null),
  ]);

  const loans = await Loan.find({
    studentId: { $in: students.map((s) => s._id) },
    cancelled: false,
  });

  const items = students.map((student) => {
    const id = student._id.toString();
    const mine = loans.filter((loan) => loan.studentId.toString() === id);
    return {
      ...student.toJSON(),
      activeLoans: mine.filter((loan) => loan.status === "active").length,
      totalLoans: mine.length,
    };
  });

  res.json(page ? { items, total, page: page.page, limit: page.limit } : items);
};

// PATCH /api/admin/students/:id/active
exports.toggleStudent = async (req, res) => {
  const student = await User.findOne({ _id: req.params.id, role: "student" });
  if (!student) throw httpError(404, "Student not found.");

  student.active = !student.active;
  await student.save();
  res.json(student.toJSON());
};

// POST /api/admin/students
exports.createStudent = async (req, res) => {
  const profile = readProfile(req.body, { requireStudentNo: true });
  const password = readNewPassword(req.body?.password);

  if (await User.exists({ studentNo: profile.studentNo })) {
    throw badRequest("That student ID number is already registered.");
  }

  const student = await User.create({
    ...profile,
    password: await bcrypt.hash(password, 10),
    role: "student",
    active: true,
  });
  res.status(201).json(student.toJSON());
};

// PUT /api/admin/students/:id
exports.updateStudent = async (req, res) => {
  const student = await User.findOne({ _id: req.params.id, role: "student" });
  if (!student) throw httpError(404, "Student not found.");

  const profile = readProfile(req.body, { requireStudentNo: true });
  if (profile.studentNo !== student.studentNo) {
    const taken = await User.exists({ _id: { $ne: student._id }, studentNo: profile.studentNo });
    if (taken) throw badRequest("That student ID number is already registered.");
  }

  Object.assign(student, profile);
  if (req.body?.password) student.password = await bcrypt.hash(readNewPassword(req.body.password), 10);
  await student.save();
  res.json(student.toJSON());
};

// POST /api/admin/students/:id/password
exports.resetStudentPassword = async (req, res) => {
  const student = await User.findOne({ _id: req.params.id, role: "student" });
  if (!student) throw httpError(404, "Student not found.");

  student.password = await bcrypt.hash(readNewPassword(req.body?.password), 10);
  await student.save();
  res.json({ ok: true, id: student._id.toString() });
};

/* -------------------------------- settings ------------------------------- */

// GET /api/admin/settings
exports.getSettings = async (_req, res) => {
  res.json((await loadSettings()).toJSON());
};

// PATCH /api/admin/settings
exports.updateSettings = async (req, res) => {
  const maxActiveLoans = Number(req.body?.maxActiveLoans);
  if (!Number.isInteger(maxActiveLoans) || maxActiveLoans < 1 || maxActiveLoans > 10) {
    throw badRequest("Max active loans must be a whole number from 1 to 10.");
  }

  const settings = await loadSettings();
  settings.maxActiveLoans = maxActiveLoans;
  await settings.save();
  res.json(settings.toJSON());
};
