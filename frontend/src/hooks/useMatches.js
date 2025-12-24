import { useState, useEffect } from 'react';
import { matchAPI } from '../services/api';
import { mapApiMatchesToInternal } from '../utils/matchMapper';

/**
 * Custom hook for fetching matches
 */
export function useMatches(filters = {}) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Extract filter values for dependency array
  const matchType = filters.matchType;
  const sports = filters.sports;
  const date = filters.date;
  const league = filters.league;

  useEffect(() => {
    let cancelled = false;

    async function fetchMatches() {
      try {
        setLoading(true);
        setError(null);
        
        const apiMatches = await matchAPI.getMatches(filters);
        
        if (!cancelled) {
          const mappedMatches = mapApiMatchesToInternal(apiMatches);
          console.log('useMatches Debug:', {
            apiMatchesCount: apiMatches.length,
            mappedMatchesCount: mappedMatches.length,
            firstApiMatch: apiMatches[0],
            firstMappedMatch: mappedMatches[0]
          });
          setMatches(mappedMatches);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Maçlar yüklenirken bir hata oluştu');
          console.error('Error fetching matches:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMatches();

    return () => {
      cancelled = true;
    };
  }, [matchType, sports, date, league, filters]); // Re-fetch when filters change

  return { matches, loading, error, refetch: () => {
    setLoading(true);
    setError(null);
    matchAPI.getMatches(filters)
      .then(apiMatches => {
        const mappedMatches = mapApiMatchesToInternal(apiMatches);
        setMatches(mappedMatches);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Maçlar yüklenirken bir hata oluştu');
        setLoading(false);
      });
  }};
}

/**
 * Custom hook for fetching live matches
 */
export function useLiveMatches(matchType = 1) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchLiveMatches() {
      try {
        setLoading(true);
        setError(null);
        
        const apiMatches = await matchAPI.getLiveMatches(matchType);
        
        console.log('useLiveMatches Debug:', {
          apiMatchesCount: apiMatches?.length || 0,
          apiMatches: apiMatches,
          firstMatch: apiMatches?.[0]
        });
        
        if (!cancelled) {
          const mappedMatches = mapApiMatchesToInternal(apiMatches || []);
          console.log('useLiveMatches Mapped:', {
            mappedCount: mappedMatches.length,
            firstMapped: mappedMatches[0],
            allIsLive: mappedMatches.map(m => ({ id: m.id, isLive: m.isLive, isFinished: m.isFinished, status: m.status }))
          });
          
          // Filter only live matches that are NOT finished
          // Backend might return recently finished matches from /live endpoint, but we only want truly live ones
          const liveMatches = mappedMatches.filter(m => m.isLive === true && m.isFinished !== true);
          console.log('useLiveMatches Filtered:', {
            liveCount: liveMatches.length,
            liveMatches: liveMatches.map(m => ({ id: m.id, isLive: m.isLive, isFinished: m.isFinished, status: m.status }))
          });
          
          setMatches(liveMatches);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Canlı maçlar yüklenirken bir hata oluştu');
          console.error('Error fetching live matches:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchLiveMatches();

    // Refresh every 30 seconds for live matches
    const interval = setInterval(() => {
      if (!cancelled) {
        fetchLiveMatches();
      }
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [matchType]);

  return { matches, loading, error, refetch: () => {
    setLoading(true);
    setError(null);
    matchAPI.getLiveMatches(matchType)
      .then(apiMatches => {
        const mappedMatches = mapApiMatchesToInternal(apiMatches);
        const liveMatches = mappedMatches.filter(m => m.isLive);
        setMatches(liveMatches);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Canlı maçlar yüklenirken bir hata oluştu');
        setLoading(false);
      });
  }};
}

/**
 * Custom hook for fetching a single match by ID
 */
export function useMatchDetails(matchId) {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!matchId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchMatchDetails() {
      try {
        setLoading(true);
        setError(null);
        
        const apiMatch = await matchAPI.getMatchDetails(matchId);
        
        if (!cancelled) {
          console.log('useMatchDetails: API response:', apiMatch);
          if (!apiMatch) {
            setError('Maç bulunamadı');
            setLoading(false);
            return;
          }
          const { mapApiMatchToInternal } = await import('../utils/matchMapper');
          const mappedMatch = mapApiMatchToInternal(apiMatch);
          console.log('useMatchDetails: Mapped match:', mappedMatch);
          console.log('useMatchDetails: Markets:', mappedMatch?.markets);
          if (!mappedMatch) {
            setError('Maç verileri işlenemedi');
            setLoading(false);
            return;
          }
          setMatch(mappedMatch);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Maç detayları yüklenirken bir hata oluştu');
          console.error('Error fetching match details:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMatchDetails();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  return { match, loading, error };
}

