const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');

// Default wallets used if no settings found in DB yet
const defaultWallets = {
    BTC:  { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna', network: 'Bitcoin Network' },
    ETH:  { address: '0x742d35Cc6634C0532925a3b8D4C9b1C4d4E1a2f', network: 'ERC-20 Network' },
    USDT: { address: 'TKFLy5PEFJkZgbPH6V4eipkDrgGbUzSajF', network: 'TRC-20 Network' }
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
