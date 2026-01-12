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

export interface Channel {
  id: string;
  name: string;
  elements: string[];
  pathways: string;
  functions: string;
  emotions: string[];
  frontMu: string; // New
  heSea: string; // New
  jingRiver: string; // New
  jingWell: string; // New
  akMuscles: { id: string; name: string }[]; // Changed from string[]
  tcmMuscles: { id: string; name: string }[]; // Changed from string[]
  yuanPoints: string; // New
  sedate1: string; // New
  sedate2: string; // New
  tonify1: string; // New
  tonify2: string; // New
  appropriateSound: string; // New
  tags: string[]; // New
  brainAspects: string; // New: Brain Aspects
  activateSinew: string; // New: Activate Sinew
  time: string; // New: Time
  sound: string; // New: Sound (Select column)
}

export interface Chakra {
  id: string;
  name: string;
  location: string;
  color: string | null;
  elements: string[];
  associatedOrgans: string[];
  emotionalThemes: string[];
  affirmations: string;
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
  // Add a discriminator for union types
  log_type_discriminator: 'session_muscle_log';
}

export interface SessionLog {
  id: string;
  created_at: string;
  user_id: string;
  appointment_id: string;
  log_type: string;
  details: Record<string, any> | null; // JSONB type for flexible details
  // Add a discriminator for union types
  log_type_discriminator: 'session_log';
}

export interface NotionSecrets {
  id: string; // This is now the user_id and primary key
  notion_integration_token: string;
  appointments_database_id: string;
  crm_database_id: string | null;
  modes_database_id: string | null;
  acupoints_database_id: string | null;
  muscles_database_id: string | null;
  channels_database_id: string | null;
  chakras_database_id: string | null; // New: Chakras Database ID
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

export interface GetChannelsPayload {
  searchTerm?: string;
  searchType?: 'name' | 'element' | 'emotion';
}

export interface GetChannelsResponse {
  channels: Channel[];
}

export interface GetChakrasPayload {
  searchTerm?: string;
  searchType?: 'name' | 'element' | 'emotion' | 'organ';
}

export interface GetChakrasResponse {
  chakras: Chakra[];
}

export interface SetNotionSecretsPayload {
  notionToken: string;
  appointmentsDbId: string;
  crmDbId: string | null;
  modesDbId: string | null;
  acupointsDbId: string | null;
  musclesDbId: string | null;
  channelsDbId: string | null;
  chakrasDbId: string | null; // New: Chakras Database ID
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

export interface LogSessionEventPayload {
  appointmentId: string;
  logType: string;
  details?: Record<string, any>;
}

export interface LogSessionEventResponse {
  success: boolean;
  logId: string;
}

// New types for fetching session logs
export interface GetSessionLogsPayload {
  appointmentId: string;
}

export interface GetSessionLogsResponse {
  sessionLogs: SessionLog[];
  sessionMuscleLogs: SessionMuscleLog[];
}

// New types for deleting session logs
export interface DeleteSessionLogPayload {
  logId: string;
  logType: 'session_log' | 'session_muscle_log';
}

export interface DeleteSessionLogResponse {
  success: boolean;
  deletedLogId: string;
}

// New types for Notion page content
export type NotionBlockType =
  | 'paragraph'
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'bulleted_list_item'
  | 'numbered_list_item'
  | 'to_do'
  | 'toggle'
  | 'code'
  | 'child_page'
  | 'image'
  | 'callout'
  | 'quote'
  | 'divider'
  | 'unsupported';

export interface NotionRichText {
  type: 'text';
  text: {
    content: string;
    link: { url: string } | null;
  };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
  href: string | null;
}

export interface NotionBlock {
  id: string;
  type: NotionBlockType;
  text?: NotionRichText[]; // For text-based blocks
  url?: string; // For image blocks
  caption?: NotionRichText[]; // For image blocks
  checked?: boolean; // For to_do blocks
  color?: string; // For callout blocks
  icon?: { type: string; emoji?: string; file?: { url: string } }; // For callout blocks
  children?: NotionBlock[]; // For nested blocks like lists, toggles
}

export interface GetNotionPageContentPayload {
  pageId: string;
}

export interface GetNotionPageContentResponse {
  title: string;
  blocks: NotionBlock[];
}