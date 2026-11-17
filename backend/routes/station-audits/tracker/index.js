const express = require("express");
const { router: myIssueRoutes } = require("./myIssueRoutes");
const issueBoardRoutes = require("./issueBoardRoutes");

const router = express.Router();

router.use("/my-issues", myIssueRoutes);
router.use("/department-issues", myIssueRoutes);
router.use("/issues-board", issueBoardRoutes);

module.exports = router;
