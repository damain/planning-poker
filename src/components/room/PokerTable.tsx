import type { Database } from "../../lib/database.types";
import { PlayingCard } from "./PlayingCard";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Vote = Database["public"]["Tables"]["votes"]["Row"];
type Story = Database["public"]["Tables"]["stories"]["Row"];

interface PlayerCardProps {
  user: string;
  room: Room;
  votes: Vote[];
}

function PlayerCard({ user, room, votes }: PlayerCardProps) {
  const userVote = votes.find((v) => v.user_name === user);
  const hasVoted = !!userVote;

  return (
    <div key={user} className="w-32">
      <div className="text-gray-300 font-medium text-center mb-2 truncate">
        {user}
      </div>
      <div className={`flex justify-center ${room.show_votes && hasVoted ? "show-vote" : ""}`}>
        <PlayingCard
          value={userVote?.vote_value || 0}
          selected={false}
          size="small"
          showBack={!room.show_votes && hasVoted}
        />
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
