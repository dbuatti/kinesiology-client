"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Key, Database, Shield, Loader2 } from 'lucide-react';
import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
import { SetNotionSecretsPayload, SetNotionSecretsResponse, NotionSecrets } from '@/types/api';

// Define a new response type for the get-notion-secrets edge function
interface GetNotionSecretsResponse {
  secrets: NotionSecrets;
}

const NotionConfig = () => {
  const [integrationToken, setIntegrationToken] = useState('');
  const [appointmentsDbId, setAppointmentsDbId] = useState('');
  const [crmDbId, setCrmDbId] = useState('');
  const [modesDbId, setModesDbId] = useState('');
  const [acupointsDbId, setAcupointsDbId] = useState('');
  const [musclesDbId, setMusculesDbId] = useState('');
  const [channelsDbId, setChannelsDbId] = useState('');
  const [chakrasDbId, setChakrasDbId] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  // Memoized callback for successful fetch of Notion secrets
  const handleFetchSuccess = useCallback((data: GetNotionSecretsResponse) => {
    const secrets = data.secrets;
    setIntegrationToken(secrets.notion_integration_token || '');
    setAppointmentsDbId(secrets.appointments_database_id || '');
    setCrmDbId(secrets.crm_database_id || '');
    setModesDbId(secrets.modes_database_id || '');
    setAcupointsDbId(secrets.acupoints_database_id || '');
    setMusculesDbId(secrets.muscles_database_id || '');
    setChannelsDbId(secrets.channels_database_id || '');
    setChakrasDbId(secrets.chakras_database_id || '');
  }, []);

  // Memoized callback for error during fetch of Notion secrets
  const handleFetchError = useCallback((msg: string, errorCode?: string) => {
    if (errorCode === 'NOTION_CONFIG_NOT_FOUND') {
      console.log('Notion config not found, starting with empty fields.');
      // This is expected if the user hasn't configured yet, so no toast error
    } else {
      toast({ variant: 'destructive', title: 'Error loading configuration', description: msg });
    }
  }, [toast]);

  // Hook for saving Notion secrets
  const {
    loading: savingConfig,
    execute: setNotionSecrets,
  } = useSupabaseEdgeFunction<SetNotionSecretsPayload, SetNotionSecretsResponse>(
    'set-notion-secrets',
    {
      requiresAuth: true,
      onSuccess: () => {
        toast({ title: 'Success', description: 'Notion configuration saved securely!' });
        navigate('/');
      },
      onError: (msg) => {
        toast({ variant: 'destructive', title: 'Save Failed', description: msg });
      }
    }
  );

  // Hook for fetching Notion secrets
  const {
    loading: loadingInitialFetch,
    error: fetchError,
    execute: fetchNotionSecrets,
  } = useSupabaseEdgeFunction<void, GetNotionSecretsResponse>(
    'get-notion-secrets',
    {
      requiresAuth: true,
      onSuccess: handleFetchSuccess, // Use the memoized callback
      onError: handleFetchError,     // Use the memoized callback
    }
  );

  useEffect(() => {
    fetchNotionSecrets();
  }, [fetchNotionSecrets]); // fetchNotionSecrets is now stable due to useCallback dependencies

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!integrationToken.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Integration Token cannot be empty.' });
      return;
    }
    if (!appointmentsDbId.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Appointments Database ID cannot be empty.' });
      return;
    }

    await setNotionSecrets({
      notionToken: integrationToken,
      appointmentsDbId: appointmentsDbId,
      crmDbId: crmDbId.trim() || null,
      modesDbId: modesDbId.trim() || null,
      acupointsDbId: acupointsDbId.trim() || null,
      musclesDbId: musclesDbId.trim() || null,
      channelsDbId: channelsDbId.trim() || null,
      chakrasDbId: chakrasDbId.trim() || null,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
            <div className="flex items-center gap-2">
              <Settings className="w-6 h-6" />
              <CardTitle className="text-2xl font-bold">
                Notion Integration Setup
              </CardTitle>
            </div>
            <p className="text-indigo-100 mt-2 text-sm">
              Configure your Notion API credentials (stored securely in Supabase)
            </p>
          </CardHeader>
          
          <CardContent className="pt-6">
            {loadingInitialFetch ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : (
              <>
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-green-800">
                    <strong>Secure Storage:</strong> Your credentials are stored as encrypted secrets in Supabase, not in the database. This is much more secure.
                  </div>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                  {/* Integration Token */}
                  <div className="space-y-2">
                    <Label htmlFor="token" className="flex items-center gap-2 font-semibold">
                      <Key className="w-4 h-4 text-indigo-600" />
                      Integration Token <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="token"
                      type="password"
                      placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={integrationToken}
                      onChange={(e) => setIntegrationToken(e.target.value)}
                      disabled={savingConfig}
                    />
                    <p className="text-xs text-gray-500">
                      Find this in Notion → Settings & Members → Integrations → [Your Integration]
                    </p>
                  </div>

                  {/* Appointments Database ID */}
                  <div className="space-y-2">
                    <Label htmlFor="appointments" className="flex items-center gap-2 font-semibold">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Appointments Database ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="appointments"
                      type="text"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={appointmentsDbId}
                      onChange={(e) => setAppointmentsDbId(e.target.value)}
                      disabled={savingConfig}
                    />
                    <p className="text-xs text-gray-500">
                      Copy from Notion: Share → Copy link → Extract the 32-character ID from the URL
                    </p>
                  </div>

                  {/* CRM Database ID (Optional) */}
                  <div className="space-y-2">
                    <Label htmlFor="crm" className="flex items-center gap-2 font-semibold">
                      <Database className="w-4 h-4 text-indigo-600" />
                      CRM Database ID (Optional)
                    </Label>
                    <Input
                      id="crm"
                      type="text"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={crmDbId}
                      onChange={(e) => setCrmDbId(e.target.value)}
                      disabled={savingConfig}
                    />
                    <p className="text-xs text-gray-500">
                      Used for client management and fetching client details like **Star Sign**. Can be added later.
                    </p>
                  </div>

                  {/* Modes & Balances Database ID */}
                  <div className="space-y-2">
                    <Label htmlFor="modes" className="flex items-center gap-2 font-semibold">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Modes & Balances Database ID (Optional)
                    </Label>
                    <Input
                      id="modes"
                      type="text"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={modesDbId}
                      onChange={(e) => setModesDbId(e.target.value)}
                      disabled={savingConfig}
                    />
                    <p className="text-xs text-gray-500">
                      ID for your Modes & Balances reference database.
                    </p>
                  </div>

                  {/* Acupoints Database ID */}
                  <div className="space-y-2">
                    <Label htmlFor="acupoints" className="flex items-center gap-2 font-semibold">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Acupoints Database ID (Optional)
                    </Label>
                    <Input
                      id="acupoints"
                      type="text"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={acupointsDbId}
                      onChange={(e) => setAcupointsDbId(e.target.value)}
                      disabled={savingConfig}
                    />
                    <p className="text-xs text-gray-500">
                      ID for your Acupoints reference database.
                    </p>
                  </div>

                  {/* Muscles Database ID */}
                  <div className="space-y-2">
                    <Label htmlFor="muscles" className="flex items-center gap-2 font-semibold">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Muscles Database ID (Optional)
                    </Label>
                    <Input
                      id="muscles"
                      type="text"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={musclesDbId}
                      onChange={(e) => setMusculesDbId(e.target.value)}
                      disabled={savingConfig}
                    />
                    <p className="text-xs text-gray-500">
                      ID for your Muscles reference database.
                    </p>
                  </div>

                  {/* Channels Database ID */}
                  <div className="space-y-2">
                    <Label htmlFor="channels" className="flex items-center gap-2 font-semibold">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Channels Database ID (Optional)
                    </Label>
                    <Input
                      id="channels"
                      type="text"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={channelsDbId}
                      onChange={(e) => setChannelsDbId(e.target.value)}
                      disabled={savingConfig}
                    />
                    <p className="text-xs text-gray-500">
                      ID for your Channels reference database.
                    </p>
                  </div>

                  {/* Chakras Database ID (New Field) */}
                  <div className="space-y-2">
                    <Label htmlFor="chakras" className="flex items-center gap-2 font-semibold">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Chakras Database ID (Optional)
                    </Label>
                    <Input
                      id="chakras"
                      type="text"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={chakrasDbId}
                      onChange={(e) => setChakrasDbId(e.target.value)}
                      disabled={savingConfig}
                    />
                    <p className="text-xs text-gray-500">
                      ID for your Chakras reference database.
                    </p>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="submit"
                      className="flex-1 h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                      disabled={savingConfig}
                    >
                      {savingConfig ? 'Saving...' : 'Save to Secrets'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate('/')}
                      disabled={savingConfig}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>

                {/* Help Section */}
                <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-2">Need Help?</h3>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Create a Notion integration at notion.com/my-integrations</li>
                    <li>Copy the "Internal Integration Token"</li>
                    <li>Share your databases (Appointments, CRM, Modes, Acupoints, Muscles, Channels, Chakras) with the integration</li>
                    <li>Copy each database ID from its share link</li>
                    <li>Paste all values above and save</li>
                  </ol>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotionConfig;