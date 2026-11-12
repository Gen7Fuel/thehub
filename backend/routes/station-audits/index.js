const express = require("express");
const { router: checklistRoutes } = require("./checklistRoutes");
const sectionRoutes = require("./sectionRoutes");
const managerRoutes = require("./manager");
const trackerRoutes = require("./tracker");

const router = express.Router();

router.use("/sections", sectionRoutes);
router.use("/checklists", checklistRoutes);
router.use("/manager", managerRoutes);
router.use("/tracker", trackerRoutes);

module.exports = router;
