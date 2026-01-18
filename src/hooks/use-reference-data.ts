"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useCachedEdgeFunction } from './use-cached-edge-function';
import {
  Mode,
  Muscle,
  Chakra,
  Channel,
  Acupoint,
} from '@/types/api';

interface ReferenceData {
  modes: Mode[];
  muscles: Muscle[];
  chakras: Chakra[];
  channels: Channel[];
  acupoints: Acupoint[];
}

interface ReferenceDataContextType {
  data: ReferenceData;
  loading: boolean;
  error: string | null;
  needsConfig: boolean;
  isCached: boolean; // New: Overall cache status
  refetchAll: () => void;
}

const defaultReferenceData: ReferenceData = {
  modes: [],
  muscles: [],
  chakras: [],
  channels: [],
  acupoints: [],
};

export const ReferenceDataContext = createContext<ReferenceDataContextType>({
  data: defaultReferenceData,
  loading: true,
  error: null,
  needsConfig: false,
  isCached: false,
  refetchAll: () => {},
});

const LONG_TTL = 720; // 12 hours in minutes

export const useReferenceData = () => useContext(ReferenceDataContext);

// Define the response structure for the new combined function
interface GetAllReferenceDataResponse {
  data: ReferenceData;
}

export const useReferenceDataFetcher = () => {
  const [data, setData] = useState<ReferenceData>(defaultReferenceData);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [configNeeded, setConfigNeeded] = useState(false);
  const [isCached, setIsCached] = useState(false);


  const handleConfigNeeded = useCallback(() => setConfigNeeded(true), []);
  const handleError = useCallback((msg: string) => setErrors(prev => [...prev, msg]), []);

  // 1. Combined Reference Data Fetch
  const { execute: fetchAllReferenceData } = useCachedEdgeFunction<void, GetAllReferenceDataResponse>('get-all-reference-data', {
    requiresAuth: true,
    requiresNotionConfig: true,
    cacheKey: 'all-reference-data', // Single cache key for all data
    cacheTtl: LONG_TTL,
    onSuccess: useCallback((res: GetAllReferenceDataResponse, isCached: boolean) => {
      setData(res.data);
      setIsCached(isCached);
      setErrors([]); // Clear errors on success
      setConfigNeeded(false);
    }, []),
    onError: useCallback((msg: string, errorCode?: string) => {
      if (errorCode === 'NOTION_CONFIG_NOT_FOUND') {
        setConfigNeeded(true);
        setErrors([]);
      } else {
        handleError(msg);
      }
    }, [handleError]),
    onNotionConfigNeeded: handleConfigNeeded,
  });


  const refetchAll = useCallback(async () => {
    // Reset state before fetching
    setErrors([]);
    setConfigNeeded(false);
    setLoading(true);
    setIsCached(false);

    try {
      await fetchAllReferenceData();
    } catch (e) {
      // Error handling is done inside the hook's onError callback
    } finally {
      setLoading(false);
    }
  }, [fetchAllReferenceData]);

  // Initial fetch on mount
  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  const error = errors.length > 0 ? errors.join('; ') : null;
  
  return { data, loading, error, needsConfig: configNeeded, isCached, refetchAll };
};