const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['job', 'motivation', 'resource', 'event', 'general'], default: 'general' },
    author: { type: String, required: true }, // alumni name
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorEmail: String,
    authorDepartment: String,
    // Job specific fields
    company: String,
    location: String,
    jobType: String,
    experience: String,
    applyLink: String,
    // Event specific fields
    eventDate: Date,
    eventTime: String,
    venue: String,
    regLink: String,
    // Common
    imageUrl: String,
    tags: [String],
    visibility: { type: String, enum: ['public', 'students', 'alumni'], default: 'public' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);