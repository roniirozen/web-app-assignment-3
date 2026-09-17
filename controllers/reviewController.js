const { readId, validateBody, validateQuery, reviewFields } = require('../middleware/validation');

exports.list = (req, res) => {
  const query = req.query;
  if (!validateQuery(query, {
    minScore: value => /^[1-5]$/.test(value),
    sort: value => ['score_desc', 'score_asc'].includes(value)
  }, res)) return;
  let reviews = [...req.app.locals.store.reviews];
  if (query.minScore) reviews = reviews.filter(review => review.score >= Number(query.minScore));
  if (query.sort) reviews.sort((a, b) => query.sort === 'score_desc' ? b.score - a.score : a.score - b.score);
  res.json(reviews);
};

function findReview(req, res) {
  const id = readId(req.params.id, res);
  if (id === null) return null;
  const review = req.app.locals.store.reviews.find(item => item.id === id);
  if (!review) res.status(404).json({ message: 'Review not found.' });
  return review;
}

exports.get = (req, res) => {
  const review = findReview(req, res);
  if (review) res.json(review);
};

exports.remove = (req, res) => {
  const review = findReview(req, res);
  if (!review) return;
  const store = req.app.locals.store;
  store.reviews = store.reviews.filter(item => item.id !== review.id);
  res.status(204).end();
};

exports.replace = (req, res) => {
  const review = findReview(req, res);
  if (!review || !validateBody(req, res, reviewFields)) return;
  const replacement = { id: review.id, movieId: review.movieId, ...req.body };
  const store = req.app.locals.store;
  store.reviews[store.reviews.findIndex(item => item.id === review.id)] = replacement;
  res.json(replacement);
};
