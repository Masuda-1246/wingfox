import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandLogo } from "../components/BrandLogo";
import { AnimatedBullet } from "../components/AnimatedBullet";
import { COLORS, FONTS } from "../theme";

const POINTS = [
  "Build your persona through AI date simulation",
  "Let your AI wingman find and rank matches for you",
  "Chat with a Fox first — then decide to say hello as yourself",
];

export const SummarySlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const fadeOutStart = durationInFrames - 30;
  const fadeOut = interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const contentProgress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 14, stiffness: 100 },
  });
  const contentY = interpolate(contentProgress, [0, 1], [30, 0]);
  const contentOpacity = interpolate(contentProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        fontFamily: FONTS.system,
        color: COLORS.foreground,
        padding: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 64,
        opacity: fadeOut,
      }}
    >
      <BrandLogo iconSize={140} textSize={96} delay={0} />
      <div
        style={{
          opacity: contentOpacity,
          transform: `translateY(${contentY}px)`,
          width: "100%",
          maxWidth: 960,
          backgroundColor: COLORS.muted,
          borderRadius: 32,
          padding: "48px 64px",
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        {POINTS.map((point, i) => (
          <AnimatedBullet key={i} text={point} delay={20 + i * 20} icon="✓" fontSize={36} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
