import { createClient } from '@supabase/supabase-js';
import { PersonalDoc, DocumentAnalysis } from '../types';

// Access environment variables using Vite's import.meta.env.
// We use optional chaining (import.meta.env?.KEY) to safely handle cases where env is undefined.

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || "https://jituyssrmqhylcbdcuqr.supabase.co";
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || "sb_publishable_B1pbS6lefnlZEjpazjTNsg_RvIpC3Ti";

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

// --- DATABASE OPERATIONS ---

// 1. Documents (Workspace)

// Helper to map DB row to PersonalDoc type
const mapDocFromDB = (row: any): PersonalDoc => ({
  id: row.id,
  title: row.title,
  content: row.content || '',
  category: row.category as any,
  tags: row.tags || [],
  updatedAt: row.updated_at,
  aiAnalysis: row.ai_analysis as DocumentAnalysis | undefined
});

export const fetchDocuments = async (): Promise<PersonalDoc[]> => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(mapDocFromDB);
};

export const createDocument = async (doc: Omit<PersonalDoc, 'id' | 'updatedAt'>) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      title: doc.title,
      content: doc.content,
      category: doc.category,
      tags: doc.tags,
      ai_analysis: doc.aiAnalysis
    })
    .select()
    .single();

  if (error) throw error;
  return mapDocFromDB(data);
};

export const updateDocument = async (id: string, updates: Partial<PersonalDoc>) => {
  const dbUpdates: any = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.content !== undefined) dbUpdates.content = updates.content;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  if (updates.aiAnalysis !== undefined) dbUpdates.ai_analysis = updates.aiAnalysis;
  // updatedAt is handled by DB trigger

  const { data, error } = await supabase
    .from('documents')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapDocFromDB(data);
};

export const deleteDocument = async (id: string) => {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// 2. User Stats (Dashboard)

export interface UserStats {
  leadsGenerated: number;
  queriesCount: number;
}

export const fetchUserStats = async (): Promise<UserStats | null> => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;

  // First try to select
  let { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // If no row found (rare, trigger handles it, but just in case), return zeros
  if (error && error.code === 'PGRST116') {
      return { leadsGenerated: 0, queriesCount: 0 };
  }
  
  if (error) {
    console.error("Error fetching stats:", error);
    return null;
  }

  return {
    leadsGenerated: data.leads_generated || 0,
    queriesCount: data.queries_count || 0
  };
};

export const incrementUserStats = async (newLeads: number, newQueries: number) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return;

  // We use an RPC call or simple increment logic. 
  // Since Supabase simple client doesn't support atomic increment easily without RPC,
  // we'll do read-modify-write for simplicity in this prototype. 
  // Ideally: use an RPC function `increment_stats`.
  
  const { data: current } = await supabase
    .from('user_stats')
    .select('leads_generated, queries_count')
    .eq('user_id', user.id)
    .single();

  if (current) {
    await supabase
      .from('user_stats')
      .update({
        leads_generated: (current.leads_generated || 0) + newLeads,
        queries_count: (current.queries_count || 0) + newQueries,
        last_active_at: new Date().toISOString()
      })
      .eq('user_id', user.id);
  } else {
     // Create if missing
     await supabase.from('user_stats').insert({
        user_id: user.id,
        leads_generated: newLeads,
        queries_count: newQueries
     });
  }
};
