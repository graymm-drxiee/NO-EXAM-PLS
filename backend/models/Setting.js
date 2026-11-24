const mongoose = require("mongoose");

// One shared settings document for the whole system.
const settingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "system" },
    maxActiveLoans: { type: Number, min: 1, max: 10, default: 2 },
  },
  { versionKey: false }
);

settingSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("Setting", settingSchema);
