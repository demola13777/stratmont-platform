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
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        const query = {};
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { name: searchRegex },
                { email: searchRegex }
            ];
        }

        const total = await User.countDocuments(query);
        const users = await User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit);

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
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;
        const query = {};
        if (req.query.status) query.status = req.query.status;

        const total = await Transaction.countDocuments(query);
        const txs = await Transaction.find(query)
            .populate('user', 'name email')
            .sort({ createdAt: -1 });

        // Apply search filter if provided (since we need to filter by populated user fields)
        let filteredTxs = txs;
        if (req.query.search) {
            const searchLower = req.query.search.toLowerCase();
            filteredTxs = txs.filter(t => 
                (t.user && t.user.name && t.user.name.toLowerCase().includes(searchLower)) ||
                (t.user && t.user.email && t.user.email.toLowerCase().includes(searchLower)) ||
                (t.txId && t.txId.toLowerCase().includes(searchLower))
            );
        }
        
        // Manual pagination for filtered results
        const paginatedTxs = filteredTxs.slice(skip, skip + limit);

        res.json({
            data: paginatedTxs,
            pagination: {
                page,
                limit,
                total: filteredTxs.length,
                totalPages: Math.ceil(filteredTxs.length / limit)
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

        if (tx.status !== 'pending') {
            return res.status(400).json({ message: `Transaction is already ${tx.status} and cannot be processed again.` });
        }

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
                walletNetwork: 'SOL',
                wallets: {
                    BTC:  { address: 'Configure in Admin Panel', network: 'Bitcoin Network' },
                    ETH:  { address: 'Configure in Admin Panel', network: 'ERC-20 Network' },
                    SOL: { address: 'Configure in Admin Panel', network: 'SPL Network' },
                    DOGE: { address: 'Configure in Admin Panel', network: 'Dogecoin Network' }
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
        const { BTC, ETH, SOL, DOGE } = req.body;

        let settings = await Settings.findOne({});
        if (!settings) {
            settings = new Settings({ activeCryptoWallet: 'placeholder', walletNetwork: 'SOL' });
        }

        settings.wallets = {
            BTC:  { address: BTC?.address || '', network: 'Bitcoin Network' },
            ETH:  { address: ETH?.address || '', network: 'ERC-20 Network' },
            SOL: { address: SOL?.address || '', network: 'SPL Network' },
                DOGE: { address: DOGE?.address || '', network: 'Dogecoin Network' }
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

router.get("/audit-logs", protect, adminOnly, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        const AuditLog = require('../models/AuditLog');
        const total = await AuditLog.countDocuments({});
        const logs = await AuditLog.find({})
            .populate('admin', 'name email')
            .populate('targetUser', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            data: logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching audit logs.' });
    }
});

// ─── MANUAL BALANCE ADJUSTMENT ───
router.put('/users/:id/balance', protect, adminOnly, async (req, res) => {
    try {
        const { availableBalance, totalDeposit, totalEarnings, reason } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (availableBalance !== undefined) {
            const val = Number(availableBalance);
            if (isNaN(val) || val < 0) return res.status(400).json({ message: 'Invalid available balance value' });
            user.balances.availableBalance = val;
        }
        if (totalDeposit !== undefined) {
            const val = Number(totalDeposit);
            if (isNaN(val) || val < 0) return res.status(400).json({ message: 'Invalid total deposit value' });
            user.balances.totalDeposit = val;
        }
        if (totalEarnings !== undefined) {
            const val = Number(totalEarnings);
            if (isNaN(val) || val < 0) return res.status(400).json({ message: 'Invalid total earnings value' });
            user.balances.totalEarnings = val;
        }

        await user.save();

        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({
            admin: req.user._id,
            action: 'MANUAL_BALANCE_ADJUST',
            targetUser: user._id,
            details: `Admin manually adjusted balances for ${user.email}. ${reason ? `Reason: ${reason}` : ''}`
        });

        res.json({ message: 'Balance adjusted successfully', user });
    } catch (err) {
        res.status(500).json({ message: 'Server error adjusting balance.' });
    }
});

// ─── UPDATE ACCOUNT STATUS (SUSPEND/BAN) ───
router.put('/users/:id/status', protect, adminOnly, async (req, res) => {
    try {
        const { status, reason } = req.body;
        if (!['active', 'suspended', 'banned'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status provided.' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Don't let admins suspend themselves
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: 'Cannot modify your own status.' });
        }

        user.status = status;
        await user.save();

        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({
            admin: req.user._id,
            action: `ACCOUNT_STATUS_CHANGE`,
            targetUser: user._id,
            details: `Admin changed account status to ${status.toUpperCase()}. ${reason ? `Reason: ${reason}` : ''}`
        });

        res.json({ message: `Account status updated to ${status}`, user });
    } catch (err) {
        res.status(500).json({ message: 'Server error updating status.' });
    }
});

module.exports = router;
