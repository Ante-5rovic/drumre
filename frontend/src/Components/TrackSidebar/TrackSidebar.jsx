import React from 'react';

const TrackSidebar = ({ selectedLocation }) => {
  return (
    <div className="sidebar-right">
      <h3>Top Pjesme</h3>
      {!selectedLocation ? (
        <p className="empty-msg">Odaberi državu na mapi ili u listi.</p>
      ) : (
        <div>
          <h2 style={{ color: selectedLocation.color, borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
            {selectedLocation.country}
          </h2>
          <div className="track-list">
            {selectedLocation.topTracks.map((track, i) => (
              <div key={i} className="track-item">
                <span className="track-rank">{track.rank}</span>
                {track.imageUrl && <img src={track.imageUrl} alt="cover" className="track-img" />}
                <div className="track-info">
                  <a href={track.url} target="_blank" rel="noreferrer" className="track-title">
                    {track.name}
                  </a>
                  <span className="track-artist">{track.artist}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackSidebar;