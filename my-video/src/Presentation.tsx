import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { TitleSlide } from "./slides/TitleSlide";
import { ProblemSlide } from "./slides/ProblemSlide";
import { WhatWeDoSlide } from "./slides/WhatWeDoSlide";
import { Phase1Slide } from "./slides/Phase1Slide";
import { Phase2Slide } from "./slides/Phase2Slide";
import { HowWeSolveSlide } from "./slides/HowWeSolveSlide";
import { SummarySlide } from "./slides/SummarySlide";
import { SLIDE_DURATION } from "./theme";

const TRANSITION_TIMING = linearTiming({
  durationInFrames: SLIDE_DURATION.transition,
});
const FADE = fade();

export const Presentation: React.FC<{
  hasPhase1Video?: boolean;
  hasPhase2Video?: boolean;
}> = ({ hasPhase1Video = false, hasPhase2Video = false }) => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SLIDE_DURATION.title}>
        <TitleSlide />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={FADE}
        timing={TRANSITION_TIMING}
      />

      <TransitionSeries.Sequence durationInFrames={SLIDE_DURATION.problem}>
        <ProblemSlide />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={FADE}
        timing={TRANSITION_TIMING}
      />

      <TransitionSeries.Sequence durationInFrames={SLIDE_DURATION.whatWeDo}>
        <WhatWeDoSlide />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={FADE}
        timing={TRANSITION_TIMING}
      />

      <TransitionSeries.Sequence durationInFrames={SLIDE_DURATION.phase1}>
        <Phase1Slide hasVideo={hasPhase1Video} />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={FADE}
        timing={TRANSITION_TIMING}
      />

      <TransitionSeries.Sequence durationInFrames={SLIDE_DURATION.phase2}>
        <Phase2Slide hasVideo={hasPhase2Video} />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={FADE}
        timing={TRANSITION_TIMING}
      />

      <TransitionSeries.Sequence durationInFrames={SLIDE_DURATION.howWeSolve}>
        <HowWeSolveSlide />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={FADE}
        timing={TRANSITION_TIMING}
      />

      <TransitionSeries.Sequence durationInFrames={SLIDE_DURATION.summary}>
        <SummarySlide />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
