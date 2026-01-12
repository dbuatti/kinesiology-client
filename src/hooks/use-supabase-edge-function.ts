"use client";

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { NotionSecrets } from '@/types/api';

interface UseSupabaseEdgeFunctionOptions {
  requiresAuth?: boolean;
  requiresNotionConfig?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string, errorCode?: string) => void;
  onNotionConfigNeeded?: () => void;
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
  const { toast } = useToast();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcriagmovotwuqbppcfm.supabase.co';

  const execute = useCallback(async (payload?: TRequest) => {
    setLoading(true);
    setError(null);
    setNeedsConfig(false);
    setData(null);

    try {
      let session = null;
      if (requiresAuth) {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!currentSession) {
          toast({ variant: 'destructive', title: 'Authentication Required', description: 'Please log in to continue.' });
          navigate('/login');
          return;
        }
        session = currentSession;
      }

      if (requiresNotionConfig && session) {
        const { data: secrets, error: secretsError } = await supabase
          .from('notion_secrets')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (secretsError && secretsError.code !== 'PGRST116') { // PGRST116 means "no rows found"
          throw secretsError;
        }
        if (!secrets || !(secrets as NotionSecrets).notion_integration_token) { // Check for a core secret
          setNeedsConfig(true);
          onNotionConfigNeeded?.();
          setLoading(false);
          return;
        }
      }

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

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || errorData.details || `Failed to execute ${functionName}`;
        const errorCode = errorData.errorCode;

        setError(errorMessage);
        onError?.(errorMessage, errorCode);

        if (errorCode === 'PROFILE_NOT_FOUND' || errorCode === 'PRACTITIONER_NAME_MISSING') {
          toast({ variant: 'destructive', title: 'Profile Required', description: errorMessage });
          navigate('/profile-setup');
        } else if (errorData.error?.includes('Notion configuration not found')) {
          setNeedsConfig(true);
          onNotionConfigNeeded?.();
        } else {
          toast({ variant: 'destructive', title: 'Error', description: errorMessage });
        }
        return;
      }

      const result = await response.json();
      setData(result);
      onSuccess?.(result);

    } catch (err: any) {
      console.error(`Error in useSupabaseEdgeFunction (${functionName}):`, err);
      const errorMessage = err.message || 'An unexpected error occurred.';
      setError(errorMessage);
      onError?.(errorMessage);
      toast({ variant: 'destructive', title: 'Error', description: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [functionName, requiresAuth, requiresNotionConfig, onSuccess, onError, onNotionConfigNeeded, navigate, toast, supabaseUrl]);

  return { data, loading, error, needsConfig, execute };
};