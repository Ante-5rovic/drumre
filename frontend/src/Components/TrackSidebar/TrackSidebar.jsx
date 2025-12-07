import React, { useState } from 'react';

const TrackSidebar = ({ selectedLocation }) => {
  // State za prebacivanje tabova: 'top' (Popularno) ili 'native' (Domaće)
  const [activeTab, setActiveTab] = useState('top');

  // Resetiraj tab na 'top' svaki put kad se promijeni država
  React.useEffect(() => {
    setActiveTab('top');
  }, [selectedLocation]);

  if (!selectedLocation) {
    return (
      <div className="sidebar-right">
        <h3>Pjesme</h3>
        <p className="empty-msg">Odaberi državu na mapi ili u listi.</p>
      </div>
    );
  }

  // Odaberi koju listu prikazujemo
  const tracksToShow = activeTab === 'top' 
    ? selectedLocation.topTracks 
    : selectedLocation.nativeTracks;

  return (
    <div className="sidebar-right">
      <div className="sidebar-header">
         <h3>{selectedLocation.country}</h3>
      </div>
      
      {/* GUMBOVI ZA PREBACIVANJE */}
      <div className="tab-buttons" style={{ display: 'flex', borderBottom: '1px solid #ddd' }}>
        <button 
          onClick={() => setActiveTab('top')}
          style={{ 
            flex: 1, 
            padding: '10px', 
            border: 'none', 
            background: activeTab === 'top' ? '#fff' : '#f4f4f4',
            borderBottom: activeTab === 'top' ? `3px solid ${selectedLocation.color}` : 'none',
            fontWeight: activeTab === 'top' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          Top 10 (Slušano)
        </button>
        <button 
          onClick={() => setActiveTab('native')}
          style={{ 
            flex: 1, 
            padding: '10px', 
            border: 'none', 
            background: activeTab === 'native' ? '#fff' : '#f4f4f4',
            borderBottom: activeTab === 'native' ? `3px solid ${selectedLocation.color}` : 'none',
            fontWeight: activeTab === 'native' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          Domaće (Tag)
        </button>
      </div>

      <div className="track-list">
        {tracksToShow && tracksToShow.length > 0 ? (
          tracksToShow.map((track, i) => (
            <div key={i} className="track-item">
              <span className="track-rank">{i + 1}</span>
              {track.imageUrl && <img src={track.imageUrl} alt="cover" className="track-img" />}
              <div className="track-info">
                <a href={track.url} target="_blank" rel="noreferrer" className="track-title">
                  {track.name}
                </a>
                <span className="track-artist">{track.artist}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-msg">Nema pronađenih pjesama za ovu kategoriju.</p>
        )}
      </div>
    </div>
  );
};

export default TrackSidebar;