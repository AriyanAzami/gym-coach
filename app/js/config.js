/* Supabase project URL and anon key.

   These are public identifiers, exactly like a Firebase web config: they
   identify the project, they do not grant access. Every table and view is
   behind row-level security, so this key can read nothing without a signed-in
   session. The service-role key is the secret one and never appears here.

   Phase 5 of docs/plan.md replaces these placeholders with the real project. */
export const SUPABASE_URL = 'https://PROJECT_REF.supabase.co';
export const SUPABASE_ANON_KEY = 'PUBLIC_ANON_KEY';

export const configured = !SUPABASE_URL.includes('PROJECT_REF');
