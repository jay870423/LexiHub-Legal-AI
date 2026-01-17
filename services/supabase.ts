import { createClient } from '@supabase/supabase-js';

// Access environment variables using Vite's import.meta.env.
// We use optional chaining (import.meta.env?.KEY) to safely handle cases where env is undefined.

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Key is missing. Authentication features will be disabled.');
}

// Initialize with values
export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey
);

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return data;
};

export const signInWithGithub = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};