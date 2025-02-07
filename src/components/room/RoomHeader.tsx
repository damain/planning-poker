import type { Database } from "../../lib/database.types";
import toast from "react-hot-toast";

type Room = Database["public"]["Tables"]["rooms"]["Row"];

interface RoomHeaderProps {
  room: Room;
  userName: string;
  onOpenSidebar: () => void;
}

export function RoomHeader({ room, userName, onOpenSidebar }: RoomHeaderProps) {
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

  return (
    <div className="border-b border-gray-700 pb-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-200">
            Room: {room.name} (Code: {room.code})
          </h3>
          <p className="mt-2 text-sm text-gray-400">Joined as: {userName}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenSidebar}
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
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
            Share Room
          </button>
        </div>
      </div>
    </div>
  );
}
