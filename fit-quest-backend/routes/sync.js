const express = require('express');
const { sync } = require('../controllers/syncController');
const { protect } = require('../middleware/auth');
const router = express.Router();
router.post('/', protect, sync);
module.exports = router;