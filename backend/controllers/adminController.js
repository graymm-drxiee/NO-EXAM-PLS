const Loan = require("../models/Loan");
const Laptop = require("../models/Laptop");
const User = require("../models/User");
const { badRequest, httpError } = require("../middleware/errors");

/* --------------------------------- loans --------------------------------- */

// Admin view: loan + embedded student + embedded laptop (the console shows both).
exports.listLoans = async (_req, res) => {
  const loans = await Loan.find().populate("studentId").populate("laptopId").sort({ start: -1 });

  res.json(
    loans.map((loan) => {
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
    })
  );
};

// POST /api/admin/loans/:id/return
exports.forceReturn = async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw httpError(404, "Loan not found.");

  loan.returned = true;
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

  const committed = await Loan.exists({ laptopId: laptop._id, cancelled: false, returned: false });
  if (committed) throw badRequest("Cannot delete a laptop that is currently reserved or on loan.");

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
  await laptop.save();
  res.json(laptop.toJSON());
};

/* -------------------------------- students ------------------------------- */

// GET /api/admin/students
exports.listStudents = async (_req, res) => {
  const [students, loans] = await Promise.all([
    User.find({ role: "student" }).sort({ createdAt: 1 }),
    Loan.find({ cancelled: false }),
  ]);

  res.json(
    students.map((student) => {
      const id = student._id.toString();
      const mine = loans.filter((loan) => loan.studentId.toString() === id);
      return {
        ...student.toJSON(),
        activeLoans: mine.filter((loan) => loan.status === "active").length,
        totalLoans: mine.length,
      };
    })
  );
};

// PATCH /api/admin/students/:id/active
exports.toggleStudent = async (req, res) => {
  const student = await User.findOne({ _id: req.params.id, role: "student" });
  if (!student) throw httpError(404, "Student not found.");

  student.active = !student.active;
  await student.save();
  res.json(student.toJSON());
};
