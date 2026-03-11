const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/campusconnect')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.log('MongoDB connection error:', err));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created uploads directory');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public/uploads/'))
    },
    filename: function (req, file, cb) {
        // Create unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Make upload available to routes
app.locals.upload = upload;

// Middleware - IMPORTANT: Order matters!
app.use(express.urlencoded({ extended: true })); // For form data
app.use(express.json()); // For JSON data
app.use(express.static('public')); // Serve static files

// Session middleware
app.use(session({
    secret: 'campusconnectsecret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import routes
const authRoutes = require('./routes/auth');

// Default routes
app.get('/', (req, res) => {
    res.render('login');
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

// Debug middleware to log all requests (optional - can be removed in production)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log('Request body:', req.body);
    }
    next();
});

// Use routes - MAKE SURE authRoutes is defined and exported correctly
if (authRoutes) {
    app.use('/', authRoutes);
} else {
    console.error('Auth routes not loaded properly!');
}

// 404 handler
app.use((req, res) => {
    res.status(404).send(`
        <html>
        <head>
            <style>
                body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                .error-card { background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); }
                h1 { color: #dc3545; }
                a { color: #667eea; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class="error-card">
                <h1>404 - Page Not Found</h1>
                <p>The page you're looking for doesn't exist.</p>
                <a href="/home">Go to Home</a>
            </div>
        </body>
        </html>
    `);
});

// Error handler
app.use((err, req, res, next) => {
    console.error('========== ERROR DETAILS ==========');
    console.error('Error:', err);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Request URL:', req.url);
    console.error('Request method:', req.method);
    console.error('Request body:', req.body);
    console.error('===================================');
    
    // Handle multer errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).send(`
                <html>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h2 style="color: #dc3545;">❌ File Too Large</h2>
                    <p>Maximum file size is 10MB.</p>
                    <a href="javascript:history.back()">Go Back</a>
                </body>
                </html>
            `);
        }
    }
    
    res.status(500).send(`
        <html>
        <head>
            <style>
                body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                .error-card { background: white; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); }
                h2 { color: #dc3545; margin-bottom: 20px; }
                pre { background: #f0f0f0; padding: 15px; border-radius: 10px; text-align: left; overflow-x: auto; margin: 20px 0; }
                a { color: #667eea; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class="error-card">
                <h2>❌ Something broke!</h2>
                <p>Error: ${err.message}</p>
                <pre>${err.stack}</pre>
                <a href="/home">← Back to Home</a>
            </div>
        </body>
        </html>
    `);
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Make sure MongoDB is running in another window!');
    console.log('Uploads directory:', path.join(__dirname, 'public/uploads'));
});