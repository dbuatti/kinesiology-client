"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Calendar as CalendarIcon, User, Target, Lightbulb, Check, ChevronsUpDown, Loader2, PlusCircle, Settings } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useCachedEdgeFunction } from '@/hooks/use-cached-edge-function';
import { Client, GetAllClientsResponse, CreateNotionAppointmentPayload, CreateNotionAppointmentResponse } from '@/types/api';
import { showSuccess, showError } from '@/utils/toast';

interface CreateAppointmentDialogProps {
  onAppointmentCreated: () => void;
}

const CreateAppointmentDialog: React.FC<CreateAppointmentDialogProps> = ({ onAppointmentCreated }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [goal, setGoal] = useState('');
  const [sessionNorthStar, setSessionNorthStar] = useState('');
  const [allClients, setAllClients] = useState<Client[]>([]);

  const handleFetchClientsSuccess = useCallback((data: GetAllClientsResponse) => {
    setAllClients(data.clients);
  }, []);

  const handleFetchClientsError = useCallback((msg: string) => {
    showError(`Failed to load clients: ${msg}`);
  }, []);

  const {
    loading: loadingClients,
    needsConfig: clientsNeedsConfig,
    execute: fetchAllClients,
    isCached: clientsIsCached,
  } = useCachedEdgeFunction<void, GetAllClientsResponse>(
    'get-all-clients',
    {
      requiresAuth: true,
      requiresNotionConfig: true,
      cacheKey: 'all-clients',
      cacheTtl: 60, // 1 hour cache
      onSuccess: handleFetchClientsSuccess,
      onError: handleFetchClientsError,
    }
  );

  const {
    loading: creatingAppointment,
    execute: createNotionAppointment,
  } = useCachedEdgeFunction<CreateNotionAppointmentPayload, CreateNotionAppointmentResponse>(
    'create-notion-appointment',
    {
      requiresAuth: true,
      onSuccess: (data) => {
        showSuccess('Appointment created and synced to Notion!');
        setIsDialogOpen(false);
        // Reset form state
        setSelectedClient(null);
        setDate(new Date());
        setGoal('');
        setSessionNorthStar('');
        onAppointmentCreated();
      },
      onError: (msg) => {
        showError(`Creation Failed: ${msg}`);
      }
    }
  );

  useEffect(() => {
    if (isDialogOpen && allClients.length === 0 && !loadingClients) {
      fetchAllClients();
    }
  }, [isDialogOpen, allClients.length, loadingClients, fetchAllClients]);

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setIsClientSelectOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClient || !date || !goal || !sessionNorthStar) {
      showError('Please fill in all required fields (Client, Date, Goal, Session North Star).');
      return;
    }

    const payload: CreateNotionAppointmentPayload = {
      clientCrmId: selectedClient.id,
      clientName: selectedClient.name,
      date: format(date, 'yyyy-MM-dd'),
      goal: goal.trim(),
      sessionNorthStar: sessionNorthStar.trim(),
    };

    await createNotionAppointment(payload);
  };

  if (clientsNeedsConfig) {
    return (
      <Button
        variant="secondary"
        className="w-full md:w-auto bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
        onClick={() => showError('Notion configuration required to load clients.')}
        disabled
      >
        <Settings className="h-4 w-4 mr-2" />
        Configure Notion First
      </Button>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white">
          <PlusCircle className="h-4 w-4 mr-2" />
          Create New Appointment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-indigo-600" />
            Schedule New Session
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {/* Client Selector */}
          <div className="space-y-2">
            <Label htmlFor="client-select" className="flex items-center gap-2 font-semibold">
              <User className="w-4 h-4 text-indigo-600" />
              Client <span className="text-red-500">*</span>
            </Label>
            <Popover open={isClientSelectOpen} onOpenChange={setIsClientSelectOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isClientSelectOpen}
                  className="w-full justify-between"
                  disabled={loadingClients || creatingAppointment}
                >
                  {loadingClients ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {selectedClient ? selectedClient.name : "Select client..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search client..." />
                  <CommandEmpty>No client found.</CommandEmpty>
                  <CommandGroup className="max-h-[300px] overflow-y-auto">
                    {allClients.map((client) => (
                      <CommandItem
                        key={client.id}
                        value={client.name}
                        onSelect={() => handleClientSelect(client)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {client.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label htmlFor="date-select" className="flex items-center gap-2 font-semibold">
              <CalendarIcon className="w-4 h-4 text-indigo-600" />
              Date <span className="text-red-500">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                  disabled={creatingAppointment}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Goal */}
          <div className="space-y-2">
            <Label htmlFor="goal" className="flex items-center gap-2 font-semibold">
              <Lightbulb className="w-4 h-4 text-indigo-600" />
              Appointment Goal <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="goal"
              placeholder="What is the main outcome for this session?"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={creatingAppointment}
              required
            />
          </div>

          {/* Session North Star */}
          <div className="space-y-2">
            <Label htmlFor="sessionNorthStar" className="flex items-center gap-2 font-semibold">
              <Target className="w-4 h-4 text-indigo-600" />
              Session North Star <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="sessionNorthStar"
              placeholder="What is the client's core focus or issue?"
              value={sessionNorthStar}
              onChange={(e) => setSessionNorthStar(e.target.value)}
              disabled={creatingAppointment}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 mt-4"
            disabled={creatingAppointment || loadingClients}
          >
            {creatingAppointment ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <PlusCircle className="h-5 w-5 mr-2" />}
            {creatingAppointment ? 'Creating...' : 'Create Appointment'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAppointmentDialog;