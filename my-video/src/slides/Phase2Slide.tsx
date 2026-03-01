import {
  Sequence,
  useCurrentFrame,
} from "remotion";
import { SlideLayout } from "../components/SlideLayout";
import {
  DemoVideoFrame,
  DemoVideoFrameMulti,
  DemoVideoPlaceholder,
} from "../components/DemoVideoFrame";
import { COLORS } from "../theme";

const BULLETS = [
  'We create your "My Fox" from your Phase 1 persona',
  "My Fox matches with other Foxes and has simulated conversations",
  "We rank matches by compatibility from those conversations and personas",
  "You can chat with a Fox you like before deciding to reach out as yourself",
];

const PLAYBACK_RATE = 1.5;

// 個別再生セグメント (1.mov, 2.mov, 3.mov) — durationInFrames は 1.5x速後の長さ
const INDIVIDUAL_SEGMENTS = [
  { src: "demo/ph2/1.mov", bulletIndex: 0, durationInFrames: 200 }, // 300f ÷ 1.5
  { src: "demo/ph2/2.mov", bulletIndex: 1, durationInFrames: 567 }, // 851f ÷ 1.5
  { src: "demo/ph2/3.mov", bulletIndex: 2, durationInFrames: 223 }, // 335f ÷ 1.5
];

// ぶっ続け bullet 3 — durationInFrames は 1.5x速後の長さ
// 4.mov, 7.mov は通常のhideUrl、5.mov・6.movはURLバーが動画内に含まれるため高さを大きくする
const CONT_4 = { src: "demo/ph2/4.mov", durationInFrames: 126 }; // 189f ÷ 1.5
const CONT_56 = [
  { src: "demo/ph2/5.mov", durationInFrames:  95 }, // 142f ÷ 1.5
  { src: "demo/ph2/6.mov", durationInFrames: 183 }, // 274f ÷ 1.5
];
const CONT_7 = { src: "demo/ph2/7.mov", durationInFrames: 187 }; // 280f ÷ 1.5

const CONT_56_TOTAL = CONT_56.reduce((acc, v) => acc + v.durationInFrames, 0); // 278f

const CONTINUOUS_BULLET = 3;

const INDIVIDUAL_TOTAL = INDIVIDUAL_SEGMENTS.reduce((acc, s) => acc + s.durationInFrames, 0); // 990f
const CONTINUOUS_START = INDIVIDUAL_TOTAL;
const CONT_4_START  = CONTINUOUS_START;
const CONT_56_START = CONT_4_START  + CONT_4.durationInFrames;                 // +126f
const CONT_7_START  = CONT_56_START + CONT_56_TOTAL;                           // +278f

export const Phase2Slide: React.FC<{ hasVideo?: boolean }> = ({
  hasVideo = true,
}) => {
  const frame = useCurrentFrame();

  const activeBulletIndex = (() => {
    if (!hasVideo) return -1;
    if (frame >= CONTINUOUS_START) return CONTINUOUS_BULLET;
    let elapsed = 0;
    for (const seg of INDIVIDUAL_SEGMENTS) {
      elapsed += seg.durationInFrames;
      if (frame < elapsed) return seg.bulletIndex;
    }
    return CONTINUOUS_BULLET;
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
              Phase 2
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
              Your AI <span style={{ color: COLORS.secondary }}>Wingman</span>
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
              {/* 1.mov, 2.mov, 3.mov: 個別にブラウザフレームごと切り替え */}
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
                      <DemoVideoFrame videoSrc={segment.src} delay={0} hideUrl playbackRate={PLAYBACK_RATE} />
                    </Sequence>
                  );
                });
              })()}

              {/* 4.mov */}
              <Sequence from={CONT_4_START} durationInFrames={CONT_4.durationInFrames} layout="none">
                <DemoVideoFrame videoSrc={CONT_4.src} delay={0} hideUrl playbackRate={PLAYBACK_RATE} />
              </Sequence>

              {/* 5.mov → 6.mov: チャットページでURLバーが録画に含まれるため高めのオーバーレイで隠す */}
              <Sequence from={CONT_56_START} durationInFrames={CONT_56_TOTAL} layout="none">
                <DemoVideoFrameMulti videos={CONT_56} delay={0} hideUrl hideUrlHeight={75} playbackRate={PLAYBACK_RATE} />
              </Sequence>

              {/* 7.mov */}
              <Sequence from={CONT_7_START} durationInFrames={CONT_7.durationInFrames} layout="none">
                <DemoVideoFrame videoSrc={CONT_7.src} delay={0} hideUrl playbackRate={PLAYBACK_RATE} />
              </Sequence>
            </>
          ) : (
            <DemoVideoPlaceholder label="Phase 2 Demo" delay={10} />
          )}
        </div>
      </div>
    </SlideLayout>
  );
};
