const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const rag = require('../controllers/ragController');

// 需要鉴权
router.post('/rag/reindex', protect, rag.reindex);
router.post('/rag/query', protect, rag.query);

module.exports = router;