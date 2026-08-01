const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../utils/emailService');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '24h',
    });
};

const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: '7d',
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Please add all fields' });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const code = emailService.generateCode();
        const hashedCode = await bcrypt.hash(code, salt);
        const codeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
        const userRole = adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            verificationCode: hashedCode,
            verificationCodeExpiry: codeExpiry,
            isVerified: false,
            role: userRole
        });

        await emailService.sendVerificationCode(user.email, code);

        res.status(201).json({
            message: 'Verification code sent',
            email: user.email
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Verify registration code
// @route   POST /api/auth/verify-code
// @access  Public
const verifyCode = async (req, res) => {
    const { email, code } = req.body;

    try {
        if (!email || !code) {
            return res.status(400).json({ message: 'Email and code are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'User is already verified' });
        }

        if (!user.verificationCode || !user.verificationCodeExpiry) {
            return res.status(400).json({ message: 'No verification code found' });
        }

        if (new Date() > user.verificationCodeExpiry) {
            return res.status(400).json({ message: 'Verification code expired' });
        }

        const isMatch = await bcrypt.compare(code, user.verificationCode);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        user.isVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpiry = undefined;
        user.lastVerifiedAt = new Date();
        
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        user.refreshToken = refreshToken;
        
        await user.save();

        res.json({
            user: {
                _id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified
            },
            token,
            refreshToken
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user && (await bcrypt.compare(password, user.password))) {
            const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
            
            // Auto-promote if they are in allowlist but not an admin yet
            if (adminEmails.includes(user.email.toLowerCase()) && user.role !== 'admin') {
                user.role = 'admin';
                await user.save();
            }

            if (!user.isVerified) {
                // If not verified, they must verify. The frontend will handle this by showing the verification screen and triggering resend-code.
                return res.status(403).json({ message: 'Please verify your email first', requiresVerification: true });
            }

            // ADMIN 2FA LOGIC
            if (user.role === 'admin') {
                const code = emailService.generateCode();
                const salt = await bcrypt.genSalt(10);
                const hashedCode = await bcrypt.hash(code, salt);
                
                user.loginVerificationCode = hashedCode;
                user.loginVerificationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);
                await user.save();
                
                await emailService.sendLoginVerificationCode(user.email, code);
                
                return res.json({ message: 'Admin 2FA required', requiresAdmin2FA: true, email: user.email });
            }

            // Standard User: Immediately issue token since they are already verified
            const token = generateToken(user._id);
            const refreshToken = generateRefreshToken(user._id);
            user.refreshToken = refreshToken;
            
            await user.save();

            res.json({
                user: {
                    _id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    isVerified: user.isVerified
                },
                token,
                refreshToken
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Verify admin 2FA login code
// @route   POST /api/auth/verify-admin
// @access  Public
const verifyAdmin = async (req, res) => {
    const { email, code } = req.body;

    try {
        if (!email || !code) {
            return res.status(400).json({ message: 'Email and code are required' });
        }

        const user = await User.findOne({ email });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (!user.loginVerificationCode || !user.loginVerificationCodeExpiry) {
            return res.status(400).json({ message: 'No active login session' });
        }

        if (new Date() > user.loginVerificationCodeExpiry) {
            return res.status(400).json({ message: 'Verification code expired' });
        }

        const isMatch = await bcrypt.compare(code, user.loginVerificationCode);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        // Clear 2FA code
        user.loginVerificationCode = undefined;
        user.loginVerificationCodeExpiry = undefined;

        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        user.refreshToken = refreshToken;
        
        await user.save();

        res.json({
            user: {
                _id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified
            },
            token,
            refreshToken
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh-token
// @access  Public
const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ message: 'No refresh token provided' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }

        const newToken = generateToken(user._id);
        const newRefreshToken = generateRefreshToken(user._id);
        
        user.refreshToken = newRefreshToken;
        await user.save();

        res.json({
            token: newToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: 'Invalid or expired refresh token' });
    }
};

// @desc    Resend code
// @route   POST /api/auth/resend-code
// @access  Public
const resendCode = async (req, res) => {
    const { email, type } = req.body;

    try {
        if (!email || !['register', 'login'].includes(type)) {
            return res.status(400).json({ message: 'Valid email and type are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        const code = emailService.generateCode();
        const salt = await bcrypt.genSalt(10);
        const hashedCode = await bcrypt.hash(code, salt);
        const codeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        if (type === 'register') {
            if (user.isVerified) {
                return res.status(400).json({ message: 'User is already verified' });
            }
            user.verificationCode = hashedCode;
            user.verificationCodeExpiry = codeExpiry;
            await emailService.sendVerificationCode(user.email, code);
        } else if (type === 'login') {
            user.loginVerificationCode = hashedCode;
            user.loginVerificationCodeExpiry = codeExpiry;
            await emailService.sendLoginVerificationCode(user.email, code);
        }

        await user.save();

        res.json({ message: 'Code resent' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// keep for backwards compatibility if needed
const verifyEmail = async (req, res) => {
    res.status(400).json({ message: 'Endpoint deprecated. Use /verify-code' });
};

module.exports = {
    registerUser,
    loginUser,
    verifyCode,
    verifyAdmin,
    refreshToken,
    resendCode,
    verifyEmail
};
