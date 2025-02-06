import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  supabase,
  addUserToRoom as addUser,
  updateUserLastSeen,
  addVote,
  anonymizeStory,
  anonymizeAllStories,
  createStory,
  toggleShowVotes,
  setVotingScale,
} from "../lib/supabase";
import type { Database } from "../lib/database.types";
import { Toaster } from "react-hot-toast";
import { VotingArea } from "./room/VotingArea";
import { PokerTable } from "./room/PokerTable";
import { RoomHeader } from "./room/RoomHeader";
import { StoryManagement } from "./room/StoryManagement";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Vote = Database["public"]["Tables"]["votes"]["Row"];
type Story = Database["public"]["Tables"]["stories"]["Row"];

export function Room() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [searchParams] = useSearchParams();
  const userName = searchParams.get("user") || "";

  const [room, setRoom] = useState<Room | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const [tempUserName, setTempUserName] = useState("");

  useEffect(() => {
    if (!roomCode) return;
    const loadRoom = async () => {
      try {
        const { data: roomData, error: roomError } = await supabase
          .from("rooms")
          .select("*")
          .eq("code", roomCode)
          .single();

        if (roomError) throw roomError;
        setRoom(roomData);

        // Load all stories for the room
        const { data: storyData, error: storyError } = await supabase
          .from("stories")
          .select("*")
          .eq("room_code", roomCode)
          .order("created_at", { ascending: false });

        if (storyError) throw storyError;
        setStories(storyData);

        // Load votes for current story
        if (roomData.current_story) {
          const { data: voteData, error: voteError } = await supabase
            .from("votes")
            .select("*")
            .eq("room_code", roomCode)
            .eq("story_id", roomData.current_story);

          if (voteError) throw voteError;
          setVotes(voteData);
        }
      } catch (err) {
        setError("Failed to load room data");
        console.error(err);
      }
    };

    loadRoom();

    // Subscribe to room changes
    const subscription = supabase
      .channel("public:rooms")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `code=eq.${roomCode}`,
        },
        (payload) => {
          console.log("Room change event received:", payload);
          const newRoom = payload.new as Room;
          setRoom(newRoom);
          
          // If current story changed, reload votes for the new story
          if (newRoom.current_story) {
            supabase
              .from("votes")
              .select("*")
              .eq("room_code", roomCode)
              .eq("story_id", newRoom.current_story)
              .then(({ data, error }) => {
                if (!error && data) {
                  console.log("Loaded votes for new story:", data);
                  setVotes(data);
                }
              });
          } else {
            // Clear votes if no current story
            setVotes([]);
          }
        }
      )
      .subscribe();

    // Subscribe to story changes
    const storySubscription = supabase
      .channel("public:stories")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stories",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          console.log("Story change event received:", payload);
          if (payload.eventType === "DELETE") {
            setStories((prev) => prev.filter((s) => s.id !== payload.old.id));
          } else {
            setStories((prev) => {
              const newStory = payload.new as Story;
              const index = prev.findIndex((s) => s.id === newStory.id);
              if (index === -1) {
                return [...prev, newStory];
              }
              const newStories = [...prev];
              newStories[index] = newStory;
              return newStories;
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      storySubscription.unsubscribe();
    };
  }, [roomCode]);

  // Separate useEffect for vote subscription to handle current story changes
  useEffect(() => {
    if (!roomCode || !room?.current_story) return;

    // Subscribe to vote changes for the current story
    const voteSubscription = supabase
      .channel(`public:votes:${room.current_story}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
          filter: `room_code=eq.${roomCode} AND story_id=eq.${room.current_story}`,
        },
        (payload) => {
          console.log("Vote change event received:", payload);
          setVotes((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((v) => v.id !== payload.old.id);
            } else if (payload.eventType === "INSERT") {
              return [...prev, payload.new as Vote];
            } else {
              // UPDATE
              const newVote = payload.new as Vote;
              return prev.map((v) => (v.id === newVote.id ? newVote : v));
            }
          });
        }
      )
      .subscribe();

    return () => {
      voteSubscription.unsubscribe();
    };
  }, [roomCode, room?.current_story]);

  useEffect(() => {
    if (!roomCode || !userName) return;

    const addUserToRoom = async () => {
      try {
        // Try to insert first (in case user doesn't exist)
        const { error: insertError } = await supabase
          .from("room_users")
          .insert({
            room_code: roomCode,
            user_name: userName,
            last_seen: new Date().toISOString(),
          })
          .select();

        // If insert fails due to duplicate, update the existing record
        if (insertError && insertError.code === "23505") {
          const { error: updateError } = await supabase
            .from("room_users")
            .update({ last_seen: new Date().toISOString() })
            .eq("room_code", roomCode)
            .eq("user_name", userName);

          if (updateError) {
            console.error("Failed to update user:", updateError);
            return;
          }
        } else if (insertError) {
          console.error("Failed to insert user:", insertError);
          return;
        }

        // Fetch active users
        const { data: activeUsers, error: fetchError } = await supabase
          .from("room_users")
          .select("user_name")
          .eq("room_code", roomCode)
          .gte("last_seen", new Date(Date.now() - 60000).toISOString());

        if (fetchError) {
          console.error("Failed to fetch users:", fetchError);
          return;
        }

        if (activeUsers) {
          const userNames = activeUsers.map((u) => u.user_name).sort();
          console.log("Active users:", userNames);
          setUsers(userNames);
        }
      } catch (err) {
        console.error("Failed to manage user in room:", err);
      }
    };

    // Initial user setup
    addUserToRoom();

    // Keep user's last_seen timestamp updated
    const interval = setInterval(async () => {
      try {
        const { error: updateError } = await supabase
          .from("room_users")
          .update({ last_seen: new Date().toISOString() })
          .eq("room_code", roomCode)
          .eq("user_name", userName);

        if (updateError) {
          console.error("Failed to update last_seen:", updateError);
        }
      } catch (err) {
        console.error("Failed to update last_seen:", err);
      }
    }, 30000);

    // Subscribe to room_users changes
    const channel = supabase.channel(`room_users:${roomCode}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_users",
          filter: `room_code=eq.${roomCode}`,
        },
        async (payload) => {
          console.log("Room users changed:", payload);

          // Fetch all active users when there's any change
          const { data: activeUsers, error: fetchError } = await supabase
            .from("room_users")
            .select("user_name")
            .eq("room_code", roomCode)
            .gte("last_seen", new Date(Date.now() - 60000).toISOString());

          if (fetchError) {
            console.error("Failed to fetch users after change:", fetchError);
            return;
          }

          if (activeUsers) {
            const userNames = activeUsers.map((u) => u.user_name).sort();
            console.log("Updated active users:", userNames);
            setUsers(userNames);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [roomCode, userName]);

  useEffect(() => {
    if (!userName) {
      setIsUsernameModalOpen(true);
    }
  }, [userName]);

  const handleSetUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUserName.trim()) return;

    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("user", tempUserName);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${searchParams.toString()}`
    );
    window.location.reload();
  };

  // Memoize the vote handler
  const handleVote = useCallback(async (value: number) => {
    if (!roomCode || !room?.current_story) return;

    try {
      const newVote = {
        room_code: roomCode,
        story_id: room.current_story,
        user_name: userName,
        vote_value: value,
      };

      const { error } = await supabase
        .from("votes")
        .upsert(newVote, {
          onConflict: 'story_id,user_name',
          ignoreDuplicates: false
        });

      if (error) throw error;
      setSelectedValue(value);
    } catch (err) {
      console.error("Failed to submit vote:", err);
    }
  }, [roomCode, room?.current_story, userName]);

  const handleAddStory = async (title: string, description: string) => {
    if (!roomCode) return;

    try {
      const { error } = await createStory({
        room_code: roomCode,
        title: title.trim(),
        description: description.trim() || undefined,
      });

      if (error) throw error;
    } catch (err) {
      console.error("Failed to add story:", err);
    }
  };

  const handleEditStory = async (story: Story) => {
    try {
      const { error } = await supabase
        .from("stories")
        .update({
          title: story.title,
          description: story.description,
        })
        .eq("id", story.id);

      if (error) throw error;
    } catch (err) {
      console.error("Failed to update story:", err);
    }
  };

  const handleSelectStory = async (storyId: number) => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from("rooms")
        .update({ current_story: storyId })
        .eq("code", roomCode);

      if (error) throw error;
    } catch (err) {
      console.error("Failed to select story:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleVotes = async () => {
    if (!room) return;
    try {
      await toggleShowVotes(roomCode!, !room.show_votes);
    } catch (err) {
      setError("Failed to toggle votes");
      console.error(err);
    }
  };

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-xl text-gray-200">Loading...</div>
      </div>
    );
  }

  const currentStory = stories.find(
    (s) => s.id.toString() === room.current_story
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-7xl">
        <div className="rounded-lg bg-gray-800 px-5 py-6 shadow-lg ring-1 ring-gray-700/50 sm:px-6">
          <RoomHeader
            room={room}
            userName={userName}
            onOpenSidebar={() => setIsSidebarOpen(true)}
          />

          {error && (
            <div className="mt-4 rounded-md bg-red-900/50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM3.707 7.293a1 1 0 00-1.414-1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <PokerTable
              room={room}
              currentStory={currentStory}
              votes={votes}
              users={users}
            />

            <VotingArea
              room={room}
              votes={votes}
              selectedValue={selectedValue}
              isLoading={isLoading}
              currentStory={currentStory}
              onVote={handleVote}
              onToggleVotes={handleToggleVotes}
              onSetVotingScale={setVotingScale}
            />
          </div>
        </div>
      </div>

      <StoryManagement
        room={room}
        stories={stories}
        isOpen={isSidebarOpen}
        isLoading={isLoading}
        onClose={() => setIsSidebarOpen(false)}
        onSelectStory={handleSelectStory}
        onAddStory={handleAddStory}
        onEditStory={handleEditStory}
        onAnonymizeStory={anonymizeStory}
        onAnonymizeAllStories={anonymizeAllStories}
      />

      {/* Username Modal */}
      {isUsernameModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">Enter Your Name</h3>
            <form onSubmit={handleSetUsername}>
              <input
                type="text"
                value={tempUserName}
                onChange={(e) => setTempUserName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Your name"
                required
              />
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Join Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
