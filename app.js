// Load environment variables in non-production environments
if(process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}

console.log(process.env.CLOUDINARY_CLOUD_NAME); // Should output your cloud name
console.log(process.env.CLOUDINARY_KEY);        // Should output your API key
console.log(process.env.CLOUDINARY_SECRET);     // Should output your API secret

// Import required modules
const express = require('express');
const app = express();
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const flash = require('connect-flash');
const ejsMate = require('ejs-mate');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/users');
const camprouter = require('./routes/campgrounds');
const revrouter = require('./routes/reviews');
const userrouter = require('./routes/users');
const Sanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const MongoStore = require('connect-mongo');
// MongoDB connection URL
const dbUrl = process.env.DB_URL || 'mongodb://127.0.0.1:27017/yelp-camp';  // Use 127.0.0.1 (IPv4 address)

// Connect to MongoDB
// Connect to MongoDB
mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,  // Just keep these two options
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});


// Set up view engine and static files
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Sanitize inputs to prevent MongoDB injections
app.use(Sanitize({ replaceWith: '_' }));

// Session configuration
const secret = process.env.SECRET || 'thisshouldbeabettersecret!';

const store = MongoStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 60 * 60,
    crypto: {
        secret: 'thisshouldbeabettersecret!'  // This should be a stronger secret in production
    }
});

store.on("error", function (e) {
    console.log("SESSION STORE ERROR", e);
});

// Session configuration with cookie settings
const sessionConfig = {
    store,
    name: 'session',
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,  // Uncomment for production when using HTTPS
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,  // 7 days
        maxAge: 1000 * 60 * 60 * 24 * 7  // 7 days
    }
};
app.use(session(sessionConfig));

// Flash messages and middleware for user info
app.use(flash());
app.use(Sanitize());
app.use(helmet());

// Set up content security policy with whitelisted URLs
const scriptSrcUrls = [
    "https://stackpath.bootstrapcdn.com/",
    "https://kit.fontawesome.com/",
    "https://cdnjs.cloudflare.com/",
    "https://cdn.jsdelivr.net",
    "https://cdn.maptiler.com/",
];
const styleSrcUrls = [
    "https://kit-free.fontawesome.com/",
    "https://stackpath.bootstrapcdn.com/",
    "https://fonts.googleapis.com/",
    "https://use.fontawesome.com/",
    "https://cdn.jsdelivr.net",
    "https://cdn.maptiler.com/",
];
const connectSrcUrls = [
    "https://api.maptiler.com/",
];
const fontSrcUrls = [];

app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: [],
            connectSrc: ["'self'", ...connectSrcUrls],
            scriptSrc: ["'unsafe-inline'", "'self'", ...scriptSrcUrls],
            styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
            workerSrc: ["'self'", "blob:"],
            childSrc: ["blob:"],
            objectSrc: [],
            imgSrc: [
                "'self'",
                "blob:",
                "data:",
                "https://res.cloudinary.com/dvk5hnyrv/",  // Ensure this matches your Cloudinary account
                "https://images.unsplash.com",
                "https://api.maptiler.com/",
            ],
            fontSrc: ["'self'", ...fontSrcUrls],
        },
    })
);

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

// Serialize and deserialize user for session
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// Middleware for passing flash messages and user info to views
app.use((req, res, next) => {
    res.locals.returnTo;
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// Route handlers
app.use('/campground', camprouter);
app.use('/campground/:id/reviews', revrouter);
app.use('/', userrouter);

// Error handling middleware
app.use((err, req, res, next) => {
    const { statusCode = 500, message = "Something went wrong!" } = err;
    res.status(statusCode).render('error', { message, error: err });
});

// Start server
app.listen(3001, () => {
    console.log("Server running on port 3001");
});
