"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, ArrowLeft, AlertCircle, Settings } from 'lucide-react';
import { useReferenceData } from '@/hooks/use-reference-data'; // Import centralized hook
import { Mode } from '@/types/api';
import { showError } from '@/utils/toast';

const ModeDetailsPage: React.FC = () => {
  const { modeId } = useParams<{ modeId: string }>();
  const navigate = useNavigate();
  const [modeDetails, setModeDetails] = useState<Mode | null>(null);

  const { data: referenceData, loading: loadingReferenceData, needsConfig: modesNeedsConfig } = useReferenceData();
  const allModes = referenceData.modes;

  useEffect(() => {
    if (!modeId) {
      showError('No mode ID provided.');
      navigate('/active-session');
      return;
    }

    if (!loadingReferenceData) {
      const foundMode = allModes.find(mode => mode.id === modeId);
      if (foundMode) {
        setModeDetails(foundMode);
      } else {
        showError('Mode not found.');
        navigate(-1); // Go back if mode not found
      }
    }
  }, [modeId, loadingReferenceData, allModes, navigate]);

  if (loadingReferenceData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (modesNeedsConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-8 text-center">
            <div className="mx-auto mb-4 p-4 bg-indigo-100 rounded-full w-20 h-20 flex items-center justify-center">
              <Settings className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-indigo-900 mb-2">
              Notion Modes Database Required
            </h2>
            <p className="text-gray-600 mb-6">
              Please configure your Notion Modes Database ID to view mode details.
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

  if (!modeDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 mb-4">
              <AlertCircle className="w-12 h-12 mx-auto" />
            </div>
            <h2 className="text-xl font-bold mb-2">Error Loading Mode</h2>
            <p className="text-gray-600 mb-4">Mode details could not be loaded or found.</p>
            <Button onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg p-4">
            <CardTitle className="text-3xl font-bold flex items-center gap-3">
              <Lightbulb className="w-7 h-7" />
              {modeDetails.name}
            </CardTitle>
            <p className="text-indigo-100 mt-1">Mode Details</p>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-indigo-800 mb-2">Action Note</h3>
              <p className="text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                {modeDetails.actionNote || 'No action note provided for this mode.'}
              </p>
            </div>

            {/* Placeholder for future custom content */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
              <p className="font-semibold">Future Enhancements:</p>
              <p className="text-sm">This section will be custom-tailored to display specific information, exercises, or protocols related to the "{modeDetails.name}" mode.</p>
            </div>

            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="w-full text-indigo-600 hover:text-indigo-800"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Session
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ModeDetailsPage;