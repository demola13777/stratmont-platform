const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    activeCryptoWallet: { type: String, default: 'placeholder' },
    walletNetwork: { type: String, default: 'USDT' },
    wallets: {
        BTC:  { address: { type: String, default: '' }, network: { type: String, default: 'Bitcoin Network' } },
        ETH:  { address: { type: String, default: '' }, network: { type: String, default: 'ERC-20 Network' } },
        USDT: { address: { type: String, default: '' }, network: { type: String, default: 'TRC-20 Network' } }
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', SettingsSchema);
