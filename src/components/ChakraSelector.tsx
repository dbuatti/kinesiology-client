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
import { Search, Check, ChevronsUpDown, Settings, Loader2, Sparkles, PlusCircle, Trash2, ExternalLink, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCachedEdgeFunction } from '@/hooks/use-cached-edge-function';
import { useReferenceData } from '@/hooks/use-reference-data'; // Import centralized hook
import { Chakra, GetChakrasPayload, GetChakrasResponse, LogSessionEventPayload, LogSessionEventResponse } from '@/types/api';
import { useDebounce } from '@/hooks/use-debounce';

interface ChakraSelectorProps {
  appointmentId: string;
  onChakraSelected: (chakra: Chakra | null) => void;
  onClearSelection: () => void;
  selectedChakra: Chakra | null;
  onOpenNotionPage: (pageId: string, pageTitle: string) => void;
}

const ChakraSelector: React.FC<ChakraSelectorProps> = ({ appointmentId, onChakraSelected, onClearSelection, selectedChakra, onOpenNotionPage }) => {
  const { data, loading: loadingReferenceData, needsConfig: chakrasNeedsConfig } = useReferenceData();
  const allChakras = data.chakras;

  const [filteredChakras, setFilteredChakras] = useState<Chakra[]>(allChakras);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'element' | 'emotion' | 'organ'>('name');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDataCached, setIsDataCached] = useState(true); // Assume cached since data comes from provider

  const navigate = useNavigate();
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Effect to update filteredChakras when allChakras changes (i.e., after initial load)
  useEffect(() => {
    setFilteredChakras(allChakras);
  }, [allChakras]);

  // Hook for logging general session events
  const {
    loading: loggingSessionEvent,
    execute: logSessionEvent,
  } = useCachedEdgeFunction<LogSessionEventPayload, LogSessionEventResponse>(
    'log-session-event',
    {
      requiresAuth: true,
      onSuccess: (data) => {
        console.log('Chakra selection logged to Supabase:', data.logId);
      },
      onError: (msg) => {
        console.error('Failed to log chakra selection to Supabase:', msg);
        showError(`Logging Failed: ${msg}`);
      }
    }
  );

  // Effect to filter chakras based on search term and type (client-side)
  useEffect(() => {
    const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();
    let currentFiltered: Chakra[] = [];

    if (lowerCaseSearchTerm.trim() === '') {
      currentFiltered = allChakras;
    } else {
      currentFiltered = allChakras.filter(chakra => {
        if (searchType === 'name') {
          return chakra.name.toLowerCase().includes(lowerCaseSearchTerm);
        } else if (searchType === 'element') {
          return chakra.elements.some(element => element.toLowerCase().includes(lowerCaseSearchTerm));
        } else if (searchType === 'emotion') {
          return chakra.emotionalThemes.some(theme => theme.toLowerCase().includes(lowerCaseSearchTerm));
        } else if (searchType === 'organ') {
          return chakra.associatedOrgans.some(organ => organ.toLowerCase().includes(lowerCaseSearchTerm));
        }
        return false;
      });
    }
    setFilteredChakras(currentFiltered);
  }, [debouncedSearchTerm, searchType, allChakras]);

  const handleSelectChakra = (chakra: Chakra) => {
    onChakraSelected(chakra);
    setIsSearchOpen(false);
    setSearchTerm(chakra.name);
  };

  const handleSearchTypeChange = (type: 'name' | 'element' | 'emotion' | 'organ') => {
    setSearchType(type);
    setSearchTerm('');
    setFilteredChakras(allChakras);
    setIsSearchOpen(true);
  };

  const handleAddChakraToSession = async () => {
    if (selectedChakra && appointmentId) {
      await logSessionEvent({
        appointmentId: appointmentId,
        logType: 'chakra_selected',
        details: {
          chakraId: selectedChakra.id,
          chakraName: selectedChakra.name,
          location: selectedChakra.location,
          color: selectedChakra.color,
          elements: selectedChakra.elements,
          emotionalThemes: selectedChakra.emotionalThemes,
        }
      });

      if (!loggingSessionEvent) {
        showSuccess(`${selectedChakra.name} logged to the current session.`);
        handleClearAll();
      }
    } else {
      showError('Please select a chakra to add to the session.');
    }
  };

  const handleClearAll = () => {
    onChakraSelected(null);
    setSearchTerm('');
    setFilteredChakras(allChakras);
    setIsSearchOpen(false);
    onClearSelection();
  };

  const isLoading = loadingReferenceData;

  if (chakrasNeedsConfig) {
    return (
      <Card className="max-w-md w-full shadow-xl mx-auto">
        <CardContent className="pt-8 text-center">
          <div className="mx-auto mb-4 p-4 bg-indigo-100 rounded-full w-20 h-20 flex items-center justify-center">
            <Settings className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-indigo-900 mb-2">
            Notion Chakras Database Required
          </h2>
          <p className="text-gray-600 mb-6">
            Please configure your Notion Chakras Database ID to use the Chakra Selector.
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
          <Sparkles className="w-5 h-5" />
          Chakra Insight Engine
          {isDataCached && (
            <Badge variant="secondary" className="bg-green-200 text-green-800 ml-2">
              Cached
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Search Input */}
        <div className="space-y-2">
          <Label htmlFor="chakra-search" className="flex items-center gap-2 font-semibold text-gray-700">
            <Search className="w-4 h-4 text-indigo-600" />
            Search Chakras
          </Label>
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button
              variant={searchType === 'name' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('name')}
              className={cn(searchType === 'name' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
              disabled={isLoading || loggingSessionEvent || !!selectedChakra}
            >
              Name
            </Button>
            <Button
              variant={searchType === 'element' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('element')}
              className={cn(searchType === 'element' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
              disabled={isLoading || loggingSessionEvent || !!selectedChakra}
            >
              Element
            </Button>
            <Button
              variant={searchType === 'emotion' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('emotion')}
              className={cn(searchType === 'emotion' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
              disabled={isLoading || loggingSessionEvent || !!selectedChakra}
            >
              Emotion
            </Button>
            <Button
              variant={searchType === 'organ' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('organ')}
              className={cn(searchType === 'organ' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
              disabled={isLoading || loggingSessionEvent || !!selectedChakra}
            >
              Organ
            </Button>
          </div>
          <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isSearchOpen}
                className="w-full justify-between"
                disabled={isLoading || loggingSessionEvent || !!selectedChakra}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {selectedChakra ? selectedChakra.name : (searchTerm || `Search by ${searchType}...`)}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput
                  placeholder={`Search ${searchType}...`}
                  value={searchTerm}
                  onValueChange={(value) => {
                    setSearchTerm(value);
                  }}
                  disabled={isLoading}
                />
                <CommandEmpty>No chakras found.</CommandEmpty>
                <CommandGroup className="max-h-[300px] overflow-y-auto">
                  {filteredChakras.map((chakra) => (
                    <CommandItem
                      key={chakra.id}
                      value={chakra.name}
                      onSelect={() => handleSelectChakra(chakra)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedChakra?.id === chakra.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {chakra.name}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 h-6 w-6 rounded-full text-gray-500 hover:bg-gray-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenNotionPage(chakra.id, chakra.name);
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

        {/* Selected Chakra Display */}
        {selectedChakra && (
          <Card className="border-2 border-purple-300 bg-purple-50 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
              <CardTitle className="text-xl font-bold text-purple-800 flex items-center gap-2">
                {selectedChakra.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-2 h-6 w-6 rounded-full text-gray-500 hover:bg-gray-100"
                  onClick={() => {
                    onOpenNotionPage(selectedChakra.id, selectedChakra.name);
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </CardTitle>
              <div className="flex gap-2">
                {selectedChakra.color && (
                  <Badge variant="secondary" className="bg-purple-200 text-purple-800" style={{ backgroundColor: selectedChakra.color.toLowerCase() }}>
                    {selectedChakra.color}
                  </Badge>
                )}
                {selectedChakra.elements.length > 0 && (
                  <Badge variant="secondary" className="bg-purple-200 text-purple-800">
                    {selectedChakra.elements.join(', ')}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-2 space-y-3 text-gray-800">
              {selectedChakra.location && (
                <div>
                  <p className="font-semibold text-purple-700">Location:</p>
                  <p className="text-sm">{selectedChakra.location}</p>
                </div>
              )}
              {selectedChakra.associatedOrgans.length > 0 && (
                <div>
                  <p className="font-semibold text-purple-700">Associated Organs:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedChakra.associatedOrgans.map((organ, i) => (
                      <Badge key={i} variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                        {organ}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedChakra.emotionalThemes.length > 0 && (
                <div>
                  <p className="font-semibold text-purple-700">Emotional Themes:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedChakra.emotionalThemes.map((theme, i) => (
                      <Badge key={i} variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedChakra.affirmations && (
                <div>
                  <p className="font-semibold text-purple-700">Affirmations:</p>
                  <p className="text-sm italic">"{selectedChakra.affirmations}"</p>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                  onClick={handleAddChakraToSession}
                  disabled={loggingSessionEvent}
                >
                  {loggingSessionEvent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                  {loggingSessionEvent ? 'Adding...' : 'Add to Session Log'}
                </Button>
                <Button variant="outline" onClick={handleClearAll} disabled={loggingSessionEvent}>
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

export default ChakraSelector;