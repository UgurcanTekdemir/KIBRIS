import React, { createContext, useContext, useState } from 'react';

const BetSlipContext = createContext(null);

export const BetSlipProvider = ({ children }) => {
  const [selections, setSelections] = useState([]);
  const [stake, setStake] = useState(0);

  const addSelection = (match, marketName, option, odds) => {
    const existingIndex = selections.findIndex(
      (s) => s.matchId === match.id && s.marketName === marketName
    );

    if (existingIndex > -1) {
      const updated = [...selections];
      updated[existingIndex] = {
        matchId: match.id,
        matchName: `${match.homeTeam} vs ${match.awayTeam}`,
        league: match.league,
        marketName,
        option,
        odds,
      };
      setSelections(updated);
    } else {
      setSelections([
        ...selections,
        {
          matchId: match.id,
          matchName: `${match.homeTeam} vs ${match.awayTeam}`,
          league: match.league,
          marketName,
          option,
          odds,
        },
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
