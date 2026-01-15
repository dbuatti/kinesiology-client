"use client";

import { supabase } from './client';

export interface CacheEntry {
  id: string;
  data: any;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export const cacheService = {
  // Get cached data by key
  async get(key: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('notion_cache')
      .select('data, expires_at')
      .eq('id', key)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if cache is expired
    if (new Date(data.expires_at) < new Date()) {
      // Delete expired cache entry
      await supabase.from('notion_cache').delete().eq('id', key);
      return null;
    }

    return data.data;
  },

  // Set cached data with TTL
  async set(key: string, data: any, ttlMinutes: number = 30): Promise<void> {
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
  async invalidate(key: string): Promise<void> {
    await supabase.from('notion_cache').delete().eq('id', key);
  },

  // Invalidate cache by pattern (e.g., 'appointments:*')
  async invalidateByPattern(pattern: string): Promise<void> {
    const { data, error } = await supabase
      .from('notion_cache')
      .select('id')
      .ilike('id', `${pattern}%`);

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

    return error ? [] : data;
  },

  // Clear all cache entries
  async clearAll(): Promise<void> {
    await supabase.from('notion_cache').delete().neq('id', '');
  },
};