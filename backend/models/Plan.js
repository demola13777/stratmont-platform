const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true // e.g., 'Starter', 'Professional', 'Institutional'
    },
    minDeposit: {
        type: Number,
        required: true
    },
    maxDeposit: {
        type: Number,
        required: true
    },
    dailyReturnRate: {
        type: Number,
        required: true // e.g., 0.08 for 8%
    },
    durationDays: {
        type: Number,
        default: 90
    }
}, { timestamps: true });

module.exports = mongoose.model('Plan', PlanSchema);
