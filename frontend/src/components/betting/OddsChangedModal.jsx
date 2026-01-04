import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

/**
 * Modal to show when odds have changed between snapshot and accept time
 */
export const OddsChangedModal = ({ open, onClose, onAccept, onReject, changedSelections }) => {
  if (!changedSelections || changedSelections.length === 0) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="bg-[#0d1117] border-[#1e2736] text-white">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <AlertDialogTitle className="text-white">Oranlar Değişti</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-gray-400 pt-2">
            Kuponunuza eklediğiniz seçimlerden bazılarının oranları değişmiş. Güncel oranlarla devam etmek ister misiniz?
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-2 py-4">
          {changedSelections.map((selection, idx) => (
            <div 
              key={idx} 
              className="bg-[#1a2332] rounded-lg p-3 border border-[#2a3a4d]"
            >
              <p className="text-sm text-white font-medium mb-1">
                {selection.matchName}
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">
                  {selection.marketName}: {selection.option}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 line-through">
                    {selection.snapshotOdds.toFixed(2)}
                  </span>
                  <span className="text-amber-500 font-bold">
                    {selection.currentOdds.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel 
            onClick={onReject}
            className="bg-[#1a2332] border-[#2a3a4d] text-gray-400 hover:text-white hover:bg-[#2a3a4d]"
          >
            İptal
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onAccept}
            className="bg-amber-500 text-black hover:bg-amber-600"
          >
            Güncel Oranlarla Devam Et
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

