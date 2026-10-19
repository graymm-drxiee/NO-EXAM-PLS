const Laptop = require("../models/Laptop");
const { httpError } = require("../middleware/errors");

// GET /api/laptops -- public: the landing page shows live fleet availability.
exports.list = async (_req, res) => {
  const laptops = await Laptop.find().sort({ tag: 1 });
  res.json(laptops.map((l) => l.toJSON()));
};

exports.get = async (req, res) => {
  const laptop = await Laptop.findById(req.params.id);
  if (!laptop) throw httpError(404, "Laptop not found.");
  res.json(laptop.toJSON());
};
