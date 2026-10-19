const express = require("express");
const loanController = require("../controllers/loanController");
const { auth, optionalAuth, allow } = require("../middleware/auth");

const router = express.Router();

router.get("/", optionalAuth, loanController.list);
router.post("/", auth, allow("student"), loanController.create);
router.patch("/:id/cancel", auth, allow("student"), loanController.cancel);

module.exports = router;
