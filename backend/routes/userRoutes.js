const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');

// @route   GET /api/user/dashboard
// @desc    Get user dashboard data with real balances
// @access  Private
router.get('/dashboard', protect, async (req, res) => {
    try {
        // Always fetch fresh from DB so balances reflect latest admin approvals
        const user = await User.findById(req.user._id)
            .select('-password')
            .populate('activePlan');

        res.json({
            user: {
                name: user.name,
                email: user.email
            },
            balances: {
                availableBalance: user.balances?.availableBalance || 0,
                totalDeposit:     user.balances?.totalDeposit     || 0,
                totalEarnings:    user.balances?.totalEarnings    || 0
            },
            activePlan: user.activePlan || null,
            cycleStatus: user.cycleStatus,
            planStartDate: user.planStartDate
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching dashboard' });
    }
});

module.exports = router;
