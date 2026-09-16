const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const rag = require('../controllers/ragController');

router.get('/rag/sync/jobs', protect, (req, res, next) => { req.query.kind = 'index'; next(); }, require('../controllers/workflowController').list);
router.post('/rag/sync/jobs/:jobId/retry', protect, require('../controllers/workflowController').retry);

// 需要鉴权
router.post('/rag/reindex', protect, rag.reindex);
router.post('/rag/query', protect, rag.query);

module.exports = router;