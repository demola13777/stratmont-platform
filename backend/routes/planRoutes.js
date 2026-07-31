const express = require('express');
const router = express.Router();
const Plan = require('../models/Plan');

// @route   GET /api/plans
// @desc    Get all investment plans
// @access  Public
router.get('/', async (req, res) => {
    try {
        const plans = await Plan.find().sort({ minDeposit: 1 });
        
        // Add the visual features array before sending to frontend
        const formattedPlans = plans.map(p => {
            const planObj = p.toObject();
            planObj.features = [
                `Daily ROI: ${p.dailyReturnRate}%`,
                `Min: $${p.minDeposit.toLocaleString()}`,
                `Max: $${p.maxDeposit.toLocaleString()}`,
                `3-Month Term (90 Days)`,
                p.name === 'Institutional' ? 'Dedicated Manager' : (p.name === 'Professional' ? 'Priority Support' : 'Email Support')
            ];
            return planObj;
        });

        res.json(formattedPlans);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error fetching plans' });
    }
});

module.exports = router;
