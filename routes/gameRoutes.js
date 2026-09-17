const router = require('express').Router();
const { publicStages } = require('../config/stages');

router.get('/stages', (req, res) => res.json(publicStages));
router.post('/reset', (req, res) => {
  // Requiring JSON prevents cross-origin HTML forms from resetting this shared demo.
  if (!req.is('application/json')) return res.status(415).json({ message: 'Reset requires application/json.' });
  const origin = req.get('Origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) {
    return res.status(403).json({ message: 'Reset must be requested from this application.' });
  }
  if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object' || Object.keys(req.body).length) {
    return res.status(400).json({ message: 'Send an empty JSON object to reset the game data.' });
  }
  req.app.locals.store.reset();
  return res.json({ message: 'The movie catalog and reviews have been restored.' });
});
module.exports = router;
