const Summary = require('../models/Summary');
const { resolveHTMLFile } = require('../services/summaryFiles');

exports.getSummaryHTML = async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.sendStatus(404);
    const summary = await Summary.findOne({ _id: req.params.id, user: req.user.id });
    const filename = summary && resolveHTMLFile(summary.htmlFilePath);
    if (!filename) return res.sendStatus(404);
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      // 模型生成的脚本在独立的沙箱中运行，不得读取登录信息。
      'Content-Security-Policy': "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"
    });
    res.sendFile(filename, err => {
      if (err && !res.headersSent) res.sendStatus(err.statusCode === 404 || err.code === 'ENOENT' ? 404 : 500);
    });
  } catch (error) {
    next(error);
  }
};
