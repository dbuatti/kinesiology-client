"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Settings, AlertCircle, PlayCircle, User, Star, Target, Lightbulb, Loader2, RefreshCw } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { format } from 'date-fns';
import { useCachedEdgeFunction } from '@/hooks/use-cached-edge-function';
import { useNotionConfig } from '@/hooks/use-notion-config';
import { useReferenceData } from '@/hooks/use-reference-data'; // Import centralized hook
import { Appointment, GetTodaysAppointmentsResponse, UpdateNotionAppointmentPayload, UpdateNotionAppointmentResponse, GetTodaysAppointmentsPayload } from '@/types/api';
import CreateAppointmentDialog from '@/components/CreateAppointmentDialog';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import { Badge } from '@/components/ui/badge';

const WaitingRoom = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const navigate = useNavigate();

  // Use reference data hook for configuration status check
  const { loading: loadingReferenceData, needsConfig: referenceNeedsConfig } = useReferenceData();
  const { isConfigured: notionConfigured, isLoading: configLoading } = useNotionConfig();

  const handleSuccess = useCallback((data: GetTodaysAppointmentsResponse) => {
    console.log('[WaitingRoom] Received appointments data:', data.appointments);
    setAppointments(data.appointments);
  }, []);

  const handleError = useCallback((msg: string, code?: string) => {
    if (code === 'PROFILE_NOT_FOUND' || code === 'PRACTITIONER_NAME_MISSING') {
      // Navigation handled by hook's onError
    } else {
      showError(msg);
    }
  }, []);

  const {
    data: fetchedAppointmentsData,
    loading: loadingAppointments,
    error: appointmentsError,
    execute: fetchTodaysAppointments,
    isCached: appointmentsIsCached,
  } = useCachedEdgeFunction<GetTodaysAppointmentsPayload, GetTodaysAppointmentsResponse>(
    'get-todays-appointments',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      cacheKey: 'todays-appointments',
      cacheTtl: 15, // 15 minutes cache
      onSuccess: handleSuccess,
      onError: handleError,
    }
  );

  useEffect(() => {
    // Wait for both the general config check AND the reference data check to complete
    if (notionConfigured && !loadingReferenceData) {
      console.log('[WaitingRoom] Initial fetch for appointments.');
      const todayDate = format(new Date(), 'yyyy-MM-dd'); // Calculate today's date string
      fetchTodaysAppointments({ todayDate }); // Pass payload
    }
  }, [fetchTodaysAppointments, notionConfigured, loadingReferenceData]);

  const handleUpdateSuccess = useCallback(() => {
    showSuccess('Navigating to live session dashboard.');
  }, []);

  const handleUpdateError = useCallback((msg: string) => {
    showError(msg);
  }, []);

  const {
    loading: updatingAppointment,
    execute: updateNotionAppointment,
  } = useCachedEdgeFunction<UpdateNotionAppointmentPayload, UpdateNotionAppointmentResponse>(
    'update-notion-appointment',
    {
      requiresAuth: true,
      onSuccess: handleUpdateSuccess,
      onError: handleUpdateError,
    }
  );

  const handleStartSession = useCallback(async (appointmentId: string) => {
    console.log('[WaitingRoom] Starting session for appointmentId:', appointmentId);
    await updateNotionAppointment({
      appointmentId: appointmentId,
      updates: { status: 'OPEN' }
    });
    if (!updatingAppointment) { // Only navigate if update was successful and not still loading
      navigate(`/active-session/${appointmentId}`);
    }
  }, [updateNotionAppointment, updatingAppointment, navigate]); // Added dependencies

  const handleRefresh = useCallback(() => {
    const todayDate = format(new Date(), 'yyyy-MM-dd'); // Calculate today's date string
    fetchTodaysAppointments({ todayDate }); // Pass payload
  }, [fetchTodaysAppointments]);

  const handleAppointmentCreated = useCallback(() => {
    const todayDate = format(new Date(), 'yyyy-MM-dd'); // Calculate today's date string
    fetchTodaysAppointments({ todayDate }); // Pass payload
  }, [fetchTodaysAppointments]);

  console.log('[WaitingRoom] Rendering with appointments:', appointments);

  if (configLoading || loadingAppointments || loadingReferenceData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6 flex items-center justify-center">
        <div className="max-w-4xl mx-auto space-y-6 w-full">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!notionConfigured || referenceNeedsConfig) {
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
              <Button onClick={() => fetchTodaysAppointments({ todayDate: format(new Date(), 'yyyy-MM-dd') })}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-indigo-900">Waiting Room</h1>
          <div className="flex gap-3">
            <CreateAppointmentDialog onAppointmentCreated={handleAppointmentCreated} />
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={loadingAppointments}
              className="text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800"
            >
              {loadingAppointments ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <p className="text-gray-600 text-center mb-8">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
        <div className="flex justify-center mb-4">
          <SyncStatusIndicator onSyncComplete={() => {
            // Refresh data after sync
            const todayDate = format(new Date(), 'yyyy-MM-dd');
            fetchTodaysAppointments({ todayDate });
          }} />
        </div>

        {appointments.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="pt-8 text-center">
              <div className="text-gray-400 mb-4">
                <Calendar className="w-16 h-16 mx-auto" />
              </div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                No Sessions Scheduled
              </h2>
              <p className="text-gray-500">
                You don't have any appointments scheduled for today with 'AP' or 'OPEN' status.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <Card key={appointment.id} className="shadow-md border border-gray-200">
                <CardHeader className="bg-indigo-50 rounded-t-lg p-4">
                  <CardTitle className="text-xl font-bold text-indigo-800 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    {appointment.clientName}
                    {appointmentsIsCached && (
                      <Badge variant="secondary" className="bg-green-200 text-green-800 ml-2">
                        Cached
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{appointment.starSign}</span>
                  </div>
                  {appointment.sessionNorthStar && (
                    <div className="flex items-start gap-2 text-sm text-gray-700">
                      <Target className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <p>
                        <span className="font-semibold">Session North Star:</span> {appointment.sessionNorthStar}
                      </p>
                    </div>
                  )}
                  {appointment.goal && (
                    <div className="flex items-start gap-2 text-sm text-gray-700">
                      <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p>
                        <span className="font-semibold">Goal:</span> {appointment.goal}
                      </p>
                    </div>
                  )}
                  <Button
                    className="w-full mt-4 h-10 text-base bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    onClick={() => handleStartSession(appointment.id)}
                    disabled={updatingAppointment}
                  >
                    {updatingAppointment ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <PlayCircle className="w-5 h-5 mr-2" />}
                    {updatingAppointment ? 'Starting Session...' : 'Start Session'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WaitingRoom;