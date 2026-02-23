const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createApiKey,
  listApiKeys,
  deleteApiKey,
  toggleApiKey,
  updateApiKey
} = require('../controllers/apiKeyController');

router.post('/', protect, createApiKey);
router.get('/', protect, listApiKeys);
router.put('/:id', protect, updateApiKey);
router.put('/:id/toggle', protect, toggleApiKey);
router.delete('/:id', protect, deleteApiKey);

module.exports = router;
