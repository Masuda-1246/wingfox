import "./index.css";
import { Composition } from "remotion";
import { Presentation } from "./Presentation";
import { SLIDE_DURATION } from "./theme";

const TOTAL_FRAMES =
  SLIDE_DURATION.title +
  SLIDE_DURATION.problem +
  SLIDE_DURATION.whatWeDo +
  SLIDE_DURATION.phase1 +
  SLIDE_DURATION.phase2 +
  SLIDE_DURATION.howWeSolve +
  SLIDE_DURATION.summary -
  6 * SLIDE_DURATION.transition;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WingFoxPresentation"
        component={Presentation}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          hasPhase1Video: false,
          hasPhase2Video: false,
        }}
      />
      <Composition
        id="WingFoxWithDemo"
        component={Presentation}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          hasPhase1Video: true,
          hasPhase2Video: true,
        }}
      />
    </>
  );
};
