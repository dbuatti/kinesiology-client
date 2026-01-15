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
import { Check, ChevronsUpDown, Calendar, User, Settings, Loader2, Search, AlertCircle, XCircle, PlayCircle } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useCachedEdgeFunction } from '@/hooks/use-cached-edge-function';
import { Appointment, GetAllAppointmentsResponse, UpdateNotionAppointmentPayload, UpdateNotionAppointmentResponse } from '@/types/api';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import { Badge } from '@/components/ui/badge';

const statusOptions = ['OPEN', 'AP', 'CH', 'CXL'];
const priorityPatternOptions = ['Pattern A', 'Pattern B', 'Pattern C', 'Pattern D'];

const AllAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const handleFetchAllAppointmentsSuccess = useCallback((data: GetAllAppointmentsResponse) => {
    setAppointments(data.appointments);
    setFilteredAppointments(data.appointments);
  }, []);

  const handleFetchAllAppointmentsError = useCallback((msg: string) => {
    showError(msg);
  }, []);

  const handleUpdateNotionAppointmentSuccess = useCallback(() => {
    showSuccess('Appointment updated in Notion.');
  }, []);

  const handleUpdateNotionAppointmentError = useCallback((msg: string) => {
    showError(`Update Failed: ${msg}`);
    fetchAllAppointments(); // Re-fetch to ensure data consistency if optimistic update failed
  }, []); // Dependency on fetchAllAppointments

  const {
    data: fetchedAppointmentsData,
    loading: loadingAppointments,
    error: appointmentsError,
    needsConfig,
    execute: fetchAllAppointments,
    isCached: appointmentsIsCached,
  } = useCachedEdgeFunction<void, GetAllAppointmentsResponse>(
    'get-all-appointments',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      cacheKey: 'all-appointments',
      cacheTtl: 60, // 1 hour cache
      onSuccess: handleFetchAllAppointmentsSuccess,
      onError: handleFetchAllAppointmentsError,
    }
  );

  const {
    loading: updatingAppointment,
    execute: updateNotionAppointment,
  } = useCachedEdgeFunction<UpdateNotionAppointmentPayload, UpdateNotionAppointmentResponse>(
    'update-notion-appointment',
    {
      requiresAuth: true,
      onSuccess: handleUpdateNotionAppointmentSuccess,
      onError: handleUpdateNotionAppointmentError,
    }
  );

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
      app.sessionNorthStar.toLowerCase().includes(lowerCaseSearchTerm) ||
      (app.priorityPattern && app.priorityPattern.toLowerCase().includes(lowerCaseSearchTerm))
    );
    setFilteredAppointments(filtered);
  }, [searchTerm, appointments]);

  const handleLocalFieldChange = (id: string, field: keyof Appointment, value: any) => {
    // Update local state immediately for responsive UI
    setAppointments(prev => prev.map(app =>
      app.id === id ? { ...app, [field]: value } : app
    ));
  };

  const handleFieldBlur = (id: string, field: keyof Appointment, value: any) => {
    // Trigger API update only on blur
    updateNotionAppointment({ appointmentId: id, updates: { [field]: value } });
  };

  const handleSelectChange = (id: string, field: keyof Appointment, value: any) => {
    // For select components, update immediately
    handleLocalFieldChange(id, field, value);
    updateNotionAppointment({ appointmentId: id, updates: { [field]: value } });
  };

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setFilteredAppointments(appointments); // Reset to all appointments
  }, [appointments]);

  const handleStartSession = useCallback(async (appointmentId: string) => {
    // Navigate directly to the active session page for this appointment
    navigate(`/active-session/${appointmentId}`);
  }, [navigate]);

  if (loadingAppointments) {
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

  if (appointmentsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 mb-4">
              <AlertCircle className="w-12 h-12 mx-auto" />
            </div>
            <h2 className="xl font-bold mb-2">Error Loading Appointments</h2>
            <p className="text-gray-600 mb-4">{appointmentsError}</p>
            <div className="space-y-2">
              <Button onClick={() => fetchAllAppointments()}>Try Again</Button>
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
                  className="pl-10 pr-10 py-2 border rounded-md w-full" // Added pr-10 for clear button
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                    onClick={handleClearSearch}
                    disabled={loadingAppointments}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button onClick={() => fetchAllAppointments()} variant="outline" disabled={loadingAppointments}>
                {loadingAppointments ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {loadingAppointments ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>

            <div className="flex justify-center mb-4">
              <SyncStatusIndicator onSyncComplete={() => {
                // Refresh data after sync
                fetchAllAppointments();
              }} />
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
                      <TableHead className="min-w-[200px]">Session North Star</TableHead>
                      <TableHead className="min-w-[150px]">Priority Pattern</TableHead>
                      <TableHead className="min-w-[120px]">Status</TableHead>
                      <TableHead className="min-w-[250px]">Notes</TableHead>
                      <TableHead className="min-w-[100px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium">
                          {app.clientName}
                          {appointmentsIsCached && (
                            <Badge variant="secondary" className="bg-green-200 text-green-800 ml-2">
                              Cached
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{app.date ? format(new Date(app.date), 'PPP') : 'N/A'}</TableCell>
                        <TableCell>
                          <Textarea
                            value={app.goal}
                            onChange={(e) => handleLocalFieldChange(app.id, 'goal', e.target.value)}
                            onBlur={(e) => handleFieldBlur(app.id, 'goal', e.target.value)}
                            className="min-h-[60px] w-full"
                            disabled={updatingAppointment}
                          />
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={app.sessionNorthStar}
                            onChange={(e) => handleLocalFieldChange(app.id, 'sessionNorthStar', e.target.value)}
                            onBlur={(e) => handleFieldBlur(app.id, 'sessionNorthStar', e.target.value)}
                            className="min-h-[60px] w-full"
                            disabled={updatingAppointment}
                          />
                        </TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                                disabled={updatingAppointment}
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
                                      onSelect={() => handleSelectChange(app.id, 'priorityPattern', pattern)}
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
                                disabled={updatingAppointment}
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
                                      onSelect={() => handleSelectChange(app.id, 'status', status)}
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
                            onChange={(e) => handleLocalFieldChange(app.id, 'notes', e.target.value)}
                            onBlur={(e) => handleFieldBlur(app.id, 'notes', e.target.value)}
                            className="min-h-[60px] w-full"
                            disabled={updatingAppointment}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartSession(app.id)}
                            disabled={updatingAppointment}
                          >
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Start Session
                          </Button>
                        </TableCell>
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

export default AllAppointments;