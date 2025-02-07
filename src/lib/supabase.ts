import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env file."
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Helper functions for room management
export const createRoom = async (roomName: string) => {
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data, error } = await supabase
    .from("rooms")
    .insert([
      {
        code: roomCode,
        name: roomName,
        active: true,
        current_story: null,
        show_votes: false,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const joinRoom = async (roomCode: string) => {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", roomCode)
    .eq("active", true)
    .single();

  if (error) throw error;
  return data;
};

export const subscribeToRoom = (
  roomCode: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`room:${roomCode}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "rooms",
        filter: `code=eq.${roomCode}`,
      },
      callback
    )
    .subscribe();
};

export async function createStory({
  room_code,
  title,
  description,
}: {
  room_code: string;
  title: string;
  description?: string;
}) {
  const { data, error } = await supabase
    .from("stories")
    .insert({ room_code, title, description })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateStory(
  storyId: number,
  updates: {
    title?: string;
    description?: string;
    final_estimate?: number;
    status?: string;
  }
) {
  const { data, error } = await supabase
    .from("stories")
    .update(updates)
    .eq("id", storyId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function editStory(
  storyId: number,
  updates: { title: string; description?: string }
) {
  const { data, error } = await supabase
    .from("stories")
    .update(updates)
    .eq("id", storyId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function anonymizeStory(storyId: number) {
  const { error } = await supabase
    .from("stories")
    .update({
      title: "anonymized",
      description: "anonymized",
    })
    .eq("id", storyId);

  if (error) throw error;
}

export async function anonymizeAllStories(roomCode: string) {
  const { error } = await supabase
    .from("stories")
    .update({
      title: "anonymized",
      description: "anonymized",
    })
    .eq("room_code", roomCode);

  if (error) throw error;
}

export async function setCurrentStory(
  roomCode: string,
  storyId: string | null
) {
  const { error } = await supabase
    .from("rooms")
    .update({
      current_story: storyId,
      show_votes: false, // Reset show votes when changing stories
    })
    .eq("code", roomCode);

  if (error) throw error;
}

export async function toggleShowVotes(roomCode: string, show: boolean) {
  const { error } = await supabase
    .from("rooms")
    .update({ show_votes: show })
    .eq("code", roomCode);

  if (error) throw error;
}

export async function setVotingScale(
  roomCode: string,
  scale: "fibonacci" | "linear"
) {
  const { error } = await supabase
    .from("rooms")
    .update({ voting_scale: scale })
    .eq("code", roomCode);

  if (error) throw error;
}

export async function addUserToRoom({
  room_code,
  user_name,
  last_seen,
}: {
  room_code: string;
  user_name: string;
  last_seen: string;
}) {
  const { data, error } = await supabase
    .from("room_users")
    .insert({ room_code, user_name, last_seen })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserLastSeen({
  room_code,
  user_name,
  last_seen,
}: {
  room_code: string;
  user_name: string;
  last_seen: string;
}) {
  const { error } = await supabase
    .from("room_users")
    .update({ last_seen })
    .eq("room_code", room_code)
    .eq("user_name", user_name);

  if (error) throw error;
}

export async function getUsers(room_code: string) {
  const { data, error } = await supabase
    .from("room_users")
    .select("*")
    .eq("room_code", room_code);

  if (error) throw error;
  return data;
}

export async function addVote({
  room_code,
  story_id,
  user_name,
  vote_value,
}: {
  room_code: string;
  story_id: string;
  user_name: string;
  vote_value: number;
}) {
  // First check if a vote already exists
  const { data: existingVote } = await supabase
    .from("votes")
    .select("id")
    .eq("room_code", room_code)
    .eq("story_id", story_id)
    .eq("user_name", user_name)
    .single();

  if (existingVote) {
    const { error } = await supabase
      .from("votes")
      .update({ vote_value })
      .eq("id", existingVote.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("votes")
      .insert({ room_code, story_id, user_name, vote_value });
    if (error) throw error;
  }
}
