const CampGround = require('../models/campground');
const { cloudinary } = require('../cloudinary');
const CatchAsync = require('../error/CatchAsync');
const maptilerClient=require("@maptiler/client");
 maptilerClient.config.apiKey=process.env.MAPTILER_API_KEY;
 console.log(process.env.MAPTILER_API_KEY)
module.exports.index=async (req, res, next) => {
    const campgrounds = await CampGround.find({});
    res.render('campgrounds/index', { campgrounds });
};
module.exports.new=async (req, res) => {
    res.render('campgrounds/new');
};
module.exports.createcamp = async (req, res, next) => {
    const { title, image, price, description, location } = req.body;

    // Step 1: Create camp instance
    const camp = new CampGround({ title, location, price, description });

    // Step 2: Geocoding
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

    // Step 3: Handle images
    if (req.files) {
        const imgs = req.files.map(f => ({ Url: f.path, filename: f.filename }));
        camp.image.push(...imgs);
    }

    // Step 4: Assign author and save
    if (req.user) {
        camp.author = req.user._id;
    }

    await camp.save();

    // Step 5: Flash and redirect
    req.flash('success', 'Successfully created a new campground!');
    res.redirect(`/campground/${camp._id}`);
};

module.exports.show=async (req, res, next) => {
    const { id } = req.params;

    const campground = await CampGround.findById(id)
        .populate({
            path: 'reviews',
            populate: { path: 'author' }
        })
        .populate('author'); // Populate the author of the campground
    if (!campground) {
        req.flash('error', 'Cannot find the campground');
        return res.redirect('/campground'); // Redirect if campground not found
    }

    res.render('campgrounds/show', { campground });
}

module.exports.editForm=async (req, res, next) => {
    const { id } = req.params;
    const campground = await CampGround.findById(id);
    res.render('campgrounds/edit', { campground });
}
module.exports.edit = async (req, res) => {
    const { id } = req.params;
    const {location}=req.body
    const campground = await CampGround.findByIdAndUpdate(id, { ...req.body.campground });

    console.log(location);
    try {
        const geoData = await maptilerClient.geocoding.forward(location, { limit: 1 });
        console.log('GeoData Response:', geoData);
      
        // Check if geoData contains valid features
        if (geoData && geoData.features && geoData.features.length > 0) {
          // Access the geometry from the first feature
          campground.geometry = geoData.features[0].geometry;
          console.log('Campground geometry:', campground.geometry);
        } else {
          console.log('No geocoding results found for the location');
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
      
    const imgs = req.files.map(f => ({ url: f.path, filename: f.filename }));
    campground.image.push(...imgs);
    await campground.save();
    if (req.body.deleteImages) {
        for (let filename of req.body.deleteImages) {
            await cloudinary.uploader.destroy(filename);
        }
        await campground.updateOne({ $pull: { image: { filename: { $in: req.body.deleteImages } } } })
    }
    console.log(campground)
    req.flash('success', 'Successfully updated campground!');
    res.redirect(`/campground/${campground._id}`)
}
  

module.exports.delete=async (req, res) => {
    const { id } = req.params;
    const campground = await CampGround.findByIdAndDelete(id);
    
    if (!campground) {
        req.flash('error', 'Campground not found');
        return res.redirect('/campground');
    }
    
    req.flash('success', 'Campground deleted successfully!');
    res.redirect('/campground');
}
