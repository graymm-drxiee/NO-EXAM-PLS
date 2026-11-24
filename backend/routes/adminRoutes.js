const express = require("express");
const adminController = require("../controllers/adminController");
const { auth, allow } = require("../middleware/auth");

const router = express.Router();

router.use(auth, allow("admin"));

router.get("/loans", adminController.listLoans);
router.post("/loans/:id/return", adminController.forceReturn);
router.patch("/loans/:id/approve", adminController.approveLoan);
router.patch("/loans/:id/decline", adminController.declineLoan);
router.patch("/loans/:id/dates", adminController.updateLoanDates);

router.post("/laptops", adminController.createLaptop);
router.put("/laptops/:id", adminController.updateLaptop);
router.delete("/laptops/:id", adminController.deleteLaptop);
router.patch("/laptops/:id/maintenance", adminController.toggleMaintenance);

router.get("/students", adminController.listStudents);
router.post("/students", adminController.createStudent);
router.put("/students/:id", adminController.updateStudent);
router.patch("/students/:id/active", adminController.toggleStudent);
router.post("/students/:id/password", adminController.resetStudentPassword);

router.get("/settings", adminController.getSettings);
router.patch("/settings", adminController.updateSettings);

module.exports = router;
