"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, User, Clock, Settings, AlertCircle, PlayCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Appointment {
  id: string; // Notion page ID
  clientName: string;
  starSign: string;
  sessionNorthStar: string; // Changed from 'focus' to 'sessionNorthStar'
  goal: string;
  status: string; // To display in the waiting room
}

const WaitingRoom = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsConfig, setNeedsConfig] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcriagmovotwuqbppcfm.supabase.co';

  const fetchTodaysAppointments = useCallback(async () => {
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

      if (secretsError && secretsError.code !== 'PGRST116') {
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
      setAppointments(data.appointments);
    } catch (err: any) {
      console.error('Error fetching today\'s appointments:', err);
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
    fetchTodaysAppointments();
  }, [fetchTodaysAppointments]);

  const handleStartSession = async (appointmentId: string) => {
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

      // Update Notion status to 'OPEN'
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
            updates: { status: 'OPEN' }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start session in Notion');
      }

      toast({
        title: 'Session Started',
        description: 'Navigating to live session dashboard.',
      });

      navigate(`/active-session/${appointmentId}`);
    } catch (err: any) {
      console.error('Error starting session:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message
      });
    }
  };

  if (loading) {
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
              <Button onClick={fetchTodaysAppointments}>Try Again</Button>
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
            {appointments.map((app) => (
              <Card key={app.id} className="shadow-md border-l-4 border-indigo-500">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-lg font-semibold text-indigo-800">{app.clientName}</p>
                    <p className="text-sm text-gray-600">Status: <span className="font-medium">{app.status}</span></p>
                    {app.sessionNorthStar && <p className="text-xs text-gray-500 mt-1">Session North Star: {app.sessionNorthStar}</p>}
                  </div>
                  <Button
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-md text-base flex items-center"
                    onClick={() => handleStartSession(app.id)}
                  >
                    <PlayCircle className="w-5 h-5 mr-2" />
                    Start Session
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 flex gap-2 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate('/all-appointments')}
            className="text-indigo-600 hover:text-indigo-800"
          >
            <Clock className="w-4 h-4 mr-2" />
            View All Appointments
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

export default WaitingRoom;