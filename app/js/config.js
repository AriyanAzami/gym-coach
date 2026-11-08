/* Supabase project URL and anon key.

   These are public identifiers, exactly like a Firebase web config: they
   identify the project, they do not grant access. Every table and view is
   behind row-level security, so this key can read nothing without a signed-in
   session. The service-role key is the secret one and never appears here. */
export const SUPABASE_URL = 'https://pdioiedbpiryccrtrynn.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkaW9pZWRicGlyeWNjcnRyeW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5OTk1MDcsImV4cCI6MjEwOTU3NTUwN30.g2Y3zOBs3YInn4gvt75JAcHUGLdJmxGxGWJyz1ABw7k';

export const configured = !SUPABASE_URL.includes('PROJECT_REF');
