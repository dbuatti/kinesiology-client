"use client";

    import React, { useState, useEffect, useCallback } from 'react';
    import { useNavigate } from 'react-router-dom';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Skeleton } from '@/components/ui/skeleton';
    import { Textarea } from '@/components/ui/textarea';
    import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
    import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
    import { Label } from '@/components/ui/label';
    import { Calendar, User, Star, Target, Clock, Settings, AlertCircle, Check, ChevronsUpDown, Lightbulb, Hand, XCircle } from 'lucide-react';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/integrations/supabase/client';
    import { cn } from '@/lib/utils';

    interface Appointment {
      id: string; // Notion page ID
      clientName: string;
      starSign: string;
      focus: string; // Session North Star
      goal: string;
      sessionAnchor: string; // Today we are really working with...
      bodyYes: boolean;
      bodyNo: boolean;
    }

    interface Mode {
      id: string;
      name: string;
      actionNote: string;
    }

    const ActiveSession = () => {
      const [appointment, setAppointment] = useState<Appointment | null>(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [needsConfig, setNeedsConfig] = useState(false);
      const [sessionAnchorText, setSessionAnchorText] = useState('');
      const [modes, setModes] = useState<Mode[]>([]);
      const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
      const [isModeSelectOpen, setIsModeSelectOpen] = useState(false);
      const [bodyYesState, setBodyYesState] = useState(false);
      const [bodyNoState, setBodyNoState] = useState(false);
      const navigate = useNavigate();
      const { toast } = useToast();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcriagmovotwuqbppcfm.supabase.co';

      const fetchTodaysAppointment = useCallback(async () => {
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

          // Check if user has Notion secrets configured
          const { data: secrets, error: secretsError } = await supabase
            .from('notion_secrets')
            .select('id')
            .eq('user_id', session.user.id)
            .single();

          if (secretsError && secretsError.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine if user hasn't configured yet
            throw secretsError;
          }
          if (!secrets) {
            setNeedsConfig(true);
            setLoading(false);
            return;
          }

          const response = await fetch(
            `${supabaseUrl}/functions/v1/get-todays-appointments`,
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
            if (errorData.errorCode === 'PROFILE_NOT_FOUND' || errorData.errorCode === 'PRACTITIONER_NAME_MISSING') {
              toast({
                variant: 'destructive',
                title: 'Profile Required',
                description: errorData.error || 'Please complete your profile to access sessions.',
              });
              navigate('/profile-setup');
              return;
            }
            throw new Error(errorData.error || 'Failed to fetch appointments');
          }

          const data = await response.json();

          if (data.appointments && data.appointments.length > 0) {
            const fetchedAppointment = data.appointments[0];
            setAppointment(fetchedAppointment);
            setSessionAnchorText(fetchedAppointment.sessionAnchor || '');
            setBodyYesState(fetchedAppointment.bodyYes);
            setBodyNoState(fetchedAppointment.bodyNo);
          } else {
            setAppointment(null);
          }
        } catch (err: any) {
          console.error('Error fetching appointment:', err);
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

      const fetchModes = useCallback(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          const response = await fetch(
            `${supabaseUrl}/functions/v1/get-notion-modes`,
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
            throw new Error(errorData.error || 'Failed to fetch modes');
          }

          const data = await response.json();
          setModes(data.modes);
        } catch (err: any) {
          console.error('Error fetching modes:', err);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: `Failed to load modes: ${err.message}`
          });
        }
      }, [toast, supabaseUrl]);

      useEffect(() => {
        fetchTodaysAppointment();
        fetchModes();
      }, [fetchTodaysAppointment, fetchModes]);

      const updateNotionAppointment = useCallback(async (updates: any) => {
        if (!appointment?.id) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No active appointment to update.'
          });
          return;
        }

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
                appointmentId: appointment.id,
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
          // Re-fetch appointment to get latest state, or update local state
          // For now, let's update local state for immediate feedback
          setAppointment(prev => prev ? { ...prev, ...updates } : null);
          if (updates.sessionAnchor !== undefined) setSessionAnchorText(updates.sessionAnchor);
          if (updates.bodyYes !== undefined) setBodyYesState(updates.bodyYes);
          if (updates.bodyNo !== undefined) setBodyNoState(updates.bodyNo);

        } catch (err: any) {
          console.error('Error updating Notion appointment:', err);
          toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: err.message
          });
        }
      }, [appointment, navigate, toast, supabaseUrl]);

      const handleSessionAnchorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setSessionAnchorText(newText);
        // Debounce or save on blur for performance
        // For now, let's save on blur
      };

      const handleSessionAnchorBlur = () => {
        if (appointment && sessionAnchorText !== appointment.sessionAnchor) {
          updateNotionAppointment({ sessionAnchor: sessionAnchorText });
        }
      };

      const handleToggleBodyYes = () => {
        const newState = !bodyYesState;
        setBodyYesState(newState);
        setBodyNoState(false); // Ensure only one is active
        updateNotionAppointment({ bodyYes: newState, bodyNo: false });
      };

      const handleToggleBodyNo = () => {
        const newState = !bodyNoState;
        setBodyNoState(newState);
        setBodyYesState(false); // Ensure only one is active
        updateNotionAppointment({ bodyYes: false, bodyNo: newState });
      };

      const handleCompleteSession = () => {
        if (appointment) {
          updateNotionAppointment({ status: 'CH' }); // Set status to Charged/Complete
          toast({
            title: 'Session Completed',
            description: `${appointment.clientName}'s session marked as complete.`,
          });
          navigate('/active-session'); // Refresh to show no active session
        }
      };

      const handleConfigureNotion = () => {
        navigate('/notion-config');
      };

      if (loading) {
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

      if (error && !appointment) {
        return (
          <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
            <Card className="max-w-md w-full shadow-lg">
              <CardContent className="pt-6 text-center">
                <div className="text-red-500 mb-4">
                  <AlertCircle className="w-12 h-12 mx-auto" />
                </div>
                <h2 className="text-xl font-bold mb-2">Error Loading Appointment</h2>
                <p className="text-gray-600 mb-4">{error}</p>
                <div className="space-y-2">
                  <Button onClick={fetchTodaysAppointment}>Try Again</Button>
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
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
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
                      <span className="font-medium">{appointment.starSign}</span>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-6 space-y-4">
                    {appointment.focus && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Target className="w-4 h-4 text-indigo-600" />
                          <span>Session North Star (Client Focus)</span>
                        </div>
                        <p className="text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">
                          {appointment.focus}
                        </p>
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

                    {/* Muscle Testing Toggles */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 font-semibold text-gray-700">
                        <Hand className="w-4 h-4 text-indigo-600" />
                        Muscle Testing
                      </Label>
                      <div className="grid grid-cols-2 gap-4">
                        <Button
                          className={cn(
                            "h-20 text-xl font-bold transition-all duration-200",
                            bodyYesState
                              ? "bg-green-600 hover:bg-green-700 text-white shadow-lg scale-105"
                              : "bg-gray-200 hover:bg-gray-300 text-gray-800 border-2 border-gray-300"
                          )}
                          onClick={handleToggleBodyYes}
                        >
                          BODY YES
                        </Button>
                        <Button
                          className={cn(
                            "h-20 text-xl font-bold transition-all duration-200",
                            bodyNoState
                              ? "bg-red-600 hover:bg-red-700 text-white shadow-lg scale-105"
                              : "bg-gray-200 hover:bg-gray-300 text-gray-800 border-2 border-gray-300"
                          )}
                          onClick={handleToggleBodyNo}
                        >
                          BODY NO
                        </Button>
                      </div>
                    </div>

                    {/* Complete Session Button */}
                    <Button
                      className="w-full h-12 text-lg bg-red-500 hover:bg-red-600 text-white"
                      onClick={handleCompleteSession}
                    >
                      <XCircle className="w-5 h-5 mr-2" />
                      Complete Session
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="shadow-lg">
                <CardContent className="pt-8 text-center">
                  <div className="text-gray-400 mb-4">
                    <Calendar className="w-16 h-16 mx-auto" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-700 mb-2">
                    No Sessions Scheduled
                  </h2>
                  <p className="text-gray-500">
                    You don't have any appointments scheduled for today.
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

    export default ActiveSession;