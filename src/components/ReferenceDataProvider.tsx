"use client";

import React from 'react';
import { useReferenceDataFetcher, ReferenceDataContext } from '@/hooks/use-reference-data';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';

interface ReferenceDataProviderProps {
  children: React.ReactNode;
}

const ReferenceDataProvider: React.FC<ReferenceDataProviderProps> = ({ children }) => {
  const { data, loading, error, needsConfig, refetchAll } = useReferenceDataFetcher();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-indigo-600" />
          <h2 className="text-xl font-bold text-indigo-900">Loading Reference Data...</h2>
          <p className="text-gray-600">Fetching Notion databases (Muscles, Chakras, etc.). This is cached for speed.</p>
        </div>
      </div>
    );
  }

  if (needsConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-8 text-center">
            <div className="mx-auto mb-4 p-4 bg-indigo-100 rounded-full w-20 h-20 flex items-center justify-center">
              <Settings className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-indigo-900 mb-2">
              Notion Integration Required
            </h2>
            <p className="text-gray-600 mb-6">
              One or more required Notion databases are not configured or accessible.
            </p>
            <Button
              className="w-full h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              onClick={() => navigate('/notion-config')}
            >
              Configure Notion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ReferenceDataContext.Provider value={{ data, loading, error, needsConfig, refetchAll }}>
      {children}
    </ReferenceDataContext.Provider>
  );
};

export default ReferenceDataProvider;