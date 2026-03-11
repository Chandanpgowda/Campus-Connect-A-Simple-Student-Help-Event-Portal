const mongoose = require('mongoose');

const lostItemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, enum: ['lost', 'found'], required: true },
    location: String,
    date: Date,
    contact: String,
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportedByName: String,
    imageUrl: String,   // 👈 new field for uploaded image
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LostItem', lostItemSchema);