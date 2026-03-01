import { Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../theme";

export const BrandLogo: React.FC<{
  showIcon?: boolean;
  iconSize?: number;
  textSize?: number;
  delay?: number;
  clickFrame?: number;
}> = ({ showIcon = true, iconSize = 120, textSize = 72, delay = 0, clickFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const iconProgress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const textProgress = spring({
    frame: frame - delay - 10,
    fps,
    config: { damping: 200 },
  });

  const iconScale = interpolate(iconProgress, [0, 1], [0.3, 1]);
  const iconOpacity = interpolate(iconProgress, [0, 1], [0, 1]);
  const textOpacity = interpolate(textProgress, [0, 1], [0, 1]);
  const textY = interpolate(textProgress, [0, 1], [20, 0]);

  const clickScale =
    clickFrame !== undefined
      ? interpolate(
          frame,
          [clickFrame, clickFrame + 3, clickFrame + 8, clickFrame + 14, clickFrame + 18],
          [1.0, 0.87, 1.1, 0.97, 1.0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
      : 1;

  const rippleScale =
    clickFrame !== undefined
      ? interpolate(frame, [clickFrame + 3, clickFrame + 32], [0.8, 2.6], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  const rippleOpacity =
    clickFrame !== undefined
      ? interpolate(frame, [clickFrame + 3, clickFrame + 8, clickFrame + 32], [0, 0.45, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  const glowOpacity =
    clickFrame !== undefined
      ? interpolate(frame, [clickFrame, clickFrame + 4, clickFrame + 22], [0, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
      }}
    >
      {showIcon && (
        <div style={{ position: "relative", width: iconSize, height: iconSize }}>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: iconSize,
              height: iconSize,
              borderRadius: 24,
              backgroundColor: COLORS.secondary,
              opacity: rippleOpacity,
              transform: `translate(-50%, -50%) scale(${rippleScale})`,
            }}
          />
          <Img
            src={staticFile("icon.png")}
            style={{
              width: iconSize,
              height: iconSize,
              borderRadius: 24,
              opacity: iconOpacity,
              transform: `scale(${iconScale * clickScale})`,
              boxShadow: `0 0 ${40 * glowOpacity}px ${Math.round(18 * glowOpacity)}px ${COLORS.secondary}88`,
              position: "relative",
            }}
          />
        </div>
      )}
      <div
        style={{
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
          fontFamily: FONTS.system,
          fontSize: textSize,
          fontWeight: 900,
          letterSpacing: "-0.02em",
        }}
      >
        Wing
        <span style={{ color: COLORS.secondary }}>Fox</span>
      </div>
    </div>
  );
};
