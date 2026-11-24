const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    laptopId: { type: mongoose.Schema.Types.ObjectId, ref: "Laptop", required: true, index: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    purpose: { type: String, trim: true, maxlength: 80, default: "" },
    declineReason: { type: String, trim: true, maxlength: 200, default: "" },
    approved: { type: Boolean, default: false },
    cancelled: { type: Boolean, default: false },
    returned: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// Supports the overlap ("is this laptop booked?") query.
loanSchema.index({ laptopId: 1, start: 1, end: 1 });

loanSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    if (ret.studentId && !ret.studentId._bsontype) ret.studentId = ret.studentId.toString();
    if (ret.laptopId && !ret.laptopId._bsontype) ret.laptopId = ret.laptopId.toString();
    return ret;
  },
});

loanSchema
  .virtual("status")
  .get(function () {
    if (this.cancelled) return "cancelled";
    if (this.returned) return "returned";
    if (this.approved === false) return "pending";
    const t = Date.now();
    if (t < +this.start) return "upcoming";
    if (t <= +this.end) return "active";
    return "overdue";
  });

module.exports = mongoose.model("Loan", loanSchema);
