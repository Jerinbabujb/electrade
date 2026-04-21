const router  = require('express').Router();
const ctrl    = require('../controllers/invoicesController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get   ('/',                    ctrl.list);
router.get   ('/export/csv',          ctrl.exportCsv);
router.post  ('/',                    authorize('admin','sales'),       ctrl.create);
router.post  ('/bulk-payment',        authorize('admin','sales','accountant'), ctrl.bulkPayment);
router.get   ('/:id',                 ctrl.getOne);
router.put   ('/:id',                 authorize('admin','sales'),       ctrl.update);
router.patch ('/:id/issue',           authorize('admin','sales'),       ctrl.issue);
router.delete('/:id',                 authorize('admin'),               ctrl.void);
router.post  ('/:id/write-off',       authorize('admin'),               ctrl.writeOff);
router.delete('/:id/write-off',       authorize('admin'),               ctrl.reverseWriteOff);
router.get   ('/:id/pdf',             ctrl.getPdf);
router.get   ('/:id/print',           ctrl.getPrint);
router.post  ('/:id/email',           authorize('admin','sales'),       ctrl.sendEmail);
router.post  ('/:id/reminder',        authorize('admin','sales'),       ctrl.sendReminder);
router.post  ('/:id/payments',        authorize('admin','sales','accountant'), ctrl.addPayment);
router.get   ('/:id/payments',        ctrl.getPayments);
router.put   ('/:id/payments/:paymentId', authorize('admin','sales','accountant'), ctrl.updatePayment);
router.delete('/:id/payments/:paymentId', authorize('admin','sales','accountant'), ctrl.deletePayment);

// Consolidate multiple DNs into one invoice
router.post  ('/from-dns',            authorize('admin','sales'),       ctrl.createFromDNs);
router.post  ('/:id/clone',           authorize('admin','sales'),       ctrl.clone);

module.exports = router;
