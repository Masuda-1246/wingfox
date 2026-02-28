export function FoxAvatar({
	className,
	iconUrl,
}: {
	seed?: string;
	variant?: number;
	className?: string;
	iconUrl?: string | null;
}) {
	return <img src={iconUrl ?? "/logo.png"} alt="" className={className} />;
}

export const FOX_VARIANT_COUNT = 1;
