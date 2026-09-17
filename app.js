const express = require('express');
const path = require('node:path');
const createDataStore = require('./services/dataStore');
const stageValidator = require('./middleware/stageValidator');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('case sensitive routing', true);
  app.set('query parser', 'simple');
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.locals.store = createDataStore();
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    });
    next();
  });
  app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'deny' }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '16kb' }));
  app.use(require('./routes/pageRoutes'));
  // Apply the gate before any API handler, including unknown routes and game controls.
  app.use('/api', stageValidator);
  app.use('/api/game', require('./routes/gameRoutes'));
  app.use('/api/movies', require('./routes/movieRoutes'));
  app.use('/api/reviews', require('./routes/reviewRoutes'));
  app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found.' }));
  app.use((req, res) => res.status(404).render('error', { title: 'Page not found', status: 404, message: 'This page does not exist.' }));
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
