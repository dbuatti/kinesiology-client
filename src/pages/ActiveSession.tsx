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
    import { Calendar, User, Star, Target, Clock, Settings, AlertCircle, Check, ChevronsUpDown, Lightbulb, Hand, XCircle, PlusCircle, Search } from 'lucide-react';
    import { useToast } from '@/components/ui/use-toast';
    import { cn } from '@/lib/utils';
    import { format } from 'date-fns';
    import MuscleSelector from '@/components/MuscleSelector';
    import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
    import {
      Appointment, Mode, Acupoint, Muscle,
      GetSingleAppointmentPayload, GetSingleAppointmentResponse,
      GetNotionModesResponse,
      GetAcupointsPayload, GetAcupointsResponse,
      UpdateNotionAppointmentPayload, UpdateNotionAppointmentResponse,
      LogSessionEventPayload, LogSessionEventResponse
    } from '@/types/api';

    const ActiveSession = () => {
      const { appointmentId } = useParams<{ appointmentId: string }>();
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


      const navigate = useNavigate();
      const { toast } = useToast();

      // Memoized callbacks for fetchSingleAppointment
      const onSingleAppointmentSuccess = useCallback((data: GetSingleAppointmentResponse) => {
        setAppointment(data.appointment);
        setSessionAnchorText(data.appointment.sessionAnchor || '');
        setSessionNorthStarText(data.appointment.sessionNorthStar || '');
      }, []);

      const onSingleAppointmentError = useCallback((msg: string) => {
        toast({ variant: 'destructive', title: 'Error', description: msg });
      }, [toast]);

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
        toast({ variant: 'destructive', title: 'Error', description: `Failed to load modes: ${msg}` });
      }, [toast]);

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
        toast({ variant: 'destructive', title: 'Error', description: `Failed to search: ${msg}` });
        setFoundAcupoints([]);
      }, [toast]);

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
        toast({ title: 'Success', description: 'Appointment updated in Notion.' });
      }, [toast]);

      const onUpdateAppointmentError = useCallback((msg: string) => {
        toast({ variant: 'destructive', title: 'Update Failed', description: msg });
      }, [toast]);

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
          },
          onError: (msg) => {
            console.error('Failed to log session event to Supabase:', msg);
          }
        }
      );

      useEffect(() => {
        if (appointmentId) {
          fetchSingleAppointment({ appointmentId });
          fetchModes();
          // Initial fetch for acupoints when component mounts
          // This will fetch all acupoints if no search term is provided
          fetchAcupoints({ searchTerm: '', searchType: 'point' }); // Or 'symptom', 'point' is more general
        }
      }, [appointmentId, fetchSingleAppointment, fetchModes, fetchAcupoints]); // Added fetchAcupoints to dependencies

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
            toast({
              title: 'Session Completed',
              description: `${appointment.clientName}'s session marked as complete.`,
            });
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
            toast({
              title: 'Acupoint Added',
              description: `${selectedAcupoint.name} added to the current session.`,
            });
            // Optionally clear selected acupoint after adding
            setSelectedAcupoint(null);
            setAcupointSearchTerm('');
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No acupoint selected to add to session.',
          });
        }
      };

      const handleMuscleSelected = (muscle: Muscle) => {
        setSelectedMuscle(muscle);
        console.log('Muscle selected:', muscle.name);
      };

      const handleSelectMode = (mode: Mode) => {
        setSelectedMode(mode);
        setIsModeSelectOpen(false);
        if (appointmentId) {
          logSessionEvent({
            appointmentId: appointmentId,
            logType: 'mode_selected',
            details: {
              modeId: mode.id,
              modeName: mode.name,
              actionNote: mode.actionNote,
            }
          });
        }
      };

      if (loadingAppointment || loadingModes || loadingAcupoints) {
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
                              <Button
                                className="w-full mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                                onClick={handleAddAcupointToSession}
                                disabled={updatingAppointment || loggingSessionEvent}
                              >
                                <PlusCircle className="w-4 h-4 mr-2" />
                                {updatingAppointment || loggingSessionEvent ? 'Adding...' : 'Add to Session'}
                              </Button>
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
                  appointmentId={appointmentId || ''}
                />

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