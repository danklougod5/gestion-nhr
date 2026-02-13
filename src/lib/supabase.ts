
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kjebadvveghiahmiqnin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZWJhZHZ2ZWdoaWFobWlxbmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjAxNTcsImV4cCI6MjA4NTg5NjE1N30.7GjIWOg_Ow9nLscnEY5fqVez2kBcF4PTRT9MO0LwKzE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
