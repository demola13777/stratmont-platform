const express = require('express');
const router = express.Router();
const { 
    registerUser, 
    loginUser, 
    verifyCode, 
    verifyAdmin,
    refreshToken,
    resendCode,
    verifyEmail 
} = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-code', verifyCode);
router.post('/verify-admin', verifyAdmin);
router.post('/refresh-token', refreshToken);
router.post('/resend-code', resendCode);

// Legacy route
router.get('/verify/:token', verifyEmail);

module.exports = router;
