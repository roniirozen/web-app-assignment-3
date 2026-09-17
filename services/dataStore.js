const movieSeeds = require('../data/movies.json');
const reviewSeeds = require('../data/reviews.json');

// Each application instance owns its store. Runtime writes never touch seed files.
function createDataStore() {
  const store = {
    reset() {
      this.movies = structuredClone(movieSeeds);
      this.reviews = structuredClone(reviewSeeds);
      this.nextMovieId = Math.max(...this.movies.map(movie => movie.id)) + 1;
      this.nextReviewId = Math.max(...this.reviews.map(review => review.id)) + 1;
    }
  };
  store.reset();
  return store;
}

module.exports = createDataStore;
