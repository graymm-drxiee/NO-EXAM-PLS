const Loan = require("../models/Loan");
const Laptop = require("../models/Laptop");
const Setting = require("../models/Setting");
const { badRequest, httpError } = require("../middleware/errors");

const CLASS_START_HOUR = 9;
const CLASS_END_HOUR = 16;
const SCHOOL_UTC_OFFSET = 8 * 36e5; // Asia/Manila has no DST; class hours are wall-clock there
const MAX_PURPOSE_LENGTH = 80;

// Vercel runs UTC, so derive school wall-clock parts from the instant explicitly.
function schoolTime(d) {
  const local = new Date(+d + SCHOOL_UTC_OFFSET);
  return {
    date: local.toISOString().slice(0, 10),
    weekday: local.getUTCDay(),
    msOfDay: (local.getUTCHours() * 60 + local.getUTCMinutes()) * 6e4 + local.getUTCSeconds() * 1000 + local.getUTCMilliseconds(),
  };
}

// Loans last one day and must sit inside class hours, Monday through Friday.
function assertLoanWindow(from, to, { allowPast = false } = {}) {
  if (Number.isNaN(+from) || Number.isNaN(+to)) throw badRequest("Enter a valid pick-up and return time.");
  if (!allowPast && from < new Date()) throw badRequest("Pick-up time can't be in the past.");
  if (to <= from) throw badRequest("Return time must be after pick-up time.");
  const start = schoolTime(from), end = schoolTime(to);
  if (start.date !== end.date) {
    throw badRequest("Loans last one day only — pick-up and return must be on the same day.");
  }
  if (start.weekday === 0 || start.weekday === 6) {
    throw badRequest("Loans are available on class days (Mon–Fri) only.");
  }
  if (start.msOfDay < CLASS_START_HOUR * 36e5 || end.msOfDay > CLASS_END_HOUR * 36e5) {
    throw badRequest("Pick-up and return must be within class hours (9:00 AM – 4:00 PM).");
  }
}

exports.assertLoanWindow = assertLoanWindow;

function busyWindow(loan) {
  // Other borrowers only need to know the laptop is occupied, not who has it or why.
  return {
    id: loan.id,
    laptopId: loan.laptopId,
    start: loan.start,
    end: loan.end,
    approved: loan.approved,
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

  assertLoanWindow(from, to);
  if (purpose.length > MAX_PURPOSE_LENGTH) {
    throw badRequest(`Keep the purpose under ${MAX_PURPOSE_LENGTH} characters.`);
  }

  const laptop = await Laptop.findById(laptopId);
  if (!laptop) throw httpError(404, "Laptop not found.");
  if (laptop.maintenance) throw badRequest("This laptop is currently in maintenance.");

  const settings = (await Setting.findById("system")) || { maxActiveLoans: 2 };
  const myOpenLoans = await Loan.countDocuments({
    studentId: req.user._id,
    cancelled: false,
    returned: false,
    end: { $gte: new Date() },
  });
  if (myOpenLoans >= settings.maxActiveLoans) {
    throw badRequest(
      `You can hold up to ${settings.maxActiveLoans} open reservations at a time. Return or cancel one first.`
    );
  }

  const clash = await Loan.exists({
    laptopId,
    cancelled: false,
    returned: false,
    start: { $lt: to },
    end: { $gt: from },
  });
  if (clash) throw badRequest("This laptop is already booked during that time. Pick another time or laptop.");

  const loan = await Loan.create({
    studentId: req.user._id,
    laptopId,
    start: from,
    end: to,
    purpose,
    approved: false, // an admin confirms the request before it is a real reservation
  });

  // Two simultaneous requests can both pass the check above. Re-read after the
  // insert and let only the oldest reservation survive.
  const race = await Loan.findOne({
    _id: { $ne: loan._id },
    laptopId,
    cancelled: false,
    returned: false,
    start: { $lt: to },
    end: { $gt: from },
  }).sort({ _id: 1 });
  if (race && String(race._id) < String(loan._id)) {
    await loan.deleteOne();
    throw badRequest("This laptop is already booked during that time. Pick another time or laptop.");
  }

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
  if (loan.approved !== false && loan.status !== "upcoming") {
    throw badRequest("Only upcoming reservations can be cancelled.");
  }

  loan.cancelled = true;
  await loan.save();
  res.json(loan.toJSON());
};

// PATCH /api/loans/:id/return — the borrower records their own return.
exports.returnLoan = async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw httpError(404, "Loan not found.");
  if (loan.studentId.toString() !== req.user._id.toString()) {
    throw httpError(403, "You can only return your own loan.");
  }
  if (loan.cancelled) throw badRequest("This reservation was declined.");
  if (loan.returned) throw badRequest("This loan was already returned.");
  if (loan.approved === false) throw badRequest("This reservation has not been confirmed yet.");
  if (Date.now() < +loan.start) throw badRequest("You can only return a laptop after pick-up time.");

  loan.returned = true;
  await loan.save();
  res.json(loan.toJSON());
};
