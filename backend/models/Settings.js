const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    activeCryptoWallet: { type: String, default: 'placeholder' },
    walletNetwork: { type: String, default: 'SOL' },
    wallets: {
        BTC:  { address: { type: String, default: '' }, network: { type: String, default: 'Bitcoin Network' } },
        ETH:  { address: { type: String, default: '' }, network: { type: String, default: 'ERC-20 Network' } },
        SOL: { address: { type: String, default: '' }, network: { type: String, default: 'SPL Network' } },
        DOGE: { address: { type: String, default: '' }, network: { type: String, default: 'Dogecoin Network' } }
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', SettingsSchema);
