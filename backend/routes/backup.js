const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const { protect } = require('../middleware/auth');

const { backupUpload } = require('../middleware/backupUpload');

// 备份路由
router.post('/create', protect, backupController.createBackup);
router.post('/restore', protect, backupUpload, backupController.restoreBackup);
router.get('/status', protect, backupController.getBackupStatus);
router.get('/download/:fileName', protect, backupController.downloadBackup);

// 新增路由：按照《备份改进.md》接口规划
router.post('/export', protect, backupController.exportBackup);
router.post('/validate', protect, backupUpload, backupController.validateBackup);
router.post('/restore-enhanced', protect, backupUpload, backupController.restoreBackupV2);
router.get('/progress', protect, backupController.getProgress);

module.exports = router;