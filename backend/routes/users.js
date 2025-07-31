const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { getUserProfile, updateUserProfile, uploadAvatar, upload } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.post('/upload-avatar', protect, upload.single('avatar'), uploadAvatar);

module.exports = router;