"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Info } from 'lucide-react';
import { Mode } from '@/types/api';

interface ModeDetailsPanelProps {
  selectedMode: Mode | null;
}

const ModeDetailsPanel: React.FC<ModeDetailsPanelProps> = ({ selectedMode }) => {
  if (!selectedMode) {
    return (
      <div className="text-center p-6 text-gray-500">
        <Info className="w-10 h-10 mx-auto mb-4" />
        <p>Select a mode from the "Overview" tab to view its custom details here.</p>
      </div>
    );
  }

  return (
    <Card className="shadow-xl">
      <CardHeader className="bg-indigo-50 border-b border-indigo-200 rounded-t-lg p-4">
        <CardTitle className="text-xl font-bold text-indigo-800 flex items-center gap-2">
          <Lightbulb className="w-5 h-5" />
          Custom Details for: {selectedMode.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-indigo-800 mb-2">Action Note</h3>
          <p className="text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
            {selectedMode.actionNote || 'No action note provided for this mode.'}
          </p>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
          <p className="font-semibold">This is your custom content area!</p>
          <p className="text-sm mt-1">
            Here you can design and display specific information, exercises, or protocols
            relevant to the "{selectedMode.name}" mode.
            This content is separate from the Notion page viewer.
          </p>
          <p className="text-sm mt-2">
            You can add more fields, rich text, images, or interactive elements here.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ModeDetailsPanel;