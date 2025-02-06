import type { Database } from "../../lib/database.types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Vote = Database["public"]["Tables"]["votes"]["Row"];
type Story = Database["public"]["Tables"]["stories"]["Row"];

interface PlayerCardProps {
  user: string;
  room: Room;
  votes: Vote[];
}

function PlayerCard({ user, room, votes }: PlayerCardProps) {
  return (
    <div key={user} className="w-32">
      <div className="text-gray-300 font-medium text-center mb-2 truncate">
        {user}
      </div>
      <div
        className={`card-flip relative h-16 ${
          room.show_votes && votes.find((v) => v.user_name === user)
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
            {votes.find((v) => v.user_name === user)?.vote_value || "-"}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PokerTableProps {
  room: Room;
  currentStory: Story | undefined;
  votes: Vote[];
  users: string[];
}

export function PokerTable({ room, currentStory, votes, users }: PokerTableProps) {
  return (
    <div className="poker-table-container">
      {/* The Table */}
      <div className="poker-table">
        {room?.current_story && currentStory && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">
                {currentStory.title}
              </h3>
              {currentStory.description && (
                <p className="mt-2 text-lg text-gray-300 whitespace-pre-wrap">
                  {currentStory.description}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Top Players */}
      <div className="player-cards top">
        {users.slice(0, 3).map((user) => (
          <PlayerCard key={user} user={user} room={room} votes={votes} />
        ))}
      </div>

      {/* Left Players */}
      <div className="player-cards left">
        {users.slice(3, 5).map((user) => (
          <PlayerCard key={user} user={user} room={room} votes={votes} />
        ))}
      </div>

      {/* Right Players */}
      <div className="player-cards right">
        {users.slice(5, 7).map((user) => (
          <PlayerCard key={user} user={user} room={room} votes={votes} />
        ))}
      </div>

      {/* Bottom Players */}
      <div className="player-cards bottom">
        {users.slice(7, 10).map((user) => (
          <PlayerCard key={user} user={user} room={room} votes={votes} />
        ))}
      </div>
    </div>
  );
}
