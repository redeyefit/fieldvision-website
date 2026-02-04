// Prompt Lab - Type Definitions

export type ModelType = 'gemini' | 'claude' | 'openai';

export interface MasterSchema {
  name: string;
  version: string;
  model_family: string;
  created: string;
  preferred_model: 'gemini' | 'claude' | 'openai';

  inputs: Record<string, string>;
  goal: string;
  context: string;
  constraints: string[];
  instructions: Array<{ step: string; action: string }>;
  output_schema: object;
  adapter_overrides: {
    claude?: AdapterConfig;
    gemini?: AdapterConfig;
    openai?: AdapterConfig;
  };
}

export interface AdapterConfig {
  add_step_by_step?: boolean;
  anti_hallucination_emphasis?: 'strong' | 'moderate' | 'none';
  system_role?: string;
  output_constraint?: 'strict' | 'flexible';
  prompt_length?: 'concise' | 'detailed';
  multimodal_instruction?: 'explicit' | 'implicit';
  emphasis?: string;
  output_format_enforcement?: 'json_mode' | 'json_strict' | 'none';
  system_prompt_style?: 'directive' | 'conversational';
}

export interface TestCase {
  id: string;
  input: {
    image?: string;
    pdf?: string;
    page?: number;
    variables?: Record<string, string>;
  };
  expected: {
    room_count: number;
    rooms: Array<{
      name: string;
      area?: number;
    }>;
    total_area?: number;
  };
  eval: EvalRules;
}

export interface EvalRules {
  room_name_match: 'exact' | 'exact_with_synonyms';
  area_match: 'exact_when_labeled' | 'range_5_percent' | 'ignore';
  missing_room: 'FAIL' | 'WARN';
  extra_room: 'FAIL' | 'WARN';
  order_sensitive: boolean;
}

export interface EvalResult {
  test_id: string;
  model: string;
  schema_version: string;
  timestamp: string;
  passed: boolean;
  scores: {
    room_count_match: boolean;
    room_names_correct: number;  // 0-1
    areas_correct: number;       // 0-1
    overall: number;             // 0-1
  };
  failures: string[];
  raw_output: object;
}

export interface RenderedPrompt {
  model: 'gemini' | 'claude' | 'openai';
  system?: string;
  user: string;
  outputFormat?: 'json' | 'text';
}

// Synonym map for room name matching
export const ROOM_SYNONYMS: Record<string, string[]> = {
  'BATHROOM': ['BATH', 'BATHRM', 'BTH'],
  'BEDROOM': ['BR', 'BED', 'BDRM'],
  'LIVING ROOM': ['LIVING', 'LR', 'LIVING RM'],
  'DINING ROOM': ['DINING', 'DR', 'DINING RM'],
  'KITCHEN': ['KIT', 'KTCHN'],
  'CLOSET': ['CLO', 'CL', 'CLST'],
  'GARAGE': ['GAR'],
  'FIRST FLOOR': ['1ST FLOOR', 'FLOOR 1', 'LEVEL 1'],
  'SECOND FLOOR': ['2ND FLOOR', 'FLOOR 2', 'LEVEL 2'],
};
