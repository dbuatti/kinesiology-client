"use client";

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast'; // Import sonner toast utilities
import { NotionSecrets } from '@/types/api';

interface UseSupabaseEdgeFunctionOptions {
  requiresAuth?: boolean;
  requiresNotionConfig?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string, errorCode?: string) => void;
  onNotionConfigNeeded?: () => void;
}

interface GetNotionSecretsResponse {
  secrets: NotionSecrets;
}

export const useSupabaseEdgeFunction = <TRequest, TResponse>(
  functionName: string,
  options?: UseSupabaseEdgeFunctionOptions
) => {
  const {
    requiresAuth = true,
    requiresNotionConfig = false,
    onSuccess,
    onError,
    onNotionConfigNeeded,
  } = options || {};

  const [data, setData] = useState<TResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfig, setNeedsConfig] = useState(false);
  const navigate = useNavigate();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcriagmovotwuqbppcfm.supabase.co';

  const execute = useCallback(async (payload?: TRequest) => {
    // Prevent re-execution if already in a 'needs config' state and not explicitly trying to save config
    if (needsConfig && functionName !== 'set-notion-secrets') {
      console.log(`[useSupabaseEdgeFunction] Skipping execution for ${functionName} because Notion config is needed.`);
      setLoading(false); // Ensure loading is false
      return;
    }

    console.log(`[useSupabaseEdgeFunction] Executing ${functionName} with payload:`, payload);
    setLoading(true);
    setError(null);
    // setNeedsConfig(false); // Only reset if we are actually going to try fetching config again
    setData(null);

    try {
      let session = null;
      if (requiresAuth) {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!currentSession) {
          console.log(`[useSupabaseEdgeFunction] No session found for ${functionName}, navigating to login.`);
          showError('Authentication Required: Please log in to continue.');
          navigate('/login');
          setLoading(false);
          return;
        }
        session = currentSession;
        console.log(`[useSupabaseEdgeFunction] Session found for ${functionName}. User ID: ${session.user.id}`);
      }

      if (requiresNotionConfig && session) {
        console.log(`[useSupabaseEdgeFunction] Checking Notion config for ${functionName} using get-notion-secrets edge function.`);
        
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
            console.log(`[useSupabaseEdgeFunction] Notion config missing for ${functionName}.`);
            setNeedsConfig(true);
            onNotionConfigNeeded?.();
            setLoading(false);
            return; // Stop execution here
          } else {
            console.error(`[useSupabaseEdgeFunction] Error fetching Notion secrets via edge function for ${functionName}:`, errorData);
            throw new Error(errorData.error || 'Failed to fetch Notion configuration.');
          }
        }
        const secretsResult: GetNotionSecretsResponse = await secretsResponse.json();
        const secrets = secretsResult.secrets;

        // Check if all required Notion database IDs are present
        const requiredDbIds = [
          secrets.notion_integration_token,
          secrets.appointments_database_id,
          secrets.modes_database_id,
          secrets.acupoints_database_id,
          secrets.muscles_database_id, // Check for muscles_database_id
        ];

        if (requiredDbIds.some(id => !id)) {
          console.log(`[useSupabaseEdgeFunction] One or more Notion database IDs are missing for ${functionName}.`);
          setNeedsConfig(true);
          onNotionConfigNeeded?.();
          setLoading(false);
          return; // Stop execution here
        }

        // If config is found, ensure needsConfig is false
        if (needsConfig) setNeedsConfig(false); // Reset if it was true from a previous state
        console.log(`[useSupabaseEdgeFunction] Notion config found for ${functionName}.`);
      }

      console.log(`[useSupabaseEdgeFunction] Initiating fetch for ${functionName} at ${supabaseUrl}/functions/v1/${functionName}`);
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

      console.log(`[useSupabaseEdgeFunction] Fetch response status for ${functionName}: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || errorData.details || `Failed to execute ${functionName}`;
        const errorCode = errorData.errorCode;

        setError(errorMessage);
        onError?.(errorMessage, errorCode);

        if (errorCode === 'PROFILE_NOT_FOUND' || errorCode === 'PRACTITIONER_NAME_MISSING') {
          showError(`Profile Required: ${errorMessage}`);
          navigate('/profile-setup');
        } else if (errorData.error?.includes('Notion configuration not found')) {
          setNeedsConfig(true);
          onNotionConfigNeeded?.();
        } else {
          showError(`Error: ${errorMessage}`);
        }
        setLoading(false);
        return; // Stop execution here
      }

      const result = await response.json();
      setData(result);
      onSuccess?.(result);
      console.log(`[useSupabaseEdgeFunction] Successfully fetched data for ${functionName}.`);

    } catch (err: any) {
      console.error(`[useSupabaseEdgeFunction] Caught error in ${functionName}:`, err);
      const errorMessage = err.message || 'An unexpected error occurred.';
      setError(errorMessage);
      onError?.(errorMessage);
      showError(`Error: ${errorMessage}`);
    } finally {
      console.log(`[useSupabaseEdgeFunction] Finally block reached for ${functionName}. Setting loading to false.`);
      setLoading(false);
    }
  }, [functionName, requiresAuth, requiresNotionConfig, onSuccess, onError, onNotionConfigNeeded, navigate, supabaseUrl, needsConfig]);

  return { data, loading, error, needsConfig, execute };
};