const { isDeepStrictEqual } = require('node:util');
const { stages } = require('../config/stages');

function normalizePath(path) {
  return path.split('/').map(segment => decodeURIComponent(segment)).join('/').replace(/\/+$/, '') || '/';
}

module.exports = function stageValidator(req, res, next) {
  const header = req.get('X-Stage-Id');
  // The API can also be used independently of the game (curl, browser, etc.).
  if (header === undefined) return next();
  const stage = /^\d+$/.test(header) && stages.find(item => String(item.id) === header);
  if (!stage) return res.status(400).json({ stageCorrect: false, message: 'X-Stage-Id must identify an existing stage.' });

  let path;
  try { path = normalizePath(req.originalUrl.split('?')[0]); }
  catch { return res.status(400).json({ stageCorrect: false, message: 'The request path contains invalid URL encoding.' }); }

  const expectedQuery = stage.query || {};
  const queryKeys = Object.keys(req.query);
  const queryMatches = queryKeys.length === Object.keys(expectedQuery).length && queryKeys.every(key => {
    const value = req.query[key];
    if (typeof value !== 'string' || !Object.hasOwn(expectedQuery, key)) return false;
    if (key === 'search' || key === 'genre') return value.toLowerCase() === expectedQuery[key].toLowerCase();
    return value === expectedQuery[key];
  });
  const body = req.body;
  let bodyMatches = stage.body ? isDeepStrictEqual(body, stage.body) : body === undefined;
  if (stage.method === 'PATCH') {
    // Required changes must match. Ordinary API validation still checks extra editable fields.
    bodyMatches = body !== null && typeof body === 'object' && !Array.isArray(body) &&
      Object.entries(stage.body).every(([key, value]) => isDeepStrictEqual(body[key], value));
  }
  if (req.method !== stage.method || path !== stage.path || !queryMatches || !bodyMatches) {
    return res.status(422).json({ stageCorrect: false, message: 'The request does not match the current challenge. Check the method, path, parameters and body.' });
  }
  // This reports request correctness, independently of the resource's HTTP status.
  res.set('X-Stage-Correct', 'true');
  return next();
};
