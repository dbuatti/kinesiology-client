"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Key, Database } from 'lucide-react';

const NotionConfig = () => {
  const [integrationToken, setIntegrationToken] = useState('');
  const [appointmentsDbId, setAppointmentsDbId] = useState('');
  const [crmDbId, setCrmDbId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadExistingConfig();
  }, []);

  const loadExistingConfig = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('notion_config')
        .select('integration_token, appointments_database_id, crm_database_id')
        .eq('user_id', session.user.id)
        .single();

      if (data && !error) {
        setIntegrationToken(data.integration_token || '');
        setAppointmentsDbId(data.appointments_database_id || '');
        setCrmDbId(data.crm_database_id || '');
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const configData = {
        user_id: session.user.id,
        integration_token: integrationToken,
        appointments_database_id: appointmentsDbId,
        crm_database_id: crmDbId || null,
      };

      // Check if config exists
      const { data: existing } = await supabase
        .from('notion_config')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      let error;
      if (existing) {
        // Update existing
        ({ error } = await supabase
          .from('notion_config')
          .update(configData)
          .eq('user_id', session.user.id));
      } else {
        // Insert new
        ({ error } = await supabase
          .from('notion_config')
          .insert([configData]));
      }

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Notion configuration saved successfully!',
      });

      navigate('/active-session');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

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
              Configure your Notion API credentials to sync appointments
            </p>
          </CardHeader>
          
          <CardContent className="pt-6">
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
                  disabled={saving}
                  required
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
                  disabled={saving}
                  required
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
                  disabled={saving}
                />
                <p className="text-xs text-gray-500">
                  Used for client management. Can be added later.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  className="flex-1 h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/active-session')}
                  disabled={saving}
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
                <li>Share your appointments database with the integration</li>
                <li>Copy the database ID from the share link</li>
                <li>Paste both values above and save</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotionConfig;