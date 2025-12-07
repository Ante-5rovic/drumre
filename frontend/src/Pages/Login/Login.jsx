import React from 'react';

const Login = () => {
  return (
    <div className="login-container">
      <div className="login-box">
        <h1>🌍 Music Map</h1>
        <p>Otkrij glazbu svijeta.</p>
        <a href="/auth/google" className="google-btn">
          Prijavi se putem Googlea
        </a>
      </div>
    </div>
  );
};

export default Login;