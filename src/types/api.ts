export interface Appointment {
  id: string;
  clientName: string;
  clientCrmId: string | null;
  starSign: string;
  clientFocus: string;
  sessionNorthStar: string;
  clientEmail: string;
  clientPhone: string;
  date: string | null;
  goal: string;
  priorityPattern: string | null;
  status: string;
  notes: string;
  sessionAnchor: string;
  // Removed bodyYes and bodyNo as muscle strength logging moves to Supabase
}

export interface Client {
  id: string;
  name: string;
  focus: string;
  email: string;
  phone: string;
  starSign: string;
}

export interface Mode {
  id: string;
  name: string;
  actionNote: string;
}

export interface Acupoint {
  id: string;
  name: string;
  for: string;
  kinesiology: string;
  psychology: string;
  akMuscles: string[];
  channel: string;
  typeOfPoint: string[];
  time: string[];
}

export interface Muscle {
  id: string;
  name: string;
  meridian: string;
  organSystem: string;
  nlPoints: string;
  nvPoints: string;
  emotionalTheme: string[];
  nutritionSupport: string[];
  testPosition: string;
}

export interface SessionMuscleLog {
  id: string;
  created_at: string;
  user_id: string;
  appointment_id: string;
  muscle_id: string;
  muscle_name: string;
  is_strong: boolean;
  notes: string | null;
}

export interface NotionSecrets {
  notion_integration_token: string;
  appointments_database_id: string;
  crm_database_id: string | null;
  modes_database_id: string | null;
  acupoints_database_id: string | null;
  muscles_database_id: string | null;
}

// Edge Function Payloads and Responses
export interface GetTodaysAppointmentsResponse {
  appointments: Appointment[];
}

export interface GetAllClientsResponse {
  clients: Client[];
}

export interface UpdateNotionClientPayload {
  clientId: string;
  updates: Partial<Client>;
}

export interface UpdateNotionClientResponse {
  success: boolean;
  updatedPageId: string;
}

export interface GetAllAppointmentsResponse {
  appointments: Appointment[];
}

export interface UpdateNotionAppointmentPayload {
  appointmentId: string;
  updates: Partial<Appointment> & { acupointId?: string };
}

export interface UpdateNotionAppointmentResponse {
  success: boolean;
  updatedPageId: string;
}

export interface GetSingleAppointmentPayload {
  appointmentId: string;
}

export interface GetSingleAppointmentResponse {
  appointment: Appointment;
}

export interface GetNotionModesResponse {
  modes: Mode[];
}

export interface GetAcupointsPayload {
  searchTerm: string;
  searchType: 'point' | 'symptom';
}

export interface GetAcupointsResponse {
  acupoints: Acupoint[];
}

export interface GetMusclesPayload {
  searchTerm: string;
  searchType: 'muscle' | 'meridian' | 'organ' | 'emotion';
}

export interface GetMusclesResponse {
  muscles: Muscle[];
}

export interface SetNotionSecretsPayload {
  notionToken: string;
  appointmentsDbId: string;
  crmDbId: string | null;
  modesDbId: string | null;
  acupointsDbId: string | null;
  musclesDbId: string | null;
}

export interface SetNotionSecretsResponse {
  success: boolean;
  message: string;
}

export interface LogMuscleStrengthPayload {
  appointmentId: string;
  muscleId: string;
  muscleName: string;
  isStrong: boolean;
  notes?: string;
}

export interface LogMuscleStrengthResponse {
  success: boolean;
  logId: string;
}