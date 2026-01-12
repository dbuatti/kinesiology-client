"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, User, Star, Target, Clock, Settings, AlertCircle, Check, ChevronsUpDown, Lightbulb, Hand, XCircle, PlusCircle, Search, Trash2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import MuscleSelector from '@/components/MuscleSelector';
import ChakraSelector from '@/components/ChakraSelector';
import ChannelDashboard from '@/components/ChannelDashboard';
import SessionLogDisplay from '@/components/SessionLogDisplay';

import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
import {
  Appointment,
  Mode,
  Acupoint,
  Muscle,
  Chakra,
  Channel,
  GetSingleAppointmentPayload,
  GetSingleAppointmentResponse,
  UpdateNotionAppointmentPayload,
  UpdateNotionAppointmentResponse,
  GetNotionModesResponse,
  GetAcupointsPayload,
  GetAcupointsResponse,
  LogSessionEventPayload,
  LogSessionEventResponse,
  GetSessionLogsResponse,
  DeleteSessionLogPayload,
  DeleteSessionLogResponse,
} from '@/types/api';

const ActiveSession = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [sessionAnchorText, setSessionAnchorText] = useState('');
  const [sessionNorthStarText, setSessionNorthStarText] = useState('');
  const [modes, setModes] = useState<Mode[]>([]);
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [isModeSelectOpen, setIsModeSelectOpen] = useState(false);

  // Acupoint Search States
  const [acupointSearchTerm, setAcupointSearchTerm] = useState('');
  const [symptomSearchTerm, setSymptomSearchTerm] = useState('');
  const [foundAcupoints, setFoundAcupoints] = useState<Acupoint[]>([]);
  const [selectedAcupoint, setSelectedAcupoint] = useState<Acupoint | null>(null);
  const [isAcupointSearchOpen, setIsAcupointSearchOpen] = useState(false);
  const [isSymptomSearchOpen, setIsSymptomSearchOpen] = useState(false);

  // Muscle States
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);

  // Chakra States
  const [selectedChakra, setSelectedChakra] = useState<Chakra | null>(null);

  // Session Logs States
  const [sessionLogs, setSessionLogs] = useState<GetSessionLogsResponse['sessionLogs']>([]);
  const [sessionMuscleLogs, setSessionMuscleLogs] = useState<GetSessionLogsResponse['sessionMuscleLogs']>([]);

  // --- Memoized Callbacks for useSupabaseEdgeFunction ---

  const handleAppointmentSuccess = useCallback((data: GetSingleAppointmentResponse) => {
    setAppointment(data.appointment);
    setSessionAnchorText(data.appointment.sessionAnchor || '');
    setSessionNorthStarText(data.appointment.sessionNorthStar || '');
  }, []);

  const handleAppointmentError = useCallback((msg: string, errorCode?: string) => {
    showError(msg);
    if (errorCode === 'PROFILE_NOT_FOUND' || errorCode === 'PRACTITIONER_NAME_MISSING') {
      navigate('/profile-setup');
    } else if (errorCode === 'NOTION_CONFIG_NOT_FOUND') {
      // Handled by needsConfig state
    }
  }, [navigate]);

  const handleUpdateAppointmentSuccess = useCallback(() => {
    showSuccess('Appointment updated in Notion.');
    // Re-fetch appointment to ensure UI is in sync with Notion after update
    if (appointmentId) {
      fetchSingleAppointment({ appointmentId });
    }
  }, [appointmentId]); // Dependency on appointmentId and fetchSingleAppointment

  const handleUpdateAppointmentError = useCallback((msg: string) => {
    showError(`Update Failed: ${msg}`);
  }, []);

  const handleModesSuccess = useCallback((data: GetNotionModesResponse) => setModes(data.modes), []);
  const handleModesError = useCallback((msg: string) => showError(`Failed to load modes: ${msg}`), []);

  const handleAcupointsSuccess = useCallback((data: GetAcupointsResponse) => setFoundAcupoints(data.acupoints), []);
  const handleAcupointsError = useCallback((msg: string) => {
    showError(`Failed to search: ${msg}`);
    setFoundAcupoints([]);
  }, []);

  const handleLogSessionEventSuccess = useCallback((data: LogSessionEventResponse) => {
    console.log('Session event logged to Supabase:', data.logId);
    showSuccess('Event logged to session.');
    if (appointmentId) {
      fetchSessionLogs({ appointmentId }); // Refresh logs after successful log
    }
  }, [appointmentId]); // Dependency on appointmentId and fetchSessionLogs

  const handleLogSessionEventError = useCallback((msg: string) => {
    console.error('Failed to log session event to Supabase:', msg);
    showError(`Logging Failed: ${msg}`);
  }, []);

  const handleLogMuscleStrengthSuccess = useCallback((data: any) => {
    console.log('Muscle strength logged to Supabase:', data.logId);
    showSuccess('Muscle strength logged.');
    if (appointmentId) {
      fetchSessionLogs({ appointmentId }); // Refresh logs after successful log
    }
  }, [appointmentId]); // Dependency on appointmentId and fetchSessionLogs

  const handleLogMuscleStrengthError = useCallback((msg: string) => {
    console.error('Failed to log muscle strength to Supabase:', msg);
    showError(`Logging Failed: ${msg}`);
  }, []);

  const handleSessionLogsSuccess = useCallback((data: GetSessionLogsResponse) => {
    setSessionLogs(data.sessionLogs);
    setSessionMuscleLogs(data.sessionMuscleLogs);
  }, []);

  const handleSessionLogsError = useCallback((msg: string) => {
    showError(`Failed to load session logs: ${msg}`);
  }, []);

  const handleDeleteSessionLogSuccess = useCallback((data: DeleteSessionLogResponse) => {
    showSuccess('Log entry deleted.');
    if (appointmentId) {
      fetchSessionLogs({ appointmentId }); // Refresh logs after deletion
    }
  }, [appointmentId]); // Dependency on appointmentId and fetchSessionLogs

  const handleDeleteSessionLogError = useCallback((msg: string) => {
    showError(`Failed to delete log: ${msg}`);
  }, []);

  // --- Supabase Edge Function Hooks ---

  // Fetch single appointment
  const {
    data: fetchedAppointmentData,
    loading: loadingAppointment,
    error: appointmentError,
    needsConfig: appointmentNeedsConfig,
    execute: fetchSingleAppointment,
  } = useSupabaseEdgeFunction<GetSingleAppointmentPayload, GetSingleAppointmentResponse>(
    'get-single-appointment',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      onSuccess: handleAppointmentSuccess,
      onError: handleAppointmentError,
    }
  );

  // Update Notion appointment
  const {
    loading: updatingAppointment,
    execute: updateNotionAppointment,
  } = useSupabaseEdgeFunction<UpdateNotionAppointmentPayload, UpdateNotionAppointmentResponse>(
    'update-notion-appointment',
    {
      requiresAuth: true,
      onSuccess: handleUpdateAppointmentSuccess,
      onError: handleUpdateAppointmentError,
    }
  );

  // Fetch Notion Modes
  const {
    data: fetchedModesData,
    loading: loadingModes,
    error: modesError,
    needsConfig: modesNeedsConfig,
    execute: fetchModes,
  } = useSupabaseEdgeFunction<void, GetNotionModesResponse>(
    'get-notion-modes',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      onSuccess: handleModesSuccess,
      onError: handleModesError,
    }
  );

  // Fetch Acupoints
  const {
    data: fetchedAcupointsData,
    loading: loadingAcupoints,
    error: acupointsError,
    needsConfig: acupointsNeedsConfig,
    execute: fetchAcupoints,
  } = useSupabaseEdgeFunction<GetAcupointsPayload, GetAcupointsResponse>(
    'get-acupoints',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      onSuccess: handleAcupointsSuccess,
      onError: handleAcupointsError,
    }
  );

  // Log Session Event
  const {
    loading: loggingSessionEvent,
    execute: logSessionEvent,
  } = useSupabaseEdgeFunction<LogSessionEventPayload, LogSessionEventResponse>(
    'log-session-event',
    {
      requiresAuth: true,
      onSuccess: handleLogSessionEventSuccess,
      onError: handleLogSessionEventError,
    }
  );

  // Log Muscle Strength (separate hook for clarity, though could use logSessionEvent)
  const {
    loading: loggingMuscleStrength,
    execute: logMuscleStrength,
  } = useSupabaseEdgeFunction<any, any>( // Define specific types if needed
    'log-muscle-strength',
    {
      requiresAuth: true,
      onSuccess: handleLogMuscleStrengthSuccess,
      onError: handleLogMuscleStrengthError,
    }
  );

  // Fetch Session Logs
  const {
    data: fetchedSessionLogsData,
    loading: loadingSessionLogs,
    error: sessionLogsError,
    execute: fetchSessionLogs,
  } = useSupabaseEdgeFunction<{ appointmentId: string }, GetSessionLogsResponse>(
    'get-session-logs',
    {
      requiresAuth: true,
      onSuccess: handleSessionLogsSuccess,
      onError: handleSessionLogsError,
    }
  );

  // Delete Session Log
  const {
    loading: deletingSessionLog,
    execute: deleteSessionLog,
  } = useSupabaseEdgeFunction<DeleteSessionLogPayload, DeleteSessionLogResponse>(
    'delete-session-log',
    {
      requiresAuth: true,
      onSuccess: handleDeleteSessionLogSuccess,
      onError: handleDeleteSessionLogError,
    }
  );

  // --- Effects ---

  useEffect(() => {
    if (appointmentId) {
      fetchSingleAppointment({ appointmentId });
      fetchModes();
      fetchSessionLogs({ appointmentId }); // Fetch logs on component mount
    }
  }, [appointmentId, fetchSingleAppointment, fetchModes, fetchSessionLogs]);

  // Combine all loading states
  const overallLoading = loadingAppointment || loadingModes || loadingAcupoints || loggingSessionEvent || loggingMuscleStrength || loadingSessionLogs || deletingSessionLog;
  // Combine all needsConfig states
  const overallNeedsConfig = appointmentNeedsConfig || modesNeedsConfig || acupointsNeedsConfig;
  // Combine all errors for initial display
  const overallError = appointmentError || modesError || acupointsError || sessionLogsError;

  // --- Handlers ---

  const handleSessionAnchorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setSessionAnchorText(newText);
  };

  const handleSessionAnchorBlur = () => {
    if (appointment && sessionAnchorText !== appointment.sessionAnchor) {
      updateNotionAppointment({ appointmentId: appointment.id, updates: { sessionAnchor: sessionAnchorText } });
    }
  };

  const handleSessionNorthStarChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setSessionNorthStarText(newText);
  };

  const handleSessionNorthStarBlur = () => {
    if (appointment && sessionNorthStarText !== appointment.sessionNorthStar) {
      updateNotionAppointment({ appointmentId: appointment.id, updates: { sessionNorthStar: sessionNorthStarText } });
    }
  };

  const handleCompleteSession = async () => {
    if (appointment) {
      await updateNotionAppointment({ appointmentId: appointment.id, updates: { status: 'CH' } }); // Set status to Charged/Complete
      if (!updatingAppointment) { // Only navigate if update was successful and not still loading
        showSuccess(`${appointment.clientName}'s session marked as complete.`);
        navigate('/'); // Return to Waiting Room
      }
    }
  };

  const handleConfigureNotion = useCallback(() => {
    navigate('/notion-config');
  }, [navigate]);

  const handleAcupointSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setAcupointSearchTerm(term);
    fetchAcupoints({ searchTerm: term, searchType: 'point' });
  };

  const handleClearAcupointSearch = useCallback(() => {
    setAcupointSearchTerm('');
    setFoundAcupoints([]);
  }, []);

  const handleSymptomSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSymptomSearchTerm(term);
    fetchAcupoints({ searchTerm: term, searchType: 'symptom' });
  };

  const handleClearSymptomSearch = useCallback(() => {
    setSymptomSearchTerm('');
    setFoundAcupoints([]);
  }, []);

  const handleSelectAcupoint = useCallback((acupoint: Acupoint) => {
    setSelectedAcupoint(acupoint);
    setIsAcupointSearchOpen(false);
    setIsSymptomSearchOpen(false);
    setAcupointSearchTerm(acupoint.name);
    setSymptomSearchTerm('');
    setFoundAcupoints([]);
  }, []);

  const handleAddAcupointToSession = useCallback(async () => {
    if (selectedAcupoint && appointmentId) {
      await updateNotionAppointment({ appointmentId, updates: { acupointId: selectedAcupoint.id } });
      if (!updatingAppointment) {
        showSuccess(`${selectedAcupoint.name} added to the current session.`);
        setSelectedAcupoint(null);
        setAcupointSearchTerm('');
      }
    } else {
      showError('No acupoint selected to add to session.');
    }
  }, [selectedAcupoint, appointmentId, updateNotionAppointment, updatingAppointment]);

  const handleMuscleSelected = useCallback((muscle: Muscle) => {
    setSelectedMuscle(muscle);
    console.log('Muscle selected:', muscle.name);
  }, []);

  const handleMuscleStrengthLogged = useCallback(async (muscle: Muscle, isStrong: boolean) => {
    if (appointmentId) {
      await logMuscleStrength({
        appointmentId: appointmentId,
        muscleId: muscle.id,
        muscleName: muscle.name,
        isStrong: isStrong,
        notes: '', // Optional notes
      });
    }
  }, [appointmentId, logMuscleStrength]);

  const handleChakraSelected = useCallback((chakra: Chakra) => {
    setSelectedChakra(chakra);
  }, []);

  const handleClearChakraSelection = useCallback(() => {
    setSelectedChakra(null);
  }, []);

  const handleLogChannelItemSuccess = useCallback(() => {
    if (appointmentId) {
      fetchSessionLogs({ appointmentId }); // Refresh logs after any channel item is logged
    }
  }, [appointmentId, fetchSessionLogs]);

  // --- Render Logic ---

  if (overallLoading && !appointment) { // Only show full loading skeleton if no appointment data yet
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6 flex items-center justify-center">
        <div className="max-w-2xl mx-auto space-y-6 w-full">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (overallNeedsConfig) {
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
              Connect your Notion account to view today's appointments and manage sessions.
            </p>
            <Button
              className="w-full h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              onClick={handleConfigureNotion}
            >
              Configure Notion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (overallError && !appointment) { // Only show error card if no appointment data could be loaded
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 mb-4">
              <AlertCircle className="w-12 h-12 mx-auto" />
            </div>
            <h2 className="text-xl font-bold mb-2">Error Loading Appointment</h2>
            <p className="text-gray-600 mb-4">{overallError}</p>
            <div className="space-y-2">
              <Button onClick={() => fetchSingleAppointment({ appointmentId: appointmentId! })}>Try Again</Button>
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
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-900 mb-2">Active Session</h1>
          <p className="text-gray-600">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {appointment ? (
          <div className="space-y-6">
            {/* Client Insight Card */}
            <Card className="shadow-xl border-2 border-indigo-200">
              <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg p-4">
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <User className="w-6 h-6" />
                  {appointment.clientName}
                </CardTitle>
                <div className="flex items-center gap-2 text-indigo-100 mt-2">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-medium">
                    {appointment.starSign === "Unknown" ? (
                      <span className="text-yellow-300">
                        Star Sign not found. Check Notion CRM config.
                      </span>
                    ) : (
                      appointment.starSign
                    )}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-4">
                {appointment.sessionNorthStar && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Target className="w-4 h-4 text-indigo-600" />
                      <span>Session North Star (Client Focus)</span>
                    </div>
                    <Textarea
                      id="session-north-star"
                      placeholder="e.g., 'Releasing tension in the shoulders related to stress.'"
                      value={sessionNorthStarText}
                      onChange={handleSessionNorthStarChange}
                      onBlur={handleSessionNorthStarBlur}
                      className="min-h-[80px]"
                      disabled={updatingAppointment}
                    />
                  </div>
                )}

                {appointment.goal && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Lightbulb className="w-4 h-4 text-indigo-600" />
                      <span>Appointment Goal</span>
                    </div>
                    <p className="text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      {appointment.goal}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live Session Controls */}
            <Card className="shadow-xl">
              <CardHeader className="bg-indigo-50 border-b border-indigo-200 rounded-t-lg p-4">
                <CardTitle className="text-xl font-bold text-indigo-800 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Live Session Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Session Anchor */}
                <div className="space-y-2">
                  <Label htmlFor="session-anchor" className="flex items-center gap-2 font-semibold text-gray-700">
                    <Hand className="w-4 h-4 text-indigo-600" />
                    Today we are really working with...
                  </Label>
                  <Textarea
                    id="session-anchor"
                    placeholder="e.g., 'Releasing tension in the shoulders related to stress.'"
                    value={sessionAnchorText}
                    onChange={handleSessionAnchorChange}
                    onBlur={handleSessionAnchorBlur}
                    className="min-h-[80px]"
                    disabled={updatingAppointment}
                  />
                </div>

                {/* Mode Selection */}
                <div className="space-y-2">
                  <Label htmlFor="mode-select" className="flex items-center gap-2 font-semibold text-gray-700">
                    <Lightbulb className="w-4 h-4 text-indigo-600" />
                    Select Mode
                  </Label>
                  <Popover open={isModeSelectOpen} onOpenChange={setIsModeSelectOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isModeSelectOpen}
                        className="w-full justify-between"
                        disabled={loadingModes || updatingAppointment}
                      >
                        {selectedMode ? selectedMode.name : "Select mode..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Search mode..." />
                        <CommandEmpty>No mode found.</CommandEmpty>
                        <CommandGroup>
                          {modes.map((mode) => (
                            <CommandItem
                              key={mode.id}
                              value={mode.name}
                              onSelect={() => {
                                setSelectedMode(mode);
                                setIsModeSelectOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedMode?.id === mode.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {mode.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedMode?.actionNote && (
                    <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200 mt-2">
                      <strong>Action Note:</strong> {selectedMode.actionNote}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Acupoint Insight Engine */}
            <Card className="shadow-xl">
              <CardHeader className="bg-indigo-50 border-b border-indigo-200 rounded-t-lg p-4">
                <CardTitle className="text-xl font-bold text-indigo-800 flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Acupoint Insight Engine
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Point Search */}
                <div className="space-y-2">
                  <Label htmlFor="point-search" className="flex items-center gap-2 font-semibold text-gray-700">
                    <Search className="w-4 h-4 text-indigo-600" />
                    Point Search (e.g., SP-06, Pc-6)
                  </Label>
                  <Popover open={isAcupointSearchOpen} onOpenChange={setIsAcupointSearchOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          id="point-search"
                          type="text"
                          placeholder="Search for an acupoint..."
                          value={acupointSearchTerm}
                          onChange={handleAcupointSearchChange}
                          onFocus={() => setIsAcupointSearchOpen(true)}
                          className="w-full pr-10"
                          disabled={loadingAcupoints || updatingAppointment}
                        />
                        {acupointSearchTerm && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                            onClick={handleClearAcupointSearch}
                            disabled={loadingAcupoints || updatingAppointment}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        {loadingAcupoints && <CommandInput value={acupointSearchTerm} onValueChange={setAcupointSearchTerm} placeholder="Searching..." disabled />}
                        {!loadingAcupoints && <CommandInput value={acupointSearchTerm} onValueChange={setAcupointSearchTerm} placeholder="Search acupoint..." />}
                        <CommandEmpty>No acupoint found.</CommandEmpty>
                        <CommandGroup>
                          {foundAcupoints.map((point) => (
                            <CommandItem
                              key={point.id}
                              value={point.name}
                              onSelect={() => handleSelectAcupoint(point)}
                            >
                              {point.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Symptom Suggester */}
                <div className="space-y-2">
                  <Label htmlFor="symptom-search" className="flex items-center gap-2 font-semibold text-gray-700">
                    <Lightbulb className="w-4 h-4 text-indigo-600" />
                    Symptom Suggester (e.g., Anxiety, Headache)
                  </Label>
                  <Popover open={isSymptomSearchOpen} onOpenChange={setIsSymptomSearchOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          id="symptom-search"
                          type="text"
                          placeholder="Search symptoms for point suggestions..."
                          value={symptomSearchTerm}
                          onChange={handleSymptomSearchChange}
                          onFocus={() => setIsSymptomSearchOpen(true)}
                          className="w-full pr-10"
                          disabled={loadingAcupoints || updatingAppointment}
                        />
                        {symptomSearchTerm && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                            onClick={handleClearSymptomSearch}
                            disabled={loadingAcupoints || updatingAppointment}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        {loadingAcupoints && <CommandInput value={symptomSearchTerm} onValueChange={setSymptomSearchTerm} placeholder="Searching..." disabled />}
                        {!loadingAcupoints && <CommandInput value={symptomSearchTerm} onValueChange={setSymptomSearchTerm} placeholder="Search symptom..." />}
                        <CommandEmpty>No suggestions found.</CommandEmpty>
                        <CommandGroup>
                          {foundAcupoints.map((point) => (
                            <CommandItem
                              key={point.id}
                              value={point.name}
                              onSelect={() => handleSelectAcupoint(point)}
                            >
                              {point.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Insight Deck (Selected Acupoint Display) */}
                {selectedAcupoint && (
                  <Card className="border-2 border-purple-300 bg-purple-50 shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                      <CardTitle className="text-xl font-bold text-purple-800">
                        {selectedAcupoint.name}
                      </CardTitle>
                      <div className="flex gap-2">
                        {selectedAcupoint.channel && (
                          <Badge variant="secondary" className="bg-purple-200 text-purple-800">
                            {selectedAcupoint.channel}
                          </Badge>
                        )}
                        {selectedAcupoint.akMuscles.length > 0 && (
                          <Badge variant="secondary" className="bg-purple-200 text-purple-800">
                            {selectedAcupoint.akMuscles.join(', ')}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2 space-y-3 text-gray-800">
                      {selectedAcupoint.for && (
                        <div>
                          <p className="font-semibold text-purple-700">For:</p>
                          <p className="text-sm">{selectedAcupoint.for}</p>
                        </div>
                      )}
                      {selectedAcupoint.kinesiology && (
                        <div>
                          <p className="font-semibold text-purple-700">Kinesiology:</p>
                          <p className="text-sm">{selectedAcupoint.kinesiology}</p>
                        </div>
                      )}
                      {selectedAcupoint.psychology && (
                        <div>
                          <p className="font-semibold text-purple-700">Psychology:</p>
                          <p className="text-sm">{selectedAcupoint.psychology}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {selectedAcupoint.typeOfPoint.length > 0 && (
                          <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                            Type: {selectedAcupoint.typeOfPoint.join(', ')}
                          </Badge>
                        )}
                        {selectedAcupoint.time.length > 0 && (
                          <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                            Time: {selectedAcupoint.time.join(', ')}
                          </Badge>
                        )}
                      </div>
                      <Button
                        className="w-full mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                        onClick={handleAddAcupointToSession}
                        disabled={updatingAppointment}
                      >
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Add to Session
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            {/* Muscle Selector Component */}
            <MuscleSelector
              onMuscleSelected={handleMuscleSelected}
              onMuscleStrengthLogged={handleMuscleStrengthLogged}
              appointmentId={appointmentId || ''}
            />

            {/* Chakra Selector Component */}
            <ChakraSelector
              appointmentId={appointmentId || ''}
              onChakraSelected={handleChakraSelected}
              onClearSelection={handleClearChakraSelection}
              selectedChakra={selectedChakra}
            />

            {/* Channel Dashboard Component */}
            <ChannelDashboard
              appointmentId={appointmentId || ''}
              onLogSuccess={handleLogChannelItemSuccess}
            />

            {/* Session Log Display */}
            <SessionLogDisplay
              appointmentId={appointmentId || ''}
              sessionLogs={sessionLogs}
              sessionMuscleLogs={sessionMuscleLogs}
              onDeleteLog={deleteSessionLog}
              deletingLog={deletingSessionLog}
            />

            {/* Complete Session Button */}
            <Button
              className="w-full h-12 text-lg bg-red-500 hover:bg-red-600 text-white"
              onClick={handleCompleteSession}
              disabled={updatingAppointment}
            >
              <XCircle className="w-5 h-5 mr-2" />
              Complete Session
            </Button>
          </div>
        ) : (
          <Card className="shadow-lg">
            <CardContent className="pt-8 text-center">
              <div className="text-gray-400 mb-4">
                <Calendar className="w-16 h-16 mx-auto" />
              </div>
              <h2 className="xl font-semibold text-gray-700 mb-2">
                No Active Session
              </h2>
              <p className="text-gray-500">
                No session is currently active. Please select one from the Waiting Room.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex gap-2 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="text-indigo-600 hover:text-indigo-800"
          >
            ← Back to Waiting Room
          </Button>
          <Button
            variant="outline"
            onClick={handleConfigureNotion}
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

export default ActiveSession;