"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown, Info, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
import { Mode, GetNotionModesResponse, LogSessionEventPayload, LogSessionEventResponse } from '@/types/api';
import { showSuccess, showError } from '@/utils/toast';

interface ModeSelectProps {
  appointmentId: string;
  selectedMode: Mode | null;
  onModeSelected: (mode: Mode | null) => void;
  onOpenNotionPage: (pageId: string, pageTitle: string) => void;
  onLogSuccess: () => void;
}

const ModeSelect: React.FC<ModeSelectProps> = ({
  appointmentId,
  selectedMode,
  onModeSelected,
  onOpenNotionPage,
  onLogSuccess,
}) => {
  const [allModes, setAllModes] = useState<Mode[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

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
  } = useSupabaseEdgeFunction<void, GetNotionModesResponse>(
    'get-notion-modes',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      onSuccess: onModesSuccess,
      onError: onModesError,
    }
  );

  const {
    loading: loggingSessionEvent,
    execute: logSessionEvent,
  } = useSupabaseEdgeFunction<LogSessionEventPayload, LogSessionEventResponse>(
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

  const handleSelectMode = async (mode: Mode) => {
    onModeSelected(mode);
    setIsPopoverOpen(false);
    await logSessionEvent({
      appointmentId: appointmentId,
      logType: 'mode_selected',
      details: {
        modeId: mode.id,
        modeName: mode.name,
        actionNote: mode.actionNote,
      }
    });
  };

  const handleClearMode = () => {
    onModeSelected(null);
  };

  if (modesNeedsConfig) {
    // This case should ideally be handled by the parent ActiveSession component
    // or the useSupabaseEdgeFunction hook's redirect logic.
    // For now, we'll just return a placeholder or let the parent handle the redirect.
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
    <div className="flex gap-2 w-full">
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
            {selectedMode ? selectedMode.name : "Select mode..."}
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
            <CommandGroup>
              {allModes.map((mode) => (
                <CommandItem
                  key={mode.id}
                  value={mode.name}
                  onSelect={() => handleSelectMode(mode)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedMode?.id === mode.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {mode.name}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent selecting the mode when clicking the info button
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
      {selectedMode && (
        <Button variant="outline" onClick={handleClearMode} disabled={loggingSessionEvent}>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear
        </Button>
      )}
    </div>
  );
};

export default ModeSelect;