"use client";

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Lightbulb, Hand, Sparkles, Waves, Search, Target } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Mode,
  Muscle,
  Chakra,
  Channel,
  Acupoint,
  SessionLog,
  SessionMuscleLog,
} from '@/types/api';

interface SessionSummaryDisplayProps {
  sessionLogs: SessionLog[];
  sessionMuscleLogs: SessionMuscleLog[];
  sessionSelectedModes: Mode[]; // Changed to array
  selectedMuscle: Muscle | null;
  selectedChakra: Chakra | null;
  selectedChannel: Channel | null;
  selectedAcupoint: Acupoint | null;
  sessionNorthStar: string;
  sessionAnchor: string;
}

const getElementColorClasses = (elements: string[]): { bg: string, text: string } => {
  const primaryElement = elements[0]?.toLowerCase();
  switch (primaryElement) {
    case 'wood': return { bg: 'bg-green-100', text: 'text-green-800' };
    case 'fire': return { bg: 'bg-red-100', text: 'text-red-800' };
    case 'earth': return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
    case 'metal': return { bg: 'bg-gray-100', text: 'text-gray-800' };
    case 'water': return { bg: 'bg-blue-100', text: 'text-blue-800' };
    default: return { bg: 'bg-indigo-100', text: 'text-indigo-800' };
  }
};

const SessionSummaryDisplay: React.FC<SessionSummaryDisplayProps> = ({
  sessionLogs,
  sessionMuscleLogs,
  sessionSelectedModes, // Changed to array
  selectedMuscle,
  selectedChakra,
  selectedChannel,
  selectedAcupoint,
  sessionNorthStar,
  sessionAnchor,
}) => {
  const allLogs = useMemo(() => {
    return [...sessionLogs, ...sessionMuscleLogs].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [sessionLogs, sessionMuscleLogs]);

  const latestLoggedItems = useMemo(() => {
    const items: { type: string; name: string; colorClass?: string; icon?: React.ReactNode }[] = [];

    // Add currently selected items (if not already logged)
    if (selectedMuscle) items.push({ type: 'Muscle', name: selectedMuscle.name, icon: <Hand className="w-3 h-3" /> });
    if (selectedChakra) items.push({ type: 'Chakra', name: selectedChakra.name, icon: <Sparkles className="w-3 h-3" /> });
    if (selectedChannel) {
      const { bg, text } = getElementColorClasses(selectedChannel.elements);
      items.push({ type: 'Channel', name: selectedChannel.name, colorClass: cn(bg, text), icon: <Waves className="w-3 h-3" /> });
    }
    if (selectedAcupoint) items.push({ type: 'Acupoint', name: selectedAcupoint.name, icon: <Search className="w-3 h-3" /> });

    // Add all selected modes
    sessionSelectedModes.forEach(mode => {
      items.push({ type: 'Mode', name: mode.name, icon: <Lightbulb className="w-3 h-3" /> });
    });

    // Add latest logged events (up to a few, to keep it concise)
    const recentLogs = allLogs.slice(-3).reverse(); // Get last 3 logs, most recent first
    recentLogs.forEach(log => {
      if ('log_type' in log) { // General session log
        // Only add if not already covered by selected modes
        if (log.log_type === 'mode_selected' && log.details?.modeName && !sessionSelectedModes.some(m => m.name === log.details.modeName)) {
          items.push({ type: 'Logged Mode', name: log.details.modeName, icon: <Lightbulb className="w-3 h-3" /> });
        } else if (log.log_type === 'chakra_selected' && log.details?.chakraName) {
          items.push({ type: 'Logged Chakra', name: log.details.chakraName, icon: <Sparkles className="w-3 h-3" /> });
        } else if (log.log_type.startsWith('channel_') && log.details?.channelName) {
          const { bg, text } = getElementColorClasses(log.details.elements || []); // Assuming elements might be in details
          items.push({ type: 'Logged Channel Item', name: `${log.details.channelName} (${log.details.itemValue})`, colorClass: cn(bg, text), icon: <Waves className="w-3 h-3" /> });
        } else if (log.log_type === 'acupoint_added' && log.details?.acupointName) {
          items.push({ type: 'Logged Acupoint', name: log.details.acupointName, icon: <Search className="w-3 h-3" /> });
        }
      } else { // Muscle strength log
        items.push({
          type: 'Logged Muscle',
          name: `${log.muscle_name} (${log.is_strong ? 'Strong' : 'Weak'})`,
          icon: <Hand className="w-3 h-3" />,
        });
      }
    });

    return items;
  }, [sessionSelectedModes, selectedMuscle, selectedChakra, selectedChannel, selectedAcupoint, allLogs]);

  const hasContent = sessionNorthStar || sessionAnchor || latestLoggedItems.length > 0;

  if (!hasContent) {
    return null; // Don't render if there's no content to display
  }

  return (
    <Card className="shadow-md border border-gray-200 bg-white sticky top-16 z-30 mb-6">
      <CardContent className="p-3 flex flex-wrap items-center gap-2 text-sm">
        {sessionNorthStar && (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
            <Target className="w-3 h-3" />
            <span className="font-semibold">North Star:</span> {sessionNorthStar}
          </Badge>
        )}
        {sessionAnchor && (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            <span className="font-semibold">Anchor:</span> {sessionAnchor}
          </Badge>
        )}
        {(sessionNorthStar || sessionAnchor) && latestLoggedItems.length > 0 && (
          <Separator orientation="vertical" className="h-6 mx-1" />
        )}
        {latestLoggedItems.map((item, index) => (
          <Badge
            key={index}
            variant="outline"
            className={cn("flex items-center gap-1", item.colorClass || "bg-gray-100 text-gray-700 border-gray-200")}
          >
            {item.icon}
            {item.name}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
};

export default SessionSummaryDisplay;