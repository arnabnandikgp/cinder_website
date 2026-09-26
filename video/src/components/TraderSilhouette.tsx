// Code-native head-and-shoulders silhouette; no emoji, external asset or font.
export const TraderSilhouette = ({
  x,
  y,
  size = 40,
  color = "#6093FF",
  opacity = 1,
}: {
  x: number;
  y: number;
  size?: number;
  color?: string;
  opacity?: number;
}) => (
  <g
    aria-label="Trader silhouette"
    transform={`translate(${x} ${y}) scale(${size / 40})`}
    fill={color}
    opacity={opacity}
  >
    <circle cx="0" cy="-11" r="9" />
    <path d="M-18 21V14C-18 6-11 0 0 0S18 6 18 14V21Q18 24 15 24H-15Q-18 24-18 21Z" />
  </g>
);
