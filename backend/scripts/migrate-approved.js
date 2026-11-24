// One-time backfill for databases created before the approval workflow.
// Loans that already exist are treated as confirmed so they do not turn pending.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Loan = require("../models/Loan");

(async () => {
  await connectDB();
  const result = await Loan.updateMany(
    { approved: { $exists: false } },
    { $set: { approved: true } }
  );
  console.log(`Backfilled ${result.modifiedCount} loan(s) as approved.`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
});
