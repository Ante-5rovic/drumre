const mongoose = require('mongoose');

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
  
  topTracks: [TrackSchema], 
  nativeTracks: [TrackSchema],

  createdAt: { type: Date, default: Date.now }
});

mongoose.model('locations', locationSchema);