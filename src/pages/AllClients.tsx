"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import debounce from "lodash/debounce";

import {
  AlertCircle,
  Database,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  User,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/utils/toast";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { useCachedEdgeFunction } from "@/hooks/use-cached-edge-function";
import type {
  Client,
  GetAllClientsResponse,
  UpdateNotionClientPayload,
} from "@/types/api";

const clientFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  focus: z.string().max(500).optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

export default function AllClients() {
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, Partial<Client>>>({});

  // ── Data Fetching ───────────────────────────────────────────────────────────

  const clientsQuery = useCachedEdgeFunction<void, GetAllClientsResponse>("get-clients-list", {
    cacheKey: "clients:list",
    cacheTtl: 300, // 5 min – clients list changes infrequently
    onSuccess: (data) => {
      if (data.clients?.length) {
        setClients(data.clients);
      } else {
        setClients([]);
      }
    },
    onError: (msg, code) => {
      if (code !== "CLIENTS_TABLE_EMPTY") {
        showError(msg);
      }
    },
  });

  const updateClientMutation = useCachedEdgeFunction<UpdateNotionClientPayload, { success: boolean }>(
    "update-client",
    {
      onSuccess: (_, payload) => {
        showSuccess("Client updated");
        setPendingUpdates((prev) => {
          const next = { ...prev };
          delete next[payload.clientId];
          return next;
        });
      },
      onError: (msg, _, payload) => {
        showError(`Update failed: ${msg}`);
        // Revert optimistic update
        setClients((prev) =>
          prev.map((c) =>
            c.id === payload.clientId ? { ...c, ...pendingUpdates[payload.clientId] } : c
          )
        );
      },
    }
  );

  const createClientMutation = useCachedEdgeFunction<ClientFormValues, { success: boolean; newClientId: string }>(
    "create-client",
    {
      onSuccess: () => {
        showSuccess("Client created");
        setCreatingOpen(false);
        clientsQuery.invalidateCache();
        clientsQuery.execute();
      },
      onError: (msg) => showError(`Creation failed: ${msg}`),
    }
  );

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    clientsQuery.execute();
  }, []);

  // ── Search filtering (memoized) ─────────────────────────────────────────────

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.focus?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.starSign?.toLowerCase().includes(term)
    );
  }, [clients, searchTerm]);

  // ── Debounced field update ──────────────────────────────────────────────────

  const debouncedUpdate = useCallback(
    debounce((payload: UpdateNotionClientPayload) => {
      updateClientMutation.execute(payload);
    }, 800),
    []
  );

  const handleFieldChange = (clientId: string, field: keyof Client, value: string) => {
    setClients((prev) =>
      prev.map((client) => (client.id === clientId ? { ...client, [field]: value } : client))
    );

    setPendingUpdates((prev) => ({
      ...prev,
      [clientId]: { ...prev[clientId], [field]: value },
    }));

    debouncedUpdate({ clientId, updates: { [field]: value } });
  };

  // ── Form ─────────────────────────────────────────────────────────────────────

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      focus: "",
      email: "",
      phone: "",
    },
  });

  const onCreateSubmit = async (values: ClientFormValues) => {
    await createClientMutation.execute(values);
    form.reset();
  };

  // ── Render states ───────────────────────────────────────────────────────────

  if (clientsQuery.loading && clients.length === 0) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 px-4 py-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <Card className="shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-xl px-6 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="h-8 w-8" />
                <div>
                  <CardTitle className="text-3xl font-bold">Clients</CardTitle>
                  <p className="mt-1 text-indigo-100/90">Manage your client records</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                {clients.length} clients
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {/* Controls */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, focus, email, phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clientsQuery.invalidateCache();
                    clientsQuery.execute();
                  }}
                  disabled={clientsQuery.loading || updateClientMutation.loading}
                >
                  {clientsQuery.loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Refresh
                </Button>

                <Dialog open={creatingOpen} onOpenChange={setCreatingOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                      <PlusCircle className="h-4 w-4" />
                      New Client
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Create New Client</DialogTitle>
                      <DialogDescription>
                        Add a new client to your database. You can edit details later.
                      </DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-5 pt-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel required>Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Full name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="focus"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Main Focus / Condition</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Primary reason for sessions (optional)"
                                  className="resize-none"
                                  rows={2}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="client@example.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone</FormLabel>
                                <FormControl>
                                  <Input type="tel" placeholder="+61 ..." {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <Button
                          type="submit"
                          className="w-full mt-2"
                          disabled={createClientMutation.loading}
                        >
                          {createClientMutation.loading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            "Create Client"
                          )}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Content */}
            {clients.length === 0 ? (
              <EmptyState isLoading={clientsQuery.loading} />
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="mx-auto h-12 w-12 opacity-40 mb-4" />
                <h3 className="text-lg font-medium">No matching clients</h3>
                <p className="mt-2">Try adjusting your search term.</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[180px]">Name</TableHead>
                      <TableHead className="min-w-[220px]">Focus</TableHead>
                      <TableHead className="w-[220px]">Email</TableHead>
                      <TableHead className="w-[160px]">Phone</TableHead>
                      <TableHead className="w-[120px] text-center">Star Sign</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow key={client.id} className="group hover:bg-muted/50">
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>
                          <Textarea
                            value={client.focus ?? ""}
                            onChange={(e) => handleFieldChange(client.id, "focus", e.target.value)}
                            placeholder="—"
                            className="min-h-[52px] text-sm resize-none border-0 shadow-none focus-visible:ring-1"
                            disabled={updateClientMutation.loading}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="email"
                            value={client.email ?? ""}
                            onChange={(e) => handleFieldChange(client.id, "email", e.target.value)}
                            placeholder="—"
                            className="border-0 shadow-none focus-visible:ring-1"
                            disabled={updateClientMutation.loading}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="tel"
                            value={client.phone ?? ""}
                            onChange={(e) => handleFieldChange(client.id, "phone", e.target.value)}
                            placeholder="—"
                            className="border-0 shadow-none focus-visible:ring-1"
                            disabled={updateClientMutation.loading}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {client.starSign ? (
                            <Badge variant="outline" className="font-normal">
                              {client.starSign}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
        <p className="text-muted-foreground">Loading clients...</p>
      </div>
    </div>
  );
}

function EmptyState({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <LoadingState />;

  return (
    <div className="py-16 text-center">
      <Database className="mx-auto h-14 w-14 text-indigo-200 mb-6" />
      <h2 className="text-2xl font-semibold text-slate-700 mb-3">No clients yet</h2>
      <p className="text-slate-500 max-w-md mx-auto mb-8">
        Create your first client to start building your database.
      </p>
      <Dialog>
        <DialogTrigger asChild>
          <Button size="lg" className="gap-2">
            <PlusCircle className="h-5 w-5" />
            Add First Client
          </Button>
        </DialogTrigger>
        {/* Dialog content same as above – could be extracted to shared component */}
      </Dialog>
    </div>
  );
}