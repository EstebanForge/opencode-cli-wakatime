export interface Input {
  file: string;
  time: number;
  project?: string;
  language?: string;
  is_write?: boolean;
  is_unmodified?: boolean;
  line_number?: number;
  cursor_position?: number;
  dependencies?: string[];
  entity?: string;
  type?: string;
}

export interface Heartbeat {
  file: string;
  timestamp: number;
  project?: string;
  language?: string;
  is_write?: boolean;
  is_unmodified?: boolean;
  line_number?: number;
  cursor_position?: number;
  dependencies?: string[];
  entity?: string;
  type?: string;
}

export interface State {
  lastHeartbeatAt: number;
  entities: Record<string, number>; // Map of file path to last known modification time
}