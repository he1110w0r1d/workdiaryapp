const express = require('express');
const path = require('path');

module.exports = function publicUploads(app) {
  app.use('/uploads/avatars', express.static(path.join(__dirname, '../uploads/avatars')));
  // 不能公开父目录，否则 summaries 会绕过 API 鉴权。
  app.use('/uploads', (req, res) => res.sendStatus(404));
};
