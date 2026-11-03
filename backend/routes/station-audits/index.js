const express = require("express");
const { router: checklistRoutes } = require("./checklistRoutes");
const sectionRoutes = require("./sectionRoutes");

const router = express.Router();

router.use("/sections", sectionRoutes);
router.use("/checklists", checklistRoutes);

module.exports = router;
