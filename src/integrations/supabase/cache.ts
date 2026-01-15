"use client";

import { supabase } from './client';

export interface CacheEntry {
  id: string;
  data: any;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

const buildKey = (userId: string, resourceKey: string) => `${userId}:${resourceKey}`;

export const cacheService = {
  // Get cached data by key
  async get(userId: string, resourceKey: string): Promise<any | null> {
    const rawData = await this.getRaw(userId, resourceKey);
    return rawData ? rawData.data : null;
  },

  // Get raw cached entry including metadata
  async getRaw(userId: string, resourceKey: string): Promise<CacheEntry | null> {
    const key = buildKey(userId, resourceKey);
    
    // Use .maybeSingle() to handle cases where no row is found without throwing an error
    const { data, error } = await supabase
      .from('notion_cache')
      .select('*')
      .eq('id', key)
      .maybeSingle(); // Use maybeSingle to gracefully handle 0 results

    if (error) {
      console.error('Cache getRaw error:', error);
      return null;
    }
    
    if (!data) {
        return null;
    }

    // Check if cache is expired
    if (new Date(data.expires_at) < new Date()) {
      // Delete expired cache entry (fire and forget)
      supabase.from('notion_cache').delete().eq('id', key).then(() => {
          console.log(`Expired cache entry deleted: ${key}`);
      }).catch(err => {
          console.error('Failed to delete expired cache entry:', err);
      });
      return null;
    }

    return data as CacheEntry;
  },

  // Set cached data with TTL
  async set(userId: string, resourceKey: string, data: any, ttlMinutes: number = 30): Promise<void> {
    const key = buildKey(userId, resourceKey);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from('notion_cache')
      .upsert({
        id: key,
        data,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Cache set error:', error);
    }
  },

  // Invalidate cache for a specific key
  async invalidate(userId: string, resourceKey: string): Promise<void> {
    const key = buildKey(userId, resourceKey);
    await supabase.from('notion_cache').delete().eq('id', key);
  },

  // Invalidate cache by pattern (e.g., 'appointments:*')
  async invalidateByPattern(userId: string, pattern: string): Promise<void> {
    const searchPattern = buildKey(userId, pattern); // e.g., 'user-id:appointments:*'
    const { data, error } = await supabase
      .from('notion_cache')
      .select('id')
      .ilike('id', `${searchPattern}%`);

    if (error || !data) return;

    const keys = data.map(entry => entry.id);
    if (keys.length > 0) {
      await supabase.from('notion_cache').delete().in('id', keys);
    }
  },

  // Get all cache entries for debugging
  async getAll(): Promise<CacheEntry[]> {
    const { data, error } = await supabase
      .from('notion_cache')
      .select('*')
      .order('updated_at', { ascending: false });

    return error ? [] : data as CacheEntry[];
  },

  // Clear all cache entries
  async clearAll(): Promise<void> {
    await supabase.from('notion_cache').delete().neq('id', '');
  },
};