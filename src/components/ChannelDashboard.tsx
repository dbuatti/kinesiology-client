"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { Search, Check, ChevronsUpDown, Settings, Loader2, Sparkles, ExternalLink, Waves, Leaf, Flame, Gem, Droplet, Sun, Heart, Hand, Walk, Bone, FlaskConical, Mic, Tag, XCircle, PlusCircle } from 'lucide-react';
import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
import { Channel, GetChannelsPayload, GetChannelsResponse } from '@/types/api';

interface ChannelDashboardProps {
  appointmentId: string;
}

const ChannelDashboard: React.FC<ChannelDashboardProps> = ({ appointmentId }) => {
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [filteredChannels, setFilteredChannels] = useState<Channel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'element' | 'emotion'>('name');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const navigate = useNavigate();

  const getElementColorClass = (elements: string[]): string => {
    const primaryElement = elements[0]?.toLowerCase();
    switch (primaryElement) {
      case 'fire':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'metal':
        return 'bg-gray-100 border-gray-300 text-gray-800';
      case 'wood':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'water':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'earth':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default:
        return 'bg-indigo-100 border-indigo-300 text-indigo-800';
    }
  };

  const getElementIcon = (element: string) => {
    switch (element.toLowerCase()) {
      case 'fire': return <Flame className="w-4 h-4 text-red-600" />;
      case 'metal': return <Gem className="w-4 h-4 text-gray-600" />;
      case 'wood': return <Leaf className="w-4 h-4 text-green-600" />;
      case 'water': return <Droplet className="w-4 h-4 text-blue-600" />;
      case 'earth': return <Sun className="w-4 h-4 text-yellow-600" />;
      default: return <Sparkles className="w-4 h-4 text-indigo-600" />;
    }
  };

  const onChannelsSuccess = useCallback((data: GetChannelsResponse) => {
    setAllChannels(data.channels);
    setFilteredChannels(data.channels);
  }, []);

  const onChannelsError = useCallback((msg: string) => {
    showError(`Failed to load channels: ${msg}`);
    setAllChannels([]);
    setFilteredChannels([]);
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

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = allChannels.filter(channel => {
      if (searchType === 'name') {
        return channel.name.toLowerCase().includes(lowerCaseSearchTerm);
      } else if (searchType === 'element') {
        return channel.elements.some(element => element.toLowerCase().includes(lowerCaseSearchTerm));
      } else if (searchType === 'emotion') {
        return channel.emotions.some(emotion => emotion.toLowerCase().includes(lowerCaseSearchTerm));
      }
      return false;
    });
    setFilteredChannels(filtered);
  }, [searchTerm, allChannels, searchType]);

  const handleSearchTypeChange = (type: 'name' | 'element' | 'emotion') => {
    setSearchType(type);
    setSearchTerm(''); // Clear search term when type changes
    setFilteredChannels(allChannels); // Reset filtered channels
    setIsSearchOpen(true); // Open popover for new search
  };

  const handleCardClick = (channel: Channel) => {
    setSelectedChannel(channel);
    setIsDetailDialogOpen(true);
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
                      onSelect={() => {
                        handleCardClick(channel); // Directly open detail dialog on select
                        setIsSearchOpen(false);
                        setSearchTerm(channel.name); // Keep selected name in search input
                      }}
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
        ) : filteredChannels.length === 0 ? (
          <p className="text-gray-600 text-center">No channels found matching your criteria.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChannels.map((channel) => (
              <Card
                key={channel.id}
                className={cn(
                  "cursor-pointer hover:shadow-lg transition-shadow duration-200",
                  getElementColorClass(channel.elements)
                )}
                onClick={() => handleCardClick(channel)}
              >
                <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    {channel.name}
                  </CardTitle>
                  {channel.elements.length > 0 && (
                    <Badge variant="secondary" className="bg-white/50 text-gray-800">
                      {getElementIcon(channel.elements[0])}
                      <span className="ml-1">{channel.elements[0]}</span>
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-2 text-sm">
                  {channel.emotions.length > 0 && (
                    <p className="text-gray-700">
                      <span className="font-semibold">Emotions:</span> {channel.emotions.join(', ')}
                    </p>
                  )}
                  {channel.pathways && (
                    <p className="text-gray-700 truncate">
                      <span className="font-semibold">Pathways:</span> {channel.pathways}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Channel Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="sm:max-w-[800px] p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-indigo-800 flex items-center gap-2">
                {selectedChannel?.name}
                {selectedChannel?.id && (
                  <a
                    href={`https://www.notion.so/${selectedChannel.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-indigo-600 hover:text-indigo-800"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
              </DialogTitle>
              {selectedChannel?.elements.length > 0 && (
                <DialogDescription className="flex items-center gap-2 text-lg font-medium text-gray-700">
                  {getElementIcon(selectedChannel.elements[0])}
                  {selectedChannel.elements[0]} Channel
                </DialogDescription>
              )}
            </DialogHeader>
            <ScrollArea className="h-[70vh] pr-4">
              <div className="space-y-6 py-4">
                {selectedChannel?.pathways && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <Walk className="w-4 h-4" /> Pathways
                    </h3>
                    <p className="text-gray-800 text-sm">{selectedChannel.pathways}</p>
                  </div>
                )}
                {selectedChannel?.functions && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <FlaskConical className="w-4 h-4" /> Functions
                    </h3>
                    <p className="text-gray-800 text-sm">{selectedChannel.functions}</p>
                  </div>
                )}
                {selectedChannel?.emotions.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <Heart className="w-4 h-4" /> Emotional Themes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedChannel.emotions.map((emotion, i) => (
                        <Badge key={i} variant="secondary" className="bg-indigo-100 text-indigo-700">
                          {emotion}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedChannel?.frontMu && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <Hand className="w-4 h-4" /> Front Mu
                    </h3>
                    <p className="text-gray-800 text-sm">{selectedChannel.frontMu}</p>
                  </div>
                )}
                {selectedChannel?.heSea && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <Waves className="w-4 h-4" /> He Sea
                    </h3>
                    <p className="text-gray-800 text-sm">{selectedChannel.heSea}</p>
                  </div>
                )}
                {selectedChannel?.jingRiver && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <Droplet className="w-4 h-4" /> Jing River
                    </h3>
                    <p className="text-gray-800 text-sm">{selectedChannel.jingRiver}</p>
                  </div>
                )}
                {selectedChannel?.jingWell && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4" /> Jing Well
                    </h3>
                    <p className="text-gray-800 text-sm">{selectedChannel.jingWell}</p>
                  </div>
                )}
                {selectedChannel?.akMuscles.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <Hand className="w-4 h-4" /> AK Muscles
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedChannel.akMuscles.map((muscle, i) => (
                        <Badge key={i} variant="secondary" className="bg-indigo-100 text-indigo-700">
                          {muscle}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedChannel?.tcmMuscles.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <Bone className="w-4 h-4" /> TCM Muscles
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedChannel.tcmMuscles.map((muscle, i) => (
                        <Badge key={i} variant="secondary" className="bg-indigo-100 text-indigo-700">
                          {muscle}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedChannel?.yuanPoints && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4" /> Yuan Points
                    </h3>
                    <p className="text-gray-800 text-sm">{selectedChannel.yuanPoints}</p>
                  </div>
                )}
                {selectedChannel?.sedate1 && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <XCircle className="w-4 h-4" /> Sedate 1
                    </h3>
                    <p className="text-gray-800 text-sm">{selectedChannel.sedate1}</p>
                  </div>
                )}
                {selectedChannel?.sedate2 && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <XCircle className="w-4 h-4" /> Sedate 2
                    </h3>
                    <p className="text-gray-800 text-sm">{selectedChannel.sedate2}</p>
                  </div>
                )}
                {selectedChannel?.tonify1 && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <PlusCircle className="w-4 h-4" /> Tonify 1
                    </h3>
                    <p className="text-gray-800 text-sm">{selectedChannel.tonify1}</p>
                  </div>
                )}
                {selectedChannel?.tonify2 && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <PlusCircle className="w-4 h-4" /> Tonify 2
                    </h3>
                    <p className="text-gray-800 text-sm">{selectedChannel.tonify2}</p>
                  </div>
                )}
                {selectedChannel?.appropriateSound && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <Mic className="w-4 h-4" /> Appropriate Sound
                    </h3>
                    <p className="text-gray-800 text-sm">{selectedChannel.appropriateSound}</p>
                  </div>
                )}
                {selectedChannel?.tags.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                      <Tag className="w-4 h-4" /> Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedChannel.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="bg-gray-100 text-gray-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ChannelDashboard;