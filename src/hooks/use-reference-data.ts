"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useCachedEdgeFunction } from './use-cached-edge-function';
import {
  Mode,
  Muscle,
  Chakra,
  Channel,
  Acupoint,
  GetNotionModesResponse,
  GetMusclesResponse,
  GetChakrasResponse,
  GetChannelsResponse,
  GetAcupointsResponse,
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
  refetchAll: () => {},
});

const LONG_TTL = 525600; // 1 year in minutes

export const useReferenceData = () => useContext(ReferenceDataContext);

export const useReferenceDataFetcher = () => {
  const [data, setData] = useState<ReferenceData>(defaultReferenceData);
  const [loadingCount, setLoadingCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [configNeeded, setConfigNeeded] = useState(false);

  const decrementLoading = useCallback(() => setLoadingCount(prev => Math.max(0, prev - 1)), []);

  const handleConfigNeeded = useCallback(() => setConfigNeeded(true), []);
  const handleError = useCallback((msg: string) => setErrors(prev => [...prev, msg]), []);

  // 1. Modes
  const { execute: fetchModes } = useCachedEdgeFunction<void, GetNotionModesResponse>('get-notion-modes', {
    requiresAuth: true,
    requiresNotionConfig: true,
    cacheKey: 'all-modes',
    cacheTtl: LONG_TTL,
    onSuccess: (res) => setData(prev => ({ ...prev, modes: res.modes })),
    onError: handleError,
    onNotionConfigNeeded: handleConfigNeeded,
  });

  // 2. Muscles
  const { execute: fetchMuscles } = useCachedEdgeFunction<{ searchTerm: string, searchType: 'muscle' | 'meridian' | 'organ' | 'emotion' }, GetMusclesResponse>('get-muscles', {
    requiresAuth: true,
    requiresNotionConfig: true,
    cacheKey: 'all-muscles',
    cacheTtl: LONG_TTL,
    onSuccess: (res) => setData(prev => ({ ...prev, muscles: res.muscles })),
    onError: handleError,
    onNotionConfigNeeded: handleConfigNeeded,
  });

  // 3. Chakras
  const { execute: fetchChakras } = useCachedEdgeFunction<{ searchTerm: string, searchType: 'name' | 'element' | 'emotion' | 'organ' }, GetChakrasResponse>('get-chakras', {
    requiresAuth: true,
    requiresNotionConfig: true,
    cacheKey: 'all-chakras',
    cacheTtl: LONG_TTL,
    onSuccess: (res) => setData(prev => ({ ...prev, chakras: res.chakras })),
    onError: handleError,
    onNotionConfigNeeded: handleConfigNeeded,
  });

  // 4. Channels
  const { execute: fetchChannels } = useCachedEdgeFunction<{ searchTerm: string, searchType: 'name' | 'element' }, GetChannelsResponse>('get-channels', {
    requiresAuth: true,
    requiresNotionConfig: true,
    cacheKey: 'all-channels',
    cacheTtl: LONG_TTL,
    onSuccess: (res) => setData(prev => ({ ...prev, channels: res.channels })),
    onError: handleError,
    onNotionConfigNeeded: handleConfigNeeded,
  });

  // 5. Acupoints
  const { execute: fetchAcupoints } = useCachedEdgeFunction<{ searchTerm: string, searchType: 'point' | 'symptom' }, GetAcupointsResponse>('get-acupoints', {
    requiresAuth: true,
    requiresNotionConfig: true,
    cacheKey: 'all-acupoints',
    cacheTtl: LONG_TTL,
    onSuccess: (res) => setData(prev => ({ ...prev, acupoints: res.acupoints })),
    onError: handleError,
    onNotionConfigNeeded: handleConfigNeeded,
  });

  const refetchAll = useCallback(async () => {
    // Reset state before fetching
    setErrors([]);
    setConfigNeeded(false);
    setLoadingCount(5); // Start with 5 items loading

    const promises = [
      fetchModes().finally(decrementLoading),
      fetchMuscles({ searchTerm: '', searchType: 'muscle' }).finally(decrementLoading),
      fetchChakras({ searchTerm: '', searchType: 'name' }).finally(decrementLoading),
      fetchChannels({ searchTerm: '', searchType: 'name' }).finally(decrementLoading),
      fetchAcupoints({ searchTerm: '', searchType: 'point' }).finally(decrementLoading),
    ];

    await Promise.all(promises);
  }, [fetchModes, fetchMuscles, fetchChakras, fetchChannels, fetchAcupoints, decrementLoading]);

  // Initial fetch on mount
  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  const isLoading = loadingCount > 0;
  const error = errors.length > 0 ? errors.join('; ') : null;

  return { data, loading: isLoading, error, needsConfig: configNeeded, refetchAll };
};