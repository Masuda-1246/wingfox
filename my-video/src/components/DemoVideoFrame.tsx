import {
  Img,
  OffthreadVideo,
  Sequence,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS } from "../theme";

const DemoChrome: React.FC<{
  delay?: number;
  hideUrl?: boolean;
  hideUrlHeight?: number;
  children: React.ReactNode;
}> = ({ delay = 0, hideUrl = false, hideUrlHeight = 36, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.95, 1]);

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        borderRadius: 16,
        overflow: "hidden",
        border: `2px solid ${COLORS.border}`,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
        backgroundColor: COLORS.muted,
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          height: 36,
          backgroundColor: COLORS.muted,
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: "#FF5F57",
          }}
        />
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: "#FFBD2E",
          }}
        />
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: "#28C840",
          }}
        />
        {!hideUrl && (
          <div
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 12,
              color: COLORS.mutedForeground,
            }}
          >
            localhost:3000
          </div>
        )}
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {hideUrl && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: hideUrlHeight,
              backgroundColor: COLORS.muted,
              zIndex: 10,
            }}
          />
        )}
        {children}
      </div>
    </div>
  );
};

export const DemoVideoFrame: React.FC<{
  videoSrc: string;
  delay?: number;
  hideUrl?: boolean;
  hideUrlHeight?: number;
  playbackRate?: number;
}> = ({ videoSrc, delay = 0, hideUrl = false, hideUrlHeight = 36, playbackRate = 1 }) => (
  <DemoChrome delay={delay} hideUrl={hideUrl} hideUrlHeight={hideUrlHeight}>
    <OffthreadVideo
      src={staticFile(videoSrc)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
      playbackRate={playbackRate}
    />
  </DemoChrome>
);

// 複数動画をブラウザフレームを維持しながら連続再生するコンポーネント
export const DemoVideoFrameMulti: React.FC<{
  videos: { src: string; durationInFrames: number }[];
  delay?: number;
  hideUrl?: boolean;
  hideUrlHeight?: number;
  playbackRate?: number;
}> = ({ videos, delay = 0, hideUrl = false, hideUrlHeight = 36, playbackRate = 1 }) => {
  let offset = 0;
  return (
    <DemoChrome delay={delay} hideUrl={hideUrl} hideUrlHeight={hideUrlHeight}>
      {videos.map((video, i) => {
        const from = offset;
        offset += video.durationInFrames;
        return (
          <Sequence
            key={i}
            from={from}
            durationInFrames={video.durationInFrames}
            layout="none"
          >
            <OffthreadVideo
              src={staticFile(video.src)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              playbackRate={playbackRate}
            />
          </Sequence>
        );
      })}
    </DemoChrome>
  );
};

export const DemoVideoPlaceholder: React.FC<{
  label: string;
  delay?: number;
}> = ({ label, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div
      style={{
        opacity,
        borderRadius: 16,
        overflow: "hidden",
        border: `2px dashed ${COLORS.border}`,
        backgroundColor: COLORS.muted,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        gap: 16,
      }}
    >
      <Img
        src={staticFile("icon.png")}
        style={{ width: 80, height: 80, borderRadius: 16, opacity: 0.5 }}
      />
      <div
        style={{
          fontSize: 20,
          color: COLORS.mutedForeground,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
};
