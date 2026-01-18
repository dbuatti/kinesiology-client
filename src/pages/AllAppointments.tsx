"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import debounce from "lodash/debounce";

import {
  AlertCircle,
  Calendar,
  Check,
  ChevronsUpDown,
  Loader2,
  PlayCircle,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { showError, showSuccess } from "@/utils/toast";
import SyncStatusIndicator from "@/components/SyncStatusIndicator"; // <-- FIX 1: Changed to default import

import { useCachedEdgeFunction } from "@/hooks/use-cached-edge-function";
import type {
  Appointment,
  GetAllAppointmentsResponse,
  UpdateNotionAppointmentPayload,
} from "@/types/api";

const STATUS_OPTIONS = ["AP", "OPEN", "CH", "CXL"] as const;
const PRIORITY_PATTERNS = ["Pattern A", "Pattern B", "Pattern C", "Pattern D"] as const;

type Status = (typeof STATUS_OPTIONS)[number];
type PriorityPattern = (typeof PRIORITY_PATTERds)[number];

export default function AllAppointments() {
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, Partial<Appointment>>>({});

  // ── Data Fetching ───────────────────────────────────────────────────────────

  const appointmentsQuery = useCachedEdgeFunction<void, GetAllAppointmentsResponse>(
    "get-all-appointments",
    {
      cacheKey: "appointments:all",
      cacheTtl: 300, // 5 minutes
      onSuccess: (data) => {
        setAppointments(data.appointments ?? []);
      },
      onError: (msg, code) => {
        if (code !== "NO_APPOINTMENTS") {
          showError(msg);
        }
      },
    }
  );

  const updateAppointmentMutation = useCachedEdgeFunction<
    UpdateNotionAppointmentPayload,
    { success: boolean }
  >("update-appointment", {
    onSuccess: (_, isCached, payload) => { // Added isCached and payload
      showSuccess("Appointment updated");
      setPendingUpdates((prev) => {
        const next = { ...prev };
        if (payload?.appointmentId) { // <-- FIX 2: Safely check and access appointmentId
          delete next[payload.appointmentId];
        }
        return next;
      });
    },
    onError: (msg, _, payload) => {
      showError(`Update failed: ${msg}`);
      // Rollback optimistic update
      if (payload?.appointmentId) {
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === payload.appointmentId
              ? { ...a, ...pendingUpdates[payload.appointmentId] }
              : a
          )
        );
      }
    },
  });

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    appointmentsQuery.execute();
  }, []);

  // ── Search (memoized) ───────────────────────────────────────────────────────

  const filteredAppointments = useMemo(() => {
    if (!searchTerm.trim()) return appointments;

    const term = searchTerm.toLowerCase();
    return appointments.filter(
      (a) =>
        a.clientName?.toLowerCase().includes(term) ||
        a.goal?.toLowerCase().includes(term) ||
        a.sessionNorthStar?.toLowerCase().includes(term) ||
        a.notes?.toLowerCase().includes(term) ||
        a.status?.toLowerCase().includes(term) ||
        a.priorityPattern?.toLowerCase().includes(term)
    );
  }, [appointments, searchTerm]);

  // ── Debounced field updates ─────────────────────────────────────────────────

  const debouncedUpdate = useCallback(
    debounce((payload: UpdateNotionAppointmentPayload) => {
      updateAppointmentMutation.execute(payload);
    }, 700),
    []
  );

  const handleFieldChange = useCallback(
    (appointmentId: string, field: keyof Appointment, value: string | null) => {
      setAppointments((prev) =>
        prev.map((app) =>
          app.id === appointmentId ? { ...app, [field]: value } : app
        )
      );

      setPendingUpdates((prev) => ({
        ...prev,
        [appointmentId]: { ...prev[appointmentId], [field]: value },
      }));

      debouncedUpdate({
        appointmentId,
        updates: { [field]: value },
      });
    },
    []
  );

  const handleSelectChange = useCallback(
    (appointmentId: string, field: keyof Appointment, value: string) => {
      handleFieldChange(appointmentId, field, value);
    },
    [handleFieldChange]
  );

  const startSession = useCallback(
    (appointmentId: string) => {
      navigate(`/active-session/${appointmentId}`);
    },
    [navigate]
  );

  // ── Render states ───────────────────────────────────────────────────────────

  if (appointmentsQuery.loading && appointments.length === 0) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 px-4 py-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <Card className="shadow-2xl border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white px-6 py-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8" />
                <div>
                  <CardTitle className="text-3xl font-bold tracking-tight">
                    Appointments
                  </CardTitle>
                  <p className="mt-1.5 text-indigo-100/90 text-lg">
                    Manage and start client sessions
                  </p>
                </div>
              </div>

              <Badge
                variant="outline"
                className="bg-white/15 text-white border-white/30 px-4 py-1.5 text-base"
              >
                {appointments.length} total
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {/* Controls */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
              <div className="relative flex-1 max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
                <Input
                  placeholder="Search by client, goal, north star, notes, status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 h-11"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    appointmentsQuery.invalidateCache();
                    appointmentsQuery.execute();
                  }}
                  disabled={appointmentsQuery.loading || updateAppointmentMutation.loading}
                  className="gap-2"
                >
                  {appointmentsQuery.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh
                </Button>

                <div className="hidden sm:block">
                  <SyncStatusIndicator
                    onSyncComplete={() => appointmentsQuery.execute()}
                  />
                </div>
              </div>
            </div>

            {/* Content Area */}
            {appointments.length === 0 ? (
              <EmptyState isLoading={appointmentsQuery.loading} />
            ) : filteredAppointments.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Search className="mx-auto h-12 w-12 opacity-40 mb-4" />
                <h3 className="text-xl font-medium">No matching appointments</h3>
                <p className="mt-2">Try adjusting your search or refresh the list.</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                        <TableHead className="w-[180px] pl-6">Client</TableHead>
                        <TableHead className="w-[140px]">Date</TableHead>
                        <TableHead className="min-w-[220px]">Goal</TableHead>
                        <TableHead className="min-w-[220px]">North Star</TableHead>
                        <TableHead className="w-[180px]">Priority Pattern</TableHead>
                        <TableHead className="w-[140px]">Status</TableHead>
                        <TableHead className="min-w-[240px]">Notes</TableHead>
                        <TableHead className="w-[140px] text-right pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredAppointments.map((appt) => (
                        <TableRow
                          key={appt.id}
                          className="group hover:bg-muted/40 transition-colors"
                        >
                          <TableCell className="pl-6 font-medium">{appt.clientName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {appt.date ? format(new Date(appt.date), "MMM d, yyyy") : "—"}
                          </TableCell>

                          <TableCell>
                            <Textarea
                              value={appt.goal ?? ""}
                              onChange={(e) =>
                                handleFieldChange(appt.id, "goal", e.target.value)
                              }
                              placeholder="—"
                              className="min-h-[56px] text-sm resize-none border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 p-2"
                              disabled={updateAppointmentMutation.loading}
                            />
                          </TableCell>

                          <TableCell>
                            <Textarea
                              value={appt.sessionNorthStar ?? ""}
                              onChange={(e) =>
                                handleFieldChange(appt.id, "sessionNorthStar", e.target.value)
                              }
                              placeholder="—"
                              className="min-h-[56px] text-sm resize-none border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 p-2"
                              disabled={updateAppointmentMutation.loading}
                            />
                          </TableCell>

                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between text-left font-normal h-10 px-3"
                                  disabled={updateAppointmentMutation.loading}
                                >
                                  {appt.priorityPattern || <span className="text-muted-foreground">Select...</span>}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[220px] p-0">
                                <Command>
                                  <CommandInput placeholder="Search pattern..." className="h-9" />
                                  <CommandEmpty>No pattern found.</CommandEmpty>
                                  <CommandGroup className="max-h-60 overflow-auto">
                                    {PRIORITY_PATTERNS.map((pattern) => (
                                      <CommandItem
                                        key={pattern}
                                        value={pattern}
                                        onSelect={() =>
                                          handleSelectChange(appt.id, "priorityPattern", pattern)
                                        }
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            appt.priorityPattern === pattern ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {pattern}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </TableCell>

                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between text-left font-normal h-10 px-3",
                                    !appt.status && "text-muted-foreground"
                                  )}
                                  disabled={updateAppointmentMutation.loading}
                                >
                                  {appt.status || "Select..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[180px] p-0">
                                <Command>
                                  <CommandInput placeholder="Search status..." className="h-9" />
                                  <CommandEmpty>No status found.</CommandEmpty>
                                  <CommandGroup>
                                    {STATUS_OPTIONS.map((status) => (
                                      <CommandItem
                                        key={status}
                                        value={status}
                                        onSelect={() =>
                                          handleSelectChange(appt.id, "status", status)
                                        }
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            appt.status === status ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {status}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </TableCell>

                          <TableCell>
                            <Textarea
                              value={appt.notes ?? ""}
                              onChange={(e) =>
                                handleFieldChange(appt.id, "notes", e.target.value)
                              }
                              placeholder="Additional notes..."
                              className="min-h-[56px] text-sm resize-none border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 p-2"
                              disabled={updateAppointmentMutation.loading}
                            />
                          </TableCell>

                          <TableCell className="text-right pr-6">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => startSession(appt.id)}
                              disabled={updateAppointmentMutation.loading}
                              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                            >
                              <PlayCircle className="h-4 w-4" />
                              Start
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
        <p className="text-muted-foreground">Loading appointments...</p>
      </div>
    </div>
  );
}

function EmptyState({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <LoadingState />;

  return (
    <div className="py-20 text-center">
      <Calendar className="mx-auto h-16 w-16 text-indigo-200 mb-6" />
      <h2 className="text-2xl font-semibold text-slate-700 mb-3">
        No appointments yet
      </h2>
      <p className="text-slate-500 max-w-md mx-auto mb-8">
        Create new appointments from the Waiting Room or sync your calendar.
      </p>
      <Button variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Refresh List
      </Button>
    </div>
  );
}