"use client";

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCachedEdgeFunction } from './use-cached-edge-function';
import { showError } from '@/utils/toast';

interface NotionConfigStatus {
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  checkConfig: () => Promise<void>;
}

export const useNotionConfig = (): NotionConfigStatus => {
  const navigate = useNavigate();
  const [isConfigured, setIsConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    loading: isLoading,
    execute: checkNotionConfig,
  } = useCachedEdgeFunction<void, any>(
    'get-notion-secrets',
    {
      requiresAuth: true,
      requiresNotionConfig: false, // We want to check if config exists, not require it
      onSuccess: useCallback(() => {
        setIsConfigured(true);
        setError(null);
      }, []),
      onError: useCallback((msg: string, errorCode?: string) => {
        if (errorCode === 'NOTION_CONFIG_NOT_FOUND') {
          setIsConfigured(false);
          setError(null); // Not an error, just not configured
        } else {
          setIsConfigured(false);
          setError(msg);
          showError(`Error checking Notion configuration: ${msg}`);
        }
      }, []),
    }
  );

  const checkConfig = useCallback(async () => {
    await checkNotionConfig();
  }, [checkNotionConfig]);

  // Check configuration on mount
  useEffect(() => {
    checkConfig();
  }, [checkConfig]);

  return {
    isConfigured,
    isLoading,
    error,
    checkConfig,
  };
};