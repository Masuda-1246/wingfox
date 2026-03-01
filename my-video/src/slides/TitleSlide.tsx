import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandLogo } from "../components/BrandLogo";
import { COLORS, FONTS } from "../theme";

export const TitleSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const subtitleProgress = spring({
    frame: frame - 30,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  const subtitleOpacity = interpolate(subtitleProgress, [0, 1], [0, 1]);
  const subtitleY = interpolate(subtitleProgress, [0, 1], [20, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        fontFamily: FONTS.system,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
      }}
    >
      <BrandLogo iconSize={200} textSize={120} delay={5} clickFrame={55} />
      <div
        style={{
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
          fontSize: 42,
          fontWeight: 600,
          color: COLORS.secondary,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          marginTop: 16,
          backgroundColor: `${COLORS.secondary}10`,
          padding: "12px 32px",
          borderRadius: 100,
        }}
      >
        Your Personal Wingman
      </div>
    </AbsoluteFill>
  );
};
