import { useState } from "react";
import { createRoom, joinRoom, supabase } from "../lib/supabase";
import pplogo from "../assets/pplogo.png";

export function Home() {
  const [userName, setUserName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const checkUsernameAvailability = async (
    roomCode: string,
    userName: string
  ) => {
    const { data } = await supabase
      .from("room_users")
      .select("user_name")
      .eq("room_code", roomCode)
      .eq("user_name", userName)
      .single();

    return !data; // If no data is found, username is available
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !roomName) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      const room = await createRoom(roomName);

      // Check if username is available in the new room
      const isAvailable = await checkUsernameAvailability(room.code, userName);
      if (!isAvailable) {
        setError("Username is already taken in this room");
        return;
      }

      window.location.href = `/room/${room.code}?user=${encodeURIComponent(
        userName
      )}`;
    } catch (err) {
      setError("Failed to create room");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !roomCode) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      // First check if username is available
      const isAvailable = await checkUsernameAvailability(roomCode, userName);
      if (!isAvailable) {
        setError("Username is already taken in this room");
        return;
      }

      await joinRoom(roomCode);
      window.location.href = `/room/${roomCode}?user=${encodeURIComponent(
        userName
      )}`;
    } catch (err) {
      setError("Room not found or inactive");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <img src={pplogo} alt="Planning Poker" />
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Estimate your user stories with your team
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-900/50 p-4">
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

        <div className="rounded-lg bg-gray-800 px-6 py-8 shadow-lg ring-1 ring-gray-700/50">
          <div className="mb-6">
            <label
              htmlFor="userName"
              className="block text-sm font-medium text-gray-200"
            >
              Your Name
            </label>
            <input
              id="userName"
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
              placeholder="Enter your name"
            />
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-200">
                Create New Room
              </h3>
              <form onSubmit={handleCreateRoom} className="mt-4">
                <div>
                  <label
                    htmlFor="roomName"
                    className="block text-sm font-medium text-gray-200"
                  >
                    Room Name
                  </label>
                  <input
                    id="roomName"
                    type="text"
                    required
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Enter room name"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`mt-4 flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    isLoading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isLoading ? "Creating..." : "Create Room"}
                </button>
              </form>
            </div>

            <div className="relative">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true"
              >
                <div className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-gray-800 px-2 text-sm text-gray-400">
                  or
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-200">
                Join Existing Room
              </h3>
              <form onSubmit={handleJoinRoom} className="mt-4">
                <div>
                  <label
                    htmlFor="roomCode"
                    className="block text-sm font-medium text-gray-200"
                  >
                    Room Code
                  </label>
                  <input
                    id="roomCode"
                    type="text"
                    required
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Enter room code"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`mt-4 flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    isLoading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isLoading ? "Joining..." : "Join Room"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
