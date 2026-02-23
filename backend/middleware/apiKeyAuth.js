const ApiKey = require('../models/ApiKey');
const logger = require('../utils/logger');

const API_KEY_HEADER = 'x-api-key';

exports.apiKeyAuth = (requiredScope = null) => {
  return async (req, res, next) => {
    try {
      const apiKey = req.headers[API_KEY_HEADER];

      if (!apiKey) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'API Key is required. Please provide it in the X-API-Key header.'
        });
      }

      if (!apiKey.startsWith('wdk_')) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid API Key format.'
        });
      }

      const apiKeyRecord = await ApiKey.findByApiKey(apiKey);

      if (!apiKeyRecord) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid or expired API Key.'
        });
      }

      if (requiredScope && !apiKeyRecord.hasScope(requiredScope)) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: `This API Key does not have the required scope: ${requiredScope}`
        });
      }

      req.user = apiKeyRecord.user;
      req.apiKey = apiKeyRecord;

      apiKeyRecord.recordUsage().catch(err => {
        logger.error('Failed to record API key usage:', err);
      });

      next();
    } catch (error) {
      logger.error('API Key authentication error:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'An error occurred during authentication.'
      });
    }
  };
};

exports.optionalApiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers[API_KEY_HEADER];

    if (!apiKey) {
      return next();
    }

    if (!apiKey.startsWith('wdk_')) {
      return next();
    }

    const apiKeyRecord = await ApiKey.findByApiKey(apiKey);

    if (apiKeyRecord) {
      req.user = apiKeyRecord.user;
      req.apiKey = apiKeyRecord;

      apiKeyRecord.recordUsage().catch(err => {
        logger.error('Failed to record API key usage:', err);
      });
    }

    next();
  } catch (error) {
    logger.error('Optional API Key authentication error:', error);
    next();
  }
};
