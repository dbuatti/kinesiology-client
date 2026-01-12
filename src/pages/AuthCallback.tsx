"use client";

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthCallback] Auth state change event:', event, 'Session:', session);
      if (event === 'SIGNED_IN' && session) {
        showSuccess('Logged in successfully!');
        navigate('/'); // Navigate to the home page (WaitingRoom)
      } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        console.log('[AuthCallback] No session found or signed out, redirecting to login.');
        showError('Authentication failed or no session found.');
        navigate('/login');
      }
      setLoading(false); // Stop loading once an event is processed
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-indigo-600" />
          <h2 className="text-2xl font-bold text-indigo-900 mb-2">Completing Sign-In</h2>
          <p className="text-gray-600">Please wait while we set up your account...</p>
        </div>
      </div>
    );
  }

  return null; // Should not be reached if navigation works
};

export default AuthCallback;