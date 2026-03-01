import { Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SlideLayout } from "../components/SlideLayout";
import { AnimatedBullet } from "../components/AnimatedBullet";
import { COLORS } from "../theme";

const PROBLEMS = [
  'I find it hard to put "what I like" into words',
  "I have no time to swipe and chat",
  "I am sick of the same old matching experience",
];

export const ProblemSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [-30, 0]);

  const foxProgress = spring({
    frame: frame - 20,
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  const foxOpacity = interpolate(foxProgress, [0, 1], [0, 1]);
  const foxScale = interpolate(foxProgress, [0, 1], [0.8, 1]);

  return (
    <SlideLayout>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "100%",
          padding: "40px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 80,
            width: "100%",
            maxWidth: 1400,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`,
                fontSize: 84,
                fontWeight: 900,
                marginBottom: 60,
                letterSpacing: "-0.03em",
                color: COLORS.primary,
              }}
            >
              The <span style={{ color: COLORS.destructive }}>Problem</span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {PROBLEMS.map((problem, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: COLORS.muted,
                    borderRadius: 24,
                    padding: "24px 32px",
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                  }}
                >
                  <AnimatedBullet
                    text={problem}
                    delay={30 + i * 20}
                    icon="×"
                    fontSize={36}
                  />
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              opacity: foxOpacity,
              transform: `scale(${foxScale})`,
              flexShrink: 0,
              backgroundColor: `${COLORS.destructive}10`,
              borderRadius: "50%",
              padding: 40,
              boxShadow: `0 0 40px ${COLORS.destructive}20`,
            }}
          >
            <Img
              src={staticFile("foxes/male/normal.png")}
              style={{
                width: 360,
                height: 360,
                objectFit: "contain",
              }}
            />
          </div>
        </div>
      </div>
    </SlideLayout>
  );
};
