"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown, Calendar, User, Settings, Loader2, Search, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Appointment {
  id: string;
  clientName: string;
  clientCrmId: string | null;
  starSign: string;
  clientFocus: string; // General client focus from CRM
  sessionNorthStar: string; // Specific session focus from appointment
  clientEmail: string;
  clientPhone: string;
  date: string | null;
  goal: string;
  priorityPattern: string | null;
  status: string;
  notes: string;
  sessionAnchor: string;
}

const statusOptions = ['OPEN', 'AP', 'CH', 'CXL']; // Assuming these are your Notion Status options
const priorityPatternOptions = ['Pattern A', 'Pattern B', 'Pattern C', 'Pattern D']; // Example options, adjust as needed

const AllAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsConfig, setNeedsConfig] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcriagmovotwuqbppcfm.supabase.co';

  const fetchAllAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setNeedsConfig(false);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Please log in to view appointments');
        navigate('/login');
        return;
      }

      const { data: secrets, error: secretsError } = await supabase
        .from('notion_secrets')
        .select('*') // Changed from 'id' to '*'
        .eq('user_id', session.user.id)
        .single();

      if (secretsError || !secrets) {
        setNeedsConfig(true);
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-all-appointments`,
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
        throw new Error(errorData.error || 'Failed to fetch all appointments');
      }

      const data = await response.json();
      setAppointments(data.appointments);
      setFilteredAppointments(data.appointments);
    } catch (err: any) {
      console.error('Error fetching all appointments:', err);
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
    fetchAllAppointments();
  }, [fetchAllAppointments]);

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = appointments.filter(app =>
      app.clientName.toLowerCase().includes(lowerCaseSearchTerm) ||
      app.goal.toLowerCase().includes(lowerCaseSearchTerm) ||
      app.notes.toLowerCase().includes(lowerCaseSearchTerm) ||
      app.status.toLowerCase().includes(lowerCaseSearchTerm) ||
      app.sessionNorthStar.toLowerCase().includes(lowerCaseSearchTerm) || // Search new field
      (app.priorityPattern && app.priorityPattern.toLowerCase().includes(lowerCaseSearchTerm))
    );
    setFilteredAppointments(filtered);
  }, [searchTerm, appointments]);

  const updateNotionAppointment = useCallback(async (appointmentId: string, updates: Partial<Appointment>) => {
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
        `${supabaseUrl}/functions/v1/update-notion-appointment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            appointmentId: appointmentId,
            updates: updates
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update appointment in Notion');
      }

      toast({
        title: 'Success',
        description: 'Appointment updated in Notion.',
      });

      // Optimistically update local state
      setAppointments(prev => prev.map(app =>
        app.id === appointmentId ? { ...app, ...updates } : app
      ));

    } catch (err: any) {
      console.error('Error updating Notion appointment:', err);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: err.message
      });
      // Re-fetch to ensure data consistency if optimistic update failed
      fetchAllAppointments();
    }
  }, [navigate, toast, supabaseUrl, fetchAllAppointments]);

  const handleFieldChange = (id: string, field: keyof Appointment, value: any) => {
    // Update local state immediately for responsive UI
    setAppointments(prev => prev.map(app =>
      app.id === id ? { ...app, [field]: value } : app
    ));
    // Debounce or save on blur for performance, for now, saving immediately
    updateNotionAppointment(id, { [field]: value });
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
              Connect your Notion account to view and manage all appointments.
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
            <h2 className="xl font-bold mb-2">Error Loading Appointments</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={fetchAllAppointments}>Try Again</Button>
              {/* Removed redundant 'Check Configuration' button */}
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
              <Calendar className="w-7 h-7" />
              All Appointments
            </CardTitle>
            <p className="text-indigo-100 mt-1">Manage all your client appointments with two-way Notion sync.</p>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="mb-6 flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search appointments by client, goal, notes, or status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-md w-full"
                />
              </div>
              <Button onClick={fetchAllAppointments} variant="outline">
                Refresh
              </Button>
            </div>

            {filteredAppointments.length === 0 && searchTerm !== '' ? (
              <div className="text-center py-10 text-gray-600">
                No appointments found matching your search.
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="text-center py-10 text-gray-600">
                No appointments available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Client Name</TableHead>
                      <TableHead className="min-w-[120px]">Date</TableHead>
                      <TableHead className="min-w-[200px]">Goal</TableHead>
                      <TableHead className="min-w-[200px]">Session North Star</TableHead> {/* New column */}
                      <TableHead className="min-w-[150px]">Priority Pattern</TableHead>
                      <TableHead className="min-w-[120px]">Status</TableHead>
                      <TableHead className="min-w-[250px]">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium">{app.clientName}</TableCell>
                        <TableCell>{app.date ? format(new Date(app.date), 'PPP') : 'N/A'}</TableCell>
                        <TableCell>
                          <Textarea
                            value={app.goal}
                            onChange={(e) => handleFieldChange(app.id, 'goal', e.target.value)}
                            onBlur={(e) => updateNotionAppointment(app.id, { goal: e.target.value })}
                            className="min-h-[60px] w-full"
                          />
                        </TableCell>
                        <TableCell> {/* New cell for Session North Star */}
                          <Textarea
                            value={app.sessionNorthStar}
                            onChange={(e) => handleFieldChange(app.id, 'sessionNorthStar', e.target.value)}
                            onBlur={(e) => updateNotionAppointment(app.id, { sessionNorthStar: e.target.value })}
                            className="min-h-[60px] w-full"
                          />
                        </TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                              >
                                {app.priorityPattern || "Select Pattern"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0">
                              <Command>
                                <CommandInput placeholder="Search pattern..." />
                                <CommandEmpty>No pattern found.</CommandEmpty>
                                <CommandGroup>
                                  {priorityPatternOptions.map((pattern) => (
                                    <CommandItem
                                      key={pattern}
                                      value={pattern}
                                      onSelect={() => handleFieldChange(app.id, 'priorityPattern', pattern)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          app.priorityPattern === pattern ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {pattern}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                              >
                                {app.status || "Select Status"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[150px] p-0">
                              <Command>
                                <CommandInput placeholder="Search status..." />
                                <CommandEmpty>No status found.</CommandEmpty>
                                <CommandGroup>
                                  {statusOptions.map((status) => (
                                    <CommandItem
                                      key={status}
                                      value={status}
                                      onSelect={() => handleFieldChange(app.id, 'status', status)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          app.status === status ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {status}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={app.notes}
                            onChange={(e) => handleFieldChange(app.id, 'notes', e.target.value)}
                            onBlur={(e) => updateNotionAppointment(app.id, { notes: e.target.value })}
                            className="min-h-[60px] w-full"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Removed redundant navigation buttons */}
      </div>
    </div>
  );
};

export default AllAppointments;