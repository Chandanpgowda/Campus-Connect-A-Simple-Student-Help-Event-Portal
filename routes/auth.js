const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Models
const Attendance = require('../models/Attendance');
const Query = require('../models/Query');
const LostItem = require('../models/LostItem');
const Event = require('../models/Event');
const Club = require('../models/Club');
const Post = require('../models/Post');

// ==================== AUTH ROUTES ====================

// Signup
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password, role, department, year, semester, phone } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.send('User already exists! <a href="/">Login</a>');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name, email, password: hashedPassword, role, department, year, semester, phone
        });
        await user.save();
        res.redirect('/');
    } catch (error) {
        res.send('Error creating user: ' + error.message);
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const user = await User.findOne({ email, role });
        if (!user) {
            return res.send('User not found! <a href="/">Try again</a>');
        }
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.send('Invalid password! <a href="/">Try again</a>');
        }
        req.session.user = user;
        res.redirect('/home');
    } catch (error) {
        res.send('Error logging in: ' + error.message);
    }
});

// Home – shows alumni posts
router.get('/home', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    try {
        const alumniPosts = await Post.find({ visibility: 'public' })
            .sort({ createdAt: -1 })
            .limit(10);
        res.render('home', { user: req.session.user, alumniPosts });
    } catch (error) {
        console.error('Error fetching alumni posts:', error);
        res.render('home', { user: req.session.user, alumniPosts: [] });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ==================== STUDENT ROUTES ====================

// Attendance view
router.get('/attendance', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/');
    try {
        const records = await Attendance.find({ studentId: req.session.user._id }).sort({ date: -1 });
        res.render('attendance', { user: req.session.user, attendanceRecords: records });
    } catch (error) {
        console.error(error);
        res.render('attendance', { user: req.session.user, attendanceRecords: [] });
    }
});

// Help page (submit & view queries)
router.get('/help', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    try {
        const queries = await Query.find({ studentId: req.session.user._id }).sort({ createdAt: -1 });
        res.render('help', { user: req.session.user, queries });
    } catch (error) {
        console.error('Error fetching queries:', error);
        res.render('help', { user: req.session.user, queries: [] });
    }
});

// Submit help query
router.post('/help/submit', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    try {
        const { message } = req.body;
        const query = new Query({
            studentId: req.session.user._id,
            studentName: req.session.user.name,
            studentEmail: req.session.user.email,
            studentDepartment: req.session.user.department,
            message
        });
        await query.save();
        res.send(`
            <html><head><style>body{font-family:Arial;text-align:center;padding:50px;background:#f5f5f5;}.success-card{background:white;max-width:500px;margin:0 auto;padding:40px;border-radius:20px;box-shadow:0 5px 20px rgba(0,0,0,0.1);}h2{color:#28a745;}</style></head>
            <body><div class="success-card"><h2>✅ Query Submitted Successfully!</h2><p>Your query has been sent to faculty.</p><a href="/help">Back to Help</a> | <a href="/home">Home</a></div></body>
            </html>
        `);
    } catch (error) {
        console.error('Error submitting query:', error);
        res.status(500).send('Error submitting query');
    }
});

// ==================== LOST & FOUND ROUTES (WITH IMAGE UPLOAD) ====================

// GET Lost & Found page – fetch all open items
router.get('/lostfound', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    try {
        const items = await LostItem.find({ status: 'open' }).sort({ createdAt: -1 });
        res.render('lostfound', { user: req.session.user, items });
    } catch (error) {
        console.error('Error fetching lost items:', error);
        res.render('lostfound', { user: req.session.user, items: [] });
    }
});

// POST report an item with optional image upload
router.post('/lostfound/report', (req, res) => {
    if (!req.session.user) return res.redirect('/');

    const upload = req.app.locals.upload; // multer instance from server.js

    upload.single('image')(req, res, async function (err) {
        if (err) {
            console.error('Multer error:', err);
            return res.status(400).send(`
                <html><body><h2 style="color:#dc3545;">❌ Upload Error</h2><p>${err.message}</p><a href="/lostfound">Try Again</a></body></html>
            `);
        }

        const { title, description, type, location, date, contact } = req.body;
        const imageUrl = req.file ? '/uploads/' + req.file.filename : null;

        try {
            const newItem = new LostItem({
                title,
                description,
                type,
                location,
                date: date || undefined,
                contact: contact || req.session.user.email,
                reportedBy: req.session.user._id,
                reportedByName: req.session.user.name,
                imageUrl,   // ✅ save image URL
                status: 'open'
            });
            await newItem.save();

            res.send(`
                <html><head><style>body{font-family:Arial;text-align:center;padding:50px;background:#f5f5f5;}.success-card{background:white;max-width:500px;margin:0 auto;padding:40px;border-radius:20px;box-shadow:0 5px 20px rgba(0,0,0,0.1);}h2{color:#28a745;}</style></head>
                <body><div class="success-card"><h2>✅ Item Reported Successfully!</h2><p>Your report has been submitted.</p><a href="/lostfound">← Back to Lost & Found</a></div></body>
                </html>
            `);
        } catch (error) {
            console.error('Error saving lost item:', error);
            res.status(500).send('Error reporting item');
        }
    });
});

// GET single item details as JSON (for modal)
router.get('/lostfound/item/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const item = await LostItem.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Not found' });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST mark item as resolved
router.post('/lostfound/resolve/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    try {
        await LostItem.findByIdAndUpdate(req.params.id, { status: 'resolved' });
        res.redirect('/lostfound');
    } catch (error) {
        res.status(500).send('Error resolving item');
    }
});

// Events page
router.get('/events', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    try {
        const events = await Event.find().sort({ date: 1 });
        res.render('events', { user: req.session.user, events });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.render('events', { user: req.session.user, events: [] });
    }
});

// Register for event
router.post('/events/register', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/');
    const { eventId, name, email, department, year, semester, phone } = req.body;
    try {
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).send('Event not found');

        const alreadyRegistered = event.registrations.some(r =>
            r.studentId && r.studentId.toString() === req.session.user._id.toString()
        );
        if (alreadyRegistered) {
            return res.send('You are already registered for this event. <a href="/events">Back to Events</a>');
        }

        event.registrations.push({
            studentId: req.session.user._id,
            name, email, department, year, semester, phone,
            registeredAt: new Date()
        });
        await event.save();

        res.send(`
            <html><head><style>body{font-family:Arial;text-align:center;padding:50px;background:#f5f5f5;}.success-card{background:white;max-width:500px;margin:0 auto;padding:40px;border-radius:20px;box-shadow:0 5px 20px rgba(0,0,0,0.1);}h2{color:#28a745;}.btn{background:#667eea;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;}</style></head>
            <body><div class="success-card"><h2>✅ Registration Successful!</h2><p>Thank you for registering. Your details have been sent to the faculty.</p><a href="/events" class="btn">Browse More Events</a><br><br><a href="/home">Home</a></div></body>
            </html>
        `);
    } catch (error) {
        console.error('Error registering for event:', error);
        res.status(500).send('Error registering for event');
    }
});

// ==================== CLUB ROUTES ====================

// GET all clubs (list view)
router.get('/clubs', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    try {
        const clubs = await Club.find().populate('members', 'name').exec();
        res.render('clubs', { user: req.session.user, clubs });
    } catch (error) {
        console.error('Error fetching clubs:', error);
        res.render('clubs', { user: req.session.user, clubs: [] });
    }
});

// GET club detail page (with messages)
router.get('/clubs/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    try {
        const club = await Club.findById(req.params.id)
            .populate('members', 'name')
            .populate('messages.userId', 'name')
            .exec();
        if (!club) return res.redirect('/clubs');
        const isMember = club.members.some(m => m._id.toString() === req.session.user._id.toString());
        res.render('club-detail', { user: req.session.user, club, isMember });
    } catch (error) {
        console.error('Error fetching club:', error);
        res.redirect('/clubs');
    }
});

// POST join club (via club detail page)
router.post('/clubs/:id/join', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const club = await Club.findById(req.params.id);
        if (!club) return res.status(404).json({ error: 'Club not found' });
        if (!club.members.includes(req.session.user._id)) {
            club.members.push(req.session.user._id);
            await club.save();
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error joining club:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST send message to club (via club detail page)
router.post('/clubs/:id/message', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { message } = req.body;
    if (!message || message.trim() === '') {
        return res.status(400).json({ error: 'Message cannot be empty' });
    }
    try {
        const club = await Club.findById(req.params.id);
        if (!club) return res.status(404).json({ error: 'Club not found' });
        club.messages.push({
            userId: req.session.user._id,
            userName: req.session.user.name,
            message: message.trim(),
            timestamp: new Date()
        });
        await club.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Legacy join club (using body) – kept for compatibility
router.post('/clubs/join', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/');
    const { clubId } = req.body;
    try {
        const club = await Club.findById(clubId);
        if (!club) return res.status(404).json({ error: 'Club not found' });
        if (!club.members.includes(req.session.user._id)) {
            club.members.push(req.session.user._id);
            await club.save();
        }
        res.json({ success: true, message: 'Successfully joined the club!' });
    } catch (error) {
        console.error('Error joining club:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Legacy send message (using body) – kept for compatibility
router.post('/clubs/message', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const { clubId, message } = req.body;
    try {
        const club = await Club.findById(clubId);
        if (!club) return res.status(404).json({ error: 'Club not found' });
        club.messages.push({
            userId: req.session.user._id,
            userName: req.session.user.name,
            message,
            timestamp: new Date()
        });
        await club.save();
        res.json({ success: true, message: 'Message sent!' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== FACULTY ROUTES ====================

// Faculty attendance page (list students)
router.get('/faculty/attendance', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'faculty') return res.redirect('/');
    try {
        const students = await User.find({ role: 'student' }).sort('name');
        res.render('faculty-attendance', { user: req.session.user, students });
    } catch (error) {
        console.error(error);
        res.send('Error loading students');
    }
});

// Mark attendance
router.post('/faculty/attendance/mark', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'faculty') return res.redirect('/');
    try {
        const { date, subject, attendance } = req.body;
        const dateObj = new Date(date);
        const operations = [];
        for (let studentId in attendance) {
            const status = attendance[studentId];
            operations.push({
                updateOne: {
                    filter: { studentId, date: dateObj, subject },
                    update: {
                        studentId,
                        studentName: req.body[`name_${studentId}`] || 'Unknown',
                        date: dateObj,
                        subject,
                        status,
                        markedBy: req.session.user._id
                    },
                    upsert: true
                }
            });
        }
        await Attendance.bulkWrite(operations);
        res.send(`
            <html><body style="font-family:Arial;text-align:center;padding:50px;">
                <h2 style="color:#28a745;">✅ Attendance Marked Successfully!</h2>
                <a href="/faculty/attendance">Mark More</a> | <a href="/home">Home</a>
            </body></html>
        `);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error marking attendance');
    }
});

// View student queries
router.get('/faculty/queries', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'faculty') return res.redirect('/');
    try {
        const queries = await Query.find().sort({ createdAt: -1 });
        res.render('faculty-queries', { user: req.session.user, queries });
    } catch (error) {
        console.error('Error fetching queries:', error);
        res.send('Error loading queries');
    }
});

// Answer a query
router.post('/faculty/queries/answer/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'faculty') return res.redirect('/');
    try {
        const { answer } = req.body;
        await Query.findByIdAndUpdate(req.params.id, {
            status: 'answered',
            answer,
            answeredBy: req.session.user._id,
            answeredAt: new Date()
        });
        res.redirect('/faculty/queries');
    } catch (error) {
        console.error('Error answering query:', error);
        res.status(500).send('Error answering query');
    }
});

// Create event (faculty only)
router.post('/events/create', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'faculty') return res.redirect('/');
    const { title, description, date, time, venue, organizer, icon } = req.body;
    try {
        const event = new Event({
            title, description, date: date || undefined, time, venue, organizer,
            icon: icon || '📅', createdBy: req.session.user._id, registrations: []
        });
        await event.save();
        res.send(`
            <html><head><style>body{font-family:Arial;text-align:center;padding:50px;background:#f5f5f5;}.success-card{background:white;max-width:500px;margin:0 auto;padding:40px;border-radius:20px;box-shadow:0 5px 20px rgba(0,0,0,0.1);}h2{color:#28a745;}.btn{background:#667eea;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;}</style></head>
            <body><div class="success-card"><h2>✅ Event Created Successfully!</h2><p>Your event "${title}" has been created and is now visible to students.</p><a href="/events" class="btn">View Events</a><br><br><a href="/home">Home</a></div></body>
            </html>
        `);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).send('Error creating event');
    }
});

// Create club (faculty only)
router.post('/clubs/create', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'faculty') return res.redirect('/');
    const { name, description, icon, coordinator, schedule, venue, email } = req.body;
    try {
        const club = new Club({
            name, description, icon, coordinator, schedule, venue, email,
            createdBy: req.session.user._id, members: [], messages: []
        });
        await club.save();
        res.send(`
            <html><head><style>body{font-family:Arial;text-align:center;padding:50px;background:#f5f5f5;}.success-card{background:white;max-width:500px;margin:0 auto;padding:40px;border-radius:20px;box-shadow:0 5px 20px rgba(0,0,0,0.1);}h2{color:#28a745;}.btn{background:#667eea;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;}</style></head>
            <body><div class="success-card"><h2>✅ Club Created Successfully!</h2><p>Your club "${name}" has been created and is now visible to students.</p><a href="/clubs" class="btn">View Clubs</a><br><br><a href="/home">Home</a></div></body>
            </html>
        `);
    } catch (error) {
        console.error('Error creating club:', error);
        res.status(500).send('Error creating club');
    }
});

// ==================== FACULTY DELETE ROUTES ====================

// Delete lost/found item (faculty only)
router.post('/lostfound/delete/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'faculty') {
        return res.status(403).send('Unauthorized');
    }
    try {
        await LostItem.findByIdAndDelete(req.params.id);
        res.redirect('/lostfound');
    } catch (error) {
        console.error('Error deleting lost item:', error);
        res.status(500).send('Error deleting item');
    }
});

// Delete club (faculty only)
router.post('/clubs/delete/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'faculty') {
        return res.status(403).send('Unauthorized');
    }
    try {
        await Club.findByIdAndDelete(req.params.id);
        res.redirect('/clubs');
    } catch (error) {
        console.error('Error deleting club:', error);
        res.status(500).send('Error deleting club');
    }
});

// Delete event (faculty only)
router.post('/events/delete/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'faculty') {
        return res.status(403).send('Unauthorized');
    }
    try {
        await Event.findByIdAndDelete(req.params.id);
        res.redirect('/events');
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).send('Error deleting event');
    }
});

// Separate GET pages for faculty forms (optional)
router.get('/faculty/create-event', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'faculty') return res.redirect('/');
    res.render('faculty-create-event', { user: req.session.user });
});

router.get('/faculty/create-club', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'faculty') return res.redirect('/');
    res.render('faculty-create-club', { user: req.session.user });
});

// ==================== ALUMNI ROUTES ====================

// Create post page
router.get('/alumni/create-post', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'alumni') return res.redirect('/');
    res.render('alumni-create-post', { user: req.session.user });
});

// My posts page
router.get('/alumni/my-posts', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'alumni') return res.redirect('/');
    try {
        const posts = await Post.find({ authorId: req.session.user._id }).sort({ createdAt: -1 });
        res.render('alumni-my-posts', { user: req.session.user, posts });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.send('Error loading posts');
    }
});

// Test alumni form route (optional)
router.get('/test-alumni-form', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'alumni') return res.redirect('/');
    res.render('test-alumni-form');
});

// ==================== ALUMNI POST WITH FILE UPLOAD ====================

// Create alumni post with image upload
router.post('/alumni/create-post', (req, res) => {
    const upload = req.app.locals.upload;
    upload.single('image')(req, res, async function (err) {
        try {
            if (err) {
                return res.status(400).send(`
                    <html><body><h2 style="color:#dc3545;">❌ Upload Error</h2><p>${err.message}</p><a href="/alumni/create-post">Try Again</a></body></html>
                `);
            }
            if (!req.session?.user || req.session.user.role !== 'alumni') return res.redirect('/');
            if (!req.body) return res.send('Error: No form data received!');

            const { title, content, type, company, location, jobType, experience, applyLink, eventDate, eventTime, venue, regLink, visibility } = req.body;
            const tags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : [];
            const imageUrl = req.file ? '/uploads/' + req.file.filename : null;

            const newPost = new Post({
                title, content, type,
                author: req.session.user.name,
                authorId: req.session.user._id,
                authorEmail: req.session.user.email,
                authorDepartment: req.session.user.department,
                company, location, jobType, experience, applyLink,
                eventDate: eventDate || undefined,
                eventTime, venue, regLink,
                imageUrl, tags, visibility
            });
            await newPost.save();

            res.send(`
                <!DOCTYPE html>
                <html>
                <head><title>Success</title><style>
                    body{font-family:'Segoe UI',sans-serif;text-align:center;padding:40px;background:linear-gradient(135deg,#667eea20,#764ba220);}
                    .card{background:white;max-width:600px;margin:0 auto;padding:40px;border-radius:30px;box-shadow:0 20px 60px rgba(0,0,0,0.3);}
                    h1{color:#28a745;font-size:32px;}
                    .btn{background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:12px 30px;text-decoration:none;border-radius:12px;display:inline-block;margin:5px;}
                    .btn-outline{background:white;border:2px solid #667eea;color:#667eea;}
                </style></head>
                <body>
                    <div class="card">
                        <h1>✅ Success!</h1>
                        <p>Your post has been created successfully.</p>
                        <div class="btn-group">
                            <a href="/alumni/my-posts" class="btn">View My Posts</a>
                            <a href="/alumni/create-post" class="btn btn-outline">Create Another</a>
                        </div>
                        <br><a href="/home">← Back to Dashboard</a>
                    </div>
                </body>
                </html>
            `);
        } catch (error) {
            console.error('Error in alumni post:', error);
            res.status(500).send('Error creating post');
        }
    });
});

// ==================== FACULTY INFORMATION PAGE (REAL DATA) ====================

// Faculty Information page - show all faculty from database
router.get('/faculty', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    try {
        const facultyList = await User.find({ role: 'faculty' })
                                      .select('name email department phone')
                                      .lean();
        res.render('faculty', { 
            user: req.session.user, 
            faculty: facultyList 
        });
    } catch (error) {
        console.error('Error fetching faculty:', error);
        res.render('faculty', { 
            user: req.session.user, 
            faculty: [] 
        });
    }
});

module.exports = router;