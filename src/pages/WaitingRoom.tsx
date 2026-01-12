"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Settings, AlertCircle, PlayCircle, User, Star, Target, Lightbulb, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast'; // Import sonner toast utilities
import { format } from 'date-fns';
import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
import { Appointment, GetTodaysAppointmentsResponse, UpdateNotionAppointmentPayload, UpdateNotionAppointmentResponse } from '@/types/api';

const WaitingRoom = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const navigate = useNavigate();

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

  const handleNotionConfigNeeded = useCallback(() => {
    // This callback is now stable and can be passed to useSupabaseEdgeFunction
    // The needsConfig state will handle the UI redirect.
  }, []);

  const {
    data: fetchedAppointmentsData,
    loading: loadingAppointments,
    error: appointmentsError,
    needsConfig,
    execute: fetchTodaysAppointments,
  } = useSupabaseEdgeFunction<void, GetTodaysAppointmentsResponse>(
    'get-todays-appointments',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      onSuccess: handleSuccess,
      onError: handleError,
      onNotionConfigNeeded: handleNotionConfigNeeded, // Use the stable callback
    }
  );

  useEffect(() => {
    console.log('[WaitingRoom] Initial fetch for appointments.');
    fetchTodaysAppointments();
  }, [fetchTodaysAppointments]);

  const {
    loading: updatingAppointment,
    execute: updateNotionAppointment,
  } = useSupabaseEdgeFunction<UpdateNotionAppointmentPayload, UpdateNotionAppointmentResponse>(
    'update-notion-appointment',
    {
      requiresAuth: true,
      onSuccess: () => {
        showSuccess('Navigating to live session dashboard.');
      },
      onError: (msg) => {
        showError(msg);
      }
    }
  );

  const handleStartSession = async (appointmentId: string) => {
    console.log('[WaitingRoom] Starting session for appointmentId:', appointmentId);
    await updateNotionAppointment({
      appointmentId: appointmentId,
      updates: { status: 'OPEN' }
    });
    if (!updatingAppointment) { // Only navigate if update was successful and not still loading
      navigate(`/active-session/${appointmentId}`);
    }
  };

  console.log('[WaitingRoom] Rendering with appointments:', appointments); // Log appointments state at render time

  if (loadingAppointments) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6 flex items-center justify-center">
        <div className="max-w-2xl mx-auto space-y-6 w-full">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
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
              <Button onClick={() => fetchTodaysAppointments()}>Try Again</Button>
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
          <h1 className="text-3xl font-bold text-indigo-900 mb-2">Waiting Room</h1>
          <p className="text-gray-600">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
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