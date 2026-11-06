const express = require("express");
const { router: sectionRoutes } = require("./sectionRoutes");
const { router: departmentRoutes } = require("./departmentRoutes");

const router = express.Router();

router.use("/sections", sectionRoutes);
router.use("/departments", departmentRoutes);

module.exports = router;
