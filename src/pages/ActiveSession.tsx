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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Calendar, User, Star, Target, Clock, Settings, AlertCircle, Check, ChevronsUpDown, Lightbulb, Hand, XCircle, PlusCircle, Search, Trash2, Info, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import MuscleSelector from '@/components/MuscleSelector';
import ChakraSelector from '@/components/ChakraSelector';
import ChannelDashboard from '@/components/ChannelDashboard';
import NotionPageViewer from '@/components/NotionPageViewer';
import SessionLogDisplay from '@/components/SessionLogDisplay';
import AcupointSelector from '@/components/AcupointSelector';
import ModeSelect from '@/components/ModeSelect';
import SessionSummaryDisplay from '@/components/SessionSummaryDisplay';
import ModeDetailsPanel from '@/components/ModeDetailsPanel';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { useCachedEdgeFunction } from '@/hooks/use-cached-edge-function';
import { useNotionConfig } from '@/hooks/use-notion-config';
import {
  Appointment,
  MinimalAppointment,
  Mode,
  Acupoint,
  Muscle,
  Chakra,
  Channel,
  GetSingleAppointmentPayload,
  GetSingleAppointmentResponse,
  UpdateNotionAppointmentPayload,
  UpdateNotionAppointmentResponse,
  LogSessionEventPayload,
  LogSessionEventResponse,
  GetSessionLogsResponse,
  DeleteSessionLogPayload,
  DeleteSessionLogResponse,
  LogMuscleStrengthPayload,
  LogMuscleStrengthResponse,
  GetMusclesResponse,
  GetChakrasResponse,
  GetChannelsResponse,
  GetAcupointsResponse,
} from '@/types/api';

interface ActiveSessionProps {
  mockAppointmentId?: string;
}

const ActiveSession: React.FC<ActiveSessionProps> = ({ mockAppointmentId }) => {
  const params = useParams<{ appointmentId: string }>();
  const actualAppointmentId = mockAppointmentId || params.appointmentId;
  const navigate = useNavigate();

  const { isConfigured: notionConfigured, isLoading: configLoading } = useNotionConfig();

  const [appointment, setAppointment] = useState<MinimalAppointment | null>(null);
  const [sessionAnchorText, setSessionAnchorText] = useState('');
  const [sessionNorthStarText, setSessionNorthStarText] = useState('');
  const [sessionSelectedModes, setSessionSelectedModes] = useState<Mode[]>([]);

  // Selector States for Summary Display
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);
  const [selectedChakra, setSelectedChakra] = useState<Chakra | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedAcupoint, setSelectedAcupoint] = useState<Acupoint | null>(null);

  // Session Logs States
  const [sessionLogs, setSessionLogs] = useState<GetSessionLogsResponse['sessionLogs']>([]);
  const [sessionMuscleLogs, setSessionMuscleLogs] = useState<GetSessionLogsResponse['sessionMuscleLogs']>([]);

  // Tab and Notion Page Viewer States
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedNotionPageId, setSelectedNotionPageId] = useState<string | null>(null);
  const [selectedNotionPageTitle, setSelectedNotionPageTitle] = useState<string | null>(null);
  const [selectedModeForDetailsPanel, setSelectedModeForDetailsPanel] = useState<Mode | null>(null);

  // --- Supabase Edge Function Hooks (Using Cached Version) ---

  // 1. Fetch single appointment
  const {
    data: fetchedAppointmentData,
    loading: loadingAppointment,
    error: appointmentError,
    execute: fetchSingleAppointment,
    isCached: appointmentIsCached,
  } = useCachedEdgeFunction<GetSingleAppointmentPayload, GetSingleAppointmentResponse>(
    'get-single-appointment',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      cacheKey: actualAppointmentId ? `${actualAppointmentId}:appointment` : undefined,
      cacheTtl: 60, // 1 hour cache
      onSuccess: useCallback((data: GetSingleAppointmentResponse) => {
        setAppointment(data.appointment);
        setSessionAnchorText(data.appointment.sessionAnchor || '');
        setSessionNorthStarText(data.appointment.sessionNorthStar || '');
      }, []),
      onError: useCallback((msg: string, errorCode?: string) => {
        showError(msg);
        if (errorCode === 'PROFILE_NOT_FOUND' || errorCode === 'PRACTITIONER_NAME_MISSING') {
          navigate('/profile-setup');
        }
      }, [navigate]),
    }
  );

  // 2. Pre-fetch Muscles
  const {
    data: musclesData,
    loading: loadingMuscles,
    execute: fetchMuscles,
  } = useCachedEdgeFunction<{ searchTerm: string, searchType: 'muscle' | 'meridian' | 'organ' | 'emotion' }, GetMusclesResponse>(
    'get-muscles',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      cacheKey: 'all-muscles',
      cacheTtl: 120,
    }
  );

  // 3. Pre-fetch Chakras
  const {
    data: chakrasData,
    loading: loadingChakras,
    execute: fetchChakras,
  } = useCachedEdgeFunction<{ searchTerm: string, searchType: 'name' | 'element' | 'emotion' | 'organ' }, GetChakrasResponse>(
    'get-chakras',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      cacheKey: 'all-chakras',
      cacheTtl: 120,
    }
  );

  // 4. Pre-fetch Channels
  const {
    data: channelsData,
    loading: loadingChannels,
    execute: fetchChannels,
  } = useCachedEdgeFunction<{ searchTerm: string, searchType: 'name' | 'element' }, GetChannelsResponse>(
    'get-channels',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      cacheKey: 'all-channels',
      cacheTtl: 120,
    }
  );

  // 5. Pre-fetch Acupoints
  const {
    data: acupointsData,
    loading: loadingAcupoints,
    execute: fetchAcupoints,
  } = useCachedEdgeFunction<{ searchTerm: string, searchType: 'point' | 'symptom' }, GetAcupointsResponse>(
    'get-acupoints',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      cacheKey: 'all-acupoints',
      cacheTtl: 120,
    }
  );

  // Update Notion appointment
  const {
    loading: updatingAppointment,
    execute: updateNotionAppointment,
  } = useCachedEdgeFunction<UpdateNotionAppointmentPayload, UpdateNotionAppointmentResponse>(
    'update-notion-appointment',
    {
      requiresAuth: true,
      onSuccess: useCallback(() => {
        showSuccess('Appointment updated in Notion.');
        // Invalidate cache after update
        if (actualAppointmentId) {
          fetchSingleAppointment({ appointmentId: actualAppointmentId });
        }
      }, [actualAppointmentId, fetchSingleAppointment]),
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
  } = useCachedEdgeFunction<{ appointmentId: string }, GetSessionLogsResponse>(
    'get-session-logs',
    {
      requiresAuth: true,
      cacheKey: actualAppointmentId ? `${actualAppointmentId}:logs` : undefined,
      cacheTtl: 5, // 5 minutes cache for logs
      onSuccess: useCallback((data: GetSessionLogsResponse) => {
        setSessionLogs(data.sessionLogs);
        setSessionMuscleLogs(data.sessionMuscleLogs);
      }, []),
      onError: useCallback((msg: string) => {
        showError(`Failed to load session logs: ${msg}`);
      }, []),
    }
  );

  // Log Muscle Strength
  const {
    loading: loggingMuscleStrength,
    execute: logMuscleStrength,
  } = useCachedEdgeFunction<LogMuscleStrengthPayload, LogMuscleStrengthResponse>(
    'log-muscle-strength',
    {
      requiresAuth: true,
      onSuccess: useCallback((data: LogMuscleStrengthResponse) => {
        console.log('Muscle strength logged to Supabase:', data.logId);
        showSuccess('Muscle strength logged.');
        if (actualAppointmentId) {
          fetchSessionLogs({ appointmentId: actualAppointmentId });
        }
      }, [actualAppointmentId, fetchSessionLogs]),
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
  } = useCachedEdgeFunction<DeleteSessionLogPayload, DeleteSessionLogResponse>(
    'delete-session-log',
    {
      requiresAuth: true,
      onSuccess: useCallback((data: DeleteSessionLogResponse) => {
        showSuccess('Log entry deleted.');
        if (actualAppointmentId) {
          fetchSessionLogs({ appointmentId: actualAppointmentId });
        }
      }, [actualAppointmentId, fetchSessionLogs]),
      onError: useCallback((msg: string) => {
        showError(`Failed to delete log: ${msg}`);
      }, []),
    }
  );

  // Clear All Session Logs
  const {
    loading: clearingAllLogs,
    execute: clearAllSessionLogs,
  } = useCachedEdgeFunction<{ appointmentId: string }, { success: boolean }>(
    'clear-session-logs',
    {
      requiresAuth: true,
      onSuccess: useCallback(() => {
        showSuccess('All session logs cleared.');
        if (actualAppointmentId) {
          fetchSessionLogs({ appointmentId: actualAppointmentId });
        }
      }, [actualAppointmentId, fetchSessionLogs]),
      onError: useCallback((msg: string) => {
        showError(`Failed to clear all logs: ${msg}`);
      }, []),
    }
  );

  // --- Effects ---

  useEffect(() => {
    if (actualAppointmentId && notionConfigured) {
      fetchSingleAppointment({ appointmentId: actualAppointmentId });
      fetchSessionLogs({ appointmentId: actualAppointmentId });
      
      // --- PRE-FETCH REFERENCE DATA ---
      // These calls will hit the cache if data is present, or fetch and cache if not.
      // They run in the background and don't block the main appointment load.
      fetchMuscles({ searchTerm: '', searchType: 'muscle' });
      fetchChakras({ searchTerm: '', searchType: 'name' });
      fetchChannels({ searchTerm: '', searchType: 'name' });
      fetchAcupoints({ searchTerm: '', searchType: 'point' });
      // --------------------------------
    }
  }, [actualAppointmentId, notionConfigured, fetchSingleAppointment, fetchSessionLogs, fetchMuscles, fetchChakras, fetchChannels, fetchAcupoints]);

  // Clear Notion page viewer when switching tabs
  useEffect(() => {
    if (activeTab !== 'notion-page') {
      setSelectedNotionPageId(null);
      setSelectedNotionPageTitle(null);
    }
    if (activeTab !== 'mode-details') {
      setSelectedModeForDetailsPanel(null);
    }
  }, [activeTab]);

  // Combine all loading states
  const overallLoading = configLoading || loadingAppointment || loggingMuscleStrength || loadingSessionLogs || deletingSessionLog || clearingAllLogs;
  // Combine all errors for initial display
  const overallError = appointmentError || sessionLogsError;

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
      await updateNotionAppointment({ appointmentId: appointment.id, updates: { status: 'CH' } });
      if (!updatingAppointment) {
        showSuccess(`${appointment.clientName}'s session marked as complete.`);
        navigate('/');
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
    if (actualAppointmentId) {
      await logMuscleStrength({
        appointmentId: actualAppointmentId,
        muscleId: muscle.id,
        muscleName: muscle.name,
        isStrong: isStrong,
        notes: notes || null,
      });
    }
  }, [actualAppointmentId, logMuscleStrength]);

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
    if (actualAppointmentId) {
      fetchSessionLogs({ appointmentId: actualAppointmentId });
    }
  }, [actualAppointmentId, fetchSessionLogs]);

  const handleOpenNotionPage = useCallback((pageId: string, pageTitle: string) => {
    setSelectedNotionPageId(pageId);
    setSelectedNotionPageTitle(pageTitle);
    setActiveTab('notion-page');
  }, []);

  const handleOpenModeDetailsPanel = useCallback((mode: Mode) => {
    setSelectedModeForDetailsPanel(mode);
    setActiveTab('mode-details');
  }, []);

  const handleClearAllSessionLogs = useCallback(async () => {
    if (actualAppointmentId && confirm('Are you sure you want to clear ALL logs for this session? This action cannot be undone.')) {
      await clearAllSessionLogs({ appointmentId: actualAppointmentId });
    }
  }, [actualAppointmentId, clearAllSessionLogs]);

  const handleClearSummaryItem = useCallback(async (type: string, id?: string) => {
    if (!id && (type === 'mode' || type === 'logged mode')) return; // Modes require an ID to clear

    switch (type) {
      case 'muscle':
        setSelectedMuscle(null);
        break;
      case 'chakra':
        setSelectedChakra(null);
        break;
      case 'channel':
        setSelectedChannel(null);
        break;
      case 'acupoint':
        setSelectedAcupoint(null);
        break;
      case 'mode':
        setSessionSelectedModes(prev => prev.filter(mode => mode.id !== id));
        // If the mode being cleared was the one displayed in the details panel, clear that too
        if (selectedModeForDetailsPanel?.id === id) {
          setSelectedModeForDetailsPanel(null);
        }
        break;
      default:
        // For logged items, we just clear the selection state if it was set, but generally,
        // logged items are cleared via the Session Log tab.
        break;
    }
  }, [selectedModeForDetailsPanel]);

  // --- Render Logic ---

  if (overallLoading && !appointment) {
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

  if (!notionConfigured) {
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

  if (overallError && !appointment) {
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
              <Button onClick={() => fetchSingleAppointment({ appointmentId: actualAppointmentId! })}>Try Again</Button>
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
          <h1 className="text-3xl font-bold text-indigo-900 mb-2 flex items-center justify-center gap-3">
            Active Session
            {mockAppointmentId && <Badge variant="destructive" className="ml-3">DEBUG MODE</Badge>}
          </h1>
          <p className="text-gray-600">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
          <div className="mt-2">
            <SyncStatusIndicator onSyncComplete={() => {
              // Refresh data after sync
              if (actualAppointmentId) {
                fetchSingleAppointment({ appointmentId: actualAppointmentId });
              }
            }} />
          </div>
        </div>

        {appointment ? (
          <>
            {/* Session Summary Display (Sticky) */}
            <SessionSummaryDisplay
              sessionLogs={sessionLogs}
              sessionMuscleLogs={sessionMuscleLogs}
              sessionSelectedModes={sessionSelectedModes}
              selectedMuscle={selectedMuscle}
              selectedChakra={selectedChakra}
              selectedChannel={selectedChannel}
              selectedAcupoint={selectedAcupoint}
              sessionNorthStar={sessionNorthStarText}
              sessionAnchor={sessionAnchorText}
              appointmentId={actualAppointmentId || ''}
              onClearItem={handleClearSummaryItem}
              onLogSuccess={handleLogSuccess}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 md:grid-cols-7 lg:grid-cols-8 h-auto flex-wrap">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="muscles">Muscles</TabsTrigger>
                <TabsTrigger value="chakras">Chakras</TabsTrigger>
                <TabsTrigger value="channels">Channels</TabsTrigger>
                <TabsTrigger value="acupoints">Acupoints</TabsTrigger>
                <TabsTrigger value="session-log">Session Log</TabsTrigger>
                <TabsTrigger value="notion-page">Notion Page</TabsTrigger>
                <TabsTrigger value="mode-details">Mode Details</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-6 space-y-6">
                {/* Client Insight Card */}
                <Card className="shadow-xl border-2 border-indigo-200">
                  <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg p-4">
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      <User className="w-6 h-6" />
                      {appointment.clientName}
                      {appointmentIsCached && (
                        <Badge variant="secondary" className="bg-green-200 text-green-800 ml-2">
                          Cached
                        </Badge>
                      )}
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
                        appointmentId={actualAppointmentId || ''}
                        onModesChanged={handleModesChanged}
                        onOpenNotionPage={handleOpenNotionPage}
                        onLogSuccess={handleLogSuccess}
                        onOpenModeDetailsPanel={handleOpenModeDetailsPanel}
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
                  appointmentId={actualAppointmentId || ''}
                  onClearSelection={() => setSelectedMuscle(null)}
                  onOpenNotionPage={handleOpenNotionPage}
                  initialMuscles={musclesData?.muscles}
                  loadingInitial={loadingMuscles}
                />
              </TabsContent>

              {/* Chakras Tab */}
              <TabsContent value="chakras" className="mt-6 space-y-6">
                <ChakraSelector
                  appointmentId={actualAppointmentId || ''}
                  onChakraSelected={handleChakraSelected}
                  onClearSelection={() => setSelectedChakra(null)}
                  selectedChakra={selectedChakra}
                  onOpenNotionPage={handleOpenNotionPage}
                  initialChakras={chakrasData?.chakras}
                  loadingInitial={loadingChakras}
                />
              </TabsContent>

              {/* Channels Tab */}
              <TabsContent value="channels" className="mt-6 space-y-6">
                <ChannelDashboard
                  appointmentId={actualAppointmentId || ''}
                  onLogSuccess={handleLogSuccess}
                  onClearSelection={() => setSelectedChannel(null)}
                  onOpenNotionPage={handleOpenNotionPage}
                  onChannelSelected={handleChannelSelected}
                  initialChannels={channelsData?.channels}
                  loadingInitial={loadingChannels}
                />
              </TabsContent>

              {/* Acupoints Tab */}
              <TabsContent value="acupoints" className="mt-6 space-y-6">
                <AcupointSelector
                  appointmentId={actualAppointmentId || ''}
                  onLogSuccess={handleLogSuccess}
                  onClearSelection={() => setSelectedAcupoint(null)}
                  onOpenNotionPage={handleOpenNotionPage}
                  onAcupointSelected={handleAcupointSelected}
                  initialAcupoints={acupointsData?.acupoints}
                  loadingInitial={loadingAcupoints}
                />
              </TabsContent>

              {/* Session Log Tab */}
              <TabsContent value="session-log" className="mt-6 space-y-6">
                <SessionLogDisplay
                  appointmentId={actualAppointmentId || ''}
                  sessionLogs={sessionLogs}
                  sessionMuscleLogs={sessionMuscleLogs}
                  onDeleteLog={deleteSessionLog}
                  deletingLog={deletingSessionLog}
                  onClearAllLogs={handleClearAllSessionLogs}
                  clearingAllLogs={clearingAllLogs}
                />
              </TabsContent>

              {/* Notion Page Tab */}
              <TabsContent value="notion-page" className="mt-6 space-y-6">
                <NotionPageViewer pageId={selectedNotionPageId} />
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
                {mockAppointmentId ? "Debug Session Initialized" : "No Active Session"}
              </h2>
              <p className="text-gray-500">
                {mockAppointmentId ? "Attempting to load mock appointment data. If this fails, ensure your Notion configuration is correct and a test appointment exists with ID 'debug-session-id' if you want to test data interaction." : "No session is currently active. Please select one from the Waiting Room."}
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