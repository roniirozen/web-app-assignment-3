// Private validation rules: never serialize these objects into a response or template.
const stages = [
  { id: 1, title: 'Meet the catalog', description: 'Retrieve the complete movie catalog. Start with the collection itself, without filtering the results.', method: 'GET', path: '/api/movies' },
  { id: 2, title: 'One movie, one identifier', description: 'Retrieve the movie whose ID is 2. Try a named placeholder in the path and supply its value in Route Parameters.', method: 'GET', path: '/api/movies/2' },
  { id: 3, title: 'Find your next action film', description: 'Retrieve Action movies released from 2010 onward, ordered from highest rating to lowest. Combine filters and sorting in Query Parameters. The API reference lists the supported parameter names.', method: 'GET', path: '/api/movies', query: { genre: 'Action', minYear: '2010', sort: 'rating_desc' } },
  { id: 4, title: 'A shot in the dark', description: 'Find movies with titles containing the word “dark”. The title search is case-insensitive.', method: 'GET', path: '/api/movies', query: { search: 'dark' } },
  { id: 5, title: 'Make room for Arrival', description: 'Add a movie with title “Arrival”, genre “Sci-Fi”, year 2016, rating 7.9, director “Denis Villeneuve”, and available set to true. Use the schema to build a JSON body and inspect the creation status.', method: 'POST', path: '/api/movies', body: { title: 'Arrival', genre: 'Sci-Fi', year: 2016, rating: 7.9, director: 'Denis Villeneuve', available: true } },
  { id: 6, title: 'A small change', description: 'Partially update movie ID 3: set its rating to 9.1 and its availability to false. Keep its other details intact.', method: 'PATCH', path: '/api/movies/3', body: { rating: 9.1, available: false } },
  { id: 7, title: 'Follow the relationship', description: 'Retrieve all reviews belonging to movie ID 2 using the nested resource relationship. Try a route parameter for the movie identifier.', method: 'GET', path: '/api/movies/2/reviews' },
  { id: 8, title: 'Join the conversation', description: 'Add a review to movie ID 2. The author is “Alex”, the score is 5, and the comment is “Excellent movie”. The server derives the movie relationship from the path.', method: 'POST', path: '/api/movies/2/reviews', body: { author: 'Alex', score: 5, comment: 'Excellent movie' } },
  { id: 9, title: 'The audience favorites', description: 'Retrieve reviews scoring at least 4, sorted from highest score to lowest. Combine the review filter and sorting parameters.', method: 'GET', path: '/api/reviews', query: { minScore: '4', sort: 'score_desc' } },
  { id: 10, title: 'The final cut', description: 'Delete review ID 1. Inspect how the server responds when an operation succeeds without returning a response body.', method: 'DELETE', path: '/api/reviews/1' },
  { id: 11, title: 'Missing, and that’s okay', description: 'Try to retrieve movie ID 999 and inspect the server response. A correctly constructed request can lead to an HTTP error; that response is the lesson here.', method: 'GET', path: '/api/movies/999' },
  { id: 12, title: 'A fresh perspective', description: 'Fully replace the editable fields of review ID 2: author “Jamie”, score 4, and comment “Great visuals and soundtrack”. Preserve its identity and movie relationship.', method: 'PUT', path: '/api/reviews/2', body: { author: 'Jamie', score: 4, comment: 'Great visuals and soundtrack' } }
];

// An explicit allowlist prevents accidental disclosure of validation configuration.
const publicStages = stages.map(({ id, title, description }) => ({ id, title, description }));
module.exports = { stages, publicStages };
