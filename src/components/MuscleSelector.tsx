"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { Search, Check, ChevronsUpDown, Hand, Info, Image, Settings, Loader2, Trash2, ExternalLink, XCircle, Clock, Brain, FlaskConical, Footprints, Heart, Gem, Leaf, Flame, Droplet, Sun, Bone, Mic, Tag, RefreshCw, Shield, Eye, Sparkles, Waves } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCachedEdgeFunction } from '@/hooks/use-cached-edge-function';
import { useReferenceData } from '@/hooks/use-reference-data'; // Import centralized hook
import { Muscle, GetMusclesPayload, GetMusclesResponse } from '@/types/api';
import { useDebounce } from '@/hooks/use-debounce';

interface MuscleSelectorProps {
  onMuscleSelected: (muscle: Muscle | null) => void;
  onMuscleStrengthLogged: (muscle: Muscle, isStrong: boolean, notes: string) => void;
  appointmentId: string;
  onClearSelection: () => void;
  onOpenNotionPage: (pageId: string, pageTitle: string) => void;
}

const MuscleSelector: React.FC<MuscleSelectorProps> = ({ onMuscleSelected, onMuscleStrengthLogged, appointmentId, onClearSelection, onOpenNotionPage }) => {
  const { data, loading: loadingReferenceData, needsConfig: musclesNeedsConfig } = useReferenceData();
  const allMuscles = data.muscles;

  const [filteredMuscles, setFilteredMuscles] = useState<Muscle[]>(allMuscles);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'muscle' | 'meridian' | 'organ' | 'emotion'>('muscle');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);
  const [showWeaknessChecklist, setShowWeaknessChecklist] = useState(false);
  const [notes, setNotes] = useState('');
  const [isDataCached, setIsDataCached] = useState(true); // Assume cached since data comes from provider

  const navigate = useNavigate();
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Effect to update filteredMuscles when allMuscles changes (i.e., after initial load)
  useEffect(() => {
    setFilteredMuscles(allMuscles);
  }, [allMuscles]);

  // Effect to filter muscles based on search term and type (client-side)
  useEffect(() => {
    const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();
    let currentFiltered: Muscle[] = [];

    if (lowerCaseSearchTerm.trim() === '') {
      currentFiltered = allMuscles;
    } else {
      currentFiltered = allMuscles.filter(muscle => {
        if (searchType === 'muscle') {
          return muscle.name.toLowerCase().includes(lowerCaseSearchTerm);
        } else if (searchType === 'meridian') {
          return muscle.meridian.toLowerCase().includes(lowerCaseSearchTerm);
        } else if (searchType === 'organ') {
          return muscle.organSystem.toLowerCase().includes(lowerCaseSearchTerm);
        } else if (searchType === 'emotion') {
          return muscle.emotionalTheme.some(theme => theme.toLowerCase().includes(lowerCaseSearchTerm));
        }
        return false;
      });
    }
    setFilteredMuscles(currentFiltered);
  }, [debouncedSearchTerm, searchType, allMuscles]);

  const handleClearAll = useCallback(() => {
    setSelectedMuscle(null);
    onMuscleSelected(null);
    setSearchTerm('');
    setFilteredMuscles(allMuscles);
    setShowWeaknessChecklist(false);
    setNotes('');
    onClearSelection();
  }, [onMuscleSelected, allMuscles, onClearSelection]);

  const handleLogStrength = useCallback((isStrong: boolean) => {
    if (selectedMuscle) {
      onMuscleStrengthLogged(selectedMuscle, isStrong, notes);

      if (!isStrong) {
        setShowWeaknessChecklist(true);
        showSuccess(`Muscle strength for ${selectedMuscle.name} logged as WEAK. Review checklist.`);
      } else {
        setShowWeaknessChecklist(false);
        showSuccess(`Muscle strength for ${selectedMuscle.name} logged as STRONG.`);
        handleClearAll();
      }
      setNotes('');
    }
  }, [selectedMuscle, onMuscleStrengthLogged, notes, handleClearAll]);

  const handleSelectMuscle = useCallback((muscle: Muscle) => {
    setSelectedMuscle(muscle);
    onMuscleSelected(muscle);
    setIsSearchOpen(false);
    setSearchTerm(muscle.name);
    setShowWeaknessChecklist(false);
    setNotes('');
  }, [onMuscleSelected]);

  const handleSearchTypeChange = (type: 'muscle' | 'meridian' | 'organ' | 'emotion') => {
    setSearchType(type);
    setSearchTerm('');
    setFilteredMuscles(allMuscles);
    setIsSearchOpen(true);
  };

  const isLoading = loadingReferenceData;

  if (musclesNeedsConfig) {
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
          {isDataCached && (
            <Badge variant="secondary" className="bg-green-200 text-green-800 ml-2">
              Cached
            </Badge>
          )}
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
              disabled={isLoading || !!selectedMuscle}
            >
              Muscle Name
            </Button>
            <Button
              variant={searchType === 'organ' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('organ')}
              className={cn(searchType === 'organ' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
              disabled={isLoading || !!selectedMuscle}
            >
              Organ System
            </Button>
            <Button
              variant={searchType === 'emotion' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('emotion')}
              className={cn(searchType === 'emotion' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
              disabled={isLoading || !!selectedMuscle}
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
                disabled={isLoading || !!selectedMuscle}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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
                <CommandGroup className="max-h-[300px] overflow-y-auto">
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
                          e.stopPropagation();
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-800">
                {selectedMuscle.origin && (
                  <div className="flex items-start gap-2">
                    <Footprints className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Origin:</span> {selectedMuscle.origin}</p>
                  </div>
                )}
                {selectedMuscle.insertion && (
                  <div className="flex items-start gap-2">
                    <Bone className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Insertion:</span> {selectedMuscle.insertion}</p>
                  </div>
                )}
                {selectedMuscle.action && (
                  <div className="flex items-start gap-2">
                    <FlaskConical className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Action:</span> {selectedMuscle.action}</p>
                  </div>
                )}
                {selectedMuscle.position && (
                  <div className="flex items-start gap-2">
                    <Hand className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Position:</span> {selectedMuscle.position}</p>
                  </div>
                )}
                {selectedMuscle.rotation && (
                  <div className="flex items-start gap-2">
                    <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Rotation:</span> {selectedMuscle.rotation}</p>
                  </div>
                )}
                {selectedMuscle.stabilise && (
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Stabilize:</span> {selectedMuscle.stabilise}</p>
                  </div>
                )}
                {selectedMuscle.monitor && (
                  <div className="flex items-start gap-2">
                    <Eye className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Monitor:</span> {selectedMuscle.monitor}</p>
                  </div>
                )}
                {selectedMuscle.nerveSupply && (
                  <div className="flex items-start gap-2">
                    <Brain className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Nerve Supply:</span> {selectedMuscle.nerveSupply}</p>
                  </div>
                )}
                {selectedMuscle.visceralNerves && (
                  <div className="flex items-start gap-2">
                    <Heart className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Visceral Nerves:</span> {selectedMuscle.visceralNerves}</p>
                  </div>
                )}
                {selectedMuscle.neuroLymphaticReflex && (
                  <div className="flex items-start gap-2">
                    <Droplet className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Neuro-Lymphatic Reflex:</span> {selectedMuscle.neuroLymphaticReflex}</p>
                  </div>
                )}
                {selectedMuscle.neuroVascularReflex && (
                  <div className="flex items-start gap-2">
                    <Sun className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Neuro-Vascular Reflex:</span> {selectedMuscle.neuroVascularReflex}</p>
                  </div>
                )}
                {selectedMuscle.relatedYuanPoint && (
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Related Yuan Point:</span> {selectedMuscle.relatedYuanPoint.name}</p>
                  </div>
                )}
                {selectedMuscle.relatedAkChannel && (
                  <div className="flex items-start gap-2">
                    <Waves className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Related AK Channel:</span> {selectedMuscle.relatedAkChannel.name}</p>
                  </div>
                )}
                {selectedMuscle.relatedTcmChannel && (
                  <div className="flex items-start gap-2">
                    <Waves className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Related TCM Channel:</span> {selectedMuscle.relatedTcmChannel.name}</p>
                  </div>
                )}
                {selectedMuscle.type && (
                  <div className="flex items-start gap-2">
                    <Tag className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Type:</span> {selectedMuscle.type}</p>
                  </div>
                )}
                {selectedMuscle.timeAk && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Time (AK):</span> {selectedMuscle.timeAk.name}</p>
                  </div>
                )}
                {selectedMuscle.timeTcm && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                    <p><span className="font-semibold text-purple-700">Time (TCM):</span> {selectedMuscle.timeTcm.name}</p>
                  </div>
                )}
              </div>

              {selectedMuscle.tags.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold text-purple-700">Tags:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedMuscle.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Notes Input */}
              <div className="space-y-2 pt-4">
                <Label htmlFor="muscle-notes" className="flex items-center gap-2 font-semibold text-gray-700">
                  <Mic className="w-4 h-4 text-indigo-600" />
                  Notes (Optional)
                </Label>
                <Textarea
                  id="muscle-notes"
                  placeholder="Add observations, client feedback, or specific correction details here..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[60px]"
                  disabled={isLoading}
                />
              </div>

              {/* Strength Logging Buttons */}
              <div className="flex gap-2 mt-4">
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => handleLogStrength(true)}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Body Yes (Strong)
                </Button>
                <Button
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => handleLogStrength(false)}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Body No (Weak)
                </Button>
                <Button variant="outline" onClick={handleClearAll} disabled={isLoading}>
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