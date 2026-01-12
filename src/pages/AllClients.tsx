"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User, Settings, Loader2, Search, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Client {
  id: string;
  name: string;
  focus: string;
  email: string;
  phone: string;
  starSign: string;
}

const AllClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsConfig, setNeedsConfig] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcriagmovotwuqbppcfm.supabase.co';

  const fetchAllClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setNeedsConfig(false);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Please log in to view clients');
        navigate('/login');
        return;
      }

      const { data: secrets, error: secretsError } = await supabase
        .from('notion_secrets')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (secretsError || !secrets) {
        setNeedsConfig(true);
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-all-clients`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch all clients');
      }

      const data = await response.json();
      setClients(data.clients);
      setFilteredClients(data.clients);
    } catch (err: any) {
      console.error('Error fetching all clients:', err);
      setError(err.message);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message
      });
    } finally {
      setLoading(false);
    }
  }, [navigate, toast, supabaseUrl]);

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

  const updateNotionClient = useCallback(async (clientId: string, updates: Partial<Client>) => {
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

      const response = await fetch(
        `${supabaseUrl}/functions/v1/update-notion-client`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            clientId: clientId,
            updates: updates
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update client in Notion');
      }

      toast({
        title: 'Success',
        description: 'Client updated in Notion.',
      });

      // Optimistically update local state
      setClients(prev => prev.map(client =>
        client.id === clientId ? { ...client, ...updates } : client
      ));

    } catch (err: any) {
      console.error('Error updating Notion client:', err);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: err.message
      });
      // Re-fetch to ensure data consistency if optimistic update failed
      fetchAllClients();
    }
  }, [navigate, toast, supabaseUrl, fetchAllClients]);

  const handleFieldChange = (id: string, field: keyof Client, value: any) => {
    // Update local state immediately for responsive UI
    setClients(prev => prev.map(client =>
      client.id === id ? { ...client, [field]: value } : client
    ));
    // Debounce or save on blur for performance, for now, saving immediately
    updateNotionClient(id, { [field]: value });
  };

  if (loading) {
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

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 mb-4">
              <AlertCircle className="w-12 h-12 mx-auto" />
            </div>
            <h2 className="text-xl font-bold mb-2">Error Loading Clients</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={fetchAllClients}>Try Again</Button>
              <Button variant="outline" onClick={() => navigate('/notion-config')}>
                Check Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
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
                  className="pl-10 pr-4 py-2 border rounded-md w-full"
                />
              </div>
              <Button onClick={fetchAllClients} variant="outline">
                Refresh
              </Button>
            </div>

            {filteredClients.length === 0 && searchTerm !== '' ? (
              <div className="text-center py-10 text-gray-600">
                No clients found matching your search.
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-10 text-gray-600">
                No clients available.
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
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>
                          <Textarea
                            value={client.focus}
                            onChange={(e) => handleFieldChange(client.id, 'focus', e.target.value)}
                            onBlur={(e) => updateNotionClient(client.id, { focus: e.target.value })}
                            className="min-h-[60px] w-full"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="email"
                            value={client.email}
                            onChange={(e) => handleFieldChange(client.id, 'email', e.target.value)}
                            onBlur={(e) => updateNotionClient(client.id, { email: e.target.value })}
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="tel"
                            value={client.phone}
                            onChange={(e) => handleFieldChange(client.id, 'phone', e.target.value)}
                            onBlur={(e) => updateNotionClient(client.id, { phone: e.target.value })}
                            className="w-full"
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

        <div className="mt-6 flex gap-2 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="text-indigo-600 hover:text-indigo-800"
          >
            ← Back to Home
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/notion-config')}
            className="text-indigo-600 hover:text-indigo-800"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configure Notion
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AllClients;