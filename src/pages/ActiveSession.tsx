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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'; // Keep Dialog for now, might be needed for other things
import { Input } from '@/components/ui/input';
import { Calendar, User, Star, Target, Clock, Settings, AlertCircle, Check, ChevronsUpDown, Lightbulb, Hand, XCircle, PlusCircle, Search, Trash2, Info, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import MuscleSelector from '@/components/MuscleSelector';
import ChakraSelector from '@/components/ChakraSelector';
import ChannelDashboard from '@/components/ChannelDashboard';
import NotionPageViewer from '@/components/NotionPageViewer'; // Import NotionPageViewer
import SessionLogDisplay from '@/components/SessionLogDisplay';
import AcupointSelector from '@/components/AcupointSelector'; // Import new AcupointSelector
import ModeSelect from '@/components/ModeSelect'; // Import new ModeSelect component
import SessionSummaryDisplay from '@/components/SessionSummaryDisplay'; // Import new SessionSummaryDisplay component
import ModeDetailsPanel from '@/components/ModeDetailsPanel'; // Import new ModeDetailsPanel component
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'; // Import Tabs components

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
  const [sessionSelectedModes, setSessionSelectedModes] = useState<Mode[]>([]); // Changed to array

  // Selector States for Summary Display
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);
  const [selectedChakra, setSelectedChakra] = useState<Chakra | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedAcupoint, setSelectedAcupoint] = useState<Acupoint | null>(null);

  // Session Logs States
  const [sessionLogs, setSessionLogs] = useState<GetSessionLogsResponse['sessionLogs']>([]);
  const [sessionMuscleLogs, setSessionMuscleLogs] = useState<GetSessionLogsResponse['sessionMuscleLogs']>([]);

  // Tab and Notion Page Viewer States
  const [activeTab, setActiveTab] = useState('overview'); // Default active tab
  const [selectedNotionPageId, setSelectedNotionPageId] = useState<string | null>(null); // Centralized Notion page ID
  const [selectedNotionPageTitle, setSelectedNotionPageTitle] = useState<string | null>(null); // Title for Notion Page Viewer
  const [selectedModeForDetailsPanel, setSelectedModeForDetailsPanel] = useState<Mode | null>(null); // For custom mode details panel

  // --- Supabase Edge Function Hooks (Declared first to resolve TS2448) ---

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
      onSuccess: useCallback((data: GetSingleAppointmentResponse) => {
        setAppointment(data.appointment);
        setSessionAnchorText(data.appointment.sessionAnchor || '');
        setSessionNorthStarText(data.appointment.sessionNorthStar || '');
      }, []),
      onError: useCallback((msg: string, errorCode?: string) => {
        showError(msg);
        if (errorCode === 'PROFILE_NOT_FOUND' || errorCode === 'PRACTITIONER_NAME_MISSING') {
          navigate('/profile-setup');
        } else if (errorCode === 'NOTION_CONFIG_NOT_FOUND') {
          // Handled by needsConfig state
        }
      }, [navigate]),
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
      onSuccess: useCallback(() => {
        showSuccess('Appointment updated in Notion.');
        // Re-fetch appointment to ensure UI is in sync with Notion after update
        if (appointmentId) {
          fetchSingleAppointment({ appointmentId });
        }
      }, [appointmentId, fetchSingleAppointment]),
      onError: useCallback((msg: string) => {
        showError(`Update Failed: ${msg}`);
      }, []),
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
      onSuccess: useCallback((data: GetSessionLogsResponse) => {
        setSessionLogs(data.sessionLogs);
        setSessionMuscleLogs(data.sessionMuscleLogs);
      }, []),
      onError: useCallback((msg: string) => {
        showError(`Failed to load session logs: ${msg}`);
      }, []),
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
      onSuccess: useCallback((data: any) => {
        console.log('Muscle strength logged to Supabase:', data.logId);
        showSuccess('Muscle strength logged.');
        if (appointmentId) {
          fetchSessionLogs({ appointmentId }); // Refresh logs after successful log
        }
      }, [appointmentId, fetchSessionLogs]),
      onError: useCallback((msg: string) => {
        console.error('Failed to log muscle strength to Supabase:', msg);
        showError(`Logging Failed: ${msg}`);
      }, []),
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
      onSuccess: useCallback((data: DeleteSessionLogResponse) => {
        showSuccess('Log entry deleted.');
        if (appointmentId) {
          fetchSessionLogs({ appointmentId }); // Refresh logs after deletion
        }
      }, [appointmentId, fetchSessionLogs]),
      onError: useCallback((msg: string) => {
        showError(`Failed to delete log: ${msg}`);
      }, []),
    }
  );

  // New: Clear All Session Logs
  const {
    loading: clearingAllLogs,
    execute: clearAllSessionLogs,
  } = useSupabaseEdgeFunction<{ appointmentId: string }, { success: boolean }>(
    'clear-session-logs', // New edge function name
    {
      requiresAuth: true,
      onSuccess: useCallback(() => {
        showSuccess('All session logs cleared.');
        if (appointmentId) {
          fetchSessionLogs({ appointmentId }); // Refresh logs after clearing
        }
      }, [appointmentId, fetchSessionLogs]),
      onError: useCallback((msg: string) => {
        showError(`Failed to clear all logs: ${msg}`);
      }, []),
    }
  );

  // --- Effects ---

  useEffect(() => {
    if (appointmentId) {
      fetchSingleAppointment({ appointmentId });
      fetchSessionLogs({ appointmentId }); // Fetch logs on component mount
    }
  }, [appointmentId, fetchSingleAppointment, fetchSessionLogs]);

  // Clear Notion page viewer when switching tabs
  useEffect(() => {
    if (activeTab !== 'notion-page') {
      setSelectedNotionPageId(null);
      setSelectedNotionPageTitle(null);
    }
    // Clear selected mode for details panel if not on that tab
    if (activeTab !== 'mode-details') {
      setSelectedModeForDetailsPanel(null);
    }
  }, [activeTab]);

  // Combine all loading states
  const overallLoading = loadingAppointment || loggingMuscleStrength || loadingSessionLogs || deletingSessionLog || clearingAllLogs;
  // Combine all needsConfig states
  const overallNeedsConfig = appointmentNeedsConfig; // Other selectors handle their own needsConfig
  // Combine all errors for initial display
  const overallError = appointmentError || sessionLogsError; // Other selectors handle their own errors

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

  const handleModesChanged = useCallback((modes: Mode[]) => {
    setSessionSelectedModes(modes);
  }, []);

  const handleMuscleSelected = useCallback((muscle: Muscle | null) => {
    setSelectedMuscle(muscle);
  }, []);

  const handleMuscleStrengthLogged = useCallback(async (muscle: Muscle, isStrong: boolean, notes: string) => {
    if (appointmentId) {
      await logMuscleStrength({
        appointmentId: appointmentId,
        muscleId: muscle.id,
        muscleName: muscle.name,
        isStrong: isStrong,
        notes: notes, // Pass notes here
      });
    }
  }, [appointmentId, logMuscleStrength]);

  const handleChakraSelected = useCallback((chakra: Chakra | null) => {
    setSelectedChakra(chakra);
  }, []);

  const handleChannelSelected = useCallback((channel: Channel | null) => {
    setSelectedChannel(channel);
  }, []);

  const handleAcupointSelected = useCallback((acupoint: Acupoint | null) => {
    setSelectedAcupoint(acupoint);
  }, []);

  const handleLogSuccess = useCallback(() => {
    if (appointmentId) {
      fetchSessionLogs({ appointmentId }); // Refresh logs after any item is logged
    }
  }, [appointmentId, fetchSessionLogs]);

  // Centralized handler for opening Notion pages
  const handleOpenNotionPage = useCallback((pageId: string, pageTitle: string) => {
    setSelectedNotionPageId(pageId);
    setSelectedNotionPageTitle(pageTitle);
    setActiveTab('notion-page'); // Switch to the Notion Page tab
  }, []);

  // New handler for opening custom Mode Details Panel
  const handleOpenModeDetailsPanel = useCallback((mode: Mode) => {
    setSelectedModeForDetailsPanel(mode);
    setActiveTab('mode-details'); // Switch to the new Mode Details tab
  }, []);

  const handleClearAllSessionLogs = useCallback(async () => {
    if (appointmentId && confirm('Are you sure you want to clear ALL logs for this session? This action cannot be undone.')) {
      await clearAllSessionLogs({ appointmentId });
    }
  }, [appointmentId, clearAllSessionLogs]);

  // --- Render Logic ---

  if (overallLoading && !appointment) { // Only show full loading skeleton if no appointment data yet
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6 flex items-center justify-center">
        <div className="max-w-4xl mx-auto space-y-6 w-full">
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
            <h2 className="xl font-bold mb-2">Error Loading Appointment</h2>
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
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-900 mb-2">Active Session</h1>
          <p className="text-gray-600">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {appointment ? (
          <>
            {/* Session Summary Display (Sticky) */}
            <SessionSummaryDisplay
              sessionLogs={sessionLogs}
              sessionMuscleLogs={sessionMuscleLogs}
              sessionSelectedModes={sessionSelectedModes} // Pass the array
              selectedMuscle={selectedMuscle}
              selectedChakra={selectedChakra}
              selectedChannel={selectedChannel}
              selectedAcupoint={selectedAcupoint}
              sessionNorthStar={sessionNorthStarText}
              sessionAnchor={sessionAnchorText}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 md:grid-cols-7 lg:grid-cols-8 h-auto flex-wrap"> {/* Adjusted grid-cols */}
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="muscles">Muscles</TabsTrigger>
                <TabsTrigger value="chakras">Chakras</TabsTrigger>
                <TabsTrigger value="channels">Channels</TabsTrigger>
                <TabsTrigger value="acupoints">Acupoints</TabsTrigger>
                <TabsTrigger value="session-log">Session Log</TabsTrigger>
                <TabsTrigger value="notion-page">Notion Page</TabsTrigger>
                <TabsTrigger value="mode-details">Mode Details</TabsTrigger> {/* New Tab */}
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-6 space-y-6">
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
                      <ModeSelect
                        appointmentId={appointmentId!}
                        onModesChanged={handleModesChanged} // Pass the new handler
                        onOpenNotionPage={handleOpenNotionPage}
                        onLogSuccess={handleLogSuccess}
                        onOpenModeDetailsPanel={handleOpenModeDetailsPanel} // Pass new handler
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Muscles Tab */}
              <TabsContent value="muscles" className="mt-6 space-y-6">
                <MuscleSelector
                  onMuscleSelected={handleMuscleSelected}
                  onMuscleStrengthLogged={handleMuscleStrengthLogged}
                  appointmentId={appointmentId || ''}
                  onClearSelection={() => setSelectedMuscle(null)} // Clear selected muscle in parent
                  onOpenNotionPage={handleOpenNotionPage} // Pass centralized handler
                />
              </TabsContent>

              {/* Chakras Tab */}
              <TabsContent value="chakras" className="mt-6 space-y-6">
                <ChakraSelector
                  appointmentId={appointmentId || ''}
                  onChakraSelected={handleChakraSelected}
                  onClearSelection={() => setSelectedChakra(null)} // Clear selected chakra in parent
                  selectedChakra={selectedChakra}
                  onOpenNotionPage={handleOpenNotionPage} // Pass centralized handler
                />
              </TabsContent>

              {/* Channels Tab */}
              <TabsContent value="channels" className="mt-6 space-y-6">
                <ChannelDashboard
                  appointmentId={appointmentId || ''}
                  onLogSuccess={handleLogSuccess}
                  onClearSelection={() => setSelectedChannel(null)} // Clear selected channel in parent
                  onOpenNotionPage={handleOpenNotionPage} // Pass centralized handler
                  onChannelSelected={handleChannelSelected} // Pass new prop
                />
              </TabsContent>

              {/* Acupoints Tab */}
              <TabsContent value="acupoints" className="mt-6 space-y-6">
                <AcupointSelector
                  appointmentId={appointmentId || ''}
                  onLogSuccess={handleLogSuccess}
                  onClearSelection={() => setSelectedAcupoint(null)}
                  onOpenNotionPage={handleOpenNotionPage}
                  onAcupointSelected={handleAcupointSelected} // Pass new prop
                />
              </TabsContent>

              {/* Session Log Tab */}
              <TabsContent value="session-log" className="mt-6 space-y-6">
                <SessionLogDisplay
                  appointmentId={appointmentId || ''}
                  sessionLogs={sessionLogs}
                  sessionMuscleLogs={sessionMuscleLogs}
                  onDeleteLog={deleteSessionLog}
                  deletingLog={deletingSessionLog}
                  onClearAllLogs={handleClearAllSessionLogs} // Pass new handler
                  clearingAllLogs={clearingAllLogs} // Pass new loading state
                />
              </TabsContent>

              {/* Notion Page Tab */}
              <TabsContent value="notion-page" className="mt-6 space-y-6">
                <Card className="shadow-xl">
                  <CardHeader className="bg-indigo-50 border-b border-indigo-200 rounded-t-lg p-4">
                    <CardTitle className="text-xl font-bold text-indigo-800 flex items-center gap-2">
                      <Info className="w-5 h-5" />
                      {selectedNotionPageTitle || "Notion Page Viewer"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <NotionPageViewer pageId={selectedNotionPageId} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Custom Mode Details Tab */}
              <TabsContent value="mode-details" className="mt-6 space-y-6">
                <ModeDetailsPanel selectedMode={selectedModeForDetailsPanel} />
              </TabsContent>

              {/* Complete Session Button (outside tabs, always visible) */}
              <Button
                className="w-full h-12 text-lg bg-red-500 hover:bg-red-600 text-white mt-6"
                onClick={handleCompleteSession}
                disabled={updatingAppointment}
              >
                <XCircle className="w-5 h-5 mr-2" />
                Complete Session
              </Button>
            </Tabs>
          </>
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