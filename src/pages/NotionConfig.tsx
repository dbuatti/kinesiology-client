"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Key, Database, Shield, Loader2 } from 'lucide-react';

const NotionConfig = () => {
  const [integrationToken, setIntegrationToken] = useState('');
  const [appointmentsDbId, setAppointmentsDbId] = useState('');
  const [crmDbId, setCrmDbId] = useState('');
  const [modesDbId, setModesDbId] = useState('');
  const [acupointsDbId, setAcupointsDbId] = useState(''); // New state for Acupoints DB ID
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchSecrets = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/login');
          return;
        }

        const { data, error } = await supabase
          .from('notion_secrets')
          .select('notion_integration_token, appointments_database_id, crm_database_id, modes_database_id, acupoints_database_id') // Select new column
          .eq('user_id', session.user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          setIntegrationToken(data.notion_integration_token || '');
          setAppointmentsDbId(data.appointments_database_id || '');
          setCrmDbId(data.crm_database_id || '');
          setModesDbId(data.modes_database_id || '');
          setAcupointsDbId(data.acupoints_database_id || ''); // Set new state
        }
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error loading configuration',
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSecrets();
  }, [navigate, toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!integrationToken.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Integration Token cannot be empty.',
      });
      setLoading(false);
      return;
    }
    if (!appointmentsDbId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Appointments Database ID cannot be empty.',
      });
      setLoading(false);
      return;
    }
    if (!modesDbId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Modes & Balances Database ID cannot be empty.',
      });
      setLoading(false);
      return;
    }
    if (!acupointsDbId.trim()) { // New validation for Acupoints DB ID
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Acupoints Database ID cannot be empty.',
      });
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          variant: 'destructive',
          title: 'Not authenticated',
          description: 'Please log in first',
        });
        navigate('/login');
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcriagmovotwuqbppcfm.supabase.co';

      console.log('[NotionConfig] Calling edge function with URL:', `${supabaseUrl}/functions/v1/set-notion-secrets`)

      const response = await fetch(
        `${supabaseUrl}/functions/v1/set-notion-secrets`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            notionToken: integrationToken,
            appointmentsDbId: appointmentsDbId,
            crmDbId: crmDbId || null,
            modesDbId: modesDbId || null,
            acupointsDbId: acupointsDbId || null, // Send new ID
          })
        }
      );

      console.log('[NotionConfig] Response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[NotionConfig] Edge function error:', errorData)
        throw new Error(errorData.error || errorData.details || 'Failed to save secrets');
      }

      const result = await response.json();
      console.log('[NotionConfig] Success:', result)

      toast({
        title: 'Success',
        description: 'Notion configuration saved securely!',
      });

      navigate('/active-session');
    } catch (error: any) {
      console.error('[NotionConfig] Save error:', error)
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'An unknown error occurred',
      });
    } finally {
      setLoading(false);
    }
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
            {loading && (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            )}
            {!loading && (
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
                      Integration Token
                    </Label>
                    <Input
                      id="token"
                      type="password"
                      placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={integrationToken}
                      onChange={(e) => setIntegrationToken(e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-500">
                      Find this in Notion → Settings & Members → Integrations → [Your Integration]
                    </p>
                  </div>

                  {/* Appointments Database ID */}
                  <div className="space-y-2">
                    <Label htmlFor="appointments" className="flex items-center gap-2 font-semibold">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Appointments Database ID
                    </Label>
                    <Input
                      id="appointments"
                      type="text"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={appointmentsDbId}
                      onChange={(e) => setAppointmentsDbId(e.target.value)}
                      disabled={loading}
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
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-500">
                      Used for client management. Can be added later.
                    </p>
                  </div>

                  {/* Modes & Balances Database ID */}
                  <div className="space-y-2">
                    <Label htmlFor="modes" className="flex items-center gap-2 font-semibold">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Modes & Balances Database ID
                    </Label>
                    <Input
                      id="modes"
                      type="text"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={modesDbId}
                      onChange={(e) => setModesDbId(e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-500">
                      ID for your Modes & Balances reference database.
                    </p>
                  </div>

                  {/* Acupoints Database ID (New Field) */}
                  <div className="space-y-2">
                    <Label htmlFor="acupoints" className="flex items-center gap-2 font-semibold">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Acupoints Database ID
                    </Label>
                    <Input
                      id="acupoints"
                      type="text"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={acupointsDbId}
                      onChange={(e) => setAcupointsDbId(e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-500">
                      ID for your Acupoints reference database.
                    </p>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="submit"
                      className="flex-1 h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save to Secrets'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate('/active-session')}
                      disabled={loading}
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
                    <li>Share your databases (Appointments, CRM, Modes, Acupoints) with the integration</li>
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