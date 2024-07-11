const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    messages: { type: Number, default: 0 },
    invites: { type: Number, default: 0 },
    voice: { type: Number, default: 0 } // Ses süresi milisaniye cinsinden
});

module.exports = mongoose.model('User', userSchema);