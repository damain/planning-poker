import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  supabase,
  subscribeToRoom,
  createStory,
  setCurrentStory,
  toggleShowVotes,
  editStory,
  anonymizeStory,
  anonymizeAllStories,
  setVotingScale,
} from "../lib/supabase";
import type { Database } from "../lib/database.types";
import toast, { Toaster } from "react-hot-toast";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Vote = Database["public"]["Tables"]["votes"]["Row"];
type Story = Database["public"]["Tables"]["stories"]["Row"];

const FIBONACCI_NUMBERS = [1, 2, 3, 5, 8, 13, 21];
const LINEAR_NUMBERS = [1, 2, 3, 4, 5, 10, 15, 20, 25];

export function Room() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [searchParams] = useSearchParams();
  const userName = searchParams.get("user") || "";

  const [room, setRoom] = useState<Room | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isAddingStory, setIsAddingStory] = useState(false);
  const [newStoryTitle, setNewStoryTitle] = useState("");
  const [newStoryDescription, setNewStoryDescription] = useState("");
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const [isAnonymizeModalOpen, setIsAnonymizeModalOpen] = useState(false);
  const [tempUserName, setTempUserName] = useState("");
  const [users, setUsers] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const calculateVoteStats = (votes: Vote[]) => {
    if (!votes || votes.length === 0) return null;
    
    const numericVotes = votes.map(v => v.vote_value);
    const optimistic = Math.min(...numericVotes);
    const pessimistic = Math.max(...numericVotes);
    const likely = Math.round(numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length);
    
    return { optimistic, pessimistic, likely };
  };

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
          setRoom(payload.new as Room);
        }
      )
      .subscribe();

    console.log("Room subscription created for room:", roomCode);

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

          // Load all stories again to ensure consistency
          supabase
            .from("stories")
            .select("*")
            .eq("room_code", roomCode)
            .order("created_at", { ascending: false })
            .then(({ data, error }) => {
              if (!error && data) {
                console.log("Reloaded stories:", data);
                setStories(data);
              }
            });
        }
      )
      .subscribe();

    // Subscribe to vote changes
    const voteSubscription = supabase
      .channel("public:votes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
          filter: `room_code=eq.${roomCode}${
            room?.current_story ? ` AND story_id=eq.${room.current_story}` : ""
          }`,
        },
        (payload) => {
          console.log("Vote change event received:", payload);

          // Reload votes for current story
          if (room?.current_story) {
            supabase
              .from("votes")
              .select("*")
              .eq("room_code", roomCode)
              .eq("story_id", room.current_story)
              .then(({ data, error }) => {
                if (!error && data) {
                  console.log("Reloaded votes:", data);
                  setVotes(data);
                }
              });
          }
        }
      )
      .subscribe();

    console.log("Subscriptions created for room:", roomCode);

    return () => {
      subscription.unsubscribe();
      storySubscription.unsubscribe();
      voteSubscription.unsubscribe();
    };
  }, [roomCode, room]);

  useEffect(() => {
    if (!roomCode || !room?.current_story) return;

    const loadVotes = async () => {
      try {
        const { data: voteData, error: voteError } = await supabase
          .from("votes")
          .select("*")
          .eq("room_code", roomCode)
          .eq("story_id", room.current_story);

        if (voteError) throw voteError;
        setVotes(voteData || []);
        
        // Update selected value for current user
        const userVote = voteData?.find((v) => v.user_name === userName);
        setSelectedValue(userVote?.vote_value || null);
      } catch (err) {
        console.error("Failed to load votes:", err);
      }
    };

    loadVotes();

    // Subscribe to vote changes
    const voteSubscription = supabase
      .channel("public:votes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
          filter: `room_code=eq.${roomCode} AND story_id=eq.${room.current_story}`,
        },
        async () => {
          const { data, error } = await supabase
            .from("votes")
            .select("*")
            .eq("room_code", roomCode)
            .eq("story_id", room.current_story);

          if (!error && data) {
            setVotes(data);
            // Update selected value when votes change
            const userVote = data.find((v) => v.user_name === userName);
            setSelectedValue(userVote?.vote_value || null);
          }
        }
      )
      .subscribe();

    return () => {
      voteSubscription.unsubscribe();
    };
  }, [roomCode, room?.current_story, userName]);

  useEffect(() => {
    if (!roomCode || !userName) return;

    const addUserToRoom = async () => {
      try {
        // Get existing users
        const { data: existingUsers } = await supabase
          .from("room_users")
          .select("user_name")
          .eq("room_code", roomCode);

        const userNames = existingUsers?.map((u) => u.user_name).sort() || [];

        if (!userNames.includes(userName)) {
          await supabase.from("room_users").insert({
            room_code: roomCode,
            user_name: userName,
            last_seen: new Date().toISOString(),
          });
        } else {
          // Update last_seen
          await supabase
            .from("room_users")
            .update({ last_seen: new Date().toISOString() })
            .eq("room_code", roomCode)
            .eq("user_name", userName);
        }

        setUsers(
          userNames.includes(userName)
            ? userNames
            : [...userNames, userName].sort()
        );
      } catch (err) {
        console.error("Failed to add user to room:", err);
      }
    };

    addUserToRoom();

    // Keep user's last_seen timestamp updated
    const interval = setInterval(async () => {
      try {
        await supabase
          .from("room_users")
          .update({ last_seen: new Date().toISOString() })
          .eq("room_code", roomCode)
          .eq("user_name", userName);
      } catch (err) {
        console.error("Failed to update last_seen:", err);
      }
    }, 30000); // Every 30 seconds

    // Subscribe to room_users changes
    const userSubscription = supabase
      .channel("public:room_users")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_users",
          filter: `room_code=eq.${roomCode}`,
        },
        async () => {
          // Reload all active users
          const { data: activeUsers } = await supabase
            .from("room_users")
            .select("user_name")
            .eq("room_code", roomCode)
            .gte("last_seen", new Date(Date.now() - 60000).toISOString()); // Active in last minute

          setUsers((activeUsers?.map((u) => u.user_name) || []).sort());
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      userSubscription.unsubscribe();
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

  const handleVote = async (value: number) => {
    try {
      const { data: existingVote } = await supabase
        .from("votes")
        .select("id")
        .eq("room_code", roomCode)
        .eq("story_id", room.current_story)
        .eq("user_name", userName)
        .single();

      if (existingVote) {
        await supabase
          .from("votes")
          .update({ vote_value: value })
          .eq("id", existingVote.id);
      } else {
        await supabase.from("votes").insert({
          room_code: roomCode,
          story_id: room.current_story,
          user_name: userName,
          vote_value: value,
        });
      }

      setSelectedValue(value);
    } catch (err) {
      setError("Failed to submit vote");
      console.error(err);
    }
  };

  const handleAddStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoryTitle.trim()) {
      setError("Story title is required");
      return;
    }

    try {
      const { data: story, error } = await supabase
        .from("stories")
        .insert({
          room_code: roomCode,
          title: newStoryTitle,
          description: newStoryDescription,
        })
        .select()
        .single();

      if (error) throw error;

      setNewStoryTitle("");
      setNewStoryDescription("");
      setIsAddingStory(false);

      // If no current story is selected, set this as current
      if (!room?.current_story && story) {
        await setCurrentStory(roomCode!, story.id.toString());
      }
    } catch (err) {
      setError("Failed to create story");
      console.error(err);
    }
  };

  const handleSelectStory = async (storyId: number) => {
    try {
      setIsLoading(true);

      // Keep old votes visible until new story is fully loaded
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

  const handleEditStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStory) return;

    if (!editingStory.title.trim()) {
      setError("Story title is required");
      return;
    }

    try {
      await editStory(editingStory.id, {
        title: editingStory.title,
        description: editingStory.description || undefined,
      });
      setEditingStory(null);
    } catch (err) {
      setError("Failed to update story");
      console.error(err);
    }
  };

  const handleAnonymizeStory = async (storyId: number) => {
    try {
      await anonymizeStory(storyId);
      toast.success("Story anonymized successfully");
    } catch (err) {
      console.error("Failed to anonymize story:", err);
      toast.error("Failed to anonymize story");
    }
  };

  const handleAnonymizeAllStories = async () => {
    if (!roomCode) {
      toast.error("Room code is missing");
      return;
    }
    try {
      await anonymizeAllStories(roomCode);
      toast.success("All stories anonymized successfully");
      setIsAnonymizeModalOpen(false);
    } catch (err) {
      console.error("Failed to anonymize stories:", err);
      toast.error("Failed to anonymize stories");
    }
  };

  const handleSetVotingScale = async (scale: 'fibonacci' | 'linear') => {
    try {
      await setVotingScale(roomCode!, scale);
      toast.success(`Voting scale updated to ${scale}`);
    } catch (err) {
      console.error('Failed to update voting scale:', err);
      toast.error('Failed to update voting scale');
    }
  };

  const copyRoomLink = async () => {
    try {
      // Create a clean URL without the username parameter
      const url = new URL(window.location.href);
      url.searchParams.delete("user");
      await navigator.clipboard.writeText(url.toString());
      toast.success("Room link copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy room link");
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
          <div className="border-b border-gray-700 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-200">
                  Room: {room.name} (Code: {room.code})
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  Joined as: {userName}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                >
                  Manage Stories
                </button>
                <button
                  onClick={copyRoomLink}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                  Share Room
                </button>
              </div>
            </div>
          </div>

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
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
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

          {/* Current Story and Voting Area */}
          <div className="mt-6">
            {/* Players around the table */}
            <div className="poker-table-container">
              {/* The Table */}
              <div className="poker-table">
                {currentStory ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white">
                        {currentStory.title}
                      </h3>
                      {currentStory.description && (
                        <p className="text-lg text-gray-300">
                          {currentStory.description}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-400">
                    Select a story to start voting
                  </div>
                )}
              </div>

              {/* Top Players */}
              <div className="player-cards top">
                {users.slice(0, 3).map((user) => (
                  <div key={user} className="w-32">
                    <div className="text-gray-300 font-medium text-center mb-2 truncate">
                      {user}
                    </div>
                    <div
                      className={`card-flip relative h-16 ${
                        room.show_votes &&
                        votes.find((v) => v.user_name === user)
                          ? "show-vote"
                          : ""
                      }`}
                    >
                      <div className="card-front rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                        {votes.find((v) => v.user_name === user) ? (
                          <div className="w-8 h-12 rounded bg-indigo-600"></div>
                        ) : (
                          <div className="text-gray-500">No vote</div>
                        )}
                      </div>
                      <div className="card-back rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                        <div className="text-3xl font-bold text-white">
                          {votes.find((v) => v.user_name === user)
                            ?.vote_value || "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Left Players */}
              <div className="player-cards left">
                {users.slice(3, 5).map((user) => (
                  <div key={user} className="w-32">
                    <div className="text-gray-300 font-medium text-center mb-2 truncate">
                      {user}
                    </div>
                    <div
                      className={`card-flip relative h-16 ${
                        room.show_votes &&
                        votes.find((v) => v.user_name === user)
                          ? "show-vote"
                          : ""
                      }`}
                    >
                      <div className="card-front rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                        {votes.find((v) => v.user_name === user) ? (
                          <div className="w-8 h-12 rounded bg-indigo-600"></div>
                        ) : (
                          <div className="text-gray-500">No vote</div>
                        )}
                      </div>
                      <div className="card-back rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                        <div className="text-3xl font-bold text-white">
                          {votes.find((v) => v.user_name === user)
                            ?.vote_value || "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Players */}
              <div className="player-cards right">
                {users.slice(5, 7).map((user) => (
                  <div key={user} className="w-32">
                    <div className="text-gray-300 font-medium text-center mb-2 truncate">
                      {user}
                    </div>
                    <div
                      className={`card-flip relative h-16 ${
                        room.show_votes &&
                        votes.find((v) => v.user_name === user)
                          ? "show-vote"
                          : ""
                      }`}
                    >
                      <div className="card-front rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                        {votes.find((v) => v.user_name === user) ? (
                          <div className="w-8 h-12 rounded bg-indigo-600"></div>
                        ) : (
                          <div className="text-gray-500">No vote</div>
                        )}
                      </div>
                      <div className="card-back rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                        <div className="text-3xl font-bold text-white">
                          {votes.find((v) => v.user_name === user)
                            ?.vote_value || "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Players */}
              <div className="player-cards bottom">
                {users.slice(7, 10).map((user) => (
                  <div key={user} className="w-32">
                    <div className="text-gray-300 font-medium text-center mb-2 truncate">
                      {user}
                    </div>
                    <div
                      className={`card-flip relative h-16 ${
                        room.show_votes &&
                        votes.find((v) => v.user_name === user)
                          ? "show-vote"
                          : ""
                      }`}
                    >
                      <div className="card-front rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                        {votes.find((v) => v.user_name === user) ? (
                          <div className="w-8 h-12 rounded bg-indigo-600"></div>
                        ) : (
                          <div className="text-gray-500">No vote</div>
                        )}
                      </div>
                      <div className="card-back rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                        <div className="text-3xl font-bold text-white">
                          {votes.find((v) => v.user_name === user)
                            ?.vote_value || "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Voting Area */}
            {currentStory && (
              <div className={`voting-area ${isLoading ? "loading" : ""}`}>
                <div className="h-6 flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    {votes.length} {votes.length === 1 ? "vote" : "votes"}
                  </div>
                  <div className="text-sm text-gray-400">
                    {!room.show_votes && votes.length > 0 && (
                      <span>🔒</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium text-gray-200">
                      Your Vote
                    </h4>
                    <div className="mt-2 flex items-center gap-4">
                      <button
                        onClick={() => handleSetVotingScale('fibonacci')}
                        className={`text-sm px-3 py-1 rounded ${
                          room.voting_scale === 'fibonacci' || !room.voting_scale
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        Fibonacci
                      </button>
                      <button
                        onClick={() => handleSetVotingScale('linear')}
                        className={`text-sm px-3 py-1 rounded ${
                          room.voting_scale === 'linear'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        Linear
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {room.show_votes && (
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2 rounded-lg bg-green-900/50 px-3 py-2">
                          <div className="text-sm text-green-300">Optimistic</div>
                          <div className="text-lg font-semibold text-green-100">
                            {calculateVoteStats(votes)?.optimistic || '-'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-blue-900/50 px-3 py-2">
                          <div className="text-sm text-blue-300">Likely</div>
                          <div className="text-lg font-semibold text-blue-100">
                            {calculateVoteStats(votes)?.likely || '-'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-red-900/50 px-3 py-2">
                          <div className="text-sm text-red-300">Pessimistic</div>
                          <div className="text-lg font-semibold text-red-100">
                            {calculateVoteStats(votes)?.pessimistic || '-'}
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={handleToggleVotes}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                    >
                      {room.show_votes ? "Hide Votes" : "Show Votes"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(40px,1fr))] gap-1 mt-6">
                  {(room.voting_scale === 'linear' ? LINEAR_NUMBERS : FIBONACCI_NUMBERS).map((value) => (
                    <button
                      key={value}
                      onClick={() => handleVote(value)}
                      className={`rounded-lg px-2 py-2 text-sm font-medium ${
                        selectedValue === value
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>

                {!room.show_votes && votes.length > 0 && (
                  <div className="text-center text-gray-400">
                    {votes.length} vote{votes.length !== 1 ? "s" : ""} cast
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Story Management Sidebar */}
      <div
        className={`sidebar-backdrop ${isSidebarOpen ? "open" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
      />
      <div className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold text-white">Stories</h2>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsAddingStory(true)}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Add Story
              </button>
              <button
                onClick={() => setIsAnonymizeModalOpen(true)}
                className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-500 flex items-center gap-2"
                title="Anonymize all stories"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
                Anonymize All
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {stories.map((story) => (
              <div
                key={story.id}
                className={`story-card rounded-lg p-4 transition-colors
                  ${
                    story.id.toString() === room.current_story
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                  }
                  ${isLoading ? "pointer-events-none opacity-50" : ""}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium">{story.title}</h5>
                    {story.description && (
                      <p className="mt-1 text-sm opacity-80">
                        {story.description}
                      </p>
                    )}
                    {story.final_estimate && (
                      <p className="mt-2 text-sm">
                        Final estimate:{" "}
                        <span className="font-bold">
                          {story.final_estimate}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleSelectStory(story.id)}
                      className={`rounded p-2 hover:bg-gray-600 ${
                        story.id.toString() === room.current_story
                          ? "bg-indigo-700"
                          : ""
                      }`}
                      title={
                        story.id.toString() === room.current_story
                          ? "Current story"
                          : "Select story"
                      }
                    >
                      {story.id.toString() === room.current_story ? (
                        <svg
                          className="h-8 w-8"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-8 w-8"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => setEditingStory(story)}
                      className="rounded p-2 hover:bg-gray-600"
                      title="Edit story"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleAnonymizeStory(story.id)}
                      className="rounded p-2 hover:bg-gray-600"
                      title="Anonymize story"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Anonymize Confirmation Modal */}
      {isAnonymizeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-4">
              Confirm Anonymize All Stories
            </h3>
            <p className="text-gray-300 mb-6">
              This action will permanently anonymize all stories in this room by removing their titles and descriptions. This change will be saved to the database and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsAnonymizeModalOpen(false)}
                className="px-4 py-2 rounded-md bg-gray-600 text-white hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleAnonymizeAllStories}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-500"
              >
                Anonymize All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {editingStory && (
        <>
          <div
            className="modal-backdrop"
            onClick={() => setEditingStory(null)}
          />
          <div className="modal">
            <h3 className="text-xl font-medium text-white mb-4">Edit Story</h3>
            <form onSubmit={handleEditStory}>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-gray-300"
                  >
                    Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={editingStory.title}
                    onChange={(e) =>
                      setEditingStory({
                        ...editingStory,
                        title: e.target.value,
                      })
                    }
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-300"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={editingStory.description || ""}
                    onChange={(e) =>
                      setEditingStory({
                        ...editingStory,
                        description: e.target.value,
                      })
                    }
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500"
                    rows={12}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingStory(null)}
                    className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}

      {isUsernameModalOpen && (
        <>
          <div className="modal-backdrop" />
          <div className="modal">
            <h3 className="text-xl font-medium text-white mb-4">
              Enter Your Name
            </h3>
            <form onSubmit={handleSetUsername}>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium text-gray-300"
                  >
                    Name
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={tempUserName}
                    onChange={(e) => setTempUserName(e.target.value)}
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    Join Room
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}

      {isAddingStory && (
        <>
          <div
            className="modal-backdrop"
            onClick={() => setIsAddingStory(false)}
          />
          <div className="modal">
            <h3 className="text-xl font-medium text-white mb-4">
              Add New Story
            </h3>
            <form onSubmit={handleAddStory}>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="new-title"
                    className="block text-sm font-medium text-gray-300"
                  >
                    Title
                  </label>
                  <input
                    type="text"
                    id="new-title"
                    value={newStoryTitle}
                    onChange={(e) => setNewStoryTitle(e.target.value)}
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-description"
                    className="block text-sm font-medium text-gray-300"
                  >
                    Description
                  </label>
                  <textarea
                    id="new-description"
                    value={newStoryDescription}
                    onChange={(e) => setNewStoryDescription(e.target.value)}
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500"
                    rows={12}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddingStory(false)}
                    className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    Add Story
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
