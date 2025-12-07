const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
  country: String, // Ime države
  // GeoJSON objekt koji crta granice na mapi
  geojson: {
    type: Object, 
    required: true
  },
  // Random boja dodijeljena državi (npr. #FF5733)
  color: String,
  topTracks: [
    {
      rank: Number,
      name: String,
      artist: String,
      url: String,
      imageUrl: String
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

mongoose.model('locations', locationSchema);