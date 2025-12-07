require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieSession = require('cookie-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const axios = require('axios');

// Učitavanje modela
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
  if (req.session && !req.session.regenerate) {
    req.session.regenerate = (cb) => { cb(); };
  }
  if (req.session && !req.session.save) {
    req.session.save = (cb) => { cb(); };
  }
  next();
});

app.use(passport.initialize());
app.use(passport.session());

// --- BAZA PODATAKA ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Spojen na MongoDB"))
  .catch(err => console.error("❌ Greška baze:", err));

// --- POMOĆNE FUNKCIJE ---

const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

const cleanCountryName = (rawName) => {
  const manualOverrides = {
    "United States of America": "United States",
    "United Kingdom": "United Kingdom",
    "Russian Federation": "Russia",
    "Czechia": "Czech Republic",
    "North Macedonia": "Macedonia",
    "People's Republic of China": "China" // Dodali smo Kinu zbog početnog punjenja
  };

  if (manualOverrides[rawName]) return manualOverrides[rawName];

  return rawName
    .replace(/^The /i, '')
    .replace(/ Republic of/i, '')
    .replace(/Republic of /i, '')
    .replace(/ Kingdom of/i, '')
    .replace(/Kingdom of /i, '')
    .replace(/Federation of /i, '')
    .trim();
};

// --- GLAVNA FUNKCIJA ZA DOHVAT I SPREMANJE (REUSABLE) ---
// Ovu funkciju sada koristimo i kod ručnog dodavanja i kod prve prijave
const fetchAndSaveLocation = async (userId, countryName) => {
  const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

  // 1. Nominatim
  console.log(`[Core] Tražim državu: ${countryName}...`);
  const geoResponse = await axios.get(`https://nominatim.openstreetmap.org/search`, {
    params: { country: countryName, format: 'json', polygon_geojson: 1, limit: 1, addressdetails: 1 },
    headers: { 'User-Agent': 'FaksProjektGlazba/1.0 (student@fer.hr)', 'Accept-Language': 'en' }
  });

  if (geoResponse.data.length === 0) return null; // Nije pronađeno

  const locData = geoResponse.data[0];
  let officialName = locData.address ? locData.address.country : locData.name;
  if (!officialName) officialName = locData.display_name.split(',')[0];

  // Provjera postoji li već u bazi za tog korisnika
  const existing = await Location.findOne({ userId, country: officialName });
  if (existing) return existing; // Vraćamo postojeći ako ga već ima

  const musicSearchName = cleanCountryName(officialName);

  // 2. Last.fm
  console.log(`[Core] Last.fm pretraga: ${musicSearchName}...`);
  let tracks = [];
  try {
    const musicResponse = await axios.get(`http://ws.audioscrobbler.com/2.0/`, {
      params: { method: 'geo.getTopTracks', country: musicSearchName, api_key: LASTFM_API_KEY, format: 'json', limit: 10 },
      validateStatus: false,
      timeout: 5000
    });
    
    const data = musicResponse.data;
    if (data?.tracks?.track) {
      const rawTracks = data.tracks.track;
      tracks = Array.isArray(rawTracks) ? rawTracks : [rawTracks];
    }
  } catch (err) {
    console.error("Last.fm greška:", err.message);
  }

  // 3. Spremanje
  const newLocation = new Location({
    userId,
    country: officialName,
    geojson: locData.geojson,
    color: getRandomColor(),
    topTracks: tracks.map((t, i) => ({
      rank: i + 1,
      name: t.name,
      artist: t.artist ? t.artist.name : "Nepoznato",
      url: t.url,
      imageUrl: (t.image && t.image[2]) ? t.image[2]['#text'] : ''
    }))
  });

  await newLocation.save();
  console.log(`✅ [Core] Spremljeno: ${officialName}`);
  return newLocation;
};


// --- PASSPORT CONFIG ---

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id).then(user => {
    done(null, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      // Provjeri postoji li korisnik
      const existingUser = await User.findOne({ googleId: profile.id });
      if (existingUser) {
        return done(null, existingUser);
      }

      // AKO NE POSTOJI -> KREIRAJ NOVOG
      console.log("🆕 Novi korisnik detektiran! Kreiram profil...");
      const user = await new User({
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value,
        image: profile.photos[0].value
      }).save();

      // --- AUTOMATSKO PUNJENJE (SEEDING) ---
      // Dodajemo 5 najmnogoljudnijih zemalja
      const defaultCountries = ["China", "India", "United States", "Indonesia", "Brazil"];
      
      console.log("🚀 Započinjem automatsko punjenje podataka...");
      // Koristimo Promise.all da ih ne čekamo jednu po jednu nego paralelno (brže je)
      // Iako, da ne zagušimo Nominatim, možemo i for loop. Idemo s for loop za sigurnost.
      try {
        for (const country of defaultCountries) {
          await fetchAndSaveLocation(user._id, country);
        }
      } catch (err) {
        console.error("Greška pri seedanju:", err);
      }
      
      done(null, user);
    }
  )
);


// --- RUTE ---

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google'), (req, res) => {
    res.redirect('http://localhost:5173');
});
app.get('/api/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('http://localhost:5173'); 
  });
});
app.get('/api/current_user', (req, res) => {
  res.send(req.user);
});

// GET LOKACIJE
app.get('/api/locations', async (req, res) => {
  if (!req.user) return res.status(401).send([]);
  try {
    const locations = await Location.find({ userId: req.user._id });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: 'Greška.' });
  }
});

// POST ADD COUNTRY (Sada koristi helper funkciju)
app.post('/api/add-country', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Niste logirani!" });
  const { countryName } = req.body;

  try {
    const result = await fetchAndSaveLocation(req.user._id, countryName);
    
    if (!result) return res.status(404).json({ error: 'Nije pronađeno.' });
    // Ako je vraćen postojeći dokument, a nismo ga tek kreirali, možemo javiti grešku ili ga vratiti
    // Za jednostavnost vraćamo ga (React će vjerojatno filtrirati duplikate ili možemo baciti 400)
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Greška servera." });
  }
});

// DELETE ROUTE (NOVO!)
app.delete('/api/locations/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Niste logirani!" });

  try {
    // Brišemo samo ako pripada tom korisniku!
    await Location.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.send({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Greška pri brisanju." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server radi na portu ${PORT}`);
});