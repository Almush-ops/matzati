import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our tables
export interface Definition {
  id: string;
  slug: string;
  definition_he: string;
  category: string | null;
  search_count: number;
}

export interface Solution {
  id: string;
  definition_id: string;
  solution: string;
  letter_count: number;
  explanation: string | null;
}

export interface HebrewWord {
  id: string;
  word: string;
  letter_count: number;
  first_letter: string;
  word_type: string | null;
  is_common: boolean;
}

export interface Synonym {
  id: string;
  word: string;
  synonym: string;
  relation_type: string;
}

export interface Rhyme {
  id: string;
  word: string;
  rhyme: string;
  rhyme_type: string;
}
// Rebuild trigger: 20260315211027
