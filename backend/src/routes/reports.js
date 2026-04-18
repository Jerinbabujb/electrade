const router = require('express').Router();
const ctrl   = require('../controllers/reportsController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// These are accessible to all authenticated roles (no role restriction)
router.get('/statement', ctrl.statement);
router.get('/dashboard',  ctrl.dashboard);

router.use(authorize('admin','accountant','sales'));
router.get('/vat',            ctrl.vatReport);
router.get('/profit-loss',    ctrl.profitLoss);
router.get('/balance-sheet',  ctrl.balanceSheet);
router.get('/overdue',        ctrl.overdue);
router.get('/ar-aging',       ctrl.arAging);
router.get('/ap-aging',       ctrl.apAging);
router.get('/stock',          ctrl.stockValuation);
router.get('/bad-debt',       ctrl.badDebtCandidates);

module.exports = router;
