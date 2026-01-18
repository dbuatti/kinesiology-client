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
  acupointId: string | null; // Added to resolve TS2353
}

export interface MinimalAppointment {
  id: string;
  clientName: string;
  starSign: string;
  sessionNorthStar: string;
  goal: string;
  sessionAnchor: string;
  status: string;
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
  // New fields for detailed muscle information
  origin: string;
  insertion: string;
  action: string;
  position: string;
  rotation: string;
  stabilise: string;
  monitor: string;
  nerveSupply: string;
  visceralNerves: string;
  neuroLymphaticReflex: string;
  neuroVascularReflex: string;
  relatedYuanPoint: { id: string; name: string } | null;
  relatedAkChannel: { id: string; name: string } | null;
  relatedTcmChannel: { id: string; name: string } | null;
  type: string | null;
  tags: { id: string; name: string }[];
  timeAk: { id: string; name: string } | null;
  timeTcm: { id: string; name: string } | null;
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

export interface Channel {
  id: string;
  name: string;
  elements: string[];
  pathways: string;
  functions: string;
  emotions: string[];
  frontMu: string;
  heSea: string;
  jingRiver: string;
  jingWell: string;
  akMuscles: { id: string; name: string }[];
  tcmMuscles: { id: string; name: string }[];
  yuanPoints: string;
  sedate1: string;
  sedate2: string;
  tonify1: string;
  tonify2: string;
  appropriateSound: string;
  tags: string[];
  brainAspects: string;
  activateSinew: string;
  time: string;
  sound: string;
}

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
  type: string;
  text?: NotionRichText[];
  caption?: NotionRichText[]; // For images
  url?: string; // For images
  checked?: boolean; // For to_do
  color?: string; // For callout
  icon?: { type: string; emoji?: string; file?: { url: string } }; // For callout
  children?: NotionBlock[]; // For nested blocks like toggle
}

export interface NotionSecrets {
  id: string; // This is now the user_id and primary key
  notion_integration_token: string;
  modes_database_id: string | null;
  acupoints_database_id: string | null;
  muscles_database_id: string | null; // New: Muscles Database ID
  channels_database_id: string | null; // New: Channels Database ID
  chakras_database_id: string | null; // New: Chakras Database ID
  tags_database_id: string | null; // New: Tags Database ID
}

// Edge Function Payloads and Responses
export interface GetTodaysAppointmentsPayload {
  todayDate: string; // YYYY-MM-DD format
}

export interface GetTodaysAppointmentsResponse {
  appointments: MinimalAppointment[];
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
  updates: Partial<Appointment>;
}

export interface UpdateNotionAppointmentResponse {
  success: boolean;
  updatedPageId: string;
}

export interface GetSingleAppointmentPayload {
  appointmentId: string;
}

export interface GetSingleAppointmentResponse {
  appointment: MinimalAppointment;
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

export interface GetChakrasPayload {
  searchTerm: string;
  searchType: 'name' | 'element' | 'emotion' | 'organ';
}

export interface GetChakrasResponse {
  chakras: Chakra[];
}

export interface GetChannelsPayload {
  searchTerm: string; // Can be used for future search, currently fetches all
  searchType: 'name' | 'element'; // Example search types
}

export interface GetChannelsResponse {
  channels: Channel[];
}

export interface GetNotionPageContentPayload {
  pageId: string;
}

export interface GetNotionPageContentResponse {
  title: string;
  blocks: NotionBlock[];
}

export interface LogSessionEventPayload {
  appointmentId: string;
  logType: string;
  details: any;
}

export interface LogSessionEventResponse {
  success: boolean;
  logId: string;
}

// New interfaces for muscle strength logging
export interface LogMuscleStrengthPayload {
  appointmentId: string;
  muscleId: string;
  muscleName: string;
  isStrong: boolean;
  notes: string | null;
}

export interface LogMuscleStrengthResponse {
  success: boolean;
  logId: string;
}

// New interfaces for session logs
export interface SessionLog {
  id: string;
  created_at: string;
  user_id: string;
  appointment_id: string;
  log_type: string;
  details: any;
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

export interface GetSessionLogsResponse {
  sessionLogs: SessionLog[];
  sessionMuscleLogs: SessionMuscleLog[];
}

export interface DeleteSessionLogPayload {
  logId: string;
  logType: 'session_log' | 'session_muscle_log';
}

export interface DeleteSessionLogResponse {
  success: boolean;
  deletedLogId: string;
}

export interface SetNotionSecretsPayload {
  notionToken: string;
  modesDbId: string | null;
  acupointsDbId: string | null;
  musclesDbId: string | null; // New: Muscles Database ID
  channelsDbId: string | null; // New: Channels Database ID
  chakrasDbId: string | null; // New: Chakras Database ID
  tagsDbId: string | null; // New: Tags Database ID
}

export interface SetNotionSecretsResponse {
  success: boolean;
  message: string;
}

export interface CreateNotionAppointmentPayload {
  clientCrmId: string;
  clientName: string; // For logging/display purposes
  date: string; // YYYY-MM-DD
  goal: string;
  sessionNorthStar: string;
}

export interface CreateNotionAppointmentResponse {
  success: boolean;
  newAppointmentId: string;
}

// New interface for creating a client
export interface CreateClientPayload {
  name: string;
  focus?: string;
  email?: string;
  phone?: string;
}

export interface CreateClientResponse {
  success: boolean;
  newClientId: string;
}