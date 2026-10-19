const express = require("express");
const adminController = require("../controllers/adminController");
const { auth, allow } = require("../middleware/auth");

const router = express.Router();

router.use(auth, allow("admin"));

router.get("/loans", adminController.listLoans);
router.post("/loans/:id/return", adminController.forceReturn);

router.post("/laptops", adminController.createLaptop);
router.put("/laptops/:id", adminController.updateLaptop);
router.delete("/laptops/:id", adminController.deleteLaptop);
router.patch("/laptops/:id/maintenance", adminController.toggleMaintenance);

router.get("/students", adminController.listStudents);
router.patch("/students/:id/active", adminController.toggleStudent);

module.exports = router;
