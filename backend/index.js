require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieSession = require('cookie-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const axios = require('axios');

require('./models/User');
require('./models/Location');

const User = mongoose.model('users');
const Location = mongoose.model('locations');

const app = express();

// --- MIDDLEWARE ---
app.use(express.json());
app.use(cors());

app.use(
  cookieSession({
    maxAge: 30 * 24 * 60 * 60 * 1000,
    keys: [process.env.COOKIE_KEY]
  })
);

app.use(function(req, res, next) {
  if (req.session && !req.session.regenerate) req.session.regenerate = (cb) => cb();
  if (req.session && !req.session.save) req.session.save = (cb) => cb();
  next();
});

app.use(passport.initialize());
app.use(passport.session());


const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000 
    });
    console.log("Spojen na MongoDB");
  } catch (err) {
    console.error("Greška pri spajanju na bazu. Provjeri IP Whitelist na Atlasu!");
  }
};
connectDB();


// ===========================================================================
// 1. PODACI I MAPIRANJE
// ===========================================================================

const countryAliases = {
  "USA": "United States", "U.S.A.": "United States", "United States of America": "United States",
  "America": "United States", "US": "United States",
  "UK": "United Kingdom", "Great Britain": "United Kingdom", "Britain": "United Kingdom",
  "England": "United Kingdom", "Scotland": "United Kingdom", "Wales": "United Kingdom", "Northern Ireland": "United Kingdom",
  "UAE": "United Arab Emirates",
  "Republic of Korea": "South Korea", "Korea, Republic of": "South Korea",
  "China, People's Republic of": "China",
  "Russian Federation": "Russia",
  "The Netherlands": "Netherlands", "Holland": "Netherlands",
  "Viet Nam": "Vietnam",
  "Czechia": "Czech Republic",
  "Macedonia": "North Macedonia", "The former Yugoslav Republic of Macedonia": "North Macedonia",
  "Cabo Verde": "Cape Verde",
  "Holy See": "Vatican City", "Vatican": "Vatican City"
};

const countryToTag = {
  "United States": "American", "United Kingdom": "British",
  "France": "French", "Germany": "German", "Italy": "Italian", "Spain": "Spanish",
  "China": "Chinese", "Japan": "Japanese", "South Korea": "K-pop",
  "Russia": "Russian", "Brazil": "Brazilian", "India": "Indian",
  "Turkey": "Turkish", "Sweden": "Swedish", "Canada": "Canadian", "Australia": "Australian",
  "Croatia": "Croatian", "Serbia": "Serbian", "Bosnia and Herzegovina": "Bosnian",
  "Slovenia": "Slovenian", "Montenegro": "Montenegrin", "North Macedonia": "Macedonian",
  "Albania": "Albanian", "Greece": "Greek", "Poland": "Polish", "Ukraine": "Ukrainian",
  "Netherlands": "Dutch", "Norway": "Norwegian", "Finland": "Finnish", "Denmark": "Danish",
  "Portugal": "Portuguese", "Romania": "Romanian", "Bulgaria": "Bulgarian",
  "Hungary": "Hungarian", "Czech Republic": "Czech", "Slovakia": "Slovak",
  "Ireland": "Irish", "Mexico": "Mexican", "Argentina": "Argentine", "Colombia": "Colombian",
  "Philippines": "Pinoy", "Indonesia": "Indonesian", "Thailand": "Thai", "Vietnam": "Vietnamese",
  "Egypt": "Egyptian", "South Africa": "South African", "Nigeria": "Nigerian",
  "Jamaica": "Jamaican", "Puerto Rico": "Puerto Rican", "Austria": "Austrian"
};


// ===========================================================================
// 2. POMOĆNE FUNKCIJE
// ===========================================================================

const cleanCountryName = (rawName) => {
  if (countryAliases[rawName]) return countryAliases[rawName];
  let clean = rawName
    .replace(/^The /i, '')
    .replace(/ Republic of/i, '')
    .replace(/Republic of /i, '')
    .replace(/ Kingdom of/i, '')
    .replace(/Kingdom of /i, '')
    .replace(/Federation of /i, '')
    .trim();
  if (countryAliases[clean]) return countryAliases[clean];
  return clean;
};

const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- TRIPLE-CHECK ORIGIN ---
const checkOrigin = async (artistName, trackName, nativeTag, countryName, apiKey) => {
  const searchTerms = [nativeTag.toLowerCase(), countryName.toLowerCase()];
  
  const hasKeyword = (listOrText) => {
    if (!listOrText) return false;
    if (Array.isArray(listOrText)) {
      return listOrText.some(t => {
        const tName = t.name.toLowerCase();
        return searchTerms.some(term => tName.includes(term));
      });
    }
    if (typeof listOrText === 'string') {
      const bio = listOrText.toLowerCase();
      return searchTerms.some(term => bio.includes(term));
    }
    return false;
  };

  try {
    // 1. INFO O IZVOĐAČU
    const artistRes = await axios.get(`http://ws.audioscrobbler.com/2.0/`, {
      params: { method: 'artist.getInfo', artist: artistName, api_key: apiKey, format: 'json' },
      timeout: 3000
    });
    const artistData = artistRes.data?.artist;

    if (artistData?.tags?.tag && hasKeyword(artistData.tags.tag)) return true;
    if (artistData?.bio?.summary && hasKeyword(artistData.bio.summary)) return true;

    // 2. INFO O PJESMI
    const trackRes = await axios.get(`http://ws.audioscrobbler.com/2.0/`, {
      params: { method: 'track.getTopTags', artist: artistName, track: trackName, api_key: apiKey, format: 'json' },
      timeout: 3000
    });

    if (hasKeyword(trackRes.data?.toptags?.tag)) return true;

  } catch (err) {
    return false;
  }
  return false;
};

const fetchAndSaveLocation = async (userId, countryName) => {
  const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

  console.log(`[Core] Tražim državu: ${countryName}...`);
  const geoResponse = await axios.get(`https://nominatim.openstreetmap.org/search`, {
    params: { country: countryName, format: 'json', polygon_geojson: 1, limit: 1, addressdetails: 1 },
    headers: { 'User-Agent': 'FaksProjektGlazba/1.0', 'Accept-Language': 'en' }
  });

  if (geoResponse.data.length === 0) return null;

  const locData = geoResponse.data[0];
  let rawName = locData.address ? locData.address.country : locData.name;
  if (!rawName) rawName = locData.display_name.split(',')[0];
  const standardName = cleanCountryName(rawName);

  const existing = await Location.findOne({ userId, country: standardName });
  if (existing) return existing;

  let nativeTag = countryToTag[standardName] || standardName;
  console.log(`[Core] Država: '${standardName}' | Tag za domaće: '${nativeTag}'`);

  let globalTracks = [];
  let foundNativeTracks = [];
  let poolOfTracks = [];

  // 1. DOHVAT GLOBALNE LISTE (GEO)
  try {
    const geoRes = await axios.get(`http://ws.audioscrobbler.com/2.0/`, {
      params: { 
        method: 'geo.getTopTracks', 
        country: standardName, 
        api_key: LASTFM_API_KEY, 
        format: 'json', 
        limit: 200 
      },
      validateStatus: false, timeout: 8000
    });

    if (geoRes.data?.tracks?.track) {
      const raw = geoRes.data.tracks.track;
      poolOfTracks = Array.isArray(raw) ? raw : [raw];
      globalTracks = poolOfTracks.slice(0, 10);
    }
  } catch (err) {
    console.warn(`[Geo] Nije uspio dohvat geo-tracks za ${standardName} (vjerojatno blokirano). Idem na Plan B.`);
  }

  // 2. BATCH SCANNER (Samo ako imamo geo pjesme)
  if (poolOfTracks.length > 0) {
    console.log(`[Scanner] Skeniram ${poolOfTracks.length} pjesama u grupama od 40...`);
    const checkedArtists = new Map();
    const BATCH_SIZE = 40; 

    for (let i = 0; i < poolOfTracks.length; i += BATCH_SIZE) {
      if (foundNativeTracks.length >= 10) break;

      const batch = poolOfTracks.slice(i, i + BATCH_SIZE);
      console.log(`   > Obrađujem grupu ${i} - ${i + batch.length}...`);

      const promises = batch.map(async (track) => {
        if (foundNativeTracks.length >= 10) return null;

        const artistName = track.artist.name;
        const trackName = track.name;
        const cacheKey = `${artistName}-${trackName}`;

        if (checkedArtists.has(cacheKey)) {
          return { track, isNative: checkedArtists.get(cacheKey) };
        }

        const isNative = await checkOrigin(artistName, trackName, nativeTag, standardName, LASTFM_API_KEY);
        checkedArtists.set(cacheKey, isNative);
        
        return { track, isNative };
      });

      const results = await Promise.all(promises);

      for (const res of results) {
        if (res && res.isNative) {
          if (!foundNativeTracks.some(t => t.name === res.track.name)) {
            foundNativeTracks.push(res.track);
          }
        }
      }
      
      if (foundNativeTracks.length < 10) await delay(500); 
    }
  }

  console.log(`[Scanner] Završeno. Pronađeno: ${foundNativeTracks.length}`);

  // 3. FALLBACK 
  if (foundNativeTracks.length < 10) {
    console.log(`[Fallback] Nedovoljno pjesama (${foundNativeTracks.length}/10). Popunjavam s 'tag.getTopTracks' za: ${nativeTag}...`);
    
    try {
      const tagRes = await axios.get(`http://ws.audioscrobbler.com/2.0/`, {
        params: { 
          method: 'tag.getTopTracks', 
          tag: nativeTag, 
          api_key: LASTFM_API_KEY, 
          format: 'json', 
          limit: 50 
        },
        validateStatus: false 
      });
      
      if (tagRes.data?.tracks?.track) {
        const rawTagTracks = Array.isArray(tagRes.data.tracks.track) ? tagRes.data.tracks.track : [tagRes.data.tracks.track];
        
        for (const tTrack of rawTagTracks) {
          if (foundNativeTracks.length >= 10) break; 
          if (!foundNativeTracks.some(ft => ft.name === tTrack.name)) {
            foundNativeTracks.push(tTrack);
          }
        }
      }
    } catch (err) {
      console.error("[Fallback] Greška:", err.message);
    }
  }

  // 4.REZANJE NA 10 (User Request)
  const finalNativeList = foundNativeTracks.slice(0, 10);
  const finalGlobalList = globalTracks.slice(0, 10);

  const mapTracks = (list) => list.map((t, i) => ({
    rank: i + 1,
    name: t.name,
    artist: t.artist ? t.artist.name : t.artist,
    url: t.url,
    imageUrl: (t.image && t.image.length > 2) ? t.image[2]['#text'] : ''
  }));

  const newLocation = new Location({
    userId,
    country: standardName,
    geojson: locData.geojson,
    color: getRandomColor(),
    topTracks: mapTracks(finalGlobalList),
    nativeTracks: mapTracks(finalNativeList)
  });

  await newLocation.save();
  console.log(`✅ [Core] Spremljeno: ${standardName} (Native: ${finalNativeList.length}).`);
  return newLocation;
};


// ===========================================================================
// 3. AUTH & RUTE
// ===========================================================================

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => User.findById(id).then(user => done(null, user)));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    const existingUser = await User.findOne({ googleId: profile.id });
    if (existingUser) return done(null, existingUser);
    
    console.log("🆕 Novi korisnik! Seeding...");
    const user = await new User({ googleId: profile.id, displayName: profile.displayName, email: profile.emails[0].value, image: profile.photos[0].value }).save();
    
    const defaultCountries = ["China", "India", "United States", "Indonesia", "Brazil"];
    try {
      for (const country of defaultCountries) await fetchAndSaveLocation(user._id, country);
    } catch (e) { console.error("Seeding error:", e); }
    done(null, user);
  }
));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google'), (req, res) => res.redirect('http://localhost:5173'));
app.get('/api/logout', (req, res, next) => { req.logout(err => { if(err) return next(err); res.redirect('http://localhost:5173'); }); });
app.get('/api/current_user', (req, res) => res.send(req.user));

app.get('/api/locations', async (req, res) => {
  if (!req.user) return res.status(401).send([]);
  const locations = await Location.find({ userId: req.user._id });
  res.json(locations);
});

app.post('/api/add-country', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Niste logirani!" });
  try {
    const result = await fetchAndSaveLocation(req.user._id, req.body.countryName);
    if (!result) return res.status(404).json({ error: 'Nije pronađeno.' });
    res.json(result);
  } catch (error) { console.error(error); res.status(500).json({ error: "Greška servera." }); }
});

app.delete('/api/locations/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Niste logirani!" });
  await Location.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  res.send({ success: true });
});

app.get('/api/music-preview', async (req, res) => {
  const { query } = req.query;
  try {
    const response = await axios.get(`https://api.deezer.com/search`, { params: { q: query, limit: 1 } });
    if (response.data.data?.[0]) {
      const s = response.data.data[0];
      res.json({ previewUrl: s.preview, cover: s.album.cover_medium, title: s.title, artist: s.artist.name, deezerLink: s.link });
    } else res.status(404).json({ error: "Nema" });
  } catch (e) { res.status(500).json({ error: "Greška" }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server radi na portu ${PORT}`));