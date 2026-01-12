"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { Search, Check, ChevronsUpDown, Lightbulb, PlusCircle, Trash2, Info, Loader2, XCircle, Settings } from 'lucide-react'; // Fixed: Added Settings import
import { useNavigate } from 'react-router-dom';
import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
import { Acupoint, GetAcupointsPayload, GetAcupointsResponse, LogSessionEventPayload, LogSessionEventResponse } from '@/types/api';
import { useDebounce } from '@/hooks/use-debounce'; // Import useDebounce

interface AcupointSelectorProps {
  appointmentId: string;
  onLogSuccess: () => void;
  onClearSelection: () => void;
  onOpenNotionPage: (pageId: string, pageTitle: string) => void;
}

const AcupointSelector: React.FC<AcupointSelectorProps> = ({ appointmentId, onLogSuccess, onClearSelection, onOpenNotionPage }) => {
  const [acupointSearchTerm, setAcupointSearchTerm] = useState('');
  const [symptomSearchTerm, setSymptomSearchTerm] = useState('');
  const [foundAcupoints, setFoundAcupoints] = useState<Acupoint[]>([]);
  const [selectedAcupoint, setSelectedAcupoint] = useState<Acupoint | null>(null);
  const [isAcupointSearchOpen, setIsAcupointSearchOpen] = useState(false);
  const [isSymptomSearchOpen, setIsSymptomSearchOpen] = useState(false);

  const navigate = useNavigate();

  const debouncedAcupointSearchTerm = useDebounce(acupointSearchTerm, 500); // Debounce acupoint search
  const debouncedSymptomSearchTerm = useDebounce(symptomSearchTerm, 500);   // Debounce symptom search

  const onAcupointsSuccess = useCallback((data: GetAcupointsResponse) => {
    setFoundAcupoints(data.acupoints);
  }, []);

  const onAcupointsError = useCallback((msg: string) => {
    showError(`Failed to search: ${msg}`);
    setFoundAcupoints([]);
  }, []);

  const {
    loading: loadingAcupoints,
    error: acupointsError,
    needsConfig,
    execute: fetchAcupoints,
  } = useSupabaseEdgeFunction<GetAcupointsPayload, GetAcupointsResponse>(
    'get-acupoints',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      onSuccess: onAcupointsSuccess,
      onError: onAcupointsError,
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
        console.log('Acupoint added to Supabase:', data.logId);
        showSuccess('Acupoint added to session.');
        onLogSuccess(); // Notify parent to refresh logs
      },
      onError: (msg) => {
        console.error('Failed to add acupoint to Supabase:', msg);
        showError(`Logging Failed: ${msg}`);
      }
    }
  );

  // Effect to fetch acupoints based on debounced search terms
  useEffect(() => {
    if (isAcupointSearchOpen && debouncedAcupointSearchTerm.trim() !== '') {
      fetchAcupoints({ searchTerm: debouncedAcupointSearchTerm, searchType: 'point' });
    } else if (isSymptomSearchOpen && debouncedSymptomSearchTerm.trim() !== '') {
      fetchAcupoints({ searchTerm: debouncedSymptomSearchTerm, searchType: 'symptom' });
    } else if (!isAcupointSearchOpen && !isSymptomSearchOpen && !selectedAcupoint) {
      // Optionally fetch all if no search term and no selection, or clear results
      setFoundAcupoints([]);
    }
  }, [debouncedAcupointSearchTerm, debouncedSymptomSearchTerm, isAcupointSearchOpen, isSymptomSearchOpen, selectedAcupoint, fetchAcupoints]);


  const handleAcupointSearchChange = (value: string) => {
    setAcupointSearchTerm(value);
    setSymptomSearchTerm(''); // Clear symptom search when point search is active
    setSelectedAcupoint(null); // Clear selected acupoint
    setIsSymptomSearchOpen(false); // Close symptom search popover
  };

  const handleClearAcupointSearch = useCallback(() => {
    setAcupointSearchTerm('');
    setFoundAcupoints([]);
    setSelectedAcupoint(null);
    onClearSelection(); // Notify parent to clear Notion page viewer
  }, [onClearSelection]);

  const handleSymptomSearchChange = (value: string) => {
    setSymptomSearchTerm(value);
    setAcupointSearchTerm(''); // Clear point search when symptom search is active
    setSelectedAcupoint(null); // Clear selected acupoint
    setIsAcupointSearchOpen(false); // Close point search popover
  };

  const handleClearSymptomSearch = useCallback(() => {
    setSymptomSearchTerm('');
    setFoundAcupoints([]);
    setSelectedAcupoint(null);
    onClearSelection(); // Notify parent to clear Notion page viewer
  }, [onClearSelection]);

  const handleSelectAcupoint = useCallback((acupoint: Acupoint) => {
    setSelectedAcupoint(acupoint);
    setIsAcupointSearchOpen(false);
    setIsSymptomSearchOpen(false);
    setAcupointSearchTerm(acupoint.name); // Display selected acupoint name in the point search trigger
    setSymptomSearchTerm(''); // Clear symptom search when a point is selected
    setFoundAcupoints([]); // Clear found acupoints after selection
  }, []);

  const handleClearSelectedAcupoint = useCallback(() => {
    setSelectedAcupoint(null);
    setAcupointSearchTerm('');
    setSymptomSearchTerm('');
    setFoundAcupoints([]); // Clear any previous search results
    onClearSelection(); // Notify parent to clear Notion page viewer
  }, [onClearSelection]);

  const handleAddAcupointToSession = useCallback(async () => {
    if (selectedAcupoint && appointmentId) {
      await logSessionEvent({
        appointmentId: appointmentId,
        logType: 'acupoint_added',
        details: {
          acupointId: selectedAcupoint.id,
          acupointName: selectedAcupoint.name,
          channel: selectedAcupoint.channel,
        }
      });
      if (!loggingSessionEvent) {
        handleClearSelectedAcupoint(); // Clear selected acupoint after logging
      }
    } else {
      showError('No acupoint selected to add to session.');
    }
  }, [selectedAcupoint, appointmentId, loggingSessionEvent, logSessionEvent, handleClearSelectedAcupoint]);

  if (needsConfig) {
    return (
      <Card className="max-w-md w-full w-full shadow-xl mx-auto">
        <CardContent className="pt-8 text-center">
          <div className="mx-auto mb-4 p-4 bg-indigo-100 rounded-full w-20 h-20 flex items-center justify-center">
            <Settings className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-indigo-900 mb-2">
            Notion Acupoints Database Required
          </h2>
          <p className="text-gray-600 mb-6">
            Please configure your Notion Acupoints Database ID to use the Acupoint Insight Engine.
          </p>
          <Button
            className="w-full h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            onClick={() => navigate('/notion-config')}
          >
            Configure Notion
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl">
      <CardHeader className="bg-indigo-50 border-b border-indigo-200 rounded-t-lg p-4">
        <CardTitle className="text-xl font-bold text-indigo-800 flex items-center gap-2">
          <Search className="w-5 h-5" />
          Acupoint Insight Engine
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Point Search */}
        <div className="space-y-2">
          <Label htmlFor="point-search" className="flex items-center gap-2 font-semibold text-gray-700">
            <Search className="w-4 h-4 text-indigo-600" />
            Point Search (e.g., SP-06, Pc-6)
          </Label>
          <Popover open={isAcupointSearchOpen} onOpenChange={setIsAcupointSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isAcupointSearchOpen}
                className="w-full justify-between"
                disabled={loadingAcupoints}
              >
                {loadingAcupoints ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {selectedAcupoint ? selectedAcupoint.name : (acupointSearchTerm || "Search for an acupoint...")}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <div className="relative">
                  <CommandInput
                    placeholder="Search acupoint..."
                    value={acupointSearchTerm}
                    onValueChange={handleAcupointSearchChange}
                    disabled={loadingAcupoints}
                  />
                  {acupointSearchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                      onClick={handleClearAcupointSearch}
                      disabled={loadingAcupoints}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <CommandEmpty>No acupoint found.</CommandEmpty>
                <CommandGroup>
                  {foundAcupoints.map((point) => (
                    <CommandItem
                      key={point.id}
                      value={point.name}
                      onSelect={() => handleSelectAcupoint(point)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedAcupoint?.id === point.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {point.name}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 h-6 w-6 rounded-full text-gray-500 hover:bg-gray-100"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent selecting the acupoint when clicking the info button
                          onOpenNotionPage(point.id, point.name);
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
        </div>

        {/* Symptom Suggester */}
        <div className="space-y-2">
          <Label htmlFor="symptom-search" className="flex items-center gap-2 font-semibold text-gray-700">
            <Lightbulb className="w-4 h-4 text-indigo-600" />
            Symptom Suggester (e.g., Anxiety, Headache)
          </Label>
          <Popover open={isSymptomSearchOpen} onOpenChange={setIsSymptomSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isSymptomSearchOpen}
                className="w-full justify-between"
                disabled={loadingAcupoints}
              >
                {loadingAcupoints ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {selectedAcupoint ? selectedAcupoint.name : (symptomSearchTerm || "Search symptoms for point suggestions...")}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <div className="relative">
                  <CommandInput
                    placeholder="Search symptom..."
                    value={symptomSearchTerm}
                    onValueChange={handleSymptomSearchChange}
                    disabled={loadingAcupoints}
                  />
                  {symptomSearchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                      onClick={handleClearSymptomSearch}
                      disabled={loadingAcupoints}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <CommandEmpty>No suggestions found.</CommandEmpty>
                <CommandGroup>
                  {foundAcupoints.map((point) => (
                    <CommandItem
                      key={point.id}
                      value={point.name}
                      onSelect={() => handleSelectAcupoint(point)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedAcupoint?.id === point.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {point.name}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 h-6 w-6 rounded-full text-gray-500 hover:bg-gray-100"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent selecting the acupoint when clicking the info button
                          onOpenNotionPage(point.id, point.name);
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
        </div>

        {/* Insight Deck (Selected Acupoint Display) */}
        {selectedAcupoint && (
          <Card className="border-2 border-purple-300 bg-purple-50 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
              <CardTitle className="text-xl font-bold text-purple-800 flex items-center gap-2">
                {selectedAcupoint.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-2 h-6 w-6 rounded-full text-gray-500 hover:bg-gray-100"
                  onClick={() => { onOpenNotionPage(selectedAcupoint.id, selectedAcupoint.name); }}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </CardTitle>
              <div className="flex gap-2">
                {selectedAcupoint.channel && (
                  <Badge variant="secondary" className="bg-purple-200 text-purple-800">
                    {selectedAcupoint.channel}
                  </Badge>
                )}
                {selectedAcupoint.akMuscles.length > 0 && (
                  <Badge variant="secondary" className="bg-purple-200 text-purple-800">
                    {selectedAcupoint.akMuscles.join(', ')}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-2 space-y-3 text-gray-800">
              {selectedAcupoint.for && (
                <div>
                  <p className="font-semibold text-purple-700">For:</p>
                  <p className="text-sm">{selectedAcupoint.for}</p>
                </div>
              )}
              {selectedAcupoint.kinesiology && (
                <div>
                  <p className="font-semibold text-purple-700">Kinesiology:</p>
                  <p className="text-sm">{selectedAcupoint.kinesiology}</p>
                </div>
              )}
              {selectedAcupoint.psychology && (
                <div>
                  <p className="font-semibold text-purple-700">Psychology:</p>
                  <p className="text-sm">{selectedAcupoint.psychology}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedAcupoint.typeOfPoint.length > 0 && (
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                    Type: {selectedAcupoint.typeOfPoint.join(', ')}
                  </Badge>
                )}
                {selectedAcupoint.time.length > 0 && (
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                    Time: {selectedAcupoint.time.join(', ')}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                  onClick={handleAddAcupointToSession}
                  disabled={loggingSessionEvent}
                >
                  {loggingSessionEvent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                  {loggingSessionEvent ? 'Adding...' : 'Add Acupoint to Session Log'}
                </Button>
                <Button variant="outline" onClick={handleClearSelectedAcupoint} disabled={loggingSessionEvent}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};

export default AcupointSelector;