const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Settings = require('../models/Settings');

// @route   POST /api/transactions/deposit
// @desc    Submit a deposit request
// @access  Private
router.post('/deposit', protect, async (req, res) => {
    try {
        const { amount, planId, walletAddressUsed, transactionHash, coin } = req.body;

        if (!amount || !planId || !walletAddressUsed) {
            return res.status(400).json({ message: 'Amount, plan, and wallet address are required.' });
        }

        // Check for existing pending deposit to prevent duplicates
        const existingPending = await Transaction.findOne({ user: req.user._id, type: 'deposit', status: 'pending' });
        if (existingPending) {
            return res.status(400).json({ message: 'You already have a pending deposit. Please wait for admin approval.' });
        }

        const transaction = await Transaction.create({
            user: req.user._id,
            type: 'deposit',
            amount: parseFloat(amount),
            status: 'pending',
            walletAddressUsed,
            transactionHash: transactionHash || null,
            coin: coin || 'USDT',
            plan: planId
        });

        res.status(201).json({
            message: 'Deposit submitted successfully! It is now pending admin approval.',
            transaction
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error submitting deposit.' });
    }
});

// @route   GET /api/transactions/my
// @desc    Get logged-in user's transactions
// @access  Private
router.get('/my', protect, async (req, res) => {
    try {
        const transactions = await Transaction.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20);
        res.json(transactions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching transactions.' });
    }
});

// @route   POST /api/transactions/withdraw
// @desc    Submit a withdrawal request
// @access  Private
router.post('/withdraw', protect, async (req, res) => {
    try {
        const { amount, walletAddress, coin } = req.body;
        if (!amount || !walletAddress) return res.status(400).json({ message: 'Amount and wallet address are required.' });

        const user = await User.findById(req.user._id);

        if (user.cycleStatus !== 'completed') {
            return res.status(400).json({ message: 'Withdrawals are locked until your 90-day cycle completes.' });
        }

        if (amount > user.balances.availableBalance) {
            return res.status(400).json({ message: 'Insufficient available balance.' });
        }

        // Check for existing pending withdrawal
        const pendingWithdrawal = await Transaction.findOne({ user: user._id, type: 'withdrawal', status: 'pending' });
        if (pendingWithdrawal) {
            return res.status(400).json({ message: 'You already have a pending withdrawal request.' });
        }

        // Deduct from available balance immediately to prevent double spending
        user.balances.availableBalance -= amount;
        await user.save();

        const transaction = await Transaction.create({
            user: user._id,
            type: 'withdrawal',
            amount,
            coin: coin || 'USDT', // user's crypto
            status: 'pending'
        });

        res.status(201).json({ message: 'Withdrawal request submitted successfully.', transaction });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/transactions/reinvest
// @desc    Reinvest available balance to start a new 90-day cycle
// @access  Private
router.post('/reinvest', protect, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.user._id);
        
        if (user.cycleStatus !== 'completed') {
            return res.status(400).json({ message: 'You can only reinvest when your cycle is completed.' });
        }

        if (user.balances.availableBalance <= 0) {
            return res.status(400).json({ message: 'No available balance to reinvest.' });
        }

        const reinvestAmount = amount ? parseFloat(amount) : user.balances.availableBalance;
        
        if (reinvestAmount > user.balances.availableBalance || reinvestAmount <= 0) {
            return res.status(400).json({ message: 'Invalid reinvestment amount.' });
        }

        // Reinvest available balance directly into total deposit
        user.balances.totalDeposit += reinvestAmount;
        user.balances.availableBalance -= reinvestAmount;
        
        user.cycleStatus = 'active';
        user.planStartDate = new Date();

        await user.save();

        await Transaction.create({
            user: user._id,
            type: 'reinvestment',
            amount: reinvestAmount,
            status: 'approved',
            coin: 'USD'
        });

        res.json({ message: 'Reinvestment successful! A new 90-day cycle has begun.', balances: user.balances });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
