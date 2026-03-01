import { Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SlideLayout } from "../components/SlideLayout";
import { COLORS } from "../theme";

const PHASES = [
  {
    number: "Phase 1",
    title: "Build Your Persona",
    description: "Build your persona through date simulations with AI",
    fox: "foxes/male/glasses.png",
  },
  {
    number: "Phase 2",
    title: "Your AI Wingman",
    description:
      "Your AI wingman runs the matchmaking and conversation simulation for you",
    fox: "foxes/female/ribbon.png",
  },
];

export const WhatWeDoSlide: React.FC = () => {
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
            marginBottom: 60,
            letterSpacing: "-0.03em",
            color: COLORS.primary,
            textAlign: "center",
          }}
        >
          What We <span style={{ color: COLORS.secondary }}>Do</span>
        </h2>

        <div
          style={{
            display: "flex",
            gap: 48,
            justifyContent: "center",
            width: "100%",
            maxWidth: 1400,
          }}
        >
          {PHASES.map((phase, i) => {
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  backgroundColor: COLORS.muted,
                  borderRadius: 32,
                  padding: "64px 48px",
                  border: `1px solid ${COLORS.border}`,
                  boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 32,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Decorative background circle */}
                <div
                  style={{
                    position: "absolute",
                    top: -100,
                    right: -100,
                    width: 300,
                    height: 300,
                    borderRadius: "50%",
                    backgroundColor: `${COLORS.secondary}10`,
                    zIndex: 0,
                  }}
                />
                
                <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
                  <div
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: "50%",
                      padding: 24,
                      boxShadow: `0 8px 24px ${COLORS.secondary}20`,
                    }}
                  >
                    <Img
                      src={staticFile(phase.fox)}
                      style={{
                        width: 200,
                        height: 200,
                        objectFit: "contain",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.15em",
                        color: COLORS.secondary,
                        backgroundColor: `${COLORS.secondary}15`,
                        padding: "8px 24px",
                        borderRadius: 100,
                      }}
                    >
                      {phase.number}
                    </div>
                    <div
                      style={{
                        fontSize: 48,
                        fontWeight: 800,
                        textAlign: "center",
                        letterSpacing: "-0.01em",
                        color: COLORS.primary,
                      }}
                    >
                      {phase.title}
                    </div>
                    <div
                      style={{
                        fontSize: 32,
                        color: COLORS.mutedForeground,
                        textAlign: "center",
                        lineHeight: 1.5,
                        marginTop: 8,
                      }}
                    >
                      {phase.description}
                    </div>
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
