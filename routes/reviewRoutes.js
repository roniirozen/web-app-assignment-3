const router = require('express').Router();
const controller = require('../controllers/reviewController');
router.get('/', controller.list);
router.route('/:id').get(controller.get).put(controller.replace).delete(controller.remove);
module.exports = router;
