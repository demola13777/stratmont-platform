const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: {
        type: String
    },
    verificationCode: String,
    verificationCodeExpiry: Date,
    loginVerificationCode: String,
    loginVerificationCodeExpiry: Date,
    lastVerifiedAt: Date,
    refreshToken: String,
    balances: {
        totalDeposit: {
            type: Number,
            default: 0
        },
        totalEarnings: {
            type: Number,
            default: 0
        },
        availableBalance: {
            type: Number,
            default: 0
        }
    },
    activePlan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        default: null
    },
    planStartDate: {
        type: Date,
        default: null
    },
    cycleStatus: {
        type: String,
        enum: ['active', 'completed'],
        default: 'active'
    }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
