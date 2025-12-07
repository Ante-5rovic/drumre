const mongoose = require('mongoose');

// Shema za pjesmu (da ne ponavljamo kod)
const TrackSchema = {
  rank: Number,
  name: String,
  artist: String,
  url: String,
  imageUrl: String
};

const locationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
  country: String,
  geojson: { type: Object, required: true },
  color: String,
  
  // 1. ONO ŠTO SE SLUŠA (Taylor Swift, itd.)
  topTracks: [TrackSchema], 

  // 2. DOMAĆE PJESME (Oliver, Gibonni, itd.) - NOVO!
  nativeTracks: [TrackSchema],

  createdAt: { type: Date, default: Date.now }
});

mongoose.model('locations', locationSchema);