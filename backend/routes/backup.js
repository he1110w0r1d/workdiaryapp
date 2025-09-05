const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const { protect } = require('../middleware/auth');

// 备份路由
router.post('/create', protect, backupController.createBackup);
router.post('/restore', protect, backupController.restoreBackup);
router.get('/status', protect, backupController.getBackupStatus);
router.get('/download/:fileName', protect, backupController.downloadBackup);

module.exports = router;