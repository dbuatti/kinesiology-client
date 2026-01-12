"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError } from '@/utils/toast'; // Import sonner toast utilities
import { cn } from '@/lib/utils';
import { Search, Check, ChevronsUpDown, Hand, Info, Image, Settings, Loader2, Trash2, ExternalLink, XCircle } from 'lucide-react'; // Added XCircle
import { useNavigate } from 'react-router-dom';
import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
import { Muscle, GetMusclesPayload, GetMusclesResponse } from '@/types/api';
import { useDebounce } from '@/hooks/use-debounce'; // Import useDebounce

interface MuscleSelectorProps {
  onMuscleSelected: (muscle: Muscle) => void;
  onMuscleStrengthLogged: (muscle: Muscle, isStrong: boolean) => void;
  appointmentId: string;
  onClearSelection: () => void; // New prop for clearing selection
  onOpenNotionPage: (pageId: string, pageTitle: string) => void; // Changed prop name and type
}

const MuscleSelector: React.FC<MuscleSelectorProps> = ({ onMuscleSelected, onMuscleStrengthLogged, appointmentId, onClearSelection, onOpenNotionPage }) => {
  const [allMuscles, setAllMuscles] = useState<Muscle[]>([]);
  const [filteredMuscles, setFilteredMuscles] = useState<Muscle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'muscle' | 'meridian' | 'organ' | 'emotion'>('muscle');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);
  const [showWeaknessChecklist, setShowWeaknessChecklist] = useState(false);

  const navigate = useNavigate();
  const debouncedSearchTerm = useDebounce(searchTerm, 500); // Debounce search term

  const onMusclesSuccess = useCallback((data: GetMusclesResponse) => {
    setAllMuscles(data.muscles);
    setFilteredMuscles(data.muscles);
  }, []);

  const onMusclesError = useCallback((msg: string) => {
    showError(`Failed to load muscles: ${msg}`);
    setAllMuscles([]);
    setFilteredMuscles([]);
  }, []);

  const {
    loading: loadingMuscles,
    error: musclesError,
    needsConfig,
    execute: fetchMuscles,
  } = useSupabaseEdgeFunction<GetMusclesPayload, GetMusclesResponse>(
    'get-muscles',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      onSuccess: onMusclesSuccess,
      onError: onMusclesError,
    }
  );

  useEffect(() => {
    // Fetch all muscles initially, or filter based on current search term/type
    // Only fetch if debouncedSearchTerm is not empty or if searchType is 'muscle' and searchTerm is empty (to get all)
    if (debouncedSearchTerm.trim() !== '' || (searchType === 'muscle' && searchTerm.trim() === '')) {
      fetchMuscles({ searchTerm: debouncedSearchTerm, searchType });
    } else if (debouncedSearchTerm.trim() === '' && searchType !== 'muscle') {
      // If debounced search term is empty and not searching by muscle name, clear results
      setFilteredMuscles([]);
    }
  }, [debouncedSearchTerm, searchType, fetchMuscles, searchTerm]); // Added searchTerm to dependencies to ensure initial fetch for 'muscle' type

  const handleSelectMuscle = (muscle: Muscle) => {
    setSelectedMuscle(muscle);
    onMuscleSelected(muscle);
    setIsSearchOpen(false);
    setSearchTerm(muscle.name); // Pre-fill search with selected muscle name
    setShowWeaknessChecklist(false); // Reset checklist visibility
  };

  const handleLogStrength = (isStrong: boolean) => {
    if (selectedMuscle) {
      onMuscleStrengthLogged(selectedMuscle, isStrong);
      if (!isStrong) {
        setShowWeaknessChecklist(true);
      } else {
        setShowWeaknessChecklist(false);
      }
      showSuccess(`Muscle strength for ${selectedMuscle.name} logged as ${isStrong ? 'Strong' : 'Weak'}.`);
    }
  };

  const handleSearchTypeChange = (type: 'muscle' | 'meridian' | 'organ' | 'emotion') => {
    setSearchType(type);
    setSearchTerm(''); // Clear search term when type changes
    setFilteredMuscles(allMuscles); // Reset filtered muscles
    setIsSearchOpen(true); // Open popover for new search
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setFilteredMuscles(allMuscles);
    setIsSearchOpen(false);
  };

  const handleClearAll = () => {
    setSelectedMuscle(null);
    setSearchTerm(''); // Clear search term in the trigger
    setFilteredMuscles(allMuscles);
    setShowWeaknessChecklist(false);
    onClearSelection(); // Notify parent of clear action
  };

  if (needsConfig) {
    return (
      <Card className="max-w-md w-full shadow-xl mx-auto">
        <CardContent className="pt-8 text-center">
          <div className="mx-auto mb-4 p-4 bg-indigo-100 rounded-full w-20 h-20 flex items-center justify-center">
            <Settings className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-indigo-900 mb-2">
            Notion Muscles Database Required
          </h2>
          <p className="text-gray-600 mb-6">
            Please configure your Notion Muscles Database ID to use the Muscle Selector.
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
          <Hand className="w-5 h-5" />
          Muscle Testing & Insights
          {selectedMuscle && (
            <Button variant="ghost" size="icon" className="ml-2 h-6 w-6 rounded-full text-gray-500 hover:bg-gray-100" onClick={() => onOpenNotionPage(selectedMuscle.id, selectedMuscle.name)}>
              <Info className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Search Input */}
        <div className="space-y-2">
          <Label htmlFor="muscle-search" className="flex items-center gap-2 font-semibold text-gray-700">
            <Search className="w-4 h-4 text-indigo-600" />
            Search Muscles
          </Label>
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button
              variant={searchType === 'muscle' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('muscle')}
              className={cn(searchType === 'muscle' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
              disabled={loadingMuscles}
            >
              Muscle Name
            </Button>
            <Button
              variant={searchType === 'organ' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('organ')}
              className={cn(searchType === 'organ' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
              disabled={loadingMuscles}
            >
              Organ System
            </Button>
            <Button
              variant={searchType === 'emotion' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('emotion')}
              className={cn(searchType === 'emotion' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
              disabled={loadingMuscles}
            >
              Emotion
            </Button>
          </div>
          <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isSearchOpen}
                className="w-full justify-between"
                disabled={loadingMuscles}
              >
                {loadingMuscles ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {selectedMuscle ? selectedMuscle.name : (searchTerm || `Search by ${searchType}...`)}
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
                />
                <CommandEmpty>No muscles found.</CommandEmpty>
                <CommandGroup>
                  {filteredMuscles.map((muscle) => (
                    <CommandItem
                      key={muscle.id}
                      value={muscle.name}
                      onSelect={() => handleSelectMuscle(muscle)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedMuscle?.id === muscle.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {muscle.name}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 h-6 w-6 rounded-full text-gray-500 hover:bg-gray-100"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent selecting the muscle when clicking the info button
                          onOpenNotionPage(muscle.id, muscle.name);
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

        {/* Selected Muscle Display */}
        {selectedMuscle && (
          <Card className="border-2 border-purple-300 bg-purple-50 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
              <CardTitle className="text-xl font-bold text-purple-800 flex items-center gap-2">
                {selectedMuscle.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-2 h-6 w-6 rounded-full text-gray-500 hover:bg-gray-100"
                  onClick={() => onOpenNotionPage(selectedMuscle.id, selectedMuscle.name)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </CardTitle>
              <div className="flex gap-2">
                {selectedMuscle.meridian && (
                  <Badge variant="secondary" className="bg-purple-200 text-purple-800">
                    {selectedMuscle.meridian}
                  </Badge>
                )}
                {selectedMuscle.organSystem && (
                  <Badge variant="secondary" className="bg-purple-200 text-purple-800">
                    {selectedMuscle.organSystem}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-2 space-y-3 text-gray-800">
              {selectedMuscle.testPosition && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-semibold text-purple-700">
                    <Image className="w-4 h-4" />
                    Test Position
                  </Label>
                  <img src={selectedMuscle.testPosition} alt={`${selectedMuscle.name} Test Position`} className="w-full h-auto rounded-md object-cover" />
                </div>
              )}
              {selectedMuscle.nlPoints && (
                <div>
                  <p className="font-semibold text-purple-700">NL Points (Neurolymphatic):</p>
                  <p className="text-sm">{selectedMuscle.nlPoints}</p>
                </div>
              )}
              {selectedMuscle.nvPoints && (
                <div>
                  <p className="font-semibold text-purple-700">NV Points (Neurovascular):</p>
                  <p className="text-sm">{selectedMuscle.nvPoints}</p>
                </div>
              )}
              {selectedMuscle.nutritionSupport.length > 0 && (
                <div>
                  <p className="font-semibold text-purple-700">Nutrition Support:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedMuscle.nutritionSupport.map((nut, i) => (
                      <Badge key={i} variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                        {nut}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedMuscle.emotionalTheme.length > 0 && (
                <div>
                  <p className="font-semibold text-purple-700">Emotional Theme:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedMuscle.emotionalTheme.map((emotion, i) => (
                      <Badge key={i} variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                        {emotion}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Strength Logging Buttons */}
              <div className="flex gap-2 mt-4">
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => handleLogStrength(true)}
                  disabled={loadingMuscles}
                >
                  {loadingMuscles ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Body Yes (Strong)
                </Button>
                <Button
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => handleLogStrength(false)}
                  disabled={loadingMuscles}
                >
                  {loadingMuscles ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Body No (Weak)
                </Button>
                <Button variant="outline" onClick={handleClearAll} disabled={loadingMuscles}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weakness Checklist / Correction Card */}
        {selectedMuscle && showWeaknessChecklist && (
          <Card className="border-2 border-red-400 bg-red-50 shadow-md">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xl font-bold text-red-800 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Weakness Checklist for {selectedMuscle.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-4 text-gray-800">
              <div>
                <p className="font-semibold text-red-700">1. NL Points (Rub):</p>
                <p className="text-sm">{selectedMuscle.nlPoints || 'N/A'}</p>
              </div>
              <div>
                <p className="font-semibold text-red-700">2. NV Points (Hold):</p>
                <p className="text-sm">{selectedMuscle.nvPoints || 'N/A'}</p>
              </div>
              <div>
                <p className="font-semibold text-red-700">3. Meridian Suggestion:</p>
                <p className="text-sm">
                  Associated Meridian: {selectedMuscle.meridian || 'N/A'}. Consider tracing the meridian or checking beginning/ending points.
                </p>
              </div>
              <div>
                <p className="font-semibold text-red-700">4. Nutrition Support:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedMuscle.nutritionSupport.length > 0 ? (
                    selectedMuscle.nutritionSupport.map((nut, i) => (
                      <Badge key={i} variant="outline" className="bg-red-100 text-red-700 border-red-300">
                        {nut}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm">No specific nutrition support listed.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="font-semibold text-red-700">5. Cerebrospinal Fluid:</p>
                <p className="text-sm">Suggest a cranial or spinal check (e.g., Sphenoid, Sacrum).</p>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};

export default MuscleSelector;