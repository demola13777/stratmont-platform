require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Plan = require('./models/Plan');

const fixUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        // Find the user who has a deposit but no active plan
        const user = await User.findOne({ 'balances.totalDeposit': { $gt: 0 }, activePlan: null });
        if (!user) {
            console.log('No user found needing a fix, or all users with deposits already have an active plan.');
            process.exit();
        }

        // Just assign them the Starter plan as a fallback fix
        const starterPlan = await Plan.findOne({ name: 'Starter' });
        
        user.activePlan = starterPlan._id;
        user.planStartDate = new Date();
        await user.save();
        
        console.log(`✅ Fixed user ${user.email} - manually assigned the Starter plan!`);
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

fixUser();
