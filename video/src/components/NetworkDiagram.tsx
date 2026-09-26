import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  accountPosition,
  badgeSize,
  clamp01,
  connection,
  mix,
  routeSignal,
  smooth,
  venuePosition,
  traderContribution,
} from "../motion";
import { venues } from "../venues";
import { TraderSilhouette } from "./TraderSilhouette";

// The same geometry drives badges, connectors and packets at every frame.
// After the orbit, the fan makes the outbound/return flow the focal point.
export const NetworkDiagram = () => {
  const frame = useCurrentFrame();
  const account = accountPosition(frame);
  const size = badgeSize(frame);
  const signal = routeSignal(frame);
  const privacy = smooth((frame - 540) / 30);
  const pooling = smooth((frame - 426) / 12) * (1 - smooth((frame - 520) / 20));
  const accumulated =
    smooth((frame - 470) / 18) * (1 - smooth((frame - 503) / 20));
  const badgesOpacity = interpolate(
    frame,
    [0, 110, 138, 198, 268, 630, 679],
    [0.65, 0.65, 0.06, 0.06, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <>
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <filter id="ray-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        {venues.map((venue, i) => {
          const line = connection(frame, i);
          const draw = smooth((frame - 294 - i * 7) / 20);
          const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
          const active = signal?.venue === i ? signal : null;
          const p = active?.progress ?? 0;
          const tail = clamp01(p + (active?.returning ? 0.16 : -0.16));
          return (
            <g key={venue.id} opacity={draw}>
              <line
                {...line}
                stroke="#314363"
                strokeWidth="2"
                strokeDasharray={length}
                strokeDashoffset={length * (1 - draw)}
              />
              {active && (
                <g opacity={active.opacity}>
                  <line
                    {...line}
                    stroke="#6093ff"
                    strokeWidth="3"
                    opacity="0.6"
                  />
                  {active.traveling && (
                    <>
                      <line
                        x1={mix(line.x1, line.x2, tail)}
                        y1={mix(line.y1, line.y2, tail)}
                        x2={mix(line.x1, line.x2, p)}
                        y2={mix(line.y1, line.y2, p)}
                        stroke={active.returning ? "#BBD3FF" : "#0051FE"}
                        strokeWidth="8"
                        strokeLinecap="round"
                        filter="url(#ray-glow)"
                      />
                      <circle
                        cx={mix(line.x1, line.x2, p)}
                        cy={mix(line.y1, line.y2, p)}
                        r="6"
                        fill={active.returning ? "#E0EBFF" : "#6093FF"}
                      />
                    </>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Trader contributions converge into Cinder, then ONE venue route lights up.
            They do not originate from venues or imply cross-venue fee-tier pooling. */}
        <g opacity={pooling}>
          {[0, 1, 2].map((i) => {
            const user = traderContribution(frame, i);
            return (
              <path
                key={i}
                d={`M 867 ${user.startY} C 925 ${user.startY}, 945 ${account.y}, ${user.endX} ${account.y}`}
                fill="none"
                stroke="#314363"
                strokeWidth="2"
              />
            );
          })}
          {/* All avatars sit above every path: no lines crossing their faces. */}
          {[0, 1, 2].map((i) => {
            const user = traderContribution(frame, i);
            return (
              <TraderSilhouette
                key={i}
                x={user.x}
                y={user.y}
                size={mix(46, 34, user.progress)}
                color="#A9C7FF"
                opacity={user.opacity}
              />
            );
          })}
        </g>
        <rect
          x={account.x - 124}
          y={account.y - 125}
          width="248"
          height="250"
          rx="54"
          fill="#0051FE"
          fillOpacity={accumulated * 0.1}
          stroke="#6093FF"
          strokeWidth="2"
          strokeOpacity={accumulated * 0.75 + (signal?.received ?? 0) * 0.7}
        />

        {/* The lock stays inside the private account. Venue execution remains
            visible outside the boundary. */}
        <rect
          x={account.x - 124}
          y={account.y - 132}
          width="248"
          height="318"
          rx="45"
          fill="#0051FE"
          fillOpacity={privacy * 0.06}
          stroke="#6093FF"
          strokeWidth="2"
          strokeOpacity={privacy * 0.8}
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={1 - privacy}
        />
        <g
          aria-label="Private account lock"
          transform={`translate(${account.x} ${account.y + 150})`}
          opacity={interpolate(frame, [563, 583], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
          stroke="#8FB2FF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M -12 -2 V -11 A 12 12 0 0 1 12 -11 V -2" fill="none" />
          <rect x="-20" y="-2" width="40" height="25" rx="6" fill="#12264B" />
          <circle cx="0" cy="8" r="2.5" fill="#BDD3FF" stroke="none" />
          <path d="M 0 11 V 15" />
        </g>
      </svg>

      {venues.map((venue, i) => {
        const p = venuePosition(frame, i);
        const arrival = signal?.venue === i ? signal.arrival : 0;
        return (
          <div
            key={venue.id}
            style={{
              position: "absolute",
              left: p.x - size / 2,
              top: p.y - size / 2,
              width: size,
              textAlign: "center",
              opacity:
                badgesOpacity * (signal?.venue === i ? 1 : 1 - privacy * 0.22),
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                background: "linear-gradient(145deg, #191d25, #0f1218)",
                border: `1px solid rgba(96,147,255,${0.2 + arrival * 0.8})`,
                borderRadius: mix(38, 28, (146 - size) / 38),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 16px 44px #00000044, 0 0 ${arrival * 38}px rgba(0,81,254,${arrival * 0.32})`,
              }}
            >
              <Img
                src={staticFile(venue.asset)}
                style={{
                  width: (venue.size * size) / 146,
                  height: (venue.size * size) / 146,
                  objectFit: "contain",
                }}
              />
            </div>
            <div
              style={{
                marginTop: 15,
                opacity:
                  1 -
                  smooth((frame - 112) / 18) * (1 - smooth((frame - 204) / 28)),
                fontSize: 29,
                fontWeight: 400,
                color: arrival > 0 ? "#E0EBFF" : "#B9C2D1",
                whiteSpace: "nowrap",
              }}
            >
              {venue.label}
            </div>
          </div>
        );
      })}
    </>
  );
};
