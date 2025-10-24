const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const User = require('../models/User');

const logger = require('../utils/logger');
exports.protect = async (req, res, next) => {
  try {
    let token;

    // 1) 优先使用本地JWT（Authorization: Bearer ...）
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.id);
        if (!user) {
          return res.status(401).json({ message: '用户不存在' });
        }
        req.user = user;
        return next();
      } catch (err) {
        // 如果本地JWT校验失败，继续尝试SSO回退
      }
    }

    // 2) 回退到门户SSO Cookie（portal_sso）
    const rawCookieHeader = req.headers.cookie || '';
    const ssoCookie = req.cookies && req.cookies.portal_sso;
    const hasSso = !!ssoCookie || rawCookieHeader.includes('portal_sso=');
    if (hasSso) {
      // 先尝试调用门户校验接口
      try {
        const verifyUrl = process.env.PORTAL_VERIFY_URL || 'http://127.0.0.1:3001/api/sso/verify';
        const resp = await axios.get(verifyUrl, {
          headers: {
            Cookie: rawCookieHeader
          },
          timeout: 3000
        });

        if (resp.data && resp.data.ok && resp.data.user && resp.data.user.username) {
          const username = resp.data.user.username;
          const portalUserId = resp.data.user.id;

          let user = await User.findOne({ username });
          if (!user) {
            const baseEmail = `${username}@portal.local`;
            let email = baseEmail;
            const existingEmailUser = await User.findOne({ email });
            if (existingEmailUser) {
              email = `${username}+${portalUserId}@portal.local`;
            }
            const randomPassword = `sso-${crypto.randomBytes(12).toString('hex')}`;
            user = new User({ username, email, password: randomPassword });
            await user.save();
          }

          req.user = user;
          return next();
        }
      } catch (e) {
        // 门户SSO校验失败则尝试本地解码SSO令牌
        try {
          const tokenPair = rawCookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith('portal_sso='));
          const tokenVal = ssoCookie || (tokenPair ? tokenPair.split('=')[1] : null);
          if (tokenVal) {
            const ssoSecret = process.env.PORTAL_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key';
            const ssoDecoded = jwt.verify(tokenVal, ssoSecret);
            const username = ssoDecoded.username || `portal_user_${ssoDecoded.id}`;
            const portalUserId = ssoDecoded.id;

            let user = await User.findOne({ username });
            if (!user) {
              const baseEmail = `${username}@portal.local`;
              let email = baseEmail;
              const existingEmailUser = await User.findOne({ email });
              if (existingEmailUser) {
                email = `${username}+${portalUserId}@portal.local`;
              }
              const randomPassword = `sso-${crypto.randomBytes(12).toString('hex')}`;
              user = new User({ username, email, password: randomPassword });
              await user.save();
            }

            req.user = user;
            return next();
          }
        } catch (err) {
          // 本地解码失败则继续未授权处理
        }
      }
    }

    // 3) 未提供有效的凭证
    return res.status(401).json({ message: '未授权访问，请登录' });
  } catch (error) {
    return res.status(401).json({ message: 'token或SSO凭证无效' });
  }
};