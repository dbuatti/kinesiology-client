"use client";

import React from 'react';
import ActiveSession from './ActiveSession';
import CacheManager from '@/components/CacheManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Bug, PlayCircle } from 'lucide-react';

// Use a valid UUID format for the mock appointment ID
const MOCK_APPOINTMENT_ID = '00000000-0000-0000-0000-000000000000';

const DebugZone = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg p-4">
            <CardTitle className="text-3xl font-bold flex items-center gap-3">
              <Bug className="w-7 h-7" />
              Debug Zone
            </CardTitle>
            <p className="text-indigo-100 mt-1">Tools for testing and cache management.</p>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <CacheManager />
            
            <Separator />

            <h2 className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
              <PlayCircle className="w-6 h-6" />
              Mock Active Session
            </h2>
            <p className="text-gray-600">
              This section loads the Active Session dashboard using a mock appointment ID 
              (`{MOCK_APPOINTMENT_ID}`) to test UI and data logging functionality without 
              relying on a real Notion appointment.
            </p>
            <ActiveSession mockAppointmentId={MOCK_APPOINTMENT_ID} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DebugZone;