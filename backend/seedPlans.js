require('dotenv').config();
const mongoose = require('mongoose');
const Plan = require('./models/Plan');

const seedPlans = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        // Clear existing to avoid duplicates if run multiple times
        await Plan.deleteMany({});

        const plans = [
            {
                name: 'Starter',
                minDeposit: 1000,
                maxDeposit: 9999,
                dailyReturnRate: 1.67,
                durationDays: 90
            },
            {
                name: 'Professional',
                minDeposit: 10000,
                maxDeposit: 49999,
                dailyReturnRate: 2.22,
                durationDays: 90
            },
            {
                name: 'Institutional',
                minDeposit: 50000,
                maxDeposit: 150000,
                dailyReturnRate: 3.33,
                durationDays: 90
            }
        ];

        await Plan.insertMany(plans);
        console.log('✅ Plans seeded successfully!');
        process.exit();
    } catch (error) {
        console.error('Error seeding plans:', error);
        process.exit(1);
    }
};

seedPlans();
