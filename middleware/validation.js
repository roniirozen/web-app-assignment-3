function readId(value, res) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    res.status(400).json({ message: 'IDs must be positive, safe integers.' });
    return null;
  }
  return Number(value);
}

const movieFields = {
  title: value => isText(value, 200),
  genre: value => isText(value, 80),
  year: value => Number.isInteger(value) && value >= 1888 && value <= 2100,
  rating: value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10,
  director: value => isText(value, 120),
  available: value => typeof value === 'boolean'
};
const reviewFields = {
  author: value => isText(value, 100),
  score: value => Number.isInteger(value) && value >= 1 && value <= 5,
  comment: value => isText(value, 2000)
};

function rejectInput(res, status, body) {
  // A matching PATCH subset is insufficient when an additional field is invalid.
  if (res.hasHeader('X-Stage-Correct')) body.stageCorrect = false;
  res.removeHeader('X-Stage-Correct');
  res.status(status).json(body);
}

function isText(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function validateBody(req, res, fields, partial = false) {
  if (!req.is('application/json')) {
    rejectInput(res, 415, { message: 'Use Content-Type: application/json for this request.' });
    return false;
  }
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    rejectInput(res, 400, { message: 'The body must be a JSON object.' });
    return false;
  }
  const keys = Object.keys(body);
  if (!keys.length || keys.some(key => !Object.hasOwn(fields, key))) {
    rejectInput(res, 422, { message: 'Provide editable fields only, with at least one field. See Schemas for field definitions.' });
    return false;
  }
  const invalid = Object.keys(fields).filter(key =>
    (!partial || Object.hasOwn(body, key)) && !fields[key](body[key]));
  if (invalid.length) {
    rejectInput(res, 422, { message: 'Missing or invalid fields. Check their types and ranges in Schemas.', fields: invalid });
    return false;
  }
  return true;
}

function validateQuery(query, rules, res) {
  for (const key of Object.keys(query)) {
    if (!Object.hasOwn(rules, key) || typeof query[key] !== 'string' || !rules[key](query[key])) {
      res.status(400).json({ message: `Unsupported or invalid query parameter: ${key}. Consult the API reference.` });
      return false;
    }
  }
  return true;
}

module.exports = { readId, validateBody, validateQuery, movieFields, reviewFields };
