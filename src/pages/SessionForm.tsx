"use client";

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label'; // Import Label component
import { User, Star, Target, ArrowLeft } from 'lucide-react';

interface SessionFormState {
  clientId: string;
  clientName: string;
  starSign: string;
  goal: string;
}

const SessionForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionData = location.state as SessionFormState;

  if (!sessionData) {
    // Redirect if no session data is available (e.g., direct access to /session-form)
    navigate('/active-session');
    return null;
  }

  const { clientName, starSign, goal } = sessionData;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold">
            Session with {clientName}
          </CardTitle>
          <div className="flex items-center gap-2 text-indigo-100 mt-2">
            <Star className="w-4 h-4 fill-current" />
            <span className="font-medium">{starSign}</span>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Target className="w-4 h-4 text-indigo-600" />
              <span>Session Goal</span>
            </div>
            <p className="text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200">
              {goal || "No specific goal set for this session."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-notes" className="flex items-center gap-2 font-semibold">
              <User className="w-4 h-4 text-indigo-600" />
              Session Notes
            </Label>
            <textarea
              id="session-notes"
              className="flex h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Start typing your session notes here..."
            />
          </div>

          <Button
            className="w-full h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            onClick={() => console.log('Session saved!')}
          >
            Save Session Notes
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 text-lg"
            onClick={() => navigate('/active-session')}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Active Session
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SessionForm;