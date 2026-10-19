const Loan = require("../models/Loan");
const Laptop = require("../models/Laptop");
const { badRequest, httpError } = require("../middleware/errors");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LOAN_DAYS = 7;
const MAX_PURPOSE_LENGTH = 80;

function busyWindow(loan) {
  // Other borrowers only need to know the laptop is occupied, not who has it or why.
  return {
    id: loan.id,
    laptopId: loan.laptopId,
    start: loan.start,
    end: loan.end,
    cancelled: loan.cancelled,
    returned: loan.returned,
  };
}

// GET /api/loans
// Student: own loans in full + anonymous busy windows for availability checks.
// Anonymous (landing page): busy windows only.
exports.list = async (req, res) => {
  const loans = await Loan.find().sort({ start: 1 });
  const viewerId = req.user?._id?.toString();

  const payload = loans.map((loan) => {
    const json = loan.toJSON();
    if (req.user?.role === "admin" || String(json.studentId) === viewerId) return json;
    return busyWindow(json);
  });

  res.json(payload);
};

// POST /api/loans
exports.create = async (req, res) => {
  const { laptopId, start, end } = req.body;
  const from = new Date(start);
  const to = new Date(end);
  const purpose = String(req.body.purpose || "").trim();

  if (Number.isNaN(+from) || Number.isNaN(+to)) throw badRequest("Enter a valid pick-up and return time.");
  if (from < new Date()) throw badRequest("Pick-up time can't be in the past.");
  if (to <= from) throw badRequest("Return time must be after pick-up time.");
  if (to - from > MAX_LOAN_DAYS * DAY_MS) {
    throw badRequest(`You can borrow a laptop for up to ${MAX_LOAN_DAYS} days.`);
  }
  if (purpose.length > MAX_PURPOSE_LENGTH) {
    throw badRequest(`Keep the purpose under ${MAX_PURPOSE_LENGTH} characters.`);
  }

  const laptop = await Laptop.findById(laptopId);
  if (!laptop) throw httpError(404, "Laptop not found.");
  if (laptop.maintenance) throw badRequest("This laptop is currently in maintenance.");

  const clash = await Loan.exists({
    laptopId,
    cancelled: false,
    returned: false,
    start: { $lt: to },
    end: { $gt: from },
  });
  if (clash) throw badRequest("This laptop is already booked during that time. Pick another time or laptop.");

  const loan = await Loan.create({ studentId: req.user._id, laptopId, start: from, end: to, purpose });
  res.status(201).json(loan.toJSON());
};

// PATCH /api/loans/:id/cancel
exports.cancel = async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw httpError(404, "Loan not found.");
  if (loan.studentId.toString() !== req.user._id.toString()) {
    throw httpError(403, "You can only cancel your own reservation.");
  }
  if (loan.cancelled || loan.returned) throw badRequest("This reservation can no longer be cancelled.");
  if (loan.status !== "upcoming") throw badRequest("Only upcoming reservations can be cancelled.");

  loan.cancelled = true;
  await loan.save();
  res.json(loan.toJSON());
};
