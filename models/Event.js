const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    email: String,
    department: String,
    year: String,
    semester: String,
    phone: String,
    registeredAt: { type: Date, default: Date.now }
});

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    date: Date,
    time: String,
    venue: String,
    organizer: String,
    icon: { type: String, default: '📅' },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    registrations: [registrationSchema]
});

module.exports = mongoose.model('Event', eventSchema);