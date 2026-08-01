const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['deposit', 'withdrawal', 'daily_yield', 'reinvestment'],
        required: true
    },
    coin: {
        type: String,
        enum: ['BTC', 'ETH', 'USDT', 'USD'],
        default: 'USDT'
    },
    plan: {
        type: String,
        default: null
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    walletAddressUsed: {
        type: String,
        default: null
    },
    walletAddress: {
        type: String, // Destination address for withdrawals
        default: null
    },
    transactionHash: {
        type: String, // If user provides a tx hash for their crypto deposit
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
