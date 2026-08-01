const cron = require('node-cron');
const User = require('./models/User');
const Plan = require('./models/Plan');
const Transaction = require('./models/Transaction');

const startCronJobs = () => {
    // Run exactly at Midnight UTC every single day
    // 0 0 * * * = minute 0, hour 0, any day, any month, any week
    cron.schedule('0 0 * * *', async () => {
        console.log('⏳ [CRON] Starting Daily Yield Processing at Midnight UTC');
        try {
            // Find all users who have an active plan
            const users = await User.find({ activePlan: { $ne: null } }).populate('activePlan');
            let processedCount = 0;
            let totalYieldPaid = 0;

            for (const user of users) {
                // Failsafe: check if plan populated correctly
                if (!user.activePlan || !user.activePlan.dailyReturnRate) continue;

                // Check if user cycle has completed 90 days
                if (user.planStartDate) {
                    const daysPassed = (new Date() - new Date(user.planStartDate)) / (1000 * 60 * 60 * 24);
                    if (daysPassed >= user.activePlan.durationDays) {
                        // Mark cycle completed and skip yield
                        await User.findByIdAndUpdate(user._id, { cycleStatus: 'completed' });
                        continue;
                    }
                }

                // Skip if already manually marked completed
                if (user.cycleStatus === 'completed') continue;

                // Calculate yield based on their total deposit
                const dailyRate = user.activePlan.dailyReturnRate / 100;
                const yieldAmount = user.balances.totalDeposit * dailyRate;

                if (yieldAmount <= 0) continue;

                // 1. Create the yield transaction record
                await Transaction.create({
                    user: user._id,
                    type: 'daily_yield',
                    amount: yieldAmount,
                    status: 'approved',
                    coin: 'USD',
                    plan: user.activePlan.name
                });

                // 2. Increment their balances
                await User.findByIdAndUpdate(user._id, {
                    $inc: {
                        'balances.totalEarnings': yieldAmount,
                        'balances.availableBalance': yieldAmount
                    }
                });

                processedCount++;
                totalYieldPaid += yieldAmount;
            }

            console.log(`✅ [CRON] Daily Yield Complete! Processed ${processedCount} users. Total paid: $${totalYieldPaid.toFixed(2)}`);
        } catch (error) {
            console.error('❌ [CRON] Daily Yield Error:', error);
        }
    }, {
        scheduled: true,
        timezone: "UTC"
    });

    console.log('🕰️  Cron jobs initialized. Daily Yield scheduled for Midnight UTC.');
};

module.exports = startCronJobs;
