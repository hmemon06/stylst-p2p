import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface OnboardingData {
  identity?: string;
  age?: string;
  goal?: string;
  comfortStyleBalance?: number; // 0.0 to 1.0
  visualTasteResults?: string[]; // array of selected styles
  colorProfile?: string[];
  fitProfile?: string[];
}

interface OnboardingContextType {
  data: OnboardingData;
  updateData: (field: keyof OnboardingData, value: any) => void;
  resetData: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>({});

  const updateData = (field: keyof OnboardingData, value: any) => {
    setData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetData = () => {
    setData({});
  };

  return (
    <OnboardingContext.Provider value={{ data, updateData, resetData }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
