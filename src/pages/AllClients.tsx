"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User, Settings, Loader2, Search, AlertCircle, XCircle, RefreshCw, Database, PlusCircle } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { useCachedEdgeFunction } from '@/hooks/use-cached-edge-function';
import { Client, GetAllClientsResponse, UpdateNotionClientPayload, UpdateNotionClientResponse } from '@/types/api';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

// Form schema for creating a new client
const clientFormSchema = z.object({
  name: z.string().min(1, { message: "Client name is required." }),
  focus: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal("")),
  phone: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

const AllClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTableEmpty, setIsTableEmpty] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const navigate = useNavigate();

  const handleFetchAllClientsSuccess = useCallback((data: GetAllClientsResponse, isCached: boolean) => {
    if ((data as any).errorCode === 'CLIENTS_TABLE_EMPTY') {
      setIsTableEmpty(true);
      setClients([]);
      setFilteredClients([]);
    } else {
      setClients(data.clients);
      setFilteredClients(data.clients);
      setIsTableEmpty(false);
    }
  }, []);

  const handleFetchAllClientsError = useCallback((msg: string, errorCode?: string) => {
    if (errorCode === 'CLIENTS_TABLE_EMPTY') {
      setIsTableEmpty(true);
      setClients([]);
      setFilteredClients([]);
    } else if (errorCode === 'NOTION_CONFIG_NOT_FOUND') {
      // Handled by needsConfig check below
    } else {
      showError(msg);
    }
  }, []);

  const handleUpdateClientSuccess = useCallback(() => {
    showSuccess('Client updated successfully.');
  }, []);

  const handleUpdateClientError = useCallback((msg: string) => {
    showError(`Update Failed: ${msg}`);
    fetchAllClients(); // Re-fetch to ensure data consistency if optimistic update failed
  }, [fetchAllClients]);

  // 1. Fetch Clients (from clients table)
  const {
    data: fetchedClientsData,
    loading: loadingClients,
    error: clientsError,
    needsConfig,
    execute: fetchAllClients,
    isCached: clientsIsCached,
    invalidateCache: invalidateClientsCache,
  } = useCachedEdgeFunction<void, GetAllClientsResponse>(
    'get-clients-list',
    {
      requiresAuth: true,
      requiresNotionConfig: false, // Clients are now local, no Notion config needed
      cacheKey: 'all-clients',
      cacheTtl: 60, // 1 hour cache
      onSuccess: handleFetchAllClientsSuccess,
      onError: handleFetchAllClientsError,
    }
  );

  // 2. Update Client (Supabase clients table)
  const {
    loading: updatingClient,
    execute: updateClient,
  } = useCachedEdgeFunction<UpdateNotionClientPayload, UpdateNotionClientResponse>(
    'update-client',
    {
      requiresAuth: true,
      onSuccess: handleUpdateClientSuccess,
      onError: handleUpdateClientError,
    }
  );

  // 3. Create Client (Supabase clients table)
  const {
    loading: creatingClient,
    execute: createClient,
  } = useCachedEdgeFunction<ClientFormValues, { success: boolean; newClientId: string }>(
    'create-client',
    {
      requiresAuth: true,
      onSuccess: (data) => {
        showSuccess('Client created successfully!');
        setIsCreateDialogOpen(false);
        // Invalidate cache to refresh the list
        invalidateClientsCache();
        fetchAllClients();
      },
      onError: (msg) => {
        showError(`Creation Failed: ${msg}`);
      }
    }
  );

  useEffect(() => {
    fetchAllClients();
  }, [fetchAllClients]);

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
    updateClient({ clientId: id, updates: { [field]: value } });
  };

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setFilteredClients(clients); // Reset to all clients
  }, [clients]);

  // Form for creating a new client
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: '',
      focus: '',
      email: '',
      phone: '',
    },
  });

  const onSubmitCreateClient = async (values: ClientFormValues) => {
    await createClient(values);
  };

  if (loadingClients && !clientsIsCached && !isTableEmpty) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (clientsError && !isTableEmpty) {
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
            <p className="text-indigo-100 mt-1">Manage all your client records directly in the app.</p>
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
                    disabled={loadingClients || updatingClient}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button onClick={() => fetchAllClients()} variant="outline" disabled={loadingClients || updatingClient}>
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

            {isTableEmpty || filteredClients.length === 0 ? (
              <div className="text-center py-10 text-gray-600">
                <Database className="w-12 h-12 mx-auto mb-4 text-indigo-400" />
                <h3 className="text-xl font-semibold mb-2">Client Database Empty</h3>
                <p className="mb-4">
                  {isTableEmpty ? "Your local client database is empty. You can create new clients via the 'Create New Appointment' dialog or manually add them here." : "No clients found matching your search."}
                </p>
                {isTableEmpty && (
                    <div className="space-y-3 max-w-sm mx-auto">
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                          <DialogTrigger asChild>
                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                              <PlusCircle className="h-4 w-4 mr-2" />
                              Create First Client
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Create New Client</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                              <form onSubmit={form.handleSubmit(onSubmitCreateClient)} className="space-y-4 py-4">
                                <FormField
                                  control={form.control}
                                  name="name"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Name <span className="text-red-500">*</span></FormLabel>
                                      <FormControl>
                                        <Input placeholder="Client Name" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="focus"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Focus</FormLabel>
                                      <FormControl>
                                        <Textarea placeholder="Client focus or main issue" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="email"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Email</FormLabel>
                                      <FormControl>
                                        <Input type="email" placeholder="client@example.com" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="phone"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Phone</FormLabel>
                                      <FormControl>
                                        <Input type="tel" placeholder="+1 (555) 123-4567" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <Button type="submit" className="w-full" disabled={creatingClient}>
                                  {creatingClient ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                                  {creatingClient ? 'Creating...' : 'Create Client'}
                                </Button>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
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