import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SlideLayout } from "../components/SlideLayout";
import { COLORS } from "../theme";

const SOLUTIONS = [
  {
    icon: "🤔",
    problem: '"I can\'t put my type into words"',
    solution: "Date simulation helps you articulate it",
  },
  {
    icon: "⏳",
    problem: '"I don\'t have time"',
    solution: "My Fox does the matching and screening for you",
  },
  {
    icon: "😮‍💨",
    problem: '"I\'m tired of dating apps"',
    solution:
      "Matchmaking becomes entertainment; you control how close you get, step by step",
  },
];

export const HowWeSolveSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [-30, 0]);

  return (
    <SlideLayout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: "40px",
        }}
      >
        <h2
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            fontSize: 84,
            fontWeight: 900,
            marginBottom: 80,
            letterSpacing: "-0.03em",
            color: COLORS.primary,
            textAlign: "center",
          }}
        >
          How We <span style={{ color: COLORS.secondary }}>Solve It</span>
        </h2>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 40,
            width: "100%",
            maxWidth: 1400,
          }}
        >
          {SOLUTIONS.map((item, i) => {
            const delay = 15 + i * 20;
            const rowProgress = spring({
              frame: frame - delay,
              fps,
              config: { damping: 16, stiffness: 120 },
            });

            const rowOpacity = interpolate(rowProgress, [0, 1], [0, 1]);
            const rowX = interpolate(rowProgress, [0, 1], [-50, 0]);
            
            const solutionProgress = spring({
              frame: frame - delay - 10,
              fps,
              config: { damping: 14, stiffness: 100 },
            });
            const solutionScale = interpolate(solutionProgress, [0, 1], [0.9, 1]);
            const solutionOpacity = interpolate(solutionProgress, [0, 1], [0, 1]);

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  gap: 32,
                  width: "100%",
                }}
              >
                {/* Problem Card */}
                <div
                  style={{
                    opacity: rowOpacity,
                    transform: `translateX(${rowX}px)`,
                    flex: 1,
                    backgroundColor: COLORS.muted,
                    borderRadius: 24,
                    padding: "32px 40px",
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <span style={{ fontSize: 48 }}>{item.icon}</span>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 500,
                      color: COLORS.mutedForeground,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.problem}
                  </div>
                </div>

                {/* Arrow */}
                <div
                  style={{
                    opacity: solutionOpacity,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 16px",
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      backgroundColor: COLORS.secondaryLight,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 32,
                      fontWeight: "bold",
                      boxShadow: `0 0 20px ${COLORS.secondaryLight}40`,
                    }}
                  >
                    →
                  </div>
                </div>

                {/* Solution Card */}
                <div
                  style={{
                    opacity: solutionOpacity,
                    transform: `scale(${solutionScale})`,
                    flex: 1.2,
                    backgroundColor: COLORS.secondary,
                    borderRadius: 24,
                    padding: "32px 40px",
                    display: "flex",
                    alignItems: "center",
                    boxShadow: `0 12px 32px ${COLORS.secondary}40`,
                    border: `1px solid ${COLORS.tertiary}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      color: "#FFFFFF",
                      lineHeight: 1.3,
                      textShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                  >
                    {item.solution}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideLayout>
  );
};
