"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Search, Check, ChevronsUpDown, Hand, Heart, Brain, FlaskConical, XCircle, CircleCheck, Info, Image, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface Muscle {
  id: string;
  name: string;
  meridian: string;
  organSystem: string;
  nlPoints: string;
  nvPoints: string;
  emotionalTheme: string[];
  nutritionSupport: string[];
  testPosition: string; // URL to image
}

interface MuscleSelectorProps {
  onMuscleSelected: (muscle: Muscle) => void;
  onMuscleStrengthLogged: (muscle: Muscle, isStrong: boolean) => void;
  appointmentId: string;
}

const MuscleSelector: React.FC<MuscleSelectorProps> = ({ onMuscleSelected, onMuscleStrengthLogged, appointmentId }) => {
  const [allMuscles, setAllMuscles] = useState<Muscle[]>([]);
  const [filteredMuscles, setFilteredMuscles] = useState<Muscle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'muscle' | 'meridian' | 'organ' | 'emotion'>('muscle');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);
  const [showWeaknessChecklist, setShowWeaknessChecklist] = useState(false);
  const [needsConfig, setNeedsConfig] = useState(false); // New state for config check

  const { toast } = useToast();
  const navigate = useNavigate(); // Initialize useNavigate
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcriagmovotwuqbppcfm.supabase.co';

  const fetchMuscles = useCallback(async (term: string = '', type: 'muscle' | 'meridian' | 'organ' | 'emotion' = 'muscle') => {
    console.log('[MuscleSelector][fetchMuscles] Function called with term:', term, 'and type:', type);
    setLoading(true);
    setNeedsConfig(false); // Reset config state
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[MuscleSelector][fetchMuscles] Supabase session error:', error.message);
        throw error;
      }
      if (!session) {
        console.warn('[MuscleSelector][fetchMuscles] No active session, showing toast.');
        toast({ variant: 'destructive', title: 'Not authenticated', description: 'Please log in first' });
        return;
      }
      console.log('[MuscleSelector][fetchMuscles] User session found:', session.user?.id);

      // Check Notion secrets for muscles_database_id
      const { data: secrets, error: secretsError } = await supabase
        .from('notion_secrets')
        .select('muscles_database_id')
        .eq('user_id', session.user.id)
        .single();

      if (secretsError && secretsError.code !== 'PGRST116') { // PGRST116 means "no rows found"
        throw secretsError;
      }
      if (!secrets || !secrets.muscles_database_id) {
        setNeedsConfig(true);
        setLoading(false);
        return;
      }


      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/get-muscles`;
      const requestBody = JSON.stringify({ searchTerm: term, searchType: type });
      console.log('[MuscleSelector][fetchMuscles] Calling edge function:', edgeFunctionUrl);
      console.log('[MuscleSelector][fetchMuscles] Request body:', requestBody);

      const response = await fetch(
        edgeFunctionUrl,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: requestBody
        }
      );

      console.log('[MuscleSelector][fetchMuscles] Edge function response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[MuscleSelector][fetchMuscles] Edge function error response:', errorData);
        throw new Error(errorData.error || 'Failed to fetch muscles');
      }

      const data = await response.json();
      console.log('[MuscleSelector][fetchMuscles] Edge function success data:', data);
      setAllMuscles(data.muscles);
      setFilteredMuscles(data.muscles);
    } catch (err: any) {
      console.error('[MuscleSelector][fetchMuscles] Error fetching muscles:', err);
      toast({ variant: 'destructive', title: 'Error', description: `Failed to load muscles: ${err.message}` });
      setAllMuscles([]);
      setFilteredMuscles([]);
    } finally {
      setLoading(false);
      console.log('[MuscleSelector][fetchMuscles] Function execution finished.');
    }
  }, [toast, supabaseUrl, navigate]);

  useEffect(() => {
    fetchMuscles(); // Fetch all muscles initially
  }, [fetchMuscles]);

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = allMuscles.filter(muscle => {
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
    setFilteredMuscles(filtered);
  }, [searchTerm, allMuscles, searchType]);

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
      toast({
        title: 'Muscle Strength Logged',
        description: `${selectedMuscle.name} marked as ${isStrong ? 'Strong' : 'Weak'}.`,
      });
    }
  };

  const handleSearchTypeChange = (type: 'muscle' | 'meridian' | 'organ' | 'emotion') => {
    setSearchType(type);
    setSearchTerm(''); // Clear search term when type changes
    setFilteredMuscles(allMuscles); // Reset filtered muscles
    setIsSearchOpen(true); // Open popover for new search
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
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Search Input */}
        <div className="space-y-2">
          <Label htmlFor="muscle-search" className="flex items-center gap-2 font-semibold text-gray-700">
            <Search className="w-4 h-4 text-indigo-600" />
            Search Muscles
          </Label>
          <div className="flex gap-2 mb-4">
            <Button
              variant={searchType === 'muscle' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('muscle')}
              className={cn(searchType === 'muscle' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
            >
              Muscle Name
            </Button>
            <Button
              variant={searchType === 'organ' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('organ')}
              className={cn(searchType === 'organ' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
            >
              Organ System
            </Button>
            <Button
              variant={searchType === 'emotion' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('emotion')}
              className={cn(searchType === 'emotion' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
            >
              Emotion
            </Button>
          </div>
          <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <PopoverTrigger asChild>
              <Input
                id="muscle-search"
                type="text"
                placeholder={`Search by ${searchType}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsSearchOpen(true)}
                className="w-full"
              />
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                {loading && <CommandInput value={searchTerm} onValueChange={setSearchTerm} placeholder="Loading muscles..." disabled />}
                {!loading && <CommandInput value={searchTerm} onValueChange={setSearchTerm} placeholder={`Search ${searchType}...`} />}
                <CommandEmpty>No muscles found.</CommandEmpty>
                <CommandGroup>
                  {filteredMuscles.map((muscle) => (
                    <CommandItem
                      key={muscle.id}
                      value={muscle.name}
                      onSelect={() => handleSelectMuscle(muscle)}
                    >
                      {muscle.name}
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
              <CardTitle className="text-xl font-bold text-purple-800">
                {selectedMuscle.name}
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
                >
                  <CircleCheck className="w-4 h-4 mr-2" />
                  Body Yes (Strong)
                </Button>
                <Button
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => handleLogStrength(false)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Body No (Weak)
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