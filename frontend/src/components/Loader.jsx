import React, { useEffect, useState } from 'react';
import '../App.css';

const Loader = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Safety: Never block the UI indefinitely. If the window "load" event never fires
    // (e.g. slow/blocked external assets), hide the loader after a short timeout.
    const forceHideTimer = setTimeout(() => {
      setIsFading(true);
      setTimeout(() => setIsLoading(false), 400);
    }, 2000);

    // Wait for window load event
    const handleLoad = () => {
      setIsFading(true);
      setTimeout(() => setIsLoading(false), 400);
    };

    // Check if page is already loaded
    if (document.readyState === 'complete') {
      // Small delay for smooth fade out
      setIsFading(true);
      setTimeout(() => setIsLoading(false), 400);
    } else {
      window.addEventListener('load', handleLoad);
      return () => {
        clearTimeout(forceHideTimer);
        window.removeEventListener('load', handleLoad);
      };
    }

    return () => clearTimeout(forceHideTimer);
  }, []);

  if (!isLoading) return null;

  return (
    <div id="loader" className={isFading ? 'loader-fade-out' : ''}>
      {/* Logo & Site Name */}
      <div className="loader-logo-container">
        <img 
          src="https://img.icons8.com/?size=100&id=9ESZMOeUioJS&format=png&color=f59e0b" 
          alt="GuessBet Logo" 
          className="loader-logo"
        />
        <span className="loader-site-name">
          Guess<span className="text-orange-500">Bet</span>
        </span>
      </div>
      
      {/* Animated Text Loader */}
      <div className="loader">LOADING</div>
    </div>
  );
};

export default Loader;

