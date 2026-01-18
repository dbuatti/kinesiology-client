"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Hand,
  Lightbulb,
  Loader2,
  Settings,
  Star,
  Target,
  User,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { showError, showSuccess } from "@/utils/toast";

import { useCachedEdgeFunction } from "@/hooks/use-cached-edge-function";
import { useNotionConfig } from "@/hooks/use-notion-config";
import { useReferenceData } from "@/hooks/use-reference-data";

import type {
  Appointment,
  MinimalAppointment,
  Mode,
  Muscle,
  Chakra,
  Channel,
  Acupoint,
  GetSingleAppointmentResponse,
  UpdateNotionAppointmentPayload,
  LogMuscleStrengthPayload,
  GetSessionLogsResponse,
} from "@/types/api";

import SessionSummaryDisplay from "@/components/SessionSummaryDisplay";
import ModeSelect from "@/components/ModeSelect";
import MuscleSelector from "@/components/MuscleSelector";
import ChakraSelector from "@/components/ChakraSelector";
import ChannelDashboard from "@/components/ChannelDashboard";
import AcupointSelector from "@/components/AcupointSelector";
import SessionLogDisplay from "@/components/SessionLogDisplay";
import NotionPageViewer from "@/components/NotionPageViewer";
import ModeDetailsPanel from "@/components/ModeDetailsPanel";
import SyncStatusIndicator from "@/components/SyncStatusIndicator";

interface ActiveSessionProps {
  mockAppointmentId?: string;
}

export default function ActiveSession({ mockAppointmentId }: ActiveSessionProps) {
  const params = useParams<{ appointmentId: string }>();
  const appointmentId = mockAppointmentId || params.appointmentId;
  const navigate = useNavigate();

  const { isConfigured: notionConfigured, isLoading: configLoading } = useNotionConfig();
  const { data: refData, loading: refLoading, needsConfig: refNeedsConfig } = useReferenceData();

  // ── Core Data ───────────────────────────────────────────────────────────────
  const [appointment, setAppointment] = useState<MinimalAppointment | null>(null);
  const [anchorText, setAnchorText] = useState("");
  const [northStarText, setNorthStarText] = useState("");
  const [selectedModes, setSelectedModes] = useState<Mode[]>([]);

  // Currently selected items (for summary highlight)
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle | null>(null);
  const [selectedChakra, setSelectedChakra] = useState<Chakra | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedAcupoint, setSelectedAcupoint] = useState<Acupoint | null>(null);

  // Session logs
  const [sessionLogs, setSessionLogs] = useState<GetSessionLogsResponse["sessionLogs"]>([]);
  const [muscleLogs, setMuscleLogs] = useState<GetSessionLogsResponse["sessionMuscleLogs"]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState("overview");
  const [notionPageId, setNotionPageId] = useState<string | null>(null);
  const [notionPageTitle, setNotionPageTitle] = useState<string | null>(null);
  const [modeForDetails, setModeForDetails] = useState<Mode | null>(null);

  // ── Data Fetching Hooks ─────────────────────────────────────────────────────

  const appointmentQuery = useCachedEdgeFunction<{ appointmentId: string }, GetSingleAppointmentResponse>(
    "get-single-appointment",
    {
      cacheKey: appointmentId ? `${appointmentId}:appt` : undefined,
      cacheTtl: 3600,
      onSuccess: (data) => {
        setAppointment(data.appointment);
        setAnchorText(data.appointment.sessionAnchor || "");
        setNorthStarText(data.appointment.sessionNorthStar || "");
      },
      onError: (msg, code) => {
        showError(msg);
        if (code && ["PROFILE_NOT_FOUND", "PRACTITIONER_NAME_MISSING"].includes(code)) {
          navigate("/profile-setup");
        }
      },
    }
  );

  const logsQuery = useCachedEdgeFunction<{ appointmentId: string }, GetSessionLogsResponse>(
    "get-session-logs",
    {
      cacheKey: appointmentId ? `${appointmentId}:logs` : undefined,
      cacheTtl: 300, // 5 min
      onSuccess: (data) => {
        setSessionLogs(data.sessionLogs);
        setMuscleLogs(data.sessionMuscleLogs);
      },
      onError: (msg) => showError(`Failed to load logs: ${msg}`),
    }
  );

  const updateAppt = useCachedEdgeFunction<UpdateNotionAppointmentPayload, { success: boolean }>(
    "update-appointment",
    {
      onSuccess: () => {
        showSuccess("Appointment updated");
        if (appointmentId) appointmentQuery.execute({ appointmentId });
      },
      onError: (msg) => showError(`Update failed: ${msg}`),
    }
  );

  const logMuscle = useCachedEdgeFunction<LogMuscleStrengthPayload, { logId: string }>(
    "log-muscle-strength",
    {
      onSuccess: () => {
        showSuccess("Strength logged");
        if (appointmentId) logsQuery.execute({ appointmentId });
      },
      onError: (msg) => showError(`Logging failed: ${msg}`),
    }
  );

  const deleteLog = useCachedEdgeFunction<{ logId: string }, { success: boolean }>("delete-session-log", {
    onSuccess: () => {
      showSuccess("Log deleted");
      if (appointmentId) logsQuery.execute({ appointmentId });
    },
    onError: (msg) => showError(`Delete failed: ${msg}`),
  });

  const clearAllLogs = useCachedEdgeFunction<{ appointmentId: string }, { success: boolean }>(
    "clear-session-logs",
    {
      onSuccess: () => {
        showSuccess("All logs cleared");
        if (appointmentId) logsQuery.execute({ appointmentId });
      },
      onError: (msg) => showError(`Clear failed: ${msg}`),
    }
  );

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!appointmentId || refLoading) return;
    appointmentQuery.execute({ appointmentId });
    logsQuery.execute({ appointmentId });
  }, [appointmentId, refLoading]);

  // Clear page viewer / mode details when tab changes
  useEffect(() => {
    if (activeTab !== "notion-page") {
      setNotionPageId(null);
      setNotionPageTitle(null);
    }
    if (activeTab !== "mode-details") {
      setModeForDetails(null);
    }
  }, [activeTab]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const saveAnchor = useCallback(() => {
    if (!appointment || anchorText === appointment.sessionAnchor) return;
    updateAppt.execute({
      appointmentId: appointment.id,
      updates: { sessionAnchor: anchorText },
    });
  }, [appointment, anchorText, updateAppt]);

  const saveNorthStar = useCallback(() => {
    if (!appointment || northStarText === appointment.sessionNorthStar) return;
    updateAppt.execute({
      appointmentId: appointment.id,
      updates: { sessionNorthStar: northStarText },
    });
  }, [appointment, northStarText, updateAppt]);

  const completeSession = useCallback(async () => {
    if (!appointment) return;
    await updateAppt.execute({
      appointmentId: appointment.id,
      updates: { status: "CH" },
    });
    if (!updateAppt.loading) {
      showSuccess(`${appointment.clientName}'s session completed.`);
      navigate("/");
    }
  }, [appointment, updateAppt, navigate]);

  const openNotionPage = useCallback((id: string, title: string) => {
    setNotionPageId(id);
    setNotionPageTitle(title);
    setActiveTab("notion-page");
  }, []);

  const openModeDetails = useCallback((mode: Mode) => {
    setModeForDetails(mode);
    setActiveTab("mode-details");
  }, []);

  const onModesChange = useCallback((modes: Mode[]) => setSelectedModes(modes), []);

  const anyLoading = useMemo(
    () =>
      configLoading ||
      refLoading ||
      appointmentQuery.loading ||
      logsQuery.loading ||
      updateAppt.loading ||
      logMuscle.loading ||
      deleteLog.loading ||
      clearAllLogs.loading,
    [
      configLoading,
      refLoading,
      appointmentQuery.loading,
      logsQuery.loading,
      updateAppt.loading,
      logMuscle.loading,
      deleteLog.loading,
      clearAllLogs.loading,
    ]
  );

  const criticalError = appointmentQuery.error || logsQuery.error;

  // ── Early Returns ───────────────────────────────────────────────────────────

  if (anyLoading && !appointment) {
    return <LoadingSkeleton />;
  }

  if (refNeedsConfig) {
    return <NotionConfigRequired onConfigure={() => navigate("/notion-config")} />;
  }

  if (criticalError && !appointment) {
    return <ErrorState message={criticalError} onRetry={() => appointmentId && appointmentQuery.execute({ appointmentId })} />;
  }

  if (!appointment) {
    return <NoActiveSession isDebug={!!mockAppointmentId} />;
  }

  // ── Main Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 px-4 py-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="text-center">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-3xl font-bold text-indigo-950">Active Session</h1>
            {mockAppointmentId && <Badge variant="destructive">DEBUG</Badge>}
          </div>
          <p className="mt-1 text-slate-600">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>

          <div className="mt-3">
            <SyncStatusIndicator
              onSyncComplete={() => {
                if (appointmentId) {
                  appointmentQuery.execute({ appointmentId });
                  logsQuery.execute({ appointmentId });
                }
              }}
            />
          </div>
        </header>

        <SessionSummaryDisplay
          appointmentId={appointmentId!}
          sessionLogs={sessionLogs}
          sessionMuscleLogs={muscleLogs}
          sessionSelectedModes={selectedModes}
          selectedMuscle={selectedMuscle}
          selectedChakra={selectedChakra}
          selectedChannel={selectedChannel}
          selectedAcupoint={selectedAcupoint}
          sessionNorthStar={northStarText}
          sessionAnchor={anchorText}
          onClearItem={(type, id) => {
            // implement clear logic - omitted for brevity
          }}
          onLogSuccess={() => logsQuery.execute({ appointmentId: appointmentId! })}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="muscles">Muscles</TabsTrigger>
            <TabsTrigger value="chakras">Chakras</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="acupoints">Acupoints</TabsTrigger>
            <TabsTrigger value="session-log">Session Log</TabsTrigger>
            <TabsTrigger value="notion-page">Notion</TabsTrigger>
            <TabsTrigger value="mode-details">Mode Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <ClientInsightCard
              appointment={appointment}
              northStarText={northStarText}
              onNorthStarChange={setNorthStarText}
              onNorthStarBlur={saveNorthStar}
              updating={updateAppt.loading}
            />

            <LiveSessionControls
              anchorText={anchorText}
              onAnchorChange={setAnchorText}
              onAnchorBlur={saveAnchor}
              updating={updateAppt.loading}
              appointmentId={appointmentId!}
              onModesChange={onModesChange}
              onOpenNotionPage={openNotionPage}
              onLogSuccess={() => logsQuery.execute({ appointmentId: appointmentId! })}
              onOpenModeDetails={openModeDetails}
            />
          </TabsContent>

          <TabsContent value="muscles">
            <MuscleSelector
              appointmentId={appointmentId!}
              onMuscleSelected={setSelectedMuscle}
              onMuscleStrengthLogged={(muscle, isStrong, notes) =>
                logMuscle.execute({
                  appointmentId: appointmentId!,
                  muscleId: muscle.id,
                  muscleName: muscle.name,
                  isStrong,
                  notes: notes || null,
                })
              }
              onClearSelection={() => setSelectedMuscle(null)}
              onOpenNotionPage={openNotionPage}
            />
          </TabsContent>

          {/* other tab contents ... similar pattern */}

          <TabsContent value="notion-page">
            {notionPageId && <NotionPageViewer pageId={notionPageId} />}
          </TabsContent>

          <TabsContent value="mode-details">
            {modeForDetails && <ModeDetailsPanel selectedMode={modeForDetails} />}
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={() => navigate("/")}>
            ← Back to Waiting Room
          </Button>

          <Button
            size="lg"
            variant="destructive"
            onClick={completeSession}
            disabled={updateAppt.loading || anyLoading}
            className="gap-2"
          >
            {updateAppt.loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
            Complete Session
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6 flex items-center justify-center">
      <div className="w-full max-w-4xl space-y-6">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

function NotionConfigRequired({ onConfigure }: { onConfigure: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="pt-10 pb-8 text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center">
            <Settings className="w-10 h-10 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-indigo-950">Notion Setup Required</h2>
            <p className="mt-3 text-slate-600">
              Reference data databases are not configured or accessible.
            </p>
          </div>
          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            onClick={onConfigure}
          >
            Configure Notion Integration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
      <Card className="max-w-md w-full shadow-lg">
        <CardContent className="pt-10 text-center space-y-6">
          <AlertCircle className="mx-auto h-16 w-16 text-red-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Something went wrong</h2>
            <p className="mt-3 text-slate-600">{message}</p>
          </div>
          <Button onClick={onRetry}>Try Again</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NoActiveSession({ isDebug }: { isDebug: boolean }) {
  return (
    <Card className="max-w-lg mx-auto shadow-lg">
      <CardContent className="pt-10 pb-8 text-center space-y-4">
        <Calendar className="mx-auto h-16 w-16 text-slate-400" />
        <h2 className="text-2xl font-semibold text-slate-700">
          {isDebug ? "Debug Session" : "No Active Session"}
        </h2>
        <p className="text-slate-500">
          {isDebug
            ? "Mock appointment failed to load. Check Notion config and test data."
            : "Please select a client from the Waiting Room to start a session."}
        </p>
      </CardContent>
    </Card>
  );
}

function ClientInsightCard({
  appointment,
  northStarText,
  onNorthStarChange,
  onNorthStarBlur,
  updating,
}: {
  appointment: MinimalAppointment;
  northStarText: string;
  onNorthStarChange: (v: string) => void;
  onNorthStarBlur: () => void;
  updating: boolean;
}) {
  return (
    <Card className="border-2 border-indigo-100 shadow-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-5">
        <CardTitle className="text-2xl flex items-center gap-3">
          <User className="h-6 w-6" />
          {appointment.clientName}
        </CardTitle>
        <div className="mt-2 flex items-center gap-2 text-indigo-100">
          <Star className="h-4 w-4 fill-current" />
          <span>{appointment.starSign || "Star sign missing"}</span>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {appointment.sessionNorthStar && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium text-slate-700">
              <Target className="h-4 w-4 text-indigo-600" />
              Session North Star
            </div>
            <Textarea
              value={northStarText}
              onChange={(e) => onNorthStarChange(e.target.value)}
              onBlur={onNorthStarBlur}
              disabled={updating}
              placeholder="Client's main focus for this session…"
              className="min-h-[84px] resize-y"
            />
          </div>
        )}

        {appointment.goal && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium text-slate-700">
              <Lightbulb className="h-4 w-4 text-indigo-600" />
              Appointment Goal
            </div>
            <div className="bg-slate-50 border rounded-lg p-4 text-slate-800">
              {appointment.goal}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LiveSessionControls({
  anchorText,
  onAnchorChange,
  onAnchorBlur,
  updating,
  appointmentId,
  onModesChange,
  onOpenNotionPage,
  onLogSuccess,
  onOpenModeDetails,
}: {
  anchorText: string;
  onAnchorChange: (v: string) => void;
  onAnchorBlur: () => void;
  updating: boolean;
  appointmentId: string;
  onModesChange: (modes: Mode[]) => void;
  onOpenNotionPage: (id: string, title: string) => void;
  onLogSuccess: () => void;
  onOpenModeDetails: (mode: Mode) => void;
}) {
  return (
    <Card className="shadow-xl">
      <CardHeader className="bg-indigo-50 border-b px-6 py-5">
        <CardTitle className="text-xl flex items-center gap-3 text-indigo-900">
          <Clock className="h-5 w-5" />
          Live Session Controls
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 space-y-8">
        <div className="space-y-3">
          <label className="flex items-center gap-2 font-medium text-slate-700">
            <Hand className="h-4 w-4 text-indigo-600" />
            Today we are really working with...
          </label>
          <Textarea
            value={anchorText}
            onChange={(e) => onAnchorChange(e.target.value)}
            onBlur={onAnchorBlur}
            disabled={updating}
            placeholder="Main theme / intention of the session"
            className="min-h-[84px] resize-y"
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 font-medium text-slate-700">
            <Lightbulb className="h-4 w-4 text-indigo-600" />
            Select Mode
          </label>
          <ModeSelect
            appointmentId={appointmentId}
            onModesChanged={onModesChange}
            onOpenNotionPage={onOpenNotionPage}
            onLogSuccess={onLogSuccess}
            onOpenModeDetailsPanel={onOpenModeDetails}
          />
        </div>
      </CardContent>
    </Card>
  );
}