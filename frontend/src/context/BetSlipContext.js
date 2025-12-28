import React, { createContext, useContext, useState } from 'react';
import { shouldLockBetting } from '../utils/liveMatchSafety';

const BetSlipContext = createContext(null);

export const BetSlipProvider = ({ children }) => {
  const [selections, setSelections] = useState([]);
  const [stake, setStake] = useState(0);

  const addSelection = (match, marketName, option, odds, isLocked = false, fixtureId = null, selectionId = null) => {
    // Prevent adding locked selections
    if (isLocked) {
      return;
    }

    // Extract fixtureId and selectionId from match or parameters
    const finalFixtureId = fixtureId || match.fixtureId || match.sportmonksData?.fixtureId || match.id;
    const finalSelectionId = selectionId || (match.markets?.[0]?.options?.find(opt => opt.label === option)?.selectionId);

    // Check if the exact same selection already exists (toggle off)
    const existingSelectionIndex = selections.findIndex(
      (s) =>
        s.matchId === match.id &&
        s.marketName === marketName &&
        s.option === option
    );

    if (existingSelectionIndex > -1) {
      // Toggle off: Remove the selection
      setSelections(selections.filter((_, index) => index !== existingSelectionIndex));
      return;
    }

    // Check if there's another selection for the same market (replace it)
    const existingMarketIndex = selections.findIndex(
      (s) => s.matchId === match.id && s.marketName === marketName
    );

    const selectionData = {
      matchId: match.id,
      matchName: `${match.homeTeam} vs ${match.awayTeam}`,
      league: match.league,
      marketName,
      option,
      odds,
      isLive: match.isLive || false,
      isLocked: false, // New selection is not locked
      fixtureId: finalFixtureId, // Sportmonks fixture ID
      selectionId: finalSelectionId, // Sportmonks selection ID
    };

    if (existingMarketIndex > -1) {
      // Replace existing selection in the same market
      const updated = [...selections];
      updated[existingMarketIndex] = selectionData;
      setSelections(updated);
    } else {
      // Add new selection
      setSelections([
        ...selections,
        selectionData,
      ]);
    }
  };

  const removeSelection = (matchId, marketName) => {
    setSelections(
      selections.filter(
        (s) => !(s.matchId === matchId && s.marketName === marketName)
      )
    );
  };

  const clearSelections = () => {
    setSelections([]);
    setStake(0);
  };

  const isSelected = (matchId, marketName, option) => {
    return selections.some(
      (s) =>
        s.matchId === matchId &&
        s.marketName === marketName &&
        s.option === option
    );
  };

  const totalOdds = selections.reduce((acc, s) => acc * s.odds, 1);
  const potentialWin = stake * totalOdds;

  return (
    <BetSlipContext.Provider
      value={{
        selections,
        stake,
        setStake,
        addSelection,
        removeSelection,
        clearSelections,
        isSelected,
        totalOdds,
        potentialWin,
      }}
    >
      {children}
    </BetSlipContext.Provider>
  );
};

export const useBetSlip = () => {
  const context = useContext(BetSlipContext);
  if (!context) {
    throw new Error('useBetSlip must be used within a BetSlipProvider');
  }
  return context;
};
