const express = require("express");
const router = express.Router();
const {login , signup} = require("../controller/authController.js");

router.post("/login", login);
router.post("/create" , signup);

module.exports = router;