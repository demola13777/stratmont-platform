require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const SupportTicket = require('../models/SupportTicket');
const AuditLog = require('../models/AuditLog');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        await User.syncIndexes();
        console.log('User indexes synced');
        
        await Transaction.syncIndexes();
        console.log('Transaction indexes synced');
        
        await SupportTicket.syncIndexes();
        console.log('SupportTicket indexes synced');
        
        await AuditLog.syncIndexes();
        console.log('AuditLog indexes synced');
        
        console.log('All indexes synced successfully');
        process.exit(0);
    } catch (err) {
        console.error('Error syncing indexes:', err);
        process.exit(1);
    }
};

run();
