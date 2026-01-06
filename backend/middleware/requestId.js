const { randomUUID } = require('crypto');

module.exports = function requestId() {
  return function (req, res, next) {
    const inbound = req.headers['x-request-id'] || req.headers['x-correlation-id'];
    req.requestId = (typeof inbound === 'string' && inbound.trim()) ? inbound.trim() : randomUUID();
    res.setHeader('x-request-id', req.requestId);
    next();
  };
};
