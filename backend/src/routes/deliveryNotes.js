const router = require('express').Router();
const ctrl   = require('../controllers/deliveryNotesController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get   ('/',                 ctrl.list);
router.post  ('/',                 authorize('admin','sales','storekeeper'), ctrl.create);
router.post  ('/quote-from-dns',   authorize('admin','sales'),               ctrl.quoteFromDNs);
router.get   ('/:id',              ctrl.getOne);
router.put   ('/:id/cancel',       authorize('admin'),                       ctrl.cancel);
router.post  ('/:id/to-invoice',   authorize('admin','sales'),               ctrl.convertToInvoice);
router.get   ('/:id/pdf',          ctrl.getPdf);
router.get   ('/:id/print',        ctrl.getPrint);

module.exports = router;
