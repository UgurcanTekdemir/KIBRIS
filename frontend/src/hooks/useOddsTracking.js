import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Custom hook to track odds changes for matches
 * Stores previous odds and compares with current odds
 */
export function useOddsTracking(matchId, match, refreshInterval = 5000) {
  const [oddsHistory, setOddsHistory] = useState({});
  const previousOddsRef = useRef({});
  const hasInitializedRef = useRef({});

  // Memoize markets to avoid unnecessary re-renders
  const markets = useMemo(() => {
    if (!match || !match.markets || !Array.isArray(match.markets)) return null;
    return match.markets;
  }, [match?.markets]);

  useEffect(() => {
    if (!matchId || !markets) return;

    // Get previous odds for this match
    const previousOdds = previousOddsRef.current[matchId] || {};
    const hasInitialized = hasInitializedRef.current[matchId] || false;

    // Compare current odds with previous
    const changes = {};
    
    // Check each market and option
    markets.forEach(market => {
      if (market.options && Array.isArray(market.options)) {
        market.options.forEach(option => {
          const key = `${market.name}-${option.label}`;
          const currentValue = typeof option.value === 'number' 
            ? option.value 
            : parseFloat(option.value) || 0;
          
          // Skip if invalid odds
          if (currentValue <= 0) return;
          
          const previousValue = previousOdds?.[key];
          
          // Only track if we have a previous value and it's different
          // Use a smaller threshold (0.005) to catch more changes
          if (hasInitialized && previousValue && previousValue > 0 && Math.abs(currentValue - previousValue) > 0.005) {
            if (currentValue > previousValue) {
              // Odds increased (less likely to win) - show red down arrow
              changes[key] = { direction: 'down', previous: previousValue, current: currentValue };
            } else if (currentValue < previousValue) {
              // Odds decreased (more likely to win) - show green up arrow
              changes[key] = { direction: 'up', previous: previousValue, current: currentValue };
            }
          }
        });
      }
    });

    // Update history if there are changes
    if (Object.keys(changes).length > 0) {
      setOddsHistory(prev => ({
        ...prev,
        [matchId]: {
          ...prev[matchId],
          ...changes
        }
      }));

      // Clear changes after a delay (so animation is visible)
      const timeoutId = setTimeout(() => {
        setOddsHistory(prev => {
          const updated = { ...prev };
          if (updated[matchId]) {
            // Only clear the specific changed keys, not all
            Object.keys(changes).forEach(key => {
              if (updated[matchId][key]) {
                delete updated[matchId][key];
              }
            });
            // If no more changes, remove the match entry
            if (Object.keys(updated[matchId] || {}).length === 0) {
              delete updated[matchId];
            }
          }
          return updated;
        });
      }, refreshInterval * 3); // Keep changes visible for 3 refresh cycles

      return () => clearTimeout(timeoutId);
    }

    // Store current odds as previous for next comparison
    const currentOddsMap = {};
    markets.forEach(market => {
      if (market.options && Array.isArray(market.options)) {
        market.options.forEach(option => {
          const key = `${market.name}-${option.label}`;
          const value = typeof option.value === 'number' 
            ? option.value 
            : parseFloat(option.value) || 0;
          if (value > 0) {
            currentOddsMap[key] = value;
          }
        });
      }
    });

    previousOddsRef.current[matchId] = currentOddsMap;
    hasInitializedRef.current[matchId] = true;
  }, [matchId, markets, refreshInterval]);

  // Get change for a specific market and option
  const getOddsChange = (marketName, optionLabel) => {
    const changes = oddsHistory[matchId];
    if (!changes) return null;
    
    const key = `${marketName}-${optionLabel}`;
    return changes[key] || null;
  };

  return { getOddsChange, oddsHistory };
}

