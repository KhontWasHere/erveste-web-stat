const mongoose = require('mongoose');

const giveawayParticipantSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    giveawayId: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GiveawayParticipant', giveawayParticipantSchema);