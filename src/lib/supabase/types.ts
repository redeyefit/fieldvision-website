// Database types for Schedule Maker

export interface Project {
  id: string;
  name: string;
  start_date: string | null;
  work_days: 'mon-fri' | 'mon-sat';
  user_id: string | null;        // Clerk user ID
  anonymous_id: string | null;   // HMAC-signed token for anonymous users
  pdf_url: string | null;        // Vercel Blob URL
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: string;
  project_id: string;
  text: string;
  trade: string | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  name: string;
  trade: string | null;
  duration_days: number;
  start_date: string;
  end_date: string;
  depends_on: string[];          // Task IDs
  sequence_index: number;
  created_at: string;
  updated_at: string;
}

// API request/response types
export interface CreateProjectRequest {
  name: string;
  start_date?: string;
  work_days?: 'mon-fri' | 'mon-sat';
}

export interface ParsePDFResponse {
  line_items: Omit<LineItem, 'id' | 'project_id' | 'created_at' | 'updated_at'>[];
}

export interface GenerateScheduleRequest {
  project_id: string;
  line_item_ids: string[];       // Only confirmed items
  start_date: string;
  work_days: 'mon-fri' | 'mon-sat';
}

export interface GenerateScheduleResponse {
  tasks: Task[];
}

// AI schedule modification types
export interface ScheduleModificationOperation {
  action: 'add' | 'update' | 'delete';
  task_name: string;
  name?: string;
  trade?: string;
  duration_days?: number;
  depends_on_names?: string[];
  insert_after?: string;
}

export interface FieldChange {
  from: string | number | string[] | null;
  to: string | number | string[] | null;
}

export interface ValidatedOperation {
  action: 'add' | 'update' | 'delete';
  task_id?: string;        // Resolved UUID (undefined for 'add')
  task_name: string;       // Display name
  changes: Record<string, FieldChange>;
  warnings?: string[];
}

export type AskResponse =
  | { type: 'text'; answer: string }
  | {
      type: 'modification';
      answer: string;
      reasoning: string;
      operations: ValidatedOperation[];
      warnings: string[];
    };

// Client-side state types
export interface ScheduleState {
  project: Project | null;
  lineItems: LineItem[];
  tasks: Task[];
  status: 'idle' | 'loading' | 'saving' | 'error';
  lastSaved: Date | null;
  error: string | null;
}
