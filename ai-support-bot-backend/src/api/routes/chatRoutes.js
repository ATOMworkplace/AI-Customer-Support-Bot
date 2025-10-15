const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.post('/start', chatController.startChat);
router.post('/message', chatController.postMessage);

module.exports = router;