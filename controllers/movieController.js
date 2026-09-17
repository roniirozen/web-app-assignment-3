const { readId, validateBody, validateQuery, movieFields, reviewFields } = require('../middleware/validation');

exports.list = (req, res) => {
  const query = req.query;
  if (!validateQuery(query, {
    genre: value => value.trim().length > 0 && value.length <= 80,
    minYear: value => /^\d{4}$/.test(value) && Number(value) >= 1888 && Number(value) <= 2100,
    search: value => value.trim().length > 0 && value.length <= 200,
    sort: value => ['rating_desc', 'rating_asc', 'year_desc', 'year_asc', 'title_asc'].includes(value)
  }, res)) return;
  let movies = [...req.app.locals.store.movies];
  if (query.genre) movies = movies.filter(movie => movie.genre.toLowerCase() === query.genre.toLowerCase());
  if (query.minYear) movies = movies.filter(movie => movie.year >= Number(query.minYear));
  if (query.search) movies = movies.filter(movie => movie.title.toLowerCase().includes(query.search.toLowerCase()));
  const sorts = {
    rating_desc: (a, b) => b.rating - a.rating,
    rating_asc: (a, b) => a.rating - b.rating,
    year_desc: (a, b) => b.year - a.year,
    year_asc: (a, b) => a.year - b.year,
    title_asc: (a, b) => a.title.localeCompare(b.title)
  };
  if (query.sort) movies.sort(sorts[query.sort]);
  res.json(movies);
};

function findMovie(req, res) {
  const id = readId(req.params.id, res);
  if (id === null) return null;
  const movie = req.app.locals.store.movies.find(item => item.id === id);
  if (!movie) res.status(404).json({ message: 'Movie not found.' });
  return movie;
}

exports.get = (req, res) => {
  const movie = findMovie(req, res);
  if (movie) res.json(movie);
};

exports.create = (req, res) => {
  if (!validateBody(req, res, movieFields)) return;
  const store = req.app.locals.store;
  const movie = { id: store.nextMovieId++, ...req.body };
  store.movies.push(movie);
  res.location(`/api/movies/${movie.id}`).status(201).json(movie);
};

exports.patch = (req, res) => {
  const movie = findMovie(req, res);
  if (!movie || !validateBody(req, res, movieFields, true)) return;
  Object.assign(movie, req.body);
  res.json(movie);
};

exports.remove = (req, res) => {
  const movie = findMovie(req, res);
  if (!movie) return;
  const store = req.app.locals.store;
  store.movies = store.movies.filter(item => item.id !== movie.id);
  // Cascade deletion preserves the relationship invariant without a database.
  store.reviews = store.reviews.filter(review => review.movieId !== movie.id);
  res.status(204).end();
};

exports.listReviews = (req, res) => {
  const movie = findMovie(req, res);
  if (movie) res.json(req.app.locals.store.reviews.filter(review => review.movieId === movie.id));
};

exports.createReview = (req, res) => {
  const movie = findMovie(req, res);
  if (!movie || !validateBody(req, res, reviewFields)) return;
  const store = req.app.locals.store;
  const review = { id: store.nextReviewId++, movieId: movie.id, ...req.body };
  store.reviews.push(review);
  res.location(`/api/reviews/${review.id}`).status(201).json(review);
};
