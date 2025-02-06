import type { Database } from "./database.types";

type Vote = Database["public"]["Tables"]["votes"]["Row"];

export function calculateStatistics(votes: Vote[]) {
  const numericVotes = votes
    .map((v) => v.vote_value)
    .filter((v): v is number => v !== null);

  if (numericVotes.length === 0) {
    return { optimistic: 0, pessimistic: 0, likely: 0 };
  }

  const optimistic = Math.min(...numericVotes);
  const pessimistic = Math.max(...numericVotes);
  const likely = Math.round(
    numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
  );

  return { optimistic, pessimistic, likely };
}
