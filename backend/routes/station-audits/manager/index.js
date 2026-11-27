const express = require("express");
const { router: sectionRoutes } = require("./sectionRoutes");
const { router: departmentRoutes } = require("./departmentRoutes");
const { router: statusOptionRoutes } = require("./statusOptionRoutes");
const { router: checklistRoutes } = require("./checklistRoutes");

const router = express.Router();

router.use("/sections", sectionRoutes);
router.use("/departments", departmentRoutes);
router.use("/status-options", statusOptionRoutes);
router.use("/checklists", checklistRoutes);

module.exports = router;
