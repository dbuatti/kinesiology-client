"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { History, Hand, Sparkles, Trash2, Loader2, AlertCircle } from 'lucide-react';
import {
  GetSessionLogsResponse,
  DeleteSessionLogPayload,
  DeleteSessionLogResponse,
} from '@/types/api';
import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
import { showError } from '@/utils/toast';
import { Badge } from './ui/badge';

interface SessionLogDisplayProps {
  appointmentId: string;
  sessionLogs: GetSessionLogsResponse['sessionLogs'];
  sessionMuscleLogs: GetSessionLogsResponse['sessionMuscleLogs'];
  onDeleteLog: (payload: DeleteSessionLogPayload) => Promise<void>;
  deletingLog: boolean;
  onClearAllLogs: (payload: { appointmentId: string }) => Promise<void>; // New prop
  clearingAllLogs: boolean; // New prop
}

const SessionLogDisplay: React.FC<SessionLogDisplayProps> = ({
  appointmentId,
  sessionLogs,
  sessionMuscleLogs,
  onDeleteLog,
  deletingLog,
  onClearAllLogs,
  clearingAllLogs,
}) => {
  const allLogs = [...sessionLogs, ...sessionMuscleLogs].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const renderLogDetails = (log: any) => {
    if (log.log_type === 'muscle_strength_log') {
      return (
        <p className="text-sm text-gray-700">
          Muscle: <span className="font-semibold">{log.muscle_name}</span> was tested{' '}
          <Badge variant={log.is_strong ? 'default' : 'destructive'} className="ml-1">
            {log.is_strong ? 'STRONG' : 'WEAK'}
          </Badge>
          {log.notes && <span className="ml-2 italic">({log.notes})</span>}
        </p>
      );
    } else if (log.log_type === 'chakra_selected') {
      return (
        <p className="text-sm text-gray-700">
          Chakra: <span className="font-semibold">{log.details?.chakraName}</span> selected.
          {log.details?.emotionalThemes?.length > 0 && (
            <span className="ml-2">({log.details.emotionalThemes.join(', ')})</span>
          )}
        </p>
      );
    } else if (log.log_type.startsWith('channel_')) {
      const itemType = log.log_type.replace('channel_', '').replace(/_/g, ' ');
      return (
        <p className="text-sm text-gray-700">
          Channel: <span className="font-semibold">{log.details?.channelName}</span> - Logged{' '}
          <span className="font-semibold capitalize">{itemType}</span>: "{log.details?.itemValue}"
        </p>
      );
    } else if (log.log_type === 'acupoint_added') {
      return (
        <p className="text-sm text-gray-700">
          Acupoint: <span className="font-semibold">{log.details?.acupointName}</span> added to session.
        </p>
      );
    } else if (log.log_type === 'mode_selected') {
      return (
        <p className="text-sm text-gray-700">
          Mode: <span className="font-semibold">{log.details?.modeName}</span> selected.
        </p>
      );
    }
    // Default rendering for other log types
    return (
      <p className="text-sm text-gray-700">
        Type: <span className="font-semibold">{log.log_type.replace(/_/g, ' ')}</span>
        {log.details && Object.keys(log.details).length > 0 && (
          <span className="ml-2 italic">
            (Details: {Object.entries(log.details).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ')})
          </span>
        )}
      </p>
    );
  };

  const handleDelete = async (logId: string, logType: 'session_log' | 'session_muscle_log') => {
    await onDeleteLog({ logId, logType });
  };

  const handleClearAll = async () => {
    await onClearAllLogs({ appointmentId });
  };

  return (
    <Card className="shadow-xl">
      <CardHeader className="bg-indigo-50 border-b border-indigo-200 rounded-t-lg p-4">
        <CardTitle className="text-xl font-bold text-indigo-800 flex items-center gap-2">
          <History className="w-5 h-5" />
          Session Log
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {allLogs.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>No events logged for this session yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {allLogs.map((log, index) => (
              <div key={log.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                  </p>
                  {renderLogDetails(log)}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(log.id, 'muscle_id' in log ? 'session_muscle_log' : 'session_log')}
                  disabled={deletingLog}
                  className="text-red-500 hover:text-red-700"
                >
                  {deletingLog ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
            <Separator className="my-4" />
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleClearAll}
              disabled={clearingAllLogs || deletingLog}
            >
              {clearingAllLogs ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {clearingAllLogs ? 'Clearing All Logs...' : 'Clear All Logs'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionLogDisplay;