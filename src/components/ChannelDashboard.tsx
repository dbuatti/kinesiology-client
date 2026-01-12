"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { Settings, Loader2, Sparkles, ExternalLink, Waves, Leaf, Flame, Gem, Droplet, Sun, Heart, Hand, Footprints, Bone, FlaskConical, Mic, Tag, XCircle, PlusCircle, Brain, Clock } from 'lucide-react';
import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
import { Channel, GetChannelsPayload, GetChannelsResponse } from '@/types/api';

interface ChannelDashboardProps {
  appointmentId: string;
}

const primaryElements = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

const ChannelDashboard: React.FC<ChannelDashboardProps> = ({ appointmentId }) => {
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
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

  const { meridian, nonMeridian } = useMemo(() => { // Corrected destructuring here
    const meridianChannels: Channel[] = [];
    const nonMeridianChannels: Channel[] = [];

    allChannels.forEach(channel => {
      const hasPrimaryElement = channel.elements.some(element => primaryElements.includes(element));
      if (hasPrimaryElement) {
        meridianChannels.push(channel);
      } else {
        nonMeridianChannels.push(channel);
      }
    });

    // Sort meridian channels by element, then by name
    meridianChannels.sort((a, b) => {
      const elementA = primaryElements.indexOf(a.elements[0] || '');
      const elementB = primaryElements.indexOf(b.elements[0] || '');
      if (elementA !== elementB) {
        return elementA - elementB;
      }
      return a.name.localeCompare(b.name);
    });

    // Sort non-meridian channels by name
    nonMeridianChannels.sort((a, b) => a.name.localeCompare(b.name));

    return { meridian: meridianChannels, nonMeridian: nonMeridianChannels }; // Return with correct keys
  }, [allChannels]);

  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannelForDisplay(channel);
  };

  const handleClearSelection = () => {
    setSelectedChannelForDisplay(null);
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
        {loadingChannels ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : channelsError ? (
          <p className="text-red-500 text-center">{channelsError}</p>
        ) : (
          <>
            {/* Meridian Channels */}
            <div className="flex flex-wrap gap-2">
              {meridian.map(channel => (
                <Button
                  key={channel.id}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-center text-xs h-auto py-1 px-3 rounded-full",
                    getElementColorClass(channel.elements),
                    selectedChannelForDisplay?.id === channel.id && "ring-2 ring-offset-2 ring-indigo-500"
                  )}
                  onClick={() => handleSelectChannel(channel)}
                >
                  {channel.name}
                </Button>
              ))}
            </div>

            {/* Non-Meridian Channels */}
            {nonMeridian.length > 0 && (
              <>
                <Separator className="my-6" />
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-gray-600" /> Other Channels
                </h3>
                <div className="flex flex-wrap gap-2">
                  {nonMeridian.map(channel => (
                    <Button
                      key={channel.id}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "text-xs h-auto py-1 px-3 rounded-full bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100",
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
              <div className="flex items-start gap-2">
                <Footprints className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Pathways:</span> {selectedChannelForDisplay.pathways || 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <FlaskConical className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Functions:</span> {selectedChannelForDisplay.functions || 'N/A'}</p>
              </div>
              {/* Emotional Themes - Always render, show N/A if empty */}
              <div className="flex items-start gap-2">
                <Heart className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Emotional Themes:</span> {selectedChannelForDisplay.emotions.length > 0 ? selectedChannelForDisplay.emotions.join(', ') : 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <Hand className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Front Mu:</span> {selectedChannelForDisplay.frontMu || 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <Waves className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">He Sea:</span> {selectedChannelForDisplay.heSea || 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <Droplet className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Jing River:</span> {selectedChannelForDisplay.jingRiver || 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Jing Well:</span> {selectedChannelForDisplay.jingWell || 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <Hand className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">AK Muscles:</span> {selectedChannelForDisplay.akMuscles.length > 0 ? selectedChannelForDisplay.akMuscles.join(', ') : 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <Bone className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">TCM Muscles:</span> {selectedChannelForDisplay.tcmMuscles.length > 0 ? selectedChannelForDisplay.tcmMuscles.join(', ') : 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Yuan Points:</span> {selectedChannelForDisplay.yuanPoints || 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Sedate 1:</span> {selectedChannelForDisplay.sedate1 || 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Sedate 2:</span> {selectedChannelForDisplay.sedate2 || 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <PlusCircle className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Tonify 1:</span> {selectedChannelForDisplay.tonify1 || 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <PlusCircle className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Tonify 2:</span> {selectedChannelForDisplay.tonify2 || 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <Mic className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Appropriate Sound:</span> {selectedChannelForDisplay.appropriateSound || 'N/A'}</p>
              </div>
              {/* Tags - Always render, show N/A if empty */}
              <div className="flex items-start gap-2">
                <Tag className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  <p><span className="font-semibold text-indigo-700">Tags:</span> {selectedChannelForDisplay.tags.length > 0 ? selectedChannelForDisplay.tags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="bg-gray-100 text-gray-700 text-xs">
                      {tag}
                    </Badge>
                  )) : 'N/A'}</p>
                </div>
              </div>
              {/* New fields */}
              <div className="flex items-start gap-2">
                <Brain className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Brain Aspects:</span> {selectedChannelForDisplay.brainAspects || 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <Hand className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Activate Sinew:</span> {selectedChannelForDisplay.activateSinew || 'N/A'}</p>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
                <p><span className="font-semibold text-indigo-700">Time:</span> {selectedChannelForDisplay.time || 'N/A'}</p>
              </div>
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