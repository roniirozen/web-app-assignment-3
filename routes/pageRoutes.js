const router = require('express').Router();
const controller = require('../controllers/pageController');
router.get('/', controller.game);
router.get('/schemas', controller.schemas);
module.exports = router;
