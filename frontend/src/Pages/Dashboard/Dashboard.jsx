import React, { useState, useEffect } from 'react';
import * as API from '../../apis/api';
import CountrySidebar from '../../components/CountrySidebar/CountrySidebar';
import TrackSidebar from '../../components/TrackSidebar/TrackSidebar';
import MapComponent from '../../components/MapComponent/MapComponent';
import { countryList } from '../../constants/countries'; // <--- UVEZI LISTU

const Dashboard = ({ user }) => {
  const [locations, setLocations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  
  // State za pretragu
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]); // <--- NOVO: Lista prijedloga

  const [loading, setLoading] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await API.getLocations();
      setLocations(res.data);
    } catch (err) {
      console.error("Greška pri dohvatu:", err);
    }
  };

  // --- LOGIKA ZA AUTOCOMPLETE ---
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    
    // Ako nema teksta, isprazni prijedloge
    if (!text) {
      setSuggestions([]);
      return;
    }

    // Filtriraj listu (case-insensitive)
    // Prikazujemo samo ako tekst ima 2 ili više slova da ne skače odmah
    if (text.length > 1) {
      const filtered = countryList.filter(country => 
        country.toLowerCase().startsWith(text.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (countryName) => {
    setSearchQuery(countryName); // Postavi tekst u input
    setSuggestions([]); // Sakrij listu
    // Opcionalno: Odmah pozovi dodavanje (ili čekaj da user stisne +)
    // handleAdd(null, countryName); 
  };
  // -----------------------------

  const handleAdd = async (e) => {
    if (e) e.preventDefault(); // Ako je pozvano klikom na gumb
    
    if (!searchQuery) return;
    setLoading(true);
    setSuggestions([]); // Sakrij prijedloge ako su ostali

    try {
      const res = await API.addCountry(searchQuery);
      
      // Provjera da li već imamo tu lokaciju u state-u (da ne dupliramo)
      const existsLocally = locations.find(l => l._id === res.data._id);
      
      if (!existsLocally) {
        setLocations([...locations, res.data]);
        setSelectedId(res.data._id);
      } else {
        alert("Država je već na listi!");
        setSelectedId(existsLocally._id);
      }
      
      setSearchQuery('');
    } catch (err) {
      console.error(err);
      alert("Država nije pronađena ili je došlo do greške.");
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    try {
      await API.deleteLocation(id);
      setLocations(locations.filter(l => l._id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      console.error("Greška pri brisanju:", err);
      alert("Brisanje nije uspjelo.");
    }
  };

  const selectedLocation = locations.find(l => l._id === selectedId);

  return (
    <div className="dashboard-layout">
      <div className="top-bar">
        <div className="logo">MusicMap 🎧</div>
        
        {/* NOVI SEARCH UI */}
        <form onSubmit={handleAdd} className="search-form">
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Dodaj državu (npr. Japan)..." 
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onBlur={() => {
                // Mali delay da stignemo kliknuti na prijedlog prije nego nestane
                setTimeout(() => setSuggestions([]), 200);
              }}
            />
            
            {/* PRIKAZ LISTE PRIJEDLOGA */}
            {suggestions.length > 0 && (
              <ul className="suggestions-list">
                {suggestions.map((country, index) => (
                  <li 
                    key={index} 
                    className="suggestion-item"
                    onClick={() => selectSuggestion(country)}
                  >
                    {country}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="submit" disabled={loading}>
            {loading ? '...' : '+'}
          </button>
        </form>

        <div className="user-info">
          <span>{user.displayName}</span>
          <img src={user.image} alt="avatar" className="avatar"/>
          <a href="/api/logout" className="logout-link">Odjava</a>
        </div>
      </div>

      <div className="main-content">
        <CountrySidebar 
          locations={locations} 
          selectedId={selectedId} 
          onSelect={setSelectedId} 
          onDelete={handleDelete}
          sortAsc={sortAsc}
          onToggleSort={() => setSortAsc(!sortAsc)}
        />
        
        <MapComponent 
          locations={locations} 
          selectedId={selectedId} 
          onSelect={setSelectedId} 
        />
        
        <TrackSidebar 
          selectedLocation={selectedLocation} 
        />
      </div>
    </div>
  );
};

export default Dashboard;