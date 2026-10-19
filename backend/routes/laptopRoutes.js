const express = require("express");
const laptopController = require("../controllers/laptopController");
const adminController = require("../controllers/adminController");
const { auth, allow } = require("../middleware/auth");

const router = express.Router();

router.get("/", laptopController.list);
router.get("/:id", laptopController.get);
router.post("/", auth, allow("admin"), adminController.createLaptop);
router.put("/:id", auth, allow("admin"), adminController.updateLaptop);
router.delete("/:id", auth, allow("admin"), adminController.deleteLaptop);
router.patch("/:id/maintenance", auth, allow("admin"), adminController.toggleMaintenance);

module.exports = router;
