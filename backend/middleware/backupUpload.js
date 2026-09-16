const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const attempts = new Map();
const windowMs = 15 * 60 * 1000;
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, '../temp');
    fs.mkdir(dir, { recursive: true }, err => cb(err, dir));
  },
  filename(req, file, cb) { cb(null, crypto.randomUUID()); }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 10, fieldSize: 4096, parts: 11 } }).single('backupFile');

exports.backupUpload = (req, res, next) => {
  if (!req.user) return res.sendStatus(401);
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = String(req.user.id);
  const state = attempts.get(key) || { count: 0, until: now + windowMs };
  if (state.count >= 10) {
    res.set('Retry-After', String(Math.ceil((state.until - now) / 1000)));
    return res.status(429).json({ success: false, message: '备份上传过于频繁，请稍后重试' });
  }
  state.count++;
  attempts.set(key, state);
  const cleanup = () => {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
  };
  res.once('finish', cleanup);
  res.once('close', cleanup);
  upload(req, res, err => {
    if (res.destroyed) { cleanup(); return; }
    if (err) {
      cleanup();
      return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, message: '备份上传失败：' + err.message });
    }
    next();
  });
};
