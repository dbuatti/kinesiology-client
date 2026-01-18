"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useCachedEdgeFunction } from '@/hooks/use-cached-edge-function';
import { showSuccess, showError } from '@/utils/toast';
import { cacheService } from '@/integrations/supabase/cache';
import { supabase } from '@/integrations/supabase/client';

interface SyncStatusIndicatorProps {
  onSyncComplete?: () => void;
}

const REFERENCE_CACHE_KEYS = [
  'all-modes',
  'all-acupoints',
  'all-muscles',
  'all-chakras',
  'all-channels',
];

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ onSyncComplete }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  const handleSyncSuccess = useCallback(async (data: any) => {
    setSyncStatus('success');
    setLastSync(new Date());
    showSuccess(`Synced ${data.synced?.length || 0} databases successfully!`);

    // Manually invalidate client-side caches that rely on this data
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const userId = user.id;
      // Invalidate main lists
      await cacheService.invalidate(userId, 'all-clients');
      await cacheService.invalidate(userId, 'all-appointments');
      await cacheService.invalidate(userId, 'todays-appointments');
      
      // Invalidate reference data caches
      REFERENCE_CACHE_KEYS.forEach(key => cacheService.invalidate(userId, key));
      
      // Invalidate all individual page caches (e.g., page:pageId)
      await cacheService.invalidateByPattern(userId, 'page');
      
      console.log('[SyncStatusIndicator] Cleared relevant caches after successful sync.');
    }

    if (onSyncComplete) onSyncComplete();
  }, [onSyncComplete]);

  const handleSyncError = useCallback((msg: string) => {
    setSyncStatus('error');
    showError(`Sync failed: ${msg}`);
  }, []);

  const {
    execute: syncNotionData,
    loading: syncLoading,
  } = useCachedEdgeFunction<any, any>('sync-notion-data', {
    requiresAuth: true,
    onSuccess: handleSyncSuccess,
    onError: handleSyncError,
  });

  const handleSync = async () => {
    if (isSyncing) return; // Prevent multiple sync triggers
    
    setSyncStatus('syncing');
    setIsSyncing(true);
    try {
      await syncNotionData({ syncType: 'all' });
    } finally {
      setIsSyncing(false);
    }
  };

  // New effect to check cache status on mount and trigger background sync if needed
  useEffect(() => {
    const checkAndSyncCache = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userId = user.id;
      let needsSync = false;

      for (const key of REFERENCE_CACHE_KEYS) {
        const cachedData = await cacheService.get(userId, key);
        if (!cachedData) {
          console.log(`[SyncStatusIndicator] Cache miss for key: ${key}. Triggering background sync.`);
          needsSync = true;
          break;
        }
      }

      if (needsSync) {
        // Trigger sync in the background without blocking the UI
        setSyncStatus('syncing');
        setIsSyncing(true);
        try {
          await syncNotionData({ syncType: 'all' });
        } finally {
          setIsSyncing(false);
        }
      } else {
        // If cache is present, try to determine the last sync time from one of the keys
        const firstKeyData = await cacheService.getRaw(userId, REFERENCE_CACHE_KEYS[0]);
        if (firstKeyData && firstKeyData.updated_at) {
            setLastSync(new Date(firstKeyData.updated_at));
            setSyncStatus('success');
        }
      }
    };

    checkAndSyncCache();
  }, [syncNotionData]);


  const getStatusBadge = () => {
    switch (syncStatus) {
      case 'syncing':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Loader2 className="h-3 w-3 animate-spin mr-1" /> Syncing...</Badge>;
      case 'success':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" /> Synced</Badge>;
      case 'error':
        return <Badge variant="destructive" className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" /> Error</Badge>;
      default:
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Idle</Badge>;
    }
  };

  return (
    <div className="flex items-center gap-2">
      {getStatusBadge()}
      {lastSync && (
        <span className="text-xs text-gray-500">
          Last sync: {lastSync.toLocaleTimeString()}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={isSyncing}
        className="h-7 px-2"
      >
        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export default SyncStatusIndicator;