"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { Search, Check, ChevronsUpDown, Settings, Loader2, Sparkles, ExternalLink, Waves, Leaf, Flame, Gem, Droplet, Sun, Heart, Hand, Footprints, Bone, FlaskConical, Mic, Tag, XCircle, PlusCircle } from 'lucide-react';
import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
import { Channel, GetChannelsPayload, GetChannelsResponse } from '@/types/api';

interface ChannelDashboardProps {
  appointmentId: string;
}

const primaryElements = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

const ChannelDashboard: React.FC<ChannelDashboardProps> = ({ appointmentId }) => {
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'element' | 'emotion'>('name');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedChannelForDisplay, setSelectedChannelForDisplay] = useState<Channel | null>(null);

  const navigate = useNavigate();

  const getElementColorClass = (elements: string[]): string => {
    const primaryElement = elements[0]?.toLowerCase();
    switch (primaryElement) {
      case 'fire':
        return 'bg-red-100 border-red-300 text-red-800 hover:bg-red-200';
      case 'metal':
        return 'bg-gray-100 border-gray-300 text-gray-800 hover:bg-gray-200';
      case 'wood':
        return 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200';
      case 'water':
        return 'bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200';
      case 'earth':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200';
      default:
        return 'bg-indigo-100 border-indigo-300 text-indigo-800 hover:bg-indigo-200';
    }
  };

  const getElementIcon = (element: string) => {
    switch (element.toLowerCase()) {
      case 'fire': return <Flame className="w-3 h-3 text-red-600" />;
      case 'metal': return <Gem className="w-3 h-3 text-gray-600" />;
      case 'wood': return <Leaf className="w-3 h-3 text-green-600" />;
      case 'water': return <Droplet className="w-3 h-3 text-blue-600" />;
      case 'earth': return <Sun className="w-3 h-3 text-yellow-600" />;
      default: return <Sparkles className="w-3 h-3 text-indigo-600" />;
    }
  };

  const onChannelsSuccess = useCallback((data: GetChannelsResponse) => {
    setAllChannels(data.channels);
  }, []);

  const onChannelsError = useCallback((msg: string) => {
    showError(`Failed to load channels: ${msg}`);
    setAllChannels([]);
  }, []);

  const {
    loading: loadingChannels,
    error: channelsError,
    needsConfig,
    execute: fetchChannels,
  } = useSupabaseEdgeFunction<GetChannelsPayload, GetChannelsResponse>(
    'get-channels',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      onSuccess: onChannelsSuccess,
      onError: onChannelsError,
    }
  );

  useEffect(() => {
    fetchChannels({ searchTerm: '', searchType: 'name' }); // Fetch all channels initially
  }, [fetchChannels]);

  const filteredChannels = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return allChannels.filter(channel => {
      if (searchType === 'name') {
        return channel.name.toLowerCase().includes(lowerCaseSearchTerm);
      } else if (searchType === 'element') {
        return channel.elements.some(element => element.toLowerCase().includes(lowerCaseSearchTerm));
      } else if (searchType === 'emotion') {
        return channel.emotions.some(emotion => emotion.toLowerCase().includes(lowerCaseSearchTerm));
      }
      return false;
    });
  }, [searchTerm, allChannels, searchType]);

  const { meridianChannels, nonMeridianChannels } = useMemo(() => {
    const meridian: Channel[] = [];
    const nonMeridian: Channel[] = [];

    allChannels.forEach(channel => { // Use allChannels here for initial grouping
      const hasPrimaryElement = channel.elements.some(element => primaryElements.includes(element));
      if (hasPrimaryElement) {
        meridian.push(channel);
      } else {
        nonMeridian.push(channel);
      }
    });
    return { meridianChannels: meridian, nonMeridianChannels: nonMeridian };
  }, [allChannels]); // Depend on allChannels

  const groupedMeridianChannels = useMemo(() => {
    const groups: { [key: string]: Channel[] } = {};
    primaryElements.forEach(element => {
      groups[element] = meridianChannels.filter(channel => channel.elements.includes(element));
    });
    return groups;
  }, [meridianChannels]);

  const handleSearchTypeChange = (type: 'name' | 'element' | 'emotion') => {
    setSearchType(type);
    setSearchTerm(''); // Clear search term when type changes
    setIsSearchOpen(true); // Open popover for new search
  };

  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannelForDisplay(channel);
    setIsSearchOpen(false);
    setSearchTerm(channel.name); // Keep selected name in search input
  };

  const handleClearSelection = () => {
    setSelectedChannelForDisplay(null);
    setSearchTerm('');
    fetchChannels({ searchTerm: '', searchType: 'name' }); // Re-fetch all for next search
  };

  const handleConfigureNotion = () => {
    navigate('/notion-config');
  };

  if (needsConfig) {
    return (
      <Card className="max-w-md w-full shadow-xl mx-auto">
        <CardContent className="pt-8 text-center">
          <div className="mx-auto mb-4 p-4 bg-indigo-100 rounded-full w-20 h-20 flex items-center justify-center">
            <Settings className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-indigo-900 mb-2">
            Notion Channels Database Required
          </h2>
          <p className="text-gray-600 mb-6">
            Please configure your Notion Channels Database ID to use the Channel Dashboard.
          </p>
          <Button
            className="w-full h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            onClick={handleConfigureNotion}
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
          <Waves className="w-5 h-5" />
          Channel Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Search Input */}
        <div className="space-y-2">
          <Label htmlFor="channel-search" className="flex items-center gap-2 font-semibold text-gray-700">
            <Search className="w-4 h-4 text-indigo-600" />
            Search Channels
          </Label>
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button
              variant={searchType === 'name' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('name')}
              className={cn(searchType === 'name' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
              disabled={loadingChannels}
            >
              Name
            </Button>
            <Button
              variant={searchType === 'element' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('element')}
              className={cn(searchType === 'element' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
              disabled={loadingChannels}
            >
              Element
            </Button>
            <Button
              variant={searchType === 'emotion' ? 'default' : 'outline'}
              onClick={() => handleSearchTypeChange('emotion')}
              className={cn(searchType === 'emotion' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50')}
              disabled={loadingChannels}
            >
              Emotion
            </Button>
          </div>
          <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <PopoverTrigger asChild>
              <Input
                id="channel-search"
                type="text"
                placeholder={`Search by ${searchType}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsSearchOpen(true)}
                className="w-full"
                disabled={loadingChannels}
              />
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                {loadingChannels && <CommandInput value={searchTerm} onValueChange={setSearchTerm} placeholder="Loading channels..." disabled />}
                {!loadingChannels && <CommandInput value={searchTerm} onValueChange={setSearchTerm} placeholder={`Search ${searchType}...`} />}
                <CommandEmpty>No channels found.</CommandEmpty>
                <CommandGroup>
                  {filteredChannels.map((channel) => (
                    <CommandItem
                      key={channel.id}
                      value={channel.name}
                      onSelect={() => handleSelectChannel(channel)}
                    >
                      {channel.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {loadingChannels ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : channelsError ? (
          <p className="text-red-500 text-center">{channelsError}</p>
        ) : (
          <>
            {/* Meridian Channels Grouped by Element */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {primaryElements.map(element => (
                <div key={element} className="flex flex-col space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                    {getElementIcon(element)} {element}
                  </h3>
                  <div className="flex flex-col space-y-1">
                    {groupedMeridianChannels[element].map(channel => (
                      <Button
                        key={channel.id}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-xs h-auto py-1 px-2 rounded-full",
                          getElementColorClass(channel.elements),
                          selectedChannelForDisplay?.id === channel.id && "ring-2 ring-offset-2 ring-indigo-500"
                        )}
                        onClick={() => handleSelectChannel(channel)}
                      >
                        {channel.name}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Non-Meridian Channels */}
            {nonMeridianChannels.length > 0 && (
              <>
                <Separator className="my-6" />
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-gray-600" /> Other Channels
                </h3>
                <div className="flex flex-wrap gap-2">
                  {nonMeridianChannels.map(channel => (
                    <Button
                      key={channel.id}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "text-xs h-auto py-1 px-2 rounded-full bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100",
                        selectedChannelForDisplay?.id === channel.id && "ring-2 ring-offset-2 ring-indigo-500"
                      )}
                      onClick={() => handleSelectChannel(channel)}
                    >
                      {channel.name}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Selected Channel Summary Display */}
        {selectedChannelForDisplay && (
          <Card className="border-2 border-indigo-300 bg-indigo-50 shadow-md mt-6 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-indigo-800 flex items-center gap-2">
                {selectedChannelForDisplay.name}
                <a
                  href={`https://www.notion.so/${selectedChannelForDisplay.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-indigo-600 hover:text-indigo-800"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </h3>
              <div className="flex gap-1">
                {selectedChannelForDisplay.elements.map((element, i) => (
                  <Badge key={i} variant="secondary" className="bg-indigo-200 text-indigo-800 text-xs">
                    {getElementIcon(element)}
                    <span className="ml-1">{element}</span>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-800">
              {selectedChannelForDisplay.pathways && (
                <div className="flex items-start gap-2">
                  <Footprints className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">Pathways:</span> {selectedChannelForDisplay.pathways}</p>
                </div>
              )}
              {selectedChannelForDisplay.functions && (
                <div className="flex items-start gap-2">
                  <FlaskConical className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">Functions:</span> {selectedChannelForDisplay.functions}</p>
                </div>
              )}
              {selectedChannelForDisplay.emotions.length > 0 && (
                <div className="flex items-start gap-2">
                  <Heart className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">Emotional Themes:</span> {selectedChannelForDisplay.emotions.join(', ')}</p>
                </div>
              )}
              {selectedChannelForDisplay.frontMu && (
                <div className="flex items-start gap-2">
                  <Hand className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">Front Mu:</span> {selectedChannelForDisplay.frontMu}</p>
                </div>
              )}
              {selectedChannelForDisplay.heSea && (
                <div className="flex items-start gap-2">
                  <Waves className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">He Sea:</span> {selectedChannelForDisplay.heSea}</p>
                </div>
              )}
              {selectedChannelForDisplay.jingRiver && (
                <div className="flex items-start gap-2">
                  <Droplet className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">Jing River:</span> {selectedChannelForDisplay.jingRiver}</p>
                </div>
              )}
              {selectedChannelForDisplay.jingWell && (
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">Jing Well:</span> {selectedChannelForDisplay.jingWell}</p>
                </div>
              )}
              {selectedChannelForDisplay.akMuscles.length > 0 && (
                <div className="flex items-start gap-2">
                  <Hand className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">AK Muscles:</span> {selectedChannelForDisplay.akMuscles.join(', ')}</p>
                </div>
              )}
              {selectedChannelForDisplay.tcmMuscles.length > 0 && (
                <div className="flex items-start gap-2">
                  <Bone className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">TCM Muscles:</span> {selectedChannelForDisplay.tcmMuscles.join(', ')}</p>
                </div>
              )}
              {selectedChannelForDisplay.yuanPoints && (
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">Yuan Points:</span> {selectedChannelForDisplay.yuanPoints}</p>
                </div>
              )}
              {selectedChannelForDisplay.sedate1 && (
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">Sedate 1:</span> {selectedChannelForDisplay.sedate1}</p>
                </div>
              )}
              {selectedChannelForDisplay.sedate2 && (
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">Sedate 2:</span> {selectedChannelForDisplay.sedate2}</p>
                </div>
              )}
              {selectedChannelForDisplay.tonify1 && (
                <div className="flex items-start gap-2">
                  <PlusCircle className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">Tonify 1:</span> {selectedChannelForDisplay.tonify1}</p>
                </div>
              )}
              {selectedChannelForDisplay.tonify2 && (
                <div className="flex items-start gap-2">
                  <PlusCircle className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">Tonify 2:</span> {selectedChannelForDisplay.tonify2}</p>
                </div>
              )}
              {selectedChannelForDisplay.appropriateSound && (
                <div className="flex items-start gap-2">
                  <Mic className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <p><span className="font-semibold text-indigo-700">Appropriate Sound:</span> {selectedChannelForDisplay.appropriateSound}</p>
                </div>
              )}
              {selectedChannelForDisplay.tags.length > 0 && (
                <div className="flex items-start gap-2">
                  <Tag className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {selectedChannelForDisplay.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="bg-gray-100 text-gray-700 text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={handleClearSelection} size="sm">
                <XCircle className="h-4 w-4 mr-2" />
                Clear Selection
              </Button>
            </div>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};

export default ChannelDashboard;