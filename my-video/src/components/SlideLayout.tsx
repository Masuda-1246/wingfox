import { AbsoluteFill } from "remotion";
import { COLORS, FONTS } from "../theme";

export const SlideLayout: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        fontFamily: FONTS.system,
        color: COLORS.foreground,
        padding: 80,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
      className={className}
    >
      {children}
    </AbsoluteFill>
  );
};
