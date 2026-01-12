"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Key, Database, Shield, Loader2, Info } from 'lucide-react'; // Added Info import
import { showSuccess, showError } from '@/utils/toast'; // Import sonner toast utilities
import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
import { SetNotionSecretsPayload, SetNotionSecretsResponse, NotionSecrets } from '@/types/api';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Define a new response type for the get-notion-secrets edge function
interface GetNotionSecretsResponse {
  secrets: NotionSecrets;
}

// Define the form schema using Zod
const notionConfigFormSchema = z.object({
  integrationToken: z.string().min(1, { message: "Integration Token is required." }),
  appointmentsDbId: z.string().min(1, { message: "Appointments Database ID is required." }),
  crmDbId: z.string().nullable(),
  modesDbId: z.string().nullable(),
  acupointsDbId: z.string().nullable(),
  musclesDbId: z.string().nullable(),
  channelsDbId: z.string().nullable(), // Added new field
  chakrasDbId: z.string().nullable(),  // Added new field
});

type NotionConfigFormValues = z.infer<typeof notionConfigFormSchema>;

const NotionConfig = () => {
  const navigate = useNavigate();

  const form = useForm<NotionConfigFormValues>({
    resolver: zodResolver(notionConfigFormSchema),
    defaultValues: {
      integrationToken: '',
      appointmentsDbId: '',
      crmDbId: '',
      modesDbId: '',
      acupointsDbId: '',
      musclesDbId: '',
      channelsDbId: '', // Default value for new field
      chakrasDbId: '',  // Default value for new field
    },
  });

  // Memoized callback for successful fetch of Notion secrets
  const handleFetchSuccess = useCallback((data: GetNotionSecretsResponse) => {
    const secrets = data.secrets;
    form.reset({
      integrationToken: secrets.notion_integration_token || '',
      appointmentsDbId: secrets.appointments_database_id || '',
      crmDbId: secrets.crm_database_id || '',
      modesDbId: secrets.modes_database_id || '',
      acupointsDbId: secrets.acupoints_database_id || '',
      musclesDbId: secrets.muscles_database_id || '',
      channelsDbId: secrets.channels_database_id || '', // Set new field
      chakrasDbId: secrets.chakras_database_id || '',  // Set new field
    });
  }, [form]);

  // Memoized callback for error during fetch of Notion secrets
  const handleFetchError = useCallback((msg: string, errorCode?: string) => {
    if (errorCode === 'NOTION_CONFIG_NOT_FOUND') {
      console.log('Notion config not found, starting with empty fields.');
      // This is expected if the user hasn't configured yet, so no toast error
    } else {
      showError(`Error loading configuration: ${msg}`);
    }
  }, []);

  const handleSetSecretsSuccess = useCallback(() => {
    showSuccess('Notion configuration saved securely!');
    navigate('/');
  }, [navigate]);

  const handleSetSecretsError = useCallback((msg: string) => {
    showError(`Save Failed: ${msg}`);
  }, []);

  // Hook for saving Notion secrets
  const {
    loading: savingConfig,
    execute: setNotionSecrets,
  } = useSupabaseEdgeFunction<SetNotionSecretsPayload, SetNotionSecretsResponse>(
    'set-notion-secrets',
    {
      requiresAuth: true,
      onSuccess: handleSetSecretsSuccess,
      onError: handleSetSecretsError,
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

  const onSubmit = async (values: NotionConfigFormValues) => {
    await setNotionSecrets({
      notionToken: values.integrationToken.trim(),
      appointmentsDbId: values.appointmentsDbId.trim(),
      crmDbId: values.crmDbId?.trim() || null,
      modesDbId: values.modesDbId?.trim() || null,
      acupointsDbId: values.acupointsDbId?.trim() || null,
      musclesDbId: values.musclesDbId?.trim() || null,
      channelsDbId: values.channelsDbId?.trim() || null, // Pass new field
      chakrasDbId: values.chakrasDbId?.trim() || null,  // Pass new field
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
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

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Integration Token */}
                    <FormField
                      control={form.control}
                      name="integrationToken"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 font-semibold">
                            <Key className="w-4 h-4 text-indigo-600" />
                            Integration Token <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="token"
                              type="password"
                              placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                              disabled={savingConfig}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-gray-500">
                            Find this in Notion → Settings & Members → Integrations → [Your Integration]
                          </p>
                        </FormItem>
                      )}
                    />

                    {/* Appointments Database ID */}
                    <FormField
                      control={form.control}
                      name="appointmentsDbId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 font-semibold">
                            <Database className="w-4 h-4 text-indigo-600" />
                            Appointments Database ID <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="appointments"
                              type="text"
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                              disabled={savingConfig}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-gray-500">
                            Copy from Notion: Share → Copy link → Extract the 32-character ID from the URL
                          </p>
                        </FormItem>
                      )}
                    />

                    {/* CRM Database ID (Optional) */}
                    <FormField
                      control={form.control}
                      name="crmDbId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 font-semibold">
                            <Database className="w-4 h-4 text-indigo-600" />
                            CRM Database ID (Optional)
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="crm"
                              type="text"
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                              disabled={savingConfig}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-gray-500">
                            Used for client management. Can be added later.
                          </p>
                        </FormItem>
                      )}
                    />

                    {/* Modes & Balances Database ID */}
                    <FormField
                      control={form.control}
                      name="modesDbId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 font-semibold">
                            <Database className="w-4 h-4 text-indigo-600" />
                            Modes & Balances Database ID (Optional)
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="modes"
                              type="text"
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                              disabled={savingConfig}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-gray-500">
                            ID for your Modes & Balances reference database.
                          </p>
                        </FormItem>
                      )}
                    />

                    {/* Acupoints Database ID */}
                    <FormField
                      control={form.control}
                      name="acupointsDbId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 font-semibold">
                            <Database className="w-4 h-4 text-indigo-600" />
                            Acupoints Database ID (Optional)
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="acupoints"
                              type="text"
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                              disabled={savingConfig}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-gray-500">
                            ID for your Acupoints reference database.
                          </p>
                        </FormItem>
                      )}
                    />

                    {/* Muscles Database ID (New Field) */}
                    <FormField
                      control={form.control}
                      name="musclesDbId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 font-semibold">
                            <Database className="w-4 h-4 text-indigo-600" />
                            Muscles Database ID (Optional)
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="muscles"
                              type="text"
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                              disabled={savingConfig}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-gray-500">
                            ID for your Muscles reference database.
                          </p>
                        </FormItem>
                      )}
                    />

                    {/* Channels Database ID (New Field) */}
                    <FormField
                      control={form.control}
                      name="channelsDbId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 font-semibold">
                            <Database className="w-4 h-4 text-indigo-600" />
                            Channels Database ID (Optional)
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="channels"
                              type="text"
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                              disabled={savingConfig}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-gray-500">
                            ID for your Channels reference database.
                          </p>
                        </FormItem>
                      )}
                    />

                    {/* Chakras Database ID (New Field) */}
                    <FormField
                      control={form.control}
                      name="chakrasDbId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 font-semibold">
                            <Database className="w-4 h-4 text-indigo-600" />
                            Chakras Database ID (Optional)
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="chakras"
                              type="text"
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                              disabled={savingConfig}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-gray-500">
                            ID for your Chakras reference database.
                          </p>
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-4 pt-4">
                      <Button
                        type="submit"
                        className="flex-1 h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                        disabled={savingConfig}
                      >
                        {savingConfig ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
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
                </Form>

                {/* Help Section */}
                <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <h3 className="font-semibold text-blue-900 mb-2">Need Help?</h3>
                    <ol className="space-y-1 list-decimal list-inside">
                      <li>Create a Notion integration at notion.com/my-integrations</li>
                      <li>Copy the "Internal Integration Token"</li>
                      <li>Share your databases (Appointments, CRM, Modes, Acupoints, Muscles, Channels, Chakras) with the integration</li>
                      <li>**Important:** For individual Notion pages (like Muscle details, Chakra details, etc.) to be viewable via direct links in the app, you must also share those specific pages with your integration.</li>
                      <li>Copy each database ID from its share link</li>
                      <li>Paste all values above and save</li>
                    </ol>
                  </div>
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