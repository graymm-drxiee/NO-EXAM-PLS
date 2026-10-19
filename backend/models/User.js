const mongoose = require("mongoose");

const ROLE = ["student", "admin"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Exactly one of username (admin) / studentNo (student) is set.
    username: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    studentNo: { type: String, trim: true, unique: true, sparse: true },
    password: { type: String, required: true },
    role: { type: String, enum: ROLE, default: "student", index: true },

    // Student profile fields
    address: { type: String, trim: true },
    contact: { type: String, trim: true },
    program: { type: String, trim: true },
    year: { type: String, trim: true },
    block: { type: String, trim: true },
    termsAcceptedAt: { type: Date },
    active: { type: Boolean, default: true },

    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.password;
    delete ret.username;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
