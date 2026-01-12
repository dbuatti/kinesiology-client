"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { Settings, Loader2, Sparkles, ExternalLink, Waves, Leaf, Flame, Gem, Droplet, Sun, Heart, Hand, Footprints, Bone, FlaskConical, Mic, Tag, XCircle, PlusCircle, Brain, Clock, Volume2, Info, CheckCircle2 } from 'lucide-react'; // Added CheckCircle2
import { useSupabaseEdgeFunction } from '@/hooks/use-supabase-edge-function';
import { Channel, GetChannelsPayload, GetChannelsResponse, LogSessionEventPayload, LogSessionEventResponse } from '@/types/api';
import NotionPageViewer from './NotionPageViewer';

interface ChannelDashboardProps {
  appointmentId: string;
  onLogSuccess: () => void;
  onClearSelection: () => void; // New prop for clearing selection
  onOpenNotionPage: (pageId: string, pageTitle: string) => void; // Changed prop name and type
}

const primaryElements = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

// Hardcoded knowledge base for Yuan Points and Front-Mu (Alarm) Points
const yuanAndFrontMuPoints = new Map<string, { yuan: string; frontMu: string }>();
yuanAndFrontMuPoints.set('Lung', { yuan: 'LU9 (Taiyuan)', frontMu: 'LU1 (Zhongfu)' });
yuanAndFrontMuPoints.set('Large Intestine', { yuan: 'LI4 (Hegu)', frontMu: 'ST25 (Tianshu)' });
yuanAndFrontMuPoints.set('Stomach', { yuan: 'ST42 (Chongyang)', frontMu: 'CV12 (Zhongwan)' });
yuanAndFrontMuPoints.set('Spleen', { yuan: 'SP3 (Taibai)', frontMu: 'LV13 (Zhangmen)' });
yuanAndFrontMuPoints.set('Heart', { yuan: 'HT7 (Shenmen)', frontMu: 'CV14 (Juque)' });
yuanAndFrontMuPoints.set('Small Intestine', { yuan: 'SI4 (Wangu)', frontMu: 'CV4 (Guanyuan)' });
yuanAndFrontMuPoints.set('Bladder', { yuan: 'BL64 (Jinggu)', frontMu: 'CV3 (Zhongji)' });
yuanAndFrontMuPoints.set('Kidney', { yuan: 'KI3 (Taixi)', frontMu: 'GB25 (Jingmen)' });
yuanAndFrontMuPoints.set('Pericardium', { yuan: 'PC7 (Daling)', frontMu: 'PC7 (Daling)' }); // Corrected Pericardium Front Mu
yuanAndFrontMuPoints.set('Triple Warmer', { yuan: 'SJ4 (Yangchi)', frontMu: 'CV5 (Shimen)' });
yuanAndFrontMuPoints.set('Gallbladder', { yuan: 'GB40 (Qiuxu)', frontMu: 'GB24 (Riyue)' });
yuanAndFrontMuPoints.set('Liver', { yuan: 'LV3 (Taichong)', frontMu: 'LV14 (Qimen)' });

const ChannelDashboard: React.FC<ChannelDashboardProps> = ({ appointmentId, onLogSuccess, onClearSelection, onOpenNotionPage }) => {
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [selectedChannelForDisplay, setSelectedChannelForDisplay] = useState<Channel | null>(null);
  const [loggedItems, setLoggedItems] = useState<Set<string>>(new Set()); // Fixed: Removed 'new' keyword

  const navigate = useNavigate();

  const getElementColorClasses = (elements: string[]): { bg: string, border: string, text: string, hoverBg: string, ring: string, icon: string } => {
    const primaryElement = elements[0]?.toLowerCase();
    switch (primaryElement) {
      case 'wood':
        return {
          bg: 'bg-green-100',
          border: 'border-green-300',
          text: 'text-green-800',
          hoverBg: 'hover:bg-green-200',
          ring: 'ring-green-500',
          icon: 'text-green-600'
        };
      case 'fire':
        return {
          bg: 'bg-red-100',
          border: 'border-red-300',
          text: 'text-red-800',
          hoverBg: 'hover:bg-red-200',
          ring: 'ring-red-500',
          icon: 'text-red-600'
        };
      case 'earth':
        return {
          bg: 'bg-yellow-100',
          border: 'border-yellow-300',
          text: 'text-yellow-800',
          hoverBg: 'hover:bg-yellow-200',
          ring: 'ring-yellow-500',
          icon: 'text-yellow-600'
        };
      case 'metal':
        return {
          bg: 'bg-gray-100',
          border: 'border-gray-300',
          text: 'text-gray-800',
          hoverBg: 'hover:bg-gray-200',
          ring: 'ring-gray-500',
          icon: 'text-gray-600'
        };
      case 'water':
        return {
          bg: 'bg-blue-100',
          border: 'border-blue-300',
          text: 'text-blue-800',
          hoverBg: 'hover:bg-blue-200',
          ring: 'ring-blue-500',
          icon: 'text-blue-600'
        };
      default:
        return {
          bg: 'bg-indigo-100',
          border: 'border-indigo-300',
          text: 'text-indigo-800',
          hoverBg: 'hover:bg-indigo-200',
          ring: 'ring-indigo-500',
          icon: 'text-indigo-600'
        };
    }
  };

  const getElementIcon = (element: string, className: string = "w-3 h-3") => {
    switch (element.toLowerCase()) {
      case 'fire': return <Flame className={cn(className, 'text-red-600')} />;
      case 'metal': return <Gem className={cn(className, 'text-gray-600')} />;
      case 'wood': return <Leaf className={cn(className, 'text-green-600')} />;
      case 'water': return <Droplet className={cn(className, 'text-blue-600')} />;
      case 'earth': return <Sun className={cn(className, 'text-yellow-600')} />;
      default: return <Sparkles className={cn(className, 'text-indigo-600')} />;
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

  // Hook for logging general session events
  const {
    loading: loggingSessionEvent,
    execute: logSessionEvent,
  } = useSupabaseEdgeFunction<LogSessionEventPayload, LogSessionEventResponse>(
    'log-session-event',
    {
      requiresAuth: true,
      onSuccess: (data) => {
        console.log('Channel detail logged to Supabase:', data.logId);
        onLogSuccess();
      },
      onError: (msg) => {
        console.error('Failed to log channel detail to Supabase:', msg);
        showError(`Logging Failed: ${msg}`);
      }
    }
  );

  useEffect(() => {
    fetchChannels({ searchTerm: '', searchType: 'name' });
  }, [fetchChannels]);

  const { meridianChannels, nonMeridianChannels } = useMemo(() => {
    const meridian: Channel[] = [];
    const nonMeridian: Channel[] = [];

    allChannels.forEach(channel => {
      const hasPrimaryElement = channel.elements.some(element => primaryElements.includes(element));
      if (hasPrimaryElement) {
        meridian.push(channel);
      } else {
        nonMeridian.push(channel);
      }
    });

    meridian.sort((a, b) => {
      const elementA = primaryElements.indexOf(a.elements[0] || '');
      const elementB = primaryElements.indexOf(b.elements[0] || '');
      if (elementA !== elementB) {
        return elementA - elementB;
      }
      return a.name.localeCompare(b.name);
    });

    nonMeridian.sort((a, b) => b.name.localeCompare(a.name));

    return { meridianChannels: meridian, nonMeridianChannels: nonMeridian };
  }, [allChannels]);

  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannelForDisplay(channel);
    setLoggedItems(new Set());
  };

  const handleClearAll = () => {
    setSelectedChannelForDisplay(null);
    setLoggedItems(new Set());
    onClearSelection(); // Notify parent of clear action
  };

  const handleConfigureNotion = () => {
    navigate('/notion-config');
  };

  const isItemLogged = (itemType: string, itemValue: string): boolean => {
    if (!selectedChannelForDisplay) return false;
    const logIdentifier = `${selectedChannelForDisplay.id}-${itemType}-${itemValue}`;
    return loggedItems.has(logIdentifier);
  };

  const handleLogItemClick = async (itemType: string, itemValue: string) => {
    if (!selectedChannelForDisplay || !appointmentId) {
      showError('Please select a channel and ensure an active appointment to log details.');
      return;
    }

    const logIdentifier = `${selectedChannelForDisplay.id}-${itemType}-${itemValue}`;
    const currentLoggedItems = new Set(loggedItems);

    if (currentLoggedItems.has(logIdentifier)) {
      // Item is already logged, so unlog it
      currentLoggedItems.delete(logIdentifier);
      setLoggedItems(currentLoggedItems);
      showSuccess(`"${itemValue}" log removed from session.`);
      // In a real scenario, you might also want to delete the log from the database
      // For this exercise, we'll just update the local state and show a message.
    } else {
      // Item is not logged, so log it
      await logSessionEvent({
        appointmentId: appointmentId,
        logType: itemType,
        details: {
          channelId: selectedChannelForDisplay.id,
          channelName: selectedChannelForDisplay.name,
          itemType: itemType,
          itemValue: itemValue,
        }
      });

      if (!loggingSessionEvent) {
        setLoggedItems(prev => new Set(prev).add(logIdentifier));
        showSuccess(`"${itemValue}" logged to session.`);
      }
    }
  };

  const getLoggedClass = (itemType: string, itemValue: string) => {
    return isItemLogged(itemType, itemValue) ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const getCanonicalChannelName = (channelName: string): string => {
    if (channelName.endsWith(' Meridian')) {
      return channelName.replace(' Meridian', '');
    }
    return channelName;
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
              {meridianChannels.map(channel => {
                const colors = getElementColorClasses(channel.elements);
                return (
                  <Button
                    key={channel.id}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-center text-xs h-auto py-1 px-3 rounded-full",
                      colors.bg, colors.border, colors.text, colors.hoverBg,
                      selectedChannelForDisplay?.id === channel.id && `ring-2 ring-offset-2 ${colors.ring}`
                    )}
                    onClick={() => handleSelectChannel(channel)}
                    disabled={loggingSessionEvent}
                  >
                    {channel.name}
                  </Button>
                );
              })}
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
                        "text-xs h-auto py-1 px-3 rounded-full bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100",
                        selectedChannelForDisplay?.id === channel.id && "ring-2 ring-offset-2 ring-indigo-500"
                      )}
                      onClick={() => handleSelectChannel(channel)}
                      disabled={loggingSessionEvent}
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
        {selectedChannelForDisplay && (() => {
          const colors = getElementColorClasses(selectedChannelForDisplay.elements);
          const canonicalChannelName = getCanonicalChannelName(selectedChannelForDisplay.name);
          const derivedYuanPoints = yuanAndFrontMuPoints.get(canonicalChannelName)?.yuan || selectedChannelForDisplay.yuanPoints;
          const derivedFrontMu = yuanAndFrontMuPoints.get(canonicalChannelName)?.frontMu || selectedChannelForDisplay.frontMu;

          return (
            <Card className={cn("border-2 shadow-md mt-6 p-4", colors.border, colors.bg)}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={cn("text-lg font-bold flex items-center gap-2", colors.text)}>
                  {selectedChannelForDisplay.name}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("ml-2 h-6 w-6 rounded-full text-gray-500 hover:bg-gray-100", colors.icon, colors.hoverBg.replace('hover:', 'hover:text-'))}
                    onClick={() => onOpenNotionPage(selectedChannelForDisplay.id, selectedChannelForDisplay.name)}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </h3>
                <div className="flex gap-1">
                  {selectedChannelForDisplay.elements.map((element, i) => (
                    <Button
                      key={i}
                      variant="secondary"
                      size="sm"
                      className={cn(
                        "text-xs h-auto py-1 px-2 rounded-full flex items-center gap-1",
                        colors.bg.replace('-100', '-200'),
                        colors.text,
                        colors.border,
                        colors.hoverBg,
                        getLoggedClass('channel_element', element)
                      )}
                      onClick={() => handleLogItemClick('channel_element', element)}
                      disabled={loggingSessionEvent}
                    >
                      {getElementIcon(element, "w-3 h-3")}
                      <span className="ml-1">{element}</span>
                      {isItemLogged('channel_element', element) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Emotional Themes - Full Width */}
              {selectedChannelForDisplay.emotions.length > 0 && (
                <div className="flex items-start gap-2 mb-4"> {/* Added mb-4 for spacing */}
                  <Heart className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center flex-wrap"> {/* Use flex-wrap for badges */}
                    <span className={cn("font-semibold mr-2", colors.icon)}>Emotional Themes:</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedChannelForDisplay.emotions.map((emotion, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "text-xs h-auto py-1 px-2 rounded-full flex items-center gap-1",
                            getLoggedClass('channel_emotion', emotion)
                          )}
                          onClick={() => handleLogItemClick('channel_emotion', emotion)}
                          disabled={loggingSessionEvent}
                        >
                          {emotion}
                          {isItemLogged('channel_emotion', emotion) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-800">
                <div className="flex items-start gap-2">
                  <Footprints className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Pathways:</span>
                    {selectedChannelForDisplay.pathways ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_pathway', selectedChannelForDisplay.pathways))}
                        onClick={() => handleLogItemClick('channel_pathway', selectedChannelForDisplay.pathways)}
                      >
                        {selectedChannelForDisplay.pathways}
                        {isItemLogged('channel_pathway', selectedChannelForDisplay.pathways) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FlaskConical className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Functions:</span>
                    {selectedChannelForDisplay.functions ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_function', selectedChannelForDisplay.functions))}
                        onClick={() => handleLogItemClick('channel_function', selectedChannelForDisplay.functions)}
                      >
                        {selectedChannelForDisplay.functions}
                        {isItemLogged('channel_function', selectedChannelForDisplay.functions) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Hand className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Front Mu (Alarm):</span>
                    {derivedFrontMu ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_front_mu', derivedFrontMu))}
                        onClick={() => handleLogItemClick('channel_front_mu', derivedFrontMu)}
                      >
                        {derivedFrontMu}
                        {isItemLogged('channel_front_mu', derivedFrontMu) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Yuan Points:</span>
                    {derivedYuanPoints ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_yuan_point', derivedYuanPoints))}
                        onClick={() => handleLogItemClick('channel_yuan_point', derivedYuanPoints)}
                      >
                        {derivedYuanPoints}
                        {isItemLogged('channel_yuan_point', derivedYuanPoints) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Hand className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>AK Muscles:</span>
                    {selectedChannelForDisplay.akMuscles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedChannelForDisplay.akMuscles.map((muscle, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                "text-xs h-auto py-1 px-2 rounded-full flex items-center gap-1",
                                getLoggedClass('channel_ak_muscle', muscle.name)
                              )}
                              onClick={() => handleLogItemClick('channel_ak_muscle', muscle.name)}
                              disabled={loggingSessionEvent}
                            >
                              {muscle.name}
                              {isItemLogged('channel_ak_muscle', muscle.name) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-full text-gray-500 hover:bg-gray-100"
                              onClick={() => onOpenNotionPage(muscle.id, muscle.name)}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Bone className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>TCM Muscles:</span>
                    {selectedChannelForDisplay.tcmMuscles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedChannelForDisplay.tcmMuscles.map((muscle, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                "text-xs h-auto py-1 px-2 rounded-full flex items-center gap-1",
                                getLoggedClass('channel_tcm_muscle', muscle.name)
                              )}
                              onClick={() => handleLogItemClick('channel_tcm_muscle', muscle.name)}
                              disabled={loggingSessionEvent}
                            >
                              {muscle.name}
                              {isItemLogged('channel_tcm_muscle', muscle.name) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-full text-gray-500 hover:bg-gray-100"
                              onClick={() => onOpenNotionPage(muscle.id, muscle.name)}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Waves className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>He Sea:</span>
                    {selectedChannelForDisplay.heSea ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_he_sea', selectedChannelForDisplay.heSea))}
                        onClick={() => handleLogItemClick('channel_he_sea', selectedChannelForDisplay.heSea)}
                      >
                        {selectedChannelForDisplay.heSea}
                        {isItemLogged('channel_he_sea', selectedChannelForDisplay.heSea) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Droplet className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Jing River:</span>
                    {selectedChannelForDisplay.jingRiver ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_jing_river', selectedChannelForDisplay.jingRiver))}
                        onClick={() => handleLogItemClick('channel_jing_river', selectedChannelForDisplay.jingRiver)}
                      >
                        {selectedChannelForDisplay.jingRiver}
                        {isItemLogged('channel_jing_river', selectedChannelForDisplay.jingRiver) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Jing Well:</span>
                    {selectedChannelForDisplay.jingWell ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_jing_well', selectedChannelForDisplay.jingWell))}
                        onClick={() => handleLogItemClick('channel_jing_well', selectedChannelForDisplay.jingWell)}
                      >
                        {selectedChannelForDisplay.jingWell}
                        {isItemLogged('channel_jing_well', selectedChannelForDisplay.jingWell) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <XCircle className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Sedate 1:</span>
                    {selectedChannelForDisplay.sedate1 ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_sedate1', selectedChannelForDisplay.sedate1))}
                        onClick={() => handleLogItemClick('channel_sedate1', selectedChannelForDisplay.sedate1)}
                      >
                        {selectedChannelForDisplay.sedate1}
                        {isItemLogged('channel_sedate1', selectedChannelForDisplay.sedate1) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <XCircle className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Sedate 2:</span>
                    {selectedChannelForDisplay.sedate2 ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_sedate2', selectedChannelForDisplay.sedate2))}
                        onClick={() => handleLogItemClick('channel_sedate2', selectedChannelForDisplay.sedate2)}
                      >
                        {selectedChannelForDisplay.sedate2}
                        {isItemLogged('channel_sedate2', selectedChannelForDisplay.sedate2) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <PlusCircle className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Tonify 1:</span>
                    {selectedChannelForDisplay.tonify1 ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_tonify1', selectedChannelForDisplay.tonify1))}
                        onClick={() => handleLogItemClick('channel_tonify1', selectedChannelForDisplay.tonify1)}
                      >
                        {selectedChannelForDisplay.tonify1}
                        {isItemLogged('channel_tonify1', selectedChannelForDisplay.tonify1) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <PlusCircle className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Tonify 2:</span>
                    {selectedChannelForDisplay.tonify2 ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_tonify2', selectedChannelForDisplay.tonify2))}
                        onClick={() => handleLogItemClick('channel_tonify2', selectedChannelForDisplay.tonify2)}
                      >
                        {selectedChannelForDisplay.tonify2}
                        {isItemLogged('channel_tonify2', selectedChannelForDisplay.tonify2) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mic className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Appropriate Sound:</span>
                    {selectedChannelForDisplay.appropriateSound ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_appropriate_sound', selectedChannelForDisplay.appropriateSound))}
                        onClick={() => handleLogItemClick('channel_appropriate_sound', selectedChannelForDisplay.appropriateSound)}
                      >
                        {selectedChannelForDisplay.appropriateSound}
                        {isItemLogged('channel_appropriate_sound', selectedChannelForDisplay.appropriateSound) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Tag className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Tags:</span>
                    {selectedChannelForDisplay.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedChannelForDisplay.tags.map((tag, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            className={cn(
                              "text-xs h-auto py-1 px-2 rounded-full flex items-center gap-1",
                              getLoggedClass('channel_tag', tag)
                            )}
                            onClick={() => handleLogItemClick('channel_tag', tag)}
                            disabled={loggingSessionEvent}
                          >
                            {tag}
                            {isItemLogged('channel_tag', tag) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                          </Button>
                        ))}
                      </div>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Brain className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Brain Aspects:</span>
                    {selectedChannelForDisplay.brainAspects ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_brain_aspect', selectedChannelForDisplay.brainAspects))}
                        onClick={() => handleLogItemClick('channel_brain_aspect', selectedChannelForDisplay.brainAspects)}
                      >
                        {selectedChannelForDisplay.brainAspects}
                        {isItemLogged('channel_brain_aspect', selectedChannelForDisplay.brainAspects) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Hand className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Activate Sinew:</span>
                    {selectedChannelForDisplay.activateSinew ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_activate_sinew', selectedChannelForDisplay.activateSinew))}
                        onClick={() => handleLogItemClick('channel_activate_sinew', selectedChannelForDisplay.activateSinew)}
                      >
                        {selectedChannelForDisplay.activateSinew}
                        {isItemLogged('channel_activate_sinew', selectedChannelForDisplay.activateSinew) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Time:</span>
                    {selectedChannelForDisplay.time ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_time', selectedChannelForDisplay.time))}
                        onClick={() => handleLogItemClick('channel_time', selectedChannelForDisplay.time)}
                      >
                        {selectedChannelForDisplay.time}
                        {isItemLogged('channel_time', selectedChannelForDisplay.time) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Volume2 className={cn("w-4 h-4 flex-shrink-0 mt-0.5", colors.icon)} />
                  <div className="flex items-center">
                    <span className={cn("font-semibold mr-1", colors.icon)}>Sound:</span>
                    {selectedChannelForDisplay.sound ? (
                      <span
                        className={cn("cursor-pointer hover:underline flex items-center gap-1", getLoggedClass('channel_sound', selectedChannelForDisplay.sound))}
                        onClick={() => handleLogItemClick('channel_sound', selectedChannelForDisplay.sound)}
                      >
                        {selectedChannelForDisplay.sound}
                        {isItemLogged('channel_sound', selectedChannelForDisplay.sound) && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button variant="outline" onClick={handleClearAll} size="sm" disabled={loggingSessionEvent}>
                  {loggingSessionEvent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Clear Selection
                </Button>
              </div>
            </Card>
          );
        })()}
      </CardContent>
    </Card>
  );
};

export default ChannelDashboard;