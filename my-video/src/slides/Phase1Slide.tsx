import {
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SlideLayout } from "../components/SlideLayout";
import {
  DemoVideoFrame,
  DemoVideoFrameMulti,
  DemoVideoPlaceholder,
} from "../components/DemoVideoFrame";
import { COLORS } from "../theme";

const BULLETS = [
  "Answer questions designed to find you better dates",
  "We generate date scenarios from your answers",
  "Have a date-like conversation with AI",
  "We build your persona from that experience",
];

// 個別再生セグメント (1.mov, 2-1.mov)
const INDIVIDUAL_SEGMENTS = [
  { src: "demo/ph1/1.mov",   bulletIndex: 0, durationInFrames: 270 }, // 9s
  { src: "demo/ph1/2-1.mov", bulletIndex: 1, durationInFrames: 180 }, // 6s
];

// ぶっ続け: 2-2.mov → 2-3.mov (bullet 2)
const MIDDLE_VIDEOS = [
  { src: "demo/ph1/2-2.mov", durationInFrames:  60 }, // 2s
  { src: "demo/ph1/2-3.mov", durationInFrames: 270 }, // 9s
];
const MIDDLE_BULLET = 2;

// ぶっ続け: 3.mov → 4-1.mov → 4-2.mov → 5.mov (bullet 3)
const CONTINUOUS_VIDEOS = [
  { src: "demo/ph1/3.mov",   durationInFrames: 101 }, // 3.4s
  { src: "demo/ph1/4-1.mov", durationInFrames:  55 }, // 1.8s
  { src: "demo/ph1/4-2.mov", durationInFrames: 298 }, // 9.9s
  { src: "demo/ph1/5.mov",   durationInFrames: 112 }, // 0.7s + 3s 静止
];
const CONTINUOUS_BULLET = 3;

const INDIVIDUAL_TOTAL = INDIVIDUAL_SEGMENTS.reduce((acc, s) => acc + s.durationInFrames, 0); // 450f
const MIDDLE_START = INDIVIDUAL_TOTAL;                                                          // 450f
const MIDDLE_TOTAL = MIDDLE_VIDEOS.reduce((acc, v) => acc + v.durationInFrames, 0);           // 330f
const CONTINUOUS_START = MIDDLE_START + MIDDLE_TOTAL;                                          // 780f
const CONTINUOUS_TOTAL = CONTINUOUS_VIDEOS.reduce((acc, v) => acc + v.durationInFrames, 0);   // 476f

export const Phase1Slide: React.FC<{ hasVideo?: boolean }> = ({
  hasVideo = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [-30, 0]);

  const activeBulletIndex = (() => {
    if (!hasVideo) return -1;
    if (frame >= CONTINUOUS_START) return CONTINUOUS_BULLET;
    if (frame >= MIDDLE_START) return MIDDLE_BULLET;
    let elapsed = 0;
    for (const seg of INDIVIDUAL_SEGMENTS) {
      elapsed += seg.durationInFrames;
      if (frame < elapsed) return seg.bulletIndex;
    }
    return MIDDLE_BULLET;
  })();

  return (
    <SlideLayout>
      <div
        style={{
          display: "flex",
          gap: 32,
          alignItems: "stretch",
          height: "100%",
          padding: "40px 0 40px 40px",
        }}
      >
        {/* 左カラム: タイトル + バレット */}
        <div
          style={{
            flex: "0 0 480px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginBottom: 60,
            }}
          >
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
                alignSelf: "flex-start",
              }}
            >
              Phase 1
            </div>
            <h2
              style={{
                fontSize: 72,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                color: COLORS.primary,
                margin: 0,
              }}
            >
              Build Your{" "}
              <span style={{ color: COLORS.secondary }}>Persona</span>
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {BULLETS.map((bullet, i) => {
              const isActive = i === activeBulletIndex;

              return (
                <div
                  key={i}
                  style={{
                    backgroundColor: isActive ? COLORS.secondary : COLORS.muted,
                    borderRadius: 24,
                    padding: "20px 32px",
                    border: `1px solid ${isActive ? COLORS.secondary : COLORS.border}`,
                    boxShadow: isActive
                      ? `0 8px 24px ${COLORS.secondary}40`
                      : "0 4px 20px rgba(0,0,0,0.03)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? "#FFFFFF" : COLORS.mutedForeground,
                      lineHeight: 1.4,
                    }}
                  >
                    {bullet}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右カラム: デモ動画 */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {hasVideo ? (
            <>
              {/* 1.mov, 2-1.mov: 個別にブラウザフレームごと切り替え */}
              {(() => {
                let offset = 0;
                return INDIVIDUAL_SEGMENTS.map((segment, i) => {
                  const from = offset;
                  offset += segment.durationInFrames;
                  return (
                    <Sequence
                      key={i}
                      from={from}
                      durationInFrames={segment.durationInFrames}
                      layout="none"
                    >
                      <DemoVideoFrame videoSrc={segment.src} delay={0} />
                    </Sequence>
                  );
                });
              })()}

              {/* 2-2.mov → 2-3.mov: ブラウザフレームを維持しながら連続再生 */}
              <Sequence from={MIDDLE_START} durationInFrames={MIDDLE_TOTAL} layout="none">
                <DemoVideoFrameMulti videos={MIDDLE_VIDEOS} delay={0} />
              </Sequence>

              {/* 3.mov → 4-1.mov → 4-2.mov → 5.mov: ブラウザフレームを維持しながら連続再生 */}
              <Sequence from={CONTINUOUS_START} durationInFrames={CONTINUOUS_TOTAL} layout="none">
                <DemoVideoFrameMulti videos={CONTINUOUS_VIDEOS} delay={0} />
              </Sequence>
            </>
          ) : (
            <DemoVideoPlaceholder label="Phase 1 Demo" delay={10} />
          )}
        </div>
      </div>
    </SlideLayout>
  );
};
