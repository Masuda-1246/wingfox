import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

export const AnimatedBullet: React.FC<{
  text: string;
  delay: number;
  icon?: string;
  fontSize?: number;
}> = ({ text, delay, icon = ">", fontSize = 36 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateX = interpolate(progress, [0, 1], [-40, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${translateX}px)`,
        display: "flex",
        alignItems: "flex-start",
        gap: fontSize * 0.55,
        marginBottom: fontSize * 0.78,
      }}
    >
      <span
        style={{
          color: COLORS.secondary,
          fontWeight: 900,
          fontSize,
          lineHeight: 1.4,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          fontSize,
          lineHeight: 1.4,
          fontWeight: 500,
        }}
      >
        {text}
      </span>
    </div>
  );
};
