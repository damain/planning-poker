interface PlayingCardProps {
  value: number;
  selected: boolean;
  onClick?: () => void;
  size?: "small" | "large";
  showBack?: boolean;
}

export function PlayingCard({
  value,
  selected,
  onClick,
  size = "large",
  showBack = false,
}: PlayingCardProps) {
  const dimensions = {
    small: { width: 40, height: 56 },
    large: { width: 80, height: 112 },
  };

  const { width, height } = dimensions[size];

  return (
    <button
      onClick={onClick}
      className={`playing-card-button ${selected ? "selected" : ""} ${
        !onClick ? "no-hover" : ""
      }`}
      disabled={!onClick}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`playing-card ${showBack ? "back" : ""}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Card background */}
        <rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          rx={size === "small" ? 4 : 8}
          className={`card-background ${selected ? "selected" : ""}`}
          stroke="currentColor"
          strokeWidth="2"
          fill="currentColor"
        />
        {/* Joker */}
        {value === 0 && <SVGCard />}
        {/* Card value */}
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="card-value"
          fill={selected ? "white" : "#4F46E5"}
          fontSize={size === "small" ? "16" : "32"}
          fontWeight="bold"
        >
          {value === 0 ? "" : value}
        </text>
      </svg>
    </button>
  );
}

function SVGCard() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="-3 0 30 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="icon"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
      />
    </svg>
  );
}
