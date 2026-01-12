"use client";

import { useState, useCallback, useRef } from 'react'; // Import useRef
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
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

  // Use refs for callbacks to keep them stable across renders
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onNotionConfigNeededRef = useRef(onNotionConfigNeeded);

  // Update refs whenever callbacks change
  // This ensures the `execute` function always calls the latest version of the callbacks
  // without `execute` itself needing to be re-created.
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  onNotionConfigNeededRef.current = onNotionConfigNeeded;

  const execute = useCallback(async (payload?: TRequest) => {
    console.log(`[useSupabaseEdgeFunction] Executing ${functionName} with payload:`, payload);
    setLoading(true);
    setError(null);
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
            onNotionConfigNeededRef.current?.(); // Call the latest ref version
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
          secrets.muscles_database_id,
          secrets.channels_database_id,
          secrets.chakras_database_id,
        ];

        if (requiredDbIds.some(id => !id)) {
          console.log(`[useSupabaseEdgeFunction] One or more Notion database IDs are missing for ${functionName}.`);
          setNeedsConfig(true);
          onNotionConfigNeededRef.current?.(); // Call the latest ref version
          setLoading(false);
          return; // Stop execution here
        }

        // If config is found, ensure needsConfig is false
        setNeedsConfig(false); // Always set to false if config is found and valid
        console.log(`[useSupabaseEdgeFunction] Notion config found for ${functionName}.`);
      } else if (requiresNotionConfig && !session) {
        // If requiresNotionConfig is true but no session, it will be handled by requiresAuth check
        // No need to set needsConfig here, as it's a pre-auth check.
      } else {
        // If requiresNotionConfig is false, ensure needsConfig is false
        setNeedsConfig(false);
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
        onErrorRef.current?.(errorMessage, errorCode); // Call the latest ref version

        if (errorCode === 'PROFILE_NOT_FOUND' || errorCode === 'PRACTITIONER_NAME_MISSING') {
          showError(`Profile Required: ${errorMessage}`);
          navigate('/profile-setup');
        } else if (errorData.error?.includes('Notion configuration not found')) {
          setNeedsConfig(true);
          onNotionConfigNeededRef.current?.(); // Call the latest ref version
        } else {
          showError(`Error: ${errorMessage}`);
        }
        setLoading(false);
        return; // Stop execution here
      }

      const result = await response.json();
      setData(result);
      onSuccessRef.current?.(result); // Call the latest ref version
      console.log(`[useSupabaseEdgeFunction] Successfully fetched data for ${functionName}.`);

    } catch (err: any) {
      console.error(`[useSupabaseEdgeFunction] Caught error in ${functionName}:`, err);
      const errorMessage = err.message || 'An unexpected error occurred.';
      setError(errorMessage);
      onErrorRef.current?.(errorMessage); // Call the latest ref version
      showError(`Error: ${errorMessage}`);
    } finally {
      console.log(`[useSupabaseEdgeFunction] Finally block reached for ${functionName}. Setting loading to false.`);
      setLoading(false);
    }
  }, [functionName, requiresAuth, requiresNotionConfig, navigate, supabaseUrl]);

  return { data, loading, error, needsConfig, execute };
};