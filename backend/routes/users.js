const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { getUserProfile, updateUserProfile, uploadAvatar, upload, updateWorkProfile, generateCustomPrompts } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.post('/upload-avatar', protect, upload.single('avatar'), uploadAvatar);
router.put('/work-profile', protect, updateWorkProfile);
router.post('/generate-custom-prompts', protect, generateCustomPrompts);
router.get('/generate-custom-prompts', protect, generateCustomPrompts);

module.exports = router;