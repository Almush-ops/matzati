import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PUBLIC_SUPABASE_ANON_KEY
);

// Test without range
const { data: limited, error: err1 } = await supabase
  .from('crossword_definitions')
  .select('slug');
console.log('Without range:', limited?.length);

// Test with range
const { data: full, error: err2 } = await supabase
  .from('crossword_definitions')
  .select('slug')
  .range(0, 9999);
console.log('With range(0, 9999):', full?.length);

if (err1) console.error('Error 1:', err1);
if (err2) console.error('Error 2:', err2);
