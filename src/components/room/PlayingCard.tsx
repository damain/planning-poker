interface PlayingCardProps {
  value: number;
  selected: boolean;
  onClick: () => void;
}

export function PlayingCard({ value, selected, onClick }: PlayingCardProps) {
  return (
    <button
      onClick={onClick}
      className={`playing-card-button ${selected ? 'selected' : ''}`}
    >
      <svg
        width="80"
        height="112"
        viewBox="0 0 80 112"
        className="playing-card"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Card background */}
        <rect
          x="2"
          y="2"
          width="76"
          height="108"
          rx="8"
          className={`card-background ${selected ? 'selected' : ''}`}
          stroke="currentColor"
          strokeWidth="2"
          fill="currentColor"
        />
        
        {/* Card value */}
        <text
          x="40"
          y="62"
          textAnchor="middle"
          dominantBaseline="middle"
          className="card-value"
          fill={selected ? "white" : "#4F46E5"}
          fontSize="32"
          fontWeight="bold"
        >
          {value}
        </text>
      </svg>
    </button>
  );
}
