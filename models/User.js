const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    role: String, // 'student', 'faculty', or 'alumni'
    department: String,
    year: String,
    semester: String,
    phone: String
});

module.exports = mongoose.model('User', userSchema);