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
    import { Calendar, User, Star, Target, Clock, Settings, AlertCircle, Check, ChevronsUpDown, Lightbulb, Hand, XCircle, PlusCircle, Search, Sparkles, ListChecks, Trash2, Loader2 } from 'lucide-react';
    import { showSuccess, showError } from '@/utils/toast'; // Import sonner toast utilities
    import { cn } from '@/lib/utils';
    import { format } from 'date-fns';
    import MuscleSelector from '@/components/MuscleSelector';
    import ChakraSelector from '@/components/ChakraSelector'; // Import the new ChakraSelector
    import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
    import {
      Appointment, Mode, Acupoint, Muscle, Chakra, SessionLog, SessionMuscleLog,
      GetSingleAppointmentPayload, GetSingleAppointmentResponse,
      GetNotionModesResponse,
      GetAcupointsPayload, GetAcupointsResponse,
      UpdateNotionAppointmentPayload, UpdateNotionAppointmentResponse,
      LogSessionEventPayload, LogSessionEventResponse,
      GetSessionLogsPayload, GetSessionLogsResponse,
      DeleteSessionLogPayload, DeleteSessionLogResponse // Import new types
    } from '@/types/api';

    const ActiveSession = () => {
      const { appointmentId } = useParams<{ appointmentId: string }>();
      const [appointment, setAppointment] = useState<Appointment | null>(null);
      const [sessionNorthStarText, setSessionNorthStarText] = useState(''); // This will now handle the combined "Session North Star"
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

      // Session Logs State
      const [sessionLogs, setSessionLogs] = useState<(SessionLog | SessionMuscleLog)[]>([]);


      const navigate = useNavigate();

      // Memoized callbacks for fetchSingleAppointment
      const onSingleAppointmentSuccess = useCallback((data: GetSingleAppointmentResponse) => {
        setAppointment(data.appointment);
        // Initialize the single editable field from Notion's "Session North Star"
        setSessionNorthStarText(data.appointment.sessionNorthStar || '');
      }, []);

      const onSingleAppointmentError = useCallback((msg: string) => {
        showError(msg);
      }, []);

      // Fetch Single Appointment
      const {
        data: fetchedAppointmentData,
        loading: loadingAppointment,
        error: appointmentError,
        needsConfig: needsAppointmentConfig,
        execute: fetchSingleAppointment,
      } = useSupabaseEdgeFunction<GetSingleAppointmentPayload, GetSingleAppointmentResponse>(
        'get-single-appointment',
        {
          requiresAuth: true,
          requiresNotionConfig: true,
          onSuccess: onSingleAppointmentSuccess,
          onError: onSingleAppointmentError,
        }
      );

      // Memoized callbacks for fetchModes
      const onModesSuccess = useCallback((data: GetNotionModesResponse) => {
        setModes(data.modes);
      }, []);

      const onModesError = useCallback((msg: string) => {
        showError(`Failed to load modes: ${msg}`);
      }, []);

      // Fetch Modes
      const {
        data: fetchedModesData,
        loading: loadingModes,
        error: modesError,
        execute: fetchModes,
      } = useSupabaseEdgeFunction<void, GetNotionModesResponse>(
        'get-notion-modes',
        {
          requiresAuth: true,
          requiresNotionConfig: true,
          onSuccess: onModesSuccess,
          onError: onModesError,
        }
      );

      // Memoized callbacks for fetchAcupoints
      const onAcupointsSuccess = useCallback((data: GetAcupointsResponse) => {
        setFoundAcupoints(data.acupoints);
      }, []);

      const onAcupointsError = useCallback((msg: string) => {
        showError(`Failed to search: ${msg}`);
        setFoundAcupoints([]);
      }, []);

      // Fetch Acupoints
      const {
        data: fetchedAcupointsData,
        loading: loadingAcupoints,
        error: acupointsError,
        needsConfig: needsAcupointsConfig, // Capture needsConfig specifically for acupoints
        execute: fetchAcupoints,
      } = useSupabaseEdgeFunction<GetAcupointsPayload, GetAcupointsResponse>(
        'get-acupoints',
        {
          requiresAuth: true,
          requiresNotionConfig: true,
          onSuccess: onAcupointsSuccess,
          onError: onAcupointsError,
        }
      );

      // Memoized callbacks for updateNotionAppointment
      const onUpdateAppointmentSuccess = useCallback(() => {
        showSuccess('Appointment updated in Notion.');
      }, []);

      const onUpdateAppointmentError = useCallback((msg: string) => {
        showError(`Update Failed: ${msg}`);
      }, []);

      // Update Notion Appointment
      const {
        loading: updatingAppointment,
        execute: updateNotionAppointment,
      } = useSupabaseEdgeFunction<UpdateNotionAppointmentPayload, UpdateNotionAppointmentResponse>(
        'update-notion-appointment',
        {
          requiresAuth: true,
          onSuccess: onUpdateAppointmentSuccess,
          onError: onUpdateAppointmentError,
        }
      );

      // New hook for logging general session events
      const {
        loading: loggingSessionEvent,
        execute: logSessionEvent,
      } = useSupabaseEdgeFunction<LogSessionEventPayload, LogSessionEventResponse>(
        'log-session-event',
        {
          requiresAuth: true,
          onSuccess: (data) => {
            console.log('Session event logged to Supabase:', data.logId);
            if (appointmentId) fetchSessionLogs({ appointmentId }); // Refresh logs
          },
          onError: (msg) => {
            console.error('Failed to log session event to Supabase:', msg);
          }
        }
      );

      // New hook for fetching session logs
      const onSessionLogsSuccess = useCallback((data: GetSessionLogsResponse) => {
        // Add discriminator to each log type for easier identification in the UI
        const generalLogsWithDiscriminator = data.sessionLogs.map(log => ({ ...log, log_type_discriminator: 'session_log' as const }));
        const muscleLogsWithDiscriminator = data.sessionMuscleLogs.map(log => ({ ...log, log_type_discriminator: 'session_muscle_log' as const }));

        const combinedLogs = [...generalLogsWithDiscriminator, ...muscleLogsWithDiscriminator];
        // Sort by created_at to display chronologically
        combinedLogs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setSessionLogs(combinedLogs);
      }, []);

      const onSessionLogsError = useCallback((msg: string) => {
        showError(`Failed to load session history: ${msg}`);
        setSessionLogs([]);
      }, []);

      const {
        loading: loadingSessionLogs,
        execute: fetchSessionLogs,
      } = useSupabaseEdgeFunction<GetSessionLogsPayload, GetSessionLogsResponse>(
        'get-session-logs',
        {
          requiresAuth: true,
          onSuccess: onSessionLogsSuccess,
          onError: onSessionLogsError,
        }
      );

      // New hook for deleting session logs
      const onDeleteSessionLogSuccess = useCallback(() => {
        showSuccess('Session log entry removed.');
        if (appointmentId) fetchSessionLogs({ appointmentId }); // Refresh logs after deletion
      }, [appointmentId, fetchSessionLogs]);

      const onDeleteSessionLogError = useCallback((msg: string) => {
        showError(`Deletion Failed: ${msg}`);
      }, []);

      const {
        loading: deletingSessionLog,
        execute: deleteSessionLog,
      } = useSupabaseEdgeFunction<DeleteSessionLogPayload, DeleteSessionLogResponse>(
        'delete-session-log',
        {
          requiresAuth: true,
          onSuccess: onDeleteSessionLogSuccess,
          onError: onDeleteSessionLogError,
        }
      );


      useEffect(() => {
        if (appointmentId) {
          fetchSingleAppointment({ appointmentId });
          fetchModes();
          fetchAcupoints({ searchTerm: '', searchType: 'point' });
          fetchSessionLogs({ appointmentId }); // Fetch session logs on initial load
        }
      }, [appointmentId, fetchSingleAppointment, fetchModes, fetchAcupoints, fetchSessionLogs]);

      const handleSessionNorthStarChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setSessionNorthStarText(newText);
      };

      const handleSessionNorthStarBlur = () => {
        if (appointment && sessionNorthStarText !== appointment.sessionNorthStar) {
          // Now, `sessionAnchor` in the payload will update Notion's "Session North Star"
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

      const handleConfigureNotion = () => {
        navigate('/notion-config');
      };

      const handleAcupointSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setAcupointSearchTerm(term);
        fetchAcupoints({ searchTerm: term, searchType: 'point' });
      };

      const handleSymptomSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setSymptomSearchTerm(term);
        fetchAcupoints({ searchTerm: term, searchType: 'symptom' });
      };

      const handleSelectAcupoint = (acupoint: Acupoint) => {
        setSelectedAcupoint(acupoint);
        setIsAcupointSearchOpen(false);
        setIsSymptomSearchOpen(false);
        setAcupointSearchTerm(acupoint.name); // Pre-fill point search with selected point
        setSymptomSearchTerm(''); // Clear symptom search
        setFoundAcupoints([]); // Clear search results
      };

      const handleClearAcupointSelection = () => {
        setSelectedAcupoint(null);
        setAcupointSearchTerm('');
        setSymptomSearchTerm('');
        setFoundAcupoints([]);
        fetchAcupoints({ searchTerm: '', searchType: 'point' }); // Re-fetch all for next search
      };

      const handleAddAcupointToSession = async () => {
        if (selectedAcupoint && appointmentId) {
          // 1. Update Notion (if property exists)
          const notionUpdatePayload = { appointmentId: appointmentId, updates: { acupointId: selectedAcupoint.id } };
          console.log("[ActiveSession] Sending payload to update-notion-appointment:", notionUpdatePayload);
          await updateNotionAppointment(notionUpdatePayload);

          // 2. Log to Supabase
          await logSessionEvent({
            appointmentId: appointmentId,
            logType: 'acupoint_added',
            details: {
              acupointId: selectedAcupoint.id,
              acupointName: selectedAcupoint.name,
              channel: selectedAcupoint.channel,
            }
          });

          if (!updatingAppointment && !loggingSessionEvent) { // Only show toast if both operations are not loading
            showSuccess(`${selectedAcupoint.name} added to the current session.`);
            handleClearAcupointSelection(); // Clear selected acupoint after adding
          }
        } else {
          showError('No acupoint selected to add to session.');
        }
      };

      const handleMuscleSelected = (muscle: Muscle) => {
        setSelectedMuscle(muscle);
        console.log('Muscle selected:', muscle.name);
      };

      const handleClearMuscleSelection = () => {
        setSelectedMuscle(null);
      };

      const handleChakraSelected = (chakra: Chakra) => {
        setSelectedChakra(chakra);
        console.log('Chakra selected:', chakra.name);
      };

      const handleClearChakraSelection = () => {
        setSelectedChakra(null);
      };

      const handleSelectMode = (mode: Mode) => {
        setSelectedMode(mode);
        setIsModeSelectOpen(false);
      };

      const handleAddModeToSession = async () => {
        if (selectedMode && appointmentId) {
          await logSessionEvent({
            appointmentId: appointmentId,
            logType: 'mode_selected',
            details: {
              modeId: selectedMode.id,
              modeName: selectedMode.name,
              actionNote: selectedMode.actionNote,
            }
          });

          if (!loggingSessionEvent) {
            showSuccess(`${selectedMode.name} logged to the current session.`);
            handleClearModeSelection(); // Clear selected mode after logging
          }
        } else {
          showError('Please select a mode to add to the session.');
        }
      };

      const handleClearModeSelection = () => {
        setSelectedMode(null);
      };

      const handleDeleteLogEntry = async (logId: string, logTypeDiscriminator: 'session_log' | 'session_muscle_log') => {
        if (window.confirm('Are you sure you want to delete this log entry?')) {
          await deleteSessionLog({ logId, logType: logTypeDiscriminator });
        }
      };

      if (loadingAppointment || loadingModes || loadingAcupoints || loadingSessionLogs) {
        return (
          <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        );
      }

      if (needsAppointmentConfig) {
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

      if (appointmentError && !appointment) {
        return (
          <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
            <Card className="max-w-md w-full shadow-lg">
              <CardContent className="pt-6 text-center">
                <div className="text-red-500 mb-4">
                  <AlertCircle className="w-12 h-12 mx-auto" />
                </div>
                <h2 className="xl font-bold mb-2">Error Loading Appointment</h2>
                <p className="text-gray-600 mb-4">{appointmentError}</p>
                <div className="space-y-2">
                  <Button onClick={() => appointmentId && fetchSingleAppointment({ appointmentId })}>Try Again</Button>
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
                    {/* Consolidated Session North Star input */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Target className="w-4 h-4 text-indigo-600" />
                        <span>Session North Star</span>
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
                            disabled={loadingModes || updatingAppointment || loggingSessionEvent}
                          >
                            {selectedMode ? selectedMode.name : "Select mode..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            {loadingModes && <CommandInput value={selectedMode?.name || ""} onValueChange={() => {}} placeholder="Loading modes..." disabled />}
                            {!loadingModes && <CommandInput value={selectedMode?.name || ""} onValueChange={(val) => setSelectedMode(modes.find(mode => mode.name === val) || null)} placeholder="Search mode..." />}
                            <CommandEmpty>No mode found.</CommandEmpty>
                            <CommandGroup>
                              {modes.map((mode) => (
                                <CommandItem
                                  key={mode.id}
                                  value={mode.name}
                                  onSelect={() => handleSelectMode(mode)}
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
                      {selectedMode && (
                        <Card className="border-2 border-purple-300 bg-purple-50 shadow-md mt-4">
                          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                            <CardTitle className="text-xl font-bold text-purple-800">
                              {selectedMode.name}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-2 space-y-3 text-gray-800">
                            {selectedMode.actionNote && (
                              <div>
                                <p className="font-semibold text-purple-700">Action Note:</p>
                                <p className="text-sm">{selectedMode.actionNote}</p>
                              </div>
                            )}
                            <div className="flex gap-2 mt-4">
                              <Button
                                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                                onClick={handleAddModeToSession}
                                disabled={loggingSessionEvent}
                              >
                                <PlusCircle className="w-4 h-4 mr-2" />
                                {loggingSessionEvent ? 'Adding...' : 'Add to Session Log'}
                              </Button>
                              <Button variant="outline" onClick={handleClearModeSelection} disabled={loggingSessionEvent}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Clear
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
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
                    {needsAcupointsConfig ? ( // Conditional rendering for acupoints config
                      <div className="text-center py-8">
                        <Settings className="w-10 h-10 mx-auto mb-4 text-indigo-600" />
                        <h3 className="text-xl font-bold text-indigo-900 mb-2">Acupoints Database Not Configured</h3>
                        <p className="text-gray-600 mb-4">
                          Please configure your Notion Acupoints Database ID in the Notion Configuration page to use this feature.
                        </p>
                        <Button
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                          onClick={handleConfigureNotion}
                        >
                          Configure Notion
                        </Button>
                      </div>
                    ) : (
                      <>
                        {/* Point Search */}
                        <div className="space-y-2">
                          <Label htmlFor="point-search" className="flex items-center gap-2 font-semibold text-gray-700">
                            <Search className="w-4 h-4 text-indigo-600" />
                            Point Search (e.g., SP-06, Pc-6)
                          </Label>
                          <Popover open={isAcupointSearchOpen} onOpenChange={setIsAcupointSearchOpen}>
                            <PopoverTrigger asChild>
                              <Input
                                id="point-search"
                                type="text"
                                placeholder="Search for an acupoint..."
                                value={acupointSearchTerm}
                                onChange={handleAcupointSearchChange}
                                onFocus={() => setIsAcupointSearchOpen(true)}
                                className="w-full"
                                disabled={loadingAcupoints || updatingAppointment || loggingSessionEvent}
                              />
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
                              <Input
                                id="symptom-search"
                                type="text"
                                placeholder="Search symptoms for point suggestions..."
                                value={symptomSearchTerm}
                                onChange={handleSymptomSearchChange}
                                onFocus={() => setIsSymptomSearchOpen(true)}
                                className="w-full"
                                disabled={loadingAcupoints || updatingAppointment || loggingSessionEvent}
                              />
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
                              <div className="flex gap-2 mt-4">
                                <Button
                                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                                  onClick={handleAddAcupointToSession}
                                  disabled={updatingAppointment || loggingSessionEvent}
                                >
                                  <PlusCircle className="w-4 h-4 mr-2" />
                                  {updatingAppointment || loggingSessionEvent ? 'Adding...' : 'Add to Session'}
                                </Button>
                                <Button variant="outline" onClick={handleClearAcupointSelection} disabled={updatingAppointment || loggingSessionEvent}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Clear
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Muscle Selector Component */}
                <MuscleSelector
                  onMuscleSelected={handleMuscleSelected}
                  onClearSelection={handleClearMuscleSelection}
                  appointmentId={appointmentId || ''}
                  selectedMuscle={selectedMuscle} // Pass selected muscle to MuscleSelector
                />

                {/* Chakra Selector Component */}
                <ChakraSelector
                  appointmentId={appointmentId || ''}
                  onChakraSelected={handleChakraSelected}
                  onClearSelection={handleClearChakraSelection}
                  selectedChakra={selectedChakra} // Pass selected chakra to ChakraSelector
                />

                {/* Session Log */}
                <Card className="shadow-xl">
                  <CardHeader className="bg-indigo-50 border-b border-indigo-200 rounded-t-lg p-4">
                    <CardTitle className="text-xl font-bold text-indigo-800 flex items-center gap-2">
                      <ListChecks className="w-5 h-5" />
                      Session Log
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {loadingSessionLogs ? (
                      <div className="flex justify-center items-center h-20">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                      </div>
                    ) : sessionLogs.length === 0 ? (
                      <p className="text-gray-600 text-center">No events logged for this session yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {sessionLogs.map((log, index) => (
                          <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <span className="text-sm text-gray-500 flex-shrink-0">
                              {format(new Date(log.created_at), 'HH:mm')}
                            </span>
                            <div className="flex-grow">
                              {log.log_type_discriminator === 'session_log' ? ( // Check if it's a general session log
                                <>
                                  {log.log_type === 'mode_selected' && (
                                    <div className="text-sm text-gray-800">
                                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 mr-2">Mode</Badge>
                                      Selected Mode: <span className="font-semibold">{(log as SessionLog).details?.modeName}</span>
                                      {(log as SessionLog).details?.actionNote && <span className="text-gray-600 ml-1">({(log as SessionLog).details.actionNote})</span>}
                                    </div>
                                  )}
                                  {log.log_type === 'acupoint_added' && (
                                    <div className="text-sm text-gray-800">
                                      <Badge variant="secondary" className="bg-green-100 text-green-800 mr-2">Acupoint</Badge>
                                      Added Acupoint: <span className="font-semibold">{(log as SessionLog).details?.acupointName}</span>
                                      {(log as SessionLog).details?.channel && <span className="text-gray-600 ml-1">({(log as SessionLog).details.channel})</span>}
                                    </div>
                                  )}
                                  {log.log_type === 'chakra_selected' && (
                                    <div className="text-sm text-gray-800">
                                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 mr-2">Chakra</Badge>
                                      Selected Chakra: <span className="font-semibold">{(log as SessionLog).details?.chakraName}</span>
                                      {(log as SessionLog).details?.emotionalThemes && (log as SessionLog).details.emotionalThemes.length > 0 && <span className="text-gray-600 ml-1">({(log as SessionLog).details.emotionalThemes.join(', ')})</span>}
                                    </div>
                                  )}
                                </>
                              ) : ( // It's a muscle strength log
                                <div className="text-sm text-gray-800">
                                  <Badge variant="secondary" className={(log as SessionMuscleLog).is_strong ? "bg-green-100 text-green-800 mr-2" : "bg-red-100 text-red-800 mr-2"}>Muscle Test</Badge>
                                  Muscle <span className="font-semibold">{(log as SessionMuscleLog).muscle_name}</span> tested <span className={(log as SessionMuscleLog).is_strong ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>{(log as SessionMuscleLog).is_strong ? 'Strong' : 'Weak'}</span>.
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteLogEntry(log.id, log.log_type_discriminator)}
                              disabled={deletingSessionLog}
                              className="flex-shrink-0"
                            >
                              <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Complete Session Button */}
                <Button
                  className="w-full h-12 text-lg bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleCompleteSession}
                  disabled={updatingAppointment}
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  {updatingAppointment ? 'Completing...' : 'Complete Session'}
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
          </div>
        </div>
      );
    };

    export default ActiveSession;