"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, User, Star, Target, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Appointment {
  id: string;
  clientName: string;
  starSign: string;
  goal: string;
}

const ActiveSession = () => {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchTodaysAppointment();
  }, []);

  const fetchTodaysAppointment = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get the session token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('Please log in to view appointments');
        navigate('/login');
        return;
      }

      // Get Supabase URL from environment or default
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcriagmovotwuqbppcfm.supabase.co';

      // Call the edge function
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
        throw new Error(errorData.error || 'Failed to fetch appointments');
      }

      const data = await response.json();
      
      if (data.appointments && data.appointments.length > 0) {
        setAppointment(data.appointments[0]);
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
  };

  const handleStartSession = () => {
    if (appointment) {
      navigate('/session-form', { 
        state: { 
          clientId: appointment.id,
          clientName: appointment.clientName,
          starSign: appointment.starSign,
          goal: appointment.goal 
        } 
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error && !appointment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 mb-4">
              <User className="w-12 h-12 mx-auto" />
            </div>
            <h2 className="text-xl font-bold mb-2">Error Loading Appointment</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchTodaysAppointment}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
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
          <Card className="shadow-xl border-2 border-indigo-200">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
              <CardTitle className="text-2xl font-bold">
                {appointment.clientName}
              </CardTitle>
              <div className="flex items-center gap-2 text-indigo-100 mt-2">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-medium">{appointment.starSign}</span>
              </div>
            </CardHeader>
            
            <CardContent className="pt-6 space-y-6">
              {/* Goal Section */}
              {appointment.goal && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Target className="w-4 h-4 text-indigo-600" />
                    <span>Session Goal</span>
                  </div>
                  <p className="text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    {appointment.goal}
                  </p>
                </div>
              )}

              {/* Start Session Button */}
              <Button 
                className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                onClick={handleStartSession}
              >
                <Clock className="w-5 h-5 mr-2" />
                Start Session
              </Button>
            </CardContent>
          </Card>
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

        {/* Navigation */}
        <div className="mt-6 text-center">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="text-indigo-600 hover:text-indigo-800"
          >
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ActiveSession;