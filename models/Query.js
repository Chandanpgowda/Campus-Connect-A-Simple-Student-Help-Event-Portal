const mongoose = require('mongoose');

const querySchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentName: String,
    studentEmail: String,
    studentDepartment: String,
    message: { type: String, required: true },
    status: { type: String, enum: ['pending', 'answered'], default: 'pending' },
    answer: String,
    answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    answeredAt: Date
});

module.exports = mongoose.model('Query', querySchema);