"use client";

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cacheService } from '@/integrations/supabase/cache';
import { showSuccess, showError } from '@/utils/toast';

interface UseCachedEdgeFunctionOptions {
  requiresAuth?: boolean;
  requiresNotionConfig?: boolean;
  cacheKey?: string;
  cacheTtl?: number; // minutes
  onSuccess?: (data: any, isCached: boolean) => void;
  onError?: (error: string, errorCode?: string) => void;
  onNotionConfigNeeded?: () => void;
}

export const useCachedEdgeFunction = <TRequest, TResponse>(
  functionName: string,
  options?: UseCachedEdgeFunctionOptions
) => {
  const {
    requiresAuth = true,
    requiresNotionConfig = false,
    cacheKey,
    cacheTtl = 30,
    onSuccess,
    onError,
    onNotionConfigNeeded,
  } = options || {};

  const [data, setData] = useState<TResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfig, setNeedsConfig] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const navigate = useNavigate();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcriagmovotwuqbppcfm.supabase.co';

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onNotionConfigNeededRef = useRef(onNotionConfigNeeded);

  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  onNotionConfigNeededRef.current = onNotionConfigNeeded;

  const execute = useCallback(async (payload?: TRequest) => {
    console.log(`[useCachedEdgeFunction] Executing ${functionName} with payload:`, payload);
    setLoading(true);
    setError(null);
    setData(null);
    setIsCached(false);
    setNeedsConfig(false);

    try {
      let session = null;
      let userId: string | null = null;

      if (requiresAuth) {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!currentSession) {
          console.log(`[useCachedEdgeFunction] No session found for ${functionName}, navigating to login.`);
          showError('Authentication Required: Please log in to continue.');
          navigate('/login');
          setLoading(false);
          return;
        }
        session = currentSession;
        userId = session.user.id;
        console.log(`[useCachedEdgeFunction] Session found for ${functionName}. User ID: ${userId}`);
      }

      // --- START: Notion Config Check Optimization ---
      if (requiresNotionConfig && session && userId) {
        console.log(`[useCachedEdgeFunction] Checking Notion config for ${functionName}.`);
        
        const configCacheKey = 'config-status';
        let isConfigValid = false;

        const cachedConfig = await cacheService.get(userId, configCacheKey);
        
        // Check if cached config status is valid and not expired
        if (cachedConfig && cachedConfig.validUntil && new Date(cachedConfig.validUntil) > new Date()) {
          isConfigValid = true;
          console.log(`[useCachedEdgeFunction] Notion config status cache hit. Skipping network check.`);
        }

        if (!isConfigValid) {
          console.log(`[useCachedEdgeFunction] Notion config status cache miss/expired. Fetching secrets status via edge function.`);
          
          const secretsResponse = await fetch(
            `${supabaseUrl}/functions/v1/get-notion-secrets`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (!secretsResponse.ok) {
            const errorData = await secretsResponse.json();
            if (errorData.errorCode === 'NOTION_CONFIG_NOT_FOUND') {
              console.log(`[useCachedEdgeFunction] Notion config missing for ${functionName}.`);
              setNeedsConfig(true);
              onNotionConfigNeededRef.current?.();
              setLoading(false);
              return;
            } else {
              throw new Error(errorData.error || 'Failed to fetch Notion configuration.');
            }
          }
          
          // If successful (200 OK), cache the status for 15 minutes
          const validUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          // Store a simple object indicating validity and expiration time
          await cacheService.set(userId, configCacheKey, { valid: true, validUntil }, 15);
          isConfigValid = true;
          console.log(`[useCachedEdgeFunction] Notion config status successfully fetched and cached.`);
        }
        
        if (!isConfigValid) {
            // Should be unreachable if logic is correct, but ensures flow stops if config is invalid
            setNeedsConfig(true);
            onNotionConfigNeededRef.current?.();
            setLoading(false);
            return;
        }
      }
      // --- END: Notion Config Check Optimization ---

      // Check cache for main data
      if (cacheKey && userId) {
        const cachedData = await cacheService.get(userId, cacheKey);
        if (cachedData) {
          console.log(`[useCachedEdgeFunction] Cache hit for ${functionName} with key: ${cacheKey}`);
          setData(cachedData);
          setIsCached(true);
          onSuccessRef.current?.(cachedData, true); // Pass true for isCached
          setLoading(false);
          return;
        }
      }

      console.log(`[useCachedEdgeFunction] Initiating fetch for ${functionName} at ${supabaseUrl}/functions/v1/${functionName}`);
      const response = await fetch(
        `${supabaseUrl}/functions/v1/${functionName}`,
        {
          method: payload ? 'POST' : 'GET',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: payload ? JSON.stringify(payload) : undefined
        }
      );

      console.log(`[useCachedEdgeFunction] Fetch response status for ${functionName}: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || errorData.details || `Failed to execute ${functionName}`;
        const errorCode = errorData.errorCode;

        setError(errorMessage);
        onErrorRef.current?.(errorMessage, errorCode);

        if (errorCode === 'PROFILE_NOT_FOUND' || errorCode === 'PRACTITIONER_NAME_MISSING') {
          showError(`Profile Required: ${errorMessage}`);
          navigate('/profile-setup');
        } else if (errorData.error?.includes('Notion configuration not found')) {
          setNeedsConfig(true);
          onNotionConfigNeededRef.current?.();
        } else {
          showError(`Error: ${errorMessage}`);
        }
        setLoading(false);
        return;
      }

      const result = await response.json();
      setData(result);
      onSuccessRef.current?.(result, false); // Pass false for isCached
      console.log(`[useCachedEdgeFunction] Successfully fetched data for ${functionName}.`);

      // Cache the result if cacheKey is provided
      if (cacheKey && userId && result) {
        await cacheService.set(userId, cacheKey, result, cacheTtl);
        console.log(`[useCachedEdgeFunction] Cached data for ${functionName} with key: ${cacheKey}`);
      }

    } catch (err: any) {
      console.error(`[useCachedEdgeFunction] Caught error in ${functionName}:`, err);
      const errorMessage = err.message || 'An unexpected error occurred.';
      setError(errorMessage);
      onErrorRef.current?.(errorMessage);
      showError(`Error: ${errorMessage}`);
    } finally {
      console.log(`[useCachedEdgeFunction] Finally block reached for ${functionName}. Setting loading to false.`);
      setLoading(false);
    }
  }, [functionName, requiresAuth, requiresNotionConfig, cacheKey, cacheTtl, navigate, supabaseUrl]);

  const invalidateCache = useCallback(async () => {
    if (cacheKey) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await cacheService.invalidate(user.id, cacheKey);
        console.log(`[useCachedEdgeFunction] Invalidated cache for ${functionName} with key: ${cacheKey}`);
      }
    }
  }, [cacheKey, functionName]);

  return { data, loading, error, needsConfig, isCached, execute, invalidateCache };
};