"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2, RefreshCw, Database, AlertCircle } from 'lucide-react';
import { cacheService, CacheEntry } from '@/integrations/supabase/cache';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { formatDistanceToNow, parseISO } from 'date-fns';

const CacheManager: React.FC = () => {
  const [cacheEntries, setCacheEntries] = useState<CacheEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCacheEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("User not authenticated.");
        return;
      }
      const entries = await cacheService.getAll();
      // Filter entries to only show those belonging to the current user (based on key format: userId:resourceKey)
      const userEntries = entries.filter(entry => entry.id.startsWith(user.id + ':'));
      setCacheEntries(userEntries);
      showSuccess('Cache entries refreshed.');
    } catch (err: any) {
      console.error('Failed to fetch cache entries:', err);
      setError(err.message || 'Failed to fetch cache entries.');
      showError('Failed to fetch cache entries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCacheEntries();
  }, [fetchCacheEntries]);

  const handleClearAllCache = async () => {
    if (!confirm('Are you sure you want to clear ALL Notion cache entries? This will force a full refresh of all reference data.')) {
      return;
    }
    setClearing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError("User not authenticated.");
        return;
      }
      // Invalidate only the current user's cache entries
      await cacheService.invalidateByPattern(user.id, '*');
      showSuccess('All user cache entries cleared successfully.');
      await fetchCacheEntries();
    } catch (err: any) {
      console.error('Failed to clear cache:', err);
      showError('Failed to clear cache.');
    } finally {
      setClearing(false);
    }
  };

  const handleClearSingleEntry = async (key: string) => {
    setClearing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError("User not authenticated.");
        return;
      }
      // Extract resource key from full ID (e.g., 'user-id:resource-key' -> 'resource-key')
      const resourceKey = key.substring(user.id.length + 1);
      await cacheService.invalidate(user.id, resourceKey);
      showSuccess(`Cache entry ${resourceKey} cleared.`);
      await fetchCacheEntries();
    } catch (err: any) {
      console.error('Failed to clear single cache entry:', err);
      showError('Failed to clear cache entry.');
    } finally {
      setClearing(false);
    }
  };

  const renderCacheKey = (fullId: string) => {
    const parts = fullId.split(':');
    // Assuming format is userId:resourceKey
    return parts.length > 1 ? parts.slice(1).join(':') : fullId;
  };

  return (
    <Card className="shadow-xl">
      <CardHeader className="bg-indigo-50 border-b border-indigo-200 rounded-t-lg p-4">
        <CardTitle className="text-xl font-bold text-indigo-800 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Notion Cache Manager
        </CardTitle>
        <p className="text-sm text-gray-600">View and manage cached Notion data entries.</p>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button onClick={fetchCacheEntries} disabled={loading || clearing} variant="outline">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh List
            </Button>
            <Button onClick={handleClearAllCache} disabled={loading || clearing} variant="destructive">
              {clearing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Clear All Cache
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-md flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto max-h-[500px]">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : cacheEntries.length === 0 ? (
            <div className="text-center py-10 text-gray-600">
              No active cache entries found for your user ID.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Resource Key</TableHead>
                  <TableHead className="min-w-[150px]">Last Updated</TableHead>
                  <TableHead className="min-w-[150px]">Expires In</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cacheEntries.map((entry) => {
                  const expiresAt = parseISO(entry.expires_at);
                  const expiresIn = formatDistanceToNow(expiresAt, { addSuffix: true });
                  const isExpired = expiresAt < new Date();

                  return (
                    <TableRow key={entry.id} className={isExpired ? 'bg-red-50 opacity-70' : ''}>
                      <TableCell className="font-medium text-sm">
                        {renderCacheKey(entry.id)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDistanceToNow(parseISO(entry.updated_at), { addSuffix: true })} ago
                      </TableCell>
                      <TableCell className={isExpired ? 'text-red-600 font-semibold' : 'text-green-600'}>
                        {isExpired ? 'Expired' : expiresIn}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClearSingleEntry(entry.id)}
                          disabled={clearing}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CacheManager;