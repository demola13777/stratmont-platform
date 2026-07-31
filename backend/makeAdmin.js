// One-time script: run this to promote your account to admin
// Usage: node makeAdmin.js your@email.com

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const email = process.argv[2];
if (!email) { console.log('Usage: node makeAdmin.js your@email.com'); process.exit(1); }

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { new: true });
        if (!user) { console.log(`❌ No user found with email: ${email}`); }
        else { console.log(`✅ ${user.name} (${user.email}) is now an admin.`); }
        mongoose.disconnect();
    })
    .catch(err => { console.error('DB Error:', err.message); process.exit(1); });
