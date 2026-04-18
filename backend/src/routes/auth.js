// ── auth.js ────────────────────────────────────────────────
const authRouter = require('express').Router()
const authCtrl   = require('../controllers/authController')
const { authenticate, authorize } = require('../middleware/auth')

authRouter.post('/login',                                     authCtrl.login)
authRouter.get ('/me',          authenticate,                 authCtrl.me)
authRouter.get ('/users',       authenticate, authorize('admin'), authCtrl.listUsers)
authRouter.post('/users',       authenticate, authorize('admin'), authCtrl.createUser)
authRouter.put ('/users/:id',          authenticate, authorize('admin'), authCtrl.updateUser)
authRouter.put ('/users/:id/password', authenticate, authorize('admin'), authCtrl.changePassword)
module.exports = authRouter
