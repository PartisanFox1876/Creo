import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CONFIG } from "./config.js";

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ---------------- Auth ----------------

export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, is_admin")
    .eq("id", session.user.id)
    .single();
  if (error) throw error;
  return { ...data, email: session.user.email };
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

// ---------------- Species (creatures) ----------------

export async function listSpecies() {
  const { data, error } = await supabase.from("species").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function upsertSpecies(species) {
  const { data, error } = await supabase.from("species").upsert(species).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSpecies(id) {
  const { error } = await supabase.from("species").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- Items ----------------

export async function listItems() {
  const { data, error } = await supabase.from("items").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function upsertItem(item) {
  const { data, error } = await supabase.from("items").upsert(item).select().single();
  if (error) throw error;
  return data;
}

export async function deleteItem(id) {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- Sprite uploads ----------------

export async function uploadSprite(file, folder) {
  const path = `${folder}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("sprites").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("sprites").getPublicUrl(path);
  return data.publicUrl;
}
