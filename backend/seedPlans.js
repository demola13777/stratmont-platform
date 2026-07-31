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
                dailyReturnRate: 8,
                durationDays: 30
            },
            {
                name: 'Professional',
                minDeposit: 10000,
                maxDeposit: 49999,
                dailyReturnRate: 12.5,
                durationDays: 30
            },
            {
                name: 'Institutional',
                minDeposit: 50000,
                maxDeposit: 150000,
                dailyReturnRate: 15,
                durationDays: 30
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
