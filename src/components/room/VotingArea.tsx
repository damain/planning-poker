import type { Database } from "../../lib/database.types";
import { calculateStatistics } from "../../lib/utils";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Vote = Database["public"]["Tables"]["votes"]["Row"];

const FIBONACCI_NUMBERS = [1, 2, 3, 5, 8, 13, 21];
const LINEAR_NUMBERS = [1, 2, 3, 4, 5, 10, 15, 20, 25];

interface VotingAreaProps {
  room: Room;
  votes: Vote[];
  selectedValue: number | null;
  isLoading: boolean;
  currentStory: Database["public"]["Tables"]["stories"]["Row"] | undefined;
  onVote: (value: number) => void;
  onToggleVotes: () => void;
  onSetVotingScale: (code: string, scale: "fibonacci" | "linear") => void;
}

export function VotingArea({
  room,
  votes,
  selectedValue,
  isLoading,
  currentStory,
  onVote,
  onToggleVotes,
  onSetVotingScale,
}: VotingAreaProps) {
  if (!currentStory) return null;

  return (
    <div className={`voting-area ${isLoading ? "loading" : ""}`}>
      <div className="h-6 flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {votes.length} {votes.length === 1 ? "vote" : "votes"}
        </div>
        <div className="text-sm text-gray-400">
          {!room.show_votes && votes.length > 0 && <span>🔒</span>}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <h4 className="text-lg font-medium text-gray-200">Your Vote</h4>
          <div className="mt-2 flex items-center gap-4">
            <button
              onClick={() => onSetVotingScale(room.code, "fibonacci")}
              className={`text-sm px-3 py-1 rounded ${
                room.voting_scale === "fibonacci" || !room.voting_scale
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              Fibonacci
            </button>
            <button
              onClick={() => onSetVotingScale(room.code, "linear")}
              className={`text-sm px-3 py-1 rounded ${
                room.voting_scale === "linear"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
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
                  {calculateStatistics(votes)?.optimistic || "-"}
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-blue-900/50 px-3 py-2">
                <div className="text-sm text-blue-300">Likely</div>
                <div className="text-lg font-semibold text-blue-100">
                  {calculateStatistics(votes)?.likely || "-"}
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-red-900/50 px-3 py-2">
                <div className="text-sm text-red-300">Pessimistic</div>
                <div className="text-lg font-semibold text-red-100">
                  {calculateStatistics(votes)?.pessimistic || "-"}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={onToggleVotes}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            {room.show_votes ? "Hide Votes" : "Show Votes"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(40px,1fr))] gap-1 mt-6">
        {(room.voting_scale === "linear"
          ? LINEAR_NUMBERS
          : FIBONACCI_NUMBERS
        ).map((value) => (
          <button
            key={value}
            onClick={() => onVote(value)}
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
  );
}
