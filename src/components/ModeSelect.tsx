"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown, Info, Loader2, Trash2, ChevronRight, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCachedEdgeFunction } from '@/hooks/use-cached-edge-function';
import { Mode, GetNotionModesResponse, LogSessionEventPayload, LogSessionEventResponse } from '@/types/api';
import { showSuccess, showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';

interface ModeSelectProps {
  appointmentId: string;
  onModesChanged: (modes: Mode[]) => void;
  onOpenNotionPage: (pageId: string, pageTitle: string) => void;
  onLogSuccess: () => void;
  onOpenModeDetailsPanel: (mode: Mode) => void;
}

const ModeSelect: React.FC<ModeSelectProps> = ({
  appointmentId,
  onModesChanged,
  onOpenNotionPage,
  onLogSuccess,
  onOpenModeDetailsPanel,
}) => {
  const [allModes, setAllModes] = useState<Mode[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [currentModeSelection, setCurrentModeSelection] = useState<Mode | null>(null);
  const [sessionSelectedModes, setSessionSelectedModes] = useState<Mode[]>([]);

  const navigate = useNavigate();

  const onModesSuccess = useCallback((data: GetNotionModesResponse) => {
    setAllModes(data.modes);
  }, []);

  const onModesError = useCallback((msg: string) => {
    showError(`Failed to load modes: ${msg}`);
    setAllModes([]);
  }, []);

  const {
    loading: loadingModes,
    error: modesError,
    needsConfig: modesNeedsConfig,
    execute: fetchModes,
    isCached: modesIsCached,
  } = useCachedEdgeFunction<void, GetNotionModesResponse>(
    'get-notion-modes',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      cacheKey: 'all-modes',
      cacheTtl: 120, // 2 hours cache
      onSuccess: onModesSuccess,
      onError: onModesError,
    }
  );

  const {
    loading: loggingSessionEvent,
    execute: logSessionEvent,
  } = useCachedEdgeFunction<LogSessionEventPayload, LogSessionEventResponse>(
    'log-session-event',
    {
      requiresAuth: true,
      onSuccess: (data) => {
        console.log('Mode selection logged to Supabase:', data.logId);
        showSuccess('Mode logged to session.');
        onLogSuccess();
      },
      onError: (msg) => {
        console.error('Failed to log mode selection to Supabase:', msg);
        showError(`Logging Failed: ${msg}`);
      }
    }
  );

  // Fetch all modes on initial mount
  useEffect(() => {
    if (allModes.length === 0 && !loadingModes && !modesError && !modesNeedsConfig) {
      fetchModes();
    }
  }, [allModes.length, loadingModes, modesError, modesNeedsConfig, fetchModes]);

  // Notify parent when sessionSelectedModes changes
  useEffect(() => {
    onModesChanged(sessionSelectedModes);
  }, [sessionSelectedModes, onModesChanged]);

  const handleSelectModeFromDropdown = async (mode: Mode) => {
    if (sessionSelectedModes.some(m => m.id === mode.id)) {
      showError(`${mode.name} is already added to the session.`);
      setIsPopoverOpen(false);
      setCurrentModeSelection(null);
      return;
    }

    const newSelectedModes = [...sessionSelectedModes, mode];
    setSessionSelectedModes(newSelectedModes);

    await logSessionEvent({
      appointmentId: appointmentId,
      logType: 'mode_selected',
      details: {
        modeId: mode.id,
        modeName: mode.name,
        actionNote: mode.actionNote,
      }
    });

    setIsPopoverOpen(false);
    setCurrentModeSelection(null);
  };

  const handleRemoveMode = (modeId: string) => {
    setSessionSelectedModes(prevModes => prevModes.filter(mode => mode.id !== modeId));
    showSuccess('Mode removed from session display.');
  };

  const handleClearAllModes = () => {
    if (sessionSelectedModes.length === 0) {
      showError('No modes to clear.');
      return;
    }
    setSessionSelectedModes([]);
    showSuccess('All modes cleared from session.');
  };

  const handleOpenModeDetailsPage = (modeId: string) => {
    navigate(`/mode-details/${modeId}`);
  };

  if (modesNeedsConfig) {
    return null;
  }

  if (loadingModes) {
    return (
      <Button variant="outline" className="w-full justify-between" disabled>
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading Modes...
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isPopoverOpen}
            className="w-full justify-between"
            disabled={loggingSessionEvent}
          >
            {loggingSessionEvent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {currentModeSelection ? currentModeSelection.name : "Select mode..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              placeholder="Search mode..."
              disabled={loadingModes}
            />
            <CommandEmpty>No mode found.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-y-auto">
              {allModes.map((mode) => (
                <CommandItem
                  key={mode.id}
                  value={mode.name}
                  onSelect={() => handleSelectModeFromDropdown(mode)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      sessionSelectedModes.some(m => m.id === mode.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {mode.name}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-6 w-6 rounded-full text-gray-500 hover:bg-gray-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNotionPage(mode.id, mode.name);
                    }}
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {sessionSelectedModes.length > 0 && (
        <div className="space-y-2">
          {sessionSelectedModes.map((mode) => (
            <Card key={mode.id} className="p-3 flex items-center justify-between bg-blue-50 border-blue-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-800">{mode.name}</span>
                {mode.actionNote && (
                  <span className="text-sm text-blue-700 italic">({mode.actionNote})</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-500 hover:bg-gray-100"
                  onClick={() => onOpenNotionPage(mode.id, mode.name)}
                >
                  <Info className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-500 hover:bg-gray-100"
                  onClick={() => onOpenModeDetailsPanel(mode)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-500 hover:bg-red-100"
                  onClick={() => handleRemoveMode(mode.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
          
          {/* Clear All Button */}
          <Button
            variant="outline"
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            onClick={handleClearAllModes}
            disabled={loggingSessionEvent}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Clear All Modes
          </Button>
        </div>
      )}
    </div>
  );
};

export default ModeSelect;