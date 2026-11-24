const mongoose = require("mongoose");

const laptopSchema = new mongoose.Schema(
  {
    tag: { type: String, required: true, unique: true, trim: true },
    model: { type: String, required: true, trim: true },
    cpu: { type: String, required: true, trim: true },
    ram: { type: String, required: true, trim: true },
    storage: { type: String, required: true, trim: true },
    maintenance: { type: Boolean, default: false },
    maintenanceNote: { type: String, trim: true, maxlength: 200, default: "" },
    maintenanceUpdatedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

laptopSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model("Laptop", laptopSchema);
