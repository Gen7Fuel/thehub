const express = require("express");
const { router: myIssueRoutes } = require("./myIssueRoutes");

const router = express.Router();

router.use("/my-issues", myIssueRoutes);
router.use("/department-issues", myIssueRoutes);

module.exports = router;
