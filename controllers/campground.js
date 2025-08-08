const CampGround = require('../models/campground');
const { cloudinary } = require('../cloudinary');
const maptilerClient = require("@maptiler/client");

maptilerClient.config.apiKey = process.env.MAPTILER_API_KEY;
console.log("MapTiler API Key:", process.env.MAPTILER_API_KEY);

// SHOW ALL CAMPGROUNDS
module.exports.index = async (req, res, next) => {
    try {
        const campgrounds = await CampGround.find({});
        res.render('campgrounds/index', { campgrounds });
    } catch (err) {
        next(err);
    }
};

// SHOW NEW CAMPGROUND FORM
module.exports.new = async (req, res) => {
    res.render('campgrounds/new');
};

// CREATE CAMPGROUND
module.exports.createcamp = async (req, res, next) => {
    const { title, price, description, location } = req.body;

    const camp = new CampGround({ title, location, price, description });

    try {
        const geoData = await maptilerClient.geocoding.forward(location, { limit: 1 });
        if (geoData && geoData.features && geoData.features.length > 0) {
            camp.geometry = geoData.features[0].geometry;
        } else {
            console.log('No geocoding results found for the location');
        }
    } catch (error) {
        console.error('Geocoding error:', error);
    }

    if (req.files) {
        const imgs = req.files.map(f => ({ Url: f.path, filename: f.filename }));
        camp.image.push(...imgs);
    }

    if (req.user) {
        camp.author = req.user._id;
    }

    await camp.save();
    req.flash('success', 'Successfully created a new campground!');
    res.redirect(`/campground/${camp._id}`);
};

// SHOW A SPECIFIC CAMPGROUND
module.exports.show = async (req, res, next) => {
    const { id } = req.params;

    const campground = await CampGround.findById(id)
        .populate({
            path: 'reviews',
            populate: { path: 'author' }
        })
        .populate('author');

    if (!campground) {
        req.flash('error', 'Cannot find the campground');
        return res.redirect('/campground');
    }

    res.render('campgrounds/show', { campground });
};

// SHOW EDIT FORM
module.exports.editForm = async (req, res, next) => {
    const { id } = req.params;
    const campground = await CampGround.findById(id);

    if (!campground) {
        req.flash('error', 'Campground not found');
        return res.redirect('/campground');
    }

    res.render('campgrounds/edit', { campground });
};

// UPDATE CAMPGROUND
module.exports.edit = async (req, res) => {
    const { id } = req.params;
    const { location } = req.body;

    const campground = await CampGround.findByIdAndUpdate(id, { ...req.body.campground });

    try {
        const geoData = await maptilerClient.geocoding.forward(location, { limit: 1 });
        if (geoData && geoData.features && geoData.features.length > 0) {
            campground.geometry = geoData.features[0].geometry;
        } else {
            console.log('No geocoding results found for the location');
        }
    } catch (error) {
        console.error('Geocoding error:', error);
    }

    if (req.files) {
        const imgs = req.files.map(f => ({ Url: f.path, filename: f.filename }));
        campground.image.push(...imgs);
    }

    await campground.save();

    if (req.body.deleteImages) {
        for (let filename of req.body.deleteImages) {
            await cloudinary.uploader.destroy(filename);
        }
        await campground.updateOne({ $pull: { image: { filename: { $in: req.body.deleteImages } } } });
    }

    req.flash('success', 'Successfully updated campground!');
    res.redirect(`/campground/${campground._id}`);
};

// DELETE CAMPGROUND
module.exports.delete = async (req, res) => {
    const { id } = req.params;
    const campground = await CampGround.findByIdAndDelete(id);

    if (!campground) {
        req.flash('error', 'Campground not found');
        return res.redirect('/campground');
    }

    req.flash('success', 'Campground deleted successfully!');
    res.redirect('/campground');
};
