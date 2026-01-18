"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User, Settings, Loader2, Search, AlertCircle, XCircle, RefreshCw, Database } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { useCachedEdgeFunction } from '@/hooks/use-cached-edge-function';
import { Client, GetAllClientsResponse, UpdateNotionClientPayload, UpdateNotionClientResponse } from '@/types/api';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import { Badge } from '@/components/ui/badge';
import { cacheService } from '@/integrations/supabase/cache';
import { supabase } from '@/integrations/supabase/client';

const AllClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMirrorEmpty, setIsMirrorEmpty] = useState(false);
  const navigate = useNavigate();

  const handleFetchAllClientsSuccess = useCallback((data: GetAllClientsResponse) => {
    setClients(data.clients);
    setFilteredClients(data.clients);
    setIsMirrorEmpty(false);
  }, []);

  const handleFetchAllClientsError = useCallback((msg: string, errorCode?: string) => {
    if (errorCode === 'CLIENTS_MIRROR_EMPTY') {
        setIsMirrorEmpty(true);
        setClients([]);
        setFilteredClients([]);
        // Do not show error toast here, the UI handles the empty state
    } else if (errorCode === 'NOTION_CONFIG_NOT_FOUND') {
        // Handled by needsConfig check below
    } else {
        showError(msg);
    }
  }, []);

  const handleUpdateNotionClientSuccess = useCallback(() => {
    showSuccess('Client updated in Notion.');
  }, []);

  const handleUpdateNotionClientError = useCallback((msg: string) => {
    showError(`Update Failed: ${msg}`);
    fetchAllClients(); // Re-fetch to ensure data consistency if optimistic update failed
  }, []);

  // 1. Fetch Clients (from clients_mirror table)
  const {
    data: fetchedClientsData,
    loading: loadingClients,
    error: clientsError,
    needsConfig,
    execute: fetchAllClients,
    isCached: clientsIsCached,
    invalidateCache: invalidateClientsCache,
  } = useCachedEdgeFunction<void, GetAllClientsResponse>(
    'fetch-all-clients', // Renamed function endpoint
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      cacheKey: 'all-clients',
      cacheTtl: 60, // 1 hour cache
      onSuccess: handleFetchAllClientsSuccess,
      onError: handleFetchAllClientsError,
    }
  );

  // 2. Sync Clients (Notion -> clients_mirror table)
  const {
    loading: syncingClients,
    execute: syncClients,
  } = useCachedEdgeFunction<{ syncType: 'clients' }, any>(
    'sync-notion-data',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      onSuccess: async (data) => {
        showSuccess(`Successfully imported ${data.results.clients_mirror_count} clients from Notion.`);
        // Invalidate the 'all-clients' cache key to force a fresh fetch from the mirror table
        await invalidateClientsCache();
        fetchAllClients();
      },
      onError: (msg) => {
        showError(`Client Sync Failed: ${msg}`);
      }
    }
  );

  // 3. Update Client (Notion API)
  const {
    loading: updatingClient,
    execute: updateNotionClient,
  } = useCachedEdgeFunction<UpdateNotionClientPayload, UpdateNotionClientResponse>(
    'update-notion-client',
    {
      requiresAuth: true,
      onSuccess: handleUpdateNotionClientSuccess,
      onError: handleUpdateNotionClientError,
    }
  );

  useEffect(() => {
    fetchAllClients();
  }, [fetchAllClients]);

  // Auto-sync if mirror is empty and not currently loading/syncing
  useEffect(() => {
    if (isMirrorEmpty && !loadingClients && !syncingClients && !needsConfig) {
        console.log('[AllClients] Mirror is empty, triggering automatic client sync.');
        syncClients({ syncType: 'clients' });
    }
  }, [isMirrorEmpty, loadingClients, syncingClients, needsConfig, syncClients]);


  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = clients.filter(client =>
      client.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      client.focus.toLowerCase().includes(lowerCaseSearchTerm) ||
      client.email.toLowerCase().includes(lowerCaseSearchTerm) ||
      client.phone.toLowerCase().includes(lowerCaseSearchTerm) ||
      client.starSign.toLowerCase().includes(lowerCaseSearchTerm)
    );
    setFilteredClients(filtered);
  }, [searchTerm, clients]);

  const handleLocalFieldChange = (id: string, field: keyof Client, value: any) => {
    // Update local state immediately for responsive UI
    setClients(prev => prev.map(client =>
      client.id === id ? { ...client, [field]: value } : client
    ));
  };

  const handleFieldBlur = (id: string, field: keyof Client, value: any) => {
    // Trigger API update only on blur
    updateNotionClient({ clientId: id, updates: { [field]: value } });
  };

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setFilteredClients(clients); // Reset to all clients
  }, [clients]);

  const handleManualSync = () => {
    syncClients({ syncType: 'clients' });
  };

  if (loadingClients && !clientsIsCached && !isMirrorEmpty) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (needsConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-8 text-center">
            <div className="mx-auto mb-4 p-4 bg-indigo-100 rounded-full w-20 h-20 flex items-center justify-center">
              <Settings className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-indigo-900 mb-2">
              Notion Integration Required
            </h2>
            <p className="text-gray-600 mb-6">
              Connect your Notion account to view and manage all clients.
            </p>
            <Button
              className="w-full h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              onClick={() => navigate('/notion-config')}
            >
              Configure Notion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (clientsError && !isMirrorEmpty) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 mb-4">
              <AlertCircle className="w-12 h-12 mx-auto" />
            </div>
            <h2 className="xl font-bold mb-2">Error Loading Clients</h2>
            <p className="text-gray-600 mb-4">{clientsError}</p>
            <div className="space-y-2">
              <Button onClick={() => fetchAllClients()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="mx-auto w-full">
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg p-4">
            <CardTitle className="text-3xl font-bold flex items-center gap-3">
              <User className="w-7 h-7" />
              All Clients
            </CardTitle>
            <p className="text-indigo-100 mt-1">Manage all your client records with two-way Notion sync.</p>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="mb-6 flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search clients by name, focus, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 py-2 border rounded-md w-full"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                    onClick={handleClearSearch}
                    disabled={loadingClients || syncingClients}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button onClick={() => fetchAllClients()} variant="outline" disabled={loadingClients || syncingClients}>
                {loadingClients ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {loadingClients ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>

            <div className="flex justify-center mb-4">
              <SyncStatusIndicator onSyncComplete={() => {
                // Refresh data after sync
                fetchAllClients();
              }} />
            </div>

            {isMirrorEmpty || filteredClients.length === 0 ? (
              <div className="text-center py-10 text-gray-600">
                <Database className="w-12 h-12 mx-auto mb-4 text-indigo-400" />
                <h3 className="text-xl font-semibold mb-2">Client Database Empty</h3>
                <p className="mb-4">
                  {isMirrorEmpty ? "Your local client mirror is empty. Sync your Notion CRM database now to import clients. If the sync fails, ensure your Notion CRM Database ID is correct and shared with the integration." : "No clients found matching your search."}
                </p>
                {isMirrorEmpty && (
                    <div className="space-y-3 max-w-sm mx-auto">
                        <Button
                            onClick={handleManualSync}
                            disabled={syncingClients}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                            {syncingClients ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                            {syncingClients ? 'Syncing Clients...' : 'Sync Clients from Notion'}
                        </Button>
                        <Button
                            onClick={() => navigate('/notion-config')}
                            variant="outline"
                            disabled={syncingClients}
                            className="w-full text-indigo-600 hover:bg-indigo-50"
                        >
                            <Settings className="h-4 w-4 mr-2" />
                            Check Notion Configuration
                        </Button>
                    </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Name</TableHead>
                      <TableHead className="min-w-[200px]">Focus</TableHead>
                      <TableHead className="min-w-[180px]">Email</TableHead>
                      <TableHead className="min-w-[150px]">Phone</TableHead>
                      <TableHead className="min-w-[120px]">Star Sign</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          {client.name}
                          {clientsIsCached && (
                            <Badge variant="secondary" className="bg-green-200 text-green-800 ml-2">
                              Cached
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={client.focus}
                            onChange={(e) => handleLocalFieldChange(client.id, 'focus', e.target.value)}
                            onBlur={(e) => handleFieldBlur(client.id, 'focus', e.target.value)}
                            className="min-h-[60px] w-full"
                            disabled={updatingClient}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="email"
                            value={client.email}
                            onChange={(e) => handleLocalFieldChange(client.id, 'email', e.target.value)}
                            onBlur={(e) => handleFieldBlur(client.id, 'email', e.target.value)}
                            className="w-full"
                            disabled={updatingClient}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="tel"
                            value={client.phone}
                            onChange={(e) => handleLocalFieldChange(client.id, 'phone', e.target.value)}
                            onBlur={(e) => handleFieldBlur(client.id, 'phone', e.target.value)}
                            className="w-full"
                            disabled={updatingClient}
                          />
                        </TableCell>
                        <TableCell>{client.starSign}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AllClients;