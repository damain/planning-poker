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

function distributeUsers(users: string[]) {
  const totalUsers = users.length;

  // Define max players per side and calculate distribution
  const maxPerSide = Math.floor(totalUsers / 4); // divide by 4 sides
  const remainder = totalUsers % 4;

  // Start with bottom and top (prioritize these positions)
  const bottomCount = maxPerSide + (remainder > 0 ? 1 : 0);
  const topCount = maxPerSide + (remainder > 1 ? 1 : 0);

  // Then distribute to sides
  const leftCount = maxPerSide + (remainder > 2 ? 1 : 0);
  const rightCount = maxPerSide + (remainder > 3 ? 1 : 0);

  // Create the distribution object
  const distribution = {
    bottom: users.slice(0, bottomCount),
    top: users.slice(bottomCount, bottomCount + topCount),
    left: users.slice(
      bottomCount + topCount,
      bottomCount + topCount + leftCount
    ),
    right: users.slice(
      bottomCount + topCount + leftCount,
      bottomCount + topCount + leftCount + rightCount
    ),
  };

  return distribution;
}

interface PokerTableProps {
  room: Room;
  currentStory: Story | undefined;
  votes: Vote[];
  users: string[];
}

export function PokerTable({
  room,
  currentStory,
  votes,
  users,
}: PokerTableProps) {
  const distribution = distributeUsers(users);

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
        {distribution.top.map((user) => (
          <PlayerCard key={user} user={user} room={room} votes={votes} />
        ))}
      </div>

      {/* Left Players */}
      <div className="player-cards left">
        {distribution.left.map((user) => (
          <PlayerCard key={user} user={user} room={room} votes={votes} />
        ))}
      </div>

      {/* Right Players */}
      <div className="player-cards right">
        {distribution.right.map((user) => (
          <PlayerCard key={user} user={user} room={room} votes={votes} />
        ))}
      </div>

      {/* Bottom Players */}
      <div className="player-cards bottom">
        {distribution.bottom.map((user) => (
          <PlayerCard key={user} user={user} room={room} votes={votes} />
        ))}
      </div>
    </div>
  );
}
