"use client";

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Database, ArrowRight, CheckCircle2, AlertCircle, Info, Settings } from 'lucide-react';
import { useCachedEdgeFunction } from '@/hooks/use-cached-edge-function';
import { showSuccess, showError } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}

const NotionMigrationTool: React.FC = () => {
  const [result, setResult] = useState<MigrationResult | null>(null);
  const navigate = useNavigate();

  const handleMigrationSuccess = useCallback((data: MigrationResult) => {
    setResult(data);
    if (data.migratedCount > 0) {
      showSuccess(`Migration complete! ${data.migratedCount} appointments migrated.`);
    } else if (data.skippedCount > 0) {
      showSuccess(`Migration finished. ${data.skippedCount} items skipped (check summary).`);
    } else {
      showSuccess('Migration finished. No new appointments found.');
    }
  }, []);

  const handleMigrationError = useCallback((msg: string) => {
    setResult(null);
    showError(`Migration Failed: ${msg}`);
  }, []);

  const {
    loading,
    needsConfig,
    execute: migrateAppointments,
  } = useCachedEdgeFunction<void, MigrationResult>(
    'migrate-notion-appointments',
    {
      requiresAuth: true,
      requiresNotionConfig: true, // Requires Notion config to fetch appointments DB ID
      cacheKey: undefined, // Never cache migration results
      onSuccess: handleMigrationSuccess,
      onError: handleMigrationError,
    }
  );

  const handleMigrate = () => {
    handleClearResult();
    migrateAppointments();
  };
  
  const handleClearResult = () => {
    setResult(null);
  };

  if (needsConfig) {
    return (
      <Card className="border-2 border-red-400 bg-red-50 shadow-md">
        <CardContent className="pt-4 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-600" />
          <p className="font-semibold text-red-800">Notion Configuration Missing</p>
          <p className="text-sm text-red-700 mb-3">
            Please ensure your Notion Integration Token and Appointments Database ID are configured.
          </p>
          <Button variant="outline" onClick={() => navigate('/notion-config')}>
            <Settings className="h-4 w-4 mr-2" /> Go to Notion Config
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="bg-yellow-50 border-b border-yellow-200 rounded-t-lg p-4">
        <CardTitle className="text-xl font-bold text-yellow-800 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Notion Appointment Migration Tool
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800 flex items-start gap-2">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>
            This tool attempts to migrate appointments from your configured Notion Appointments Database 
            to the local Supabase Appointments table. It requires matching client names in your local 
            Supabase Clients table for successful migration. Duplicates (same client, same date) are skipped.
          </p>
        </div>
        
        <Button
          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
          onClick={handleMigrate}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ArrowRight className="h-5 w-5 mr-2" />}
          {loading ? 'Migrating Appointments...' : 'Start Migration from Notion'}
        </Button>

        {result && (
          <div className="mt-4 p-4 border rounded-lg space-y-2" 
               style={{ borderColor: result.errors.length > 0 ? 'var(--destructive)' : 'var(--primary)' }}>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              {result.errors.length > 0 ? (
                <AlertCircle className="h-5 w-5 text-red-600" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              Migration Summary
            </h3>
            <Separator />
            <p className="text-sm">
              <span className="font-medium text-green-700">Migrated Successfully:</span> {result.migratedCount}
            </p>
            <p className="text-sm">
              <span className="font-medium text-yellow-700">Skipped (Duplicates/Missing Client):</span> {result.skippedCount}
            </p>
            {result.errors.length > 0 && (
              <div className="pt-2">
                <p className="font-medium text-red-700 mb-1">Errors ({result.errors.length}):</p>
                <ul className="list-disc list-inside text-xs text-red-600 max-h-32 overflow-y-auto p-2 bg-red-50 rounded-md">
                  {result.errors.map((err, index) => (
                    <li key={index}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotionMigrationTool;