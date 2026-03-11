const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    studentId: String,
    studentName: String,
    date: Date,
    status: String, // 'present' or 'absent'
    subject: String
});

module.exports = mongoose.model('Attendance', attendanceSchema);