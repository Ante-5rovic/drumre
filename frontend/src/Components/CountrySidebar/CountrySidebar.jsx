import React from 'react';

const CountrySidebar = ({ locations, selectedId, onSelect, onDelete, sortAsc, onToggleSort }) => {
  
  // Logika sortiranja
  const sortedLocations = [...locations].sort((a, b) => {
    return sortAsc 
      ? a.country.localeCompare(b.country) 
      : b.country.localeCompare(a.country);
  });

  return (
    <div className="sidebar-left">
      <div className="sidebar-header">
        <h3>Države ({locations.length})</h3>
        <button onClick={onToggleSort} className="sort-btn">
          {sortAsc ? 'A-Z' : 'Z-A'}
        </button>
      </div>

      <div className="list-content">
        {sortedLocations.map(loc => (
          <div 
            key={loc._id} 
            className={`country-card ${selectedId === loc._id ? 'active' : ''}`}
            style={{ borderLeftColor: loc.color }}
            onClick={() => onSelect(loc._id)}
          >
            <span className="country-name">{loc.country}</span>
            <button 
              className="delete-btn" 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(loc._id);
              }}
            >
              −
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CountrySidebar;