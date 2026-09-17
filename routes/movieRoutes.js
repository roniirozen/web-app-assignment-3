const router = require('express').Router();
const controller = require('../controllers/movieController');
router.route('/').get(controller.list).post(controller.create);
router.route('/:id/reviews').get(controller.listReviews).post(controller.createReview);
router.route('/:id').get(controller.get).patch(controller.patch).delete(controller.remove);
module.exports = router;
