import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { RatingResult } from '@/lib/rater';

// Individual rating card in the stack
export type RatingCard = {
  id: string;
  imageUri: string;
  result: RatingResult;
  isRedesign: boolean;
  parentId?: string; // Links to previous card this was redesigned from
};

// Legacy type for backwards compatibility
type RatingSession = {
  imageUri: string;
  result: RatingResult;
};

type RatingSessionContextValue = {
  // Stack navigation
  stack: RatingCard[];
  currentIndex: number;
  currentCard: RatingCard | null;
  
  // Navigation functions
  pushCard: (card: Omit<RatingCard, 'id'>) => string;
  goBack: () => boolean;
  goForward: () => boolean;
  navigateToCard: (id: string) => boolean;
  
  // Navigation state
  canGoBack: boolean;
  canGoForward: boolean;
  
  // Clear everything
  clearStack: () => void;
  
  // Legacy compatibility
  session: RatingSession | null;
  saveSession: (session: RatingSession) => void;
  clearSession: () => void;
};

const RatingSessionContext = createContext<RatingSessionContextValue | undefined>(undefined);

let cardCounter = 0;
function generateCardId(): string {
  cardCounter++;
  return `card_${cardCounter}_${Date.now()}`;
}

export function RatingSessionProvider({ children }: { children: React.ReactNode }) {
  // Use a single state object to avoid sync issues between stack and index
  const [state, setState] = useState<{ stack: RatingCard[]; currentIndex: number }>({
    stack: [],
    currentIndex: -1,
  });

  const { stack, currentIndex } = state;

  // Current card based on index
  const currentCard = useMemo(() => {
    if (currentIndex >= 0 && currentIndex < stack.length) {
      return stack[currentIndex];
    }
    return null;
  }, [stack, currentIndex]);

  // Navigation state
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex >= 0 && currentIndex < stack.length - 1;

  // Push a new card to the stack
  const pushCard = useCallback((cardData: Omit<RatingCard, 'id'>): string => {
    const id = generateCardId();
    const newCard: RatingCard = { ...cardData, id };
    
    setState(prev => {
      const newStack = [...prev.stack, newCard];
      const newIndex = newStack.length - 1;
      console.log('[RatingSession] Pushed card:', id, 'Stack size:', newStack.length, 'Index:', newIndex);
      return {
        stack: newStack,
        currentIndex: newIndex,
      };
    });
    
    return id;
  }, []);

  // Navigate backwards
  const goBack = useCallback((): boolean => {
    let success = false;
    setState(prev => {
      if (prev.currentIndex > 0) {
        const newIndex = prev.currentIndex - 1;
        console.log('[RatingSession] Going back to index:', newIndex);
        success = true;
        return { ...prev, currentIndex: newIndex };
      }
      console.log('[RatingSession] Cannot go back, at start');
      return prev;
    });
    return success;
  }, []);

  // Navigate forwards
  const goForward = useCallback((): boolean => {
    let success = false;
    setState(prev => {
      if (prev.currentIndex < prev.stack.length - 1) {
        const newIndex = prev.currentIndex + 1;
        console.log('[RatingSession] Going forward to index:', newIndex);
        success = true;
        return { ...prev, currentIndex: newIndex };
      }
      console.log('[RatingSession] Cannot go forward, at end');
      return prev;
    });
    return success;
  }, []);

  // Navigate to specific card by ID
  const navigateToCard = useCallback((id: string): boolean => {
    let success = false;
    setState(prev => {
      const index = prev.stack.findIndex(card => card.id === id);
      if (index !== -1) {
        console.log('[RatingSession] Navigating to card:', id, 'at index:', index);
        success = true;
        return { ...prev, currentIndex: index };
      }
      return prev;
    });
    return success;
  }, []);

  // Clear all cards
  const clearStack = useCallback(() => {
    console.log('[RatingSession] Clearing stack');
    setState({ stack: [], currentIndex: -1 });
  }, []);

  // Legacy compatibility: session is the current card
  const session = useMemo((): RatingSession | null => {
    if (currentCard) {
      return {
        imageUri: currentCard.imageUri,
        result: currentCard.result,
      };
    }
    return null;
  }, [currentCard]);

  // Legacy compatibility: saveSession pushes a new card
  const saveSession = useCallback((sessionData: RatingSession) => {
    pushCard({
      imageUri: sessionData.imageUri,
      result: sessionData.result,
      isRedesign: false,
    });
  }, [pushCard]);

  // Legacy compatibility: clearSession clears the stack
  const clearSession = useCallback(() => {
    clearStack();
  }, [clearStack]);

  // Debug logging
  console.log('[RatingSession] Render - Stack:', stack.length, 'Index:', currentIndex, 'CanGoBack:', canGoBack, 'CanGoForward:', canGoForward);

  const value = useMemo(
    () => ({
      stack,
      currentIndex,
      currentCard,
      pushCard,
      goBack,
      goForward,
      navigateToCard,
      canGoBack,
      canGoForward,
      clearStack,
      session,
      saveSession,
      clearSession,
    }),
    [
      stack,
      currentIndex,
      currentCard,
      pushCard,
      goBack,
      goForward,
      navigateToCard,
      canGoBack,
      canGoForward,
      clearStack,
      session,
      saveSession,
      clearSession,
    ],
  );

  return <RatingSessionContext.Provider value={value}>{children}</RatingSessionContext.Provider>;
}

export function useRatingSession(): RatingSessionContextValue {
  const context = useContext(RatingSessionContext);
  if (!context) {
    throw new Error('useRatingSession must be used within a RatingSessionProvider');
  }
  return context;
}
