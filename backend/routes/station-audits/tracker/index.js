const express = require("express");
const { router: myIssueRoutes } = require("./myIssueRoutes");
const issueBoardRoutes = require("./issueBoardRoutes");
const reportRoutes = require("./reportRoutes");

const router = express.Router();

router.use("/my-issues", myIssueRoutes);
router.use("/department-issues", myIssueRoutes);
router.use("/issues-board", issueBoardRoutes);
router.use("/reports", reportRoutes);

module.exports = router;
