const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');

// Default wallets used if no settings found in DB yet
const defaultWallets = {
    BTC:  { address: 'Configure in Admin Panel', network: 'Bitcoin Network' },
    ETH:  { address: 'Configure in Admin Panel', network: 'ERC-20 Network' },
    SOL: { address: 'Configure in Admin Panel', network: 'SPL Network' },
                DOGE: { address: 'Configure in Admin Panel', network: 'Dogecoin Network' }
};

// @route   GET /api/settings/wallets
// @desc    Get active crypto wallet addresses
// @access  Public
router.get('/wallets', async (req, res) => {
    try {
        // Try to fetch from database first
        const settings = await Settings.findOne({});

        if (settings && settings.wallets) {
            return res.json(settings.wallets);
        }

        // Fall back to defaults
        res.json(defaultWallets);
    } catch (error) {
        console.error(error);
        // On any error, always return usable defaults
        res.json(defaultWallets);
    }
});

module.exports = router;
