const router = require('express').Router();
const queryCtrl = require('../controllers/queryController');
const jwtAuth = require('../middleware/jwtAuth');

const adminCheck = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
};

router.post('/', jwtAuth, queryCtrl.createQuery);
router.post('/ask-gemini', jwtAuth, queryCtrl.askGemini);
router.get('/', jwtAuth, adminCheck, queryCtrl.getQueries);
router.post('/optimize', jwtAuth, adminCheck, queryCtrl.optimizeQuery);
router.post('/:id/answer', jwtAuth, adminCheck, queryCtrl.answerQuery);
router.delete('/:id', jwtAuth, adminCheck, queryCtrl.deleteQuery);

module.exports = router;
