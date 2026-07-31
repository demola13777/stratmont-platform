const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');

// ─── ADMIN GUARD ───
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') return next();
    res.status(403).json({ message: 'Access denied. Admins only.' });
};

// ─── GET ALL USERS ───
router.get('/users', protect, adminOnly, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const total = await User.countDocuments({});
        const users = await User.find({}).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit);

        res.json({
            data: users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ─── GET ALL TRANSACTIONS ───
router.get('/transactions', protect, adminOnly, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const query = {};
        if (req.query.status) query.status = req.query.status;

        const total = await Transaction.countDocuments(query);
        const txs = await Transaction.find(query)
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            data: txs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ─── APPROVE / REJECT TRANSACTION ───
router.put('/transactions/:id', protect, adminOnly, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status.' });
        }

        const tx = await Transaction.findById(req.params.id).populate('user');
        if (!tx) return res.status(404).json({ message: 'Transaction not found.' });

        tx.status = status;
        await tx.save();

        // Handle Deposit Approval
        if (status === 'approved' && tx.type === 'deposit') {
            const updateFields = {
                $inc: {
                    'balances.totalDeposit': tx.amount,
                    'balances.availableBalance': tx.amount
                }
            };
            
            if (tx.plan) {
                updateFields.$set = {
                    activePlan: tx.plan,
                    planStartDate: new Date(),
                    cycleStatus: 'active'
                };
            }

            await User.findByIdAndUpdate(tx.user._id, updateFields);
        }

        // Handle Withdrawal Rejection (Refund)
        if (status === 'rejected' && tx.type === 'withdrawal') {
            await User.findByIdAndUpdate(tx.user._id, {
                $inc: { 'balances.availableBalance': tx.amount }
            });
        }

        // Create Audit Log
        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({
            admin: req.user._id,
            action: `${status.toUpperCase()} ${tx.type}`,
            targetUser: tx.user._id,
            details: `Admin ${status} ${tx.type} of $${tx.amount}`
        });

        res.json({ message: `Transaction ${status} successfully.`, transaction: tx });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ─── GET WALLET SETTINGS ───
router.get('/settings/wallets', protect, adminOnly, async (req, res) => {
    try {
        let settings = await Settings.findOne({});
        if (!settings) {
            // Seed defaults
            settings = await Settings.create({
                activeCryptoWallet: 'placeholder',
                walletNetwork: 'USDT',
                wallets: {
                    BTC:  { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna', network: 'Bitcoin Network' },
                    ETH:  { address: '0x742d35Cc6634C0532925a3b8D4C9b1C4d4E1a2f', network: 'ERC-20 Network' },
                    USDT: { address: 'TKFLy5PEFJkZgbPH6V4eipkDrgGbUzSajF', network: 'TRC-20 Network' }
                }
            });
        }
        res.json(settings.wallets || {});
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ─── UPDATE WALLET SETTINGS ───
router.put('/settings/wallets', protect, adminOnly, async (req, res) => {
    try {
        const { BTC, ETH, USDT } = req.body;

        let settings = await Settings.findOne({});
        if (!settings) {
            settings = new Settings({ activeCryptoWallet: 'placeholder', walletNetwork: 'USDT' });
        }

        settings.wallets = {
            BTC:  { address: BTC?.address || '', network: 'Bitcoin Network' },
            ETH:  { address: ETH?.address || '', network: 'ERC-20 Network' },
            USDT: { address: USDT?.address || '', network: 'TRC-20 Network' }
        };

        await settings.save();
        res.json({ message: 'Wallet addresses updated successfully!', wallets: settings.wallets });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error updating wallets.' });
    }
});

// ─── DASHBOARD STATS ───
router.get('/stats', protect, adminOnly, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: 'user' });
        const totalDeposits = await Transaction.aggregate([
            { $match: { type: 'deposit', status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const pendingDeposits = await Transaction.countDocuments({ type: 'deposit', status: 'pending' });
        const totalTx = await Transaction.countDocuments({});

        res.json({
            totalUsers,
            totalApprovedDeposits: totalDeposits[0]?.total || 0,
            pendingDeposits,
            totalTransactions: totalTx
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
