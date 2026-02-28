export function FoxAvatar({
	className,
}: {
	seed?: string;
	variant?: number;
	className?: string;
}) {
	return (
		<img
			src="/logo.png"
			alt=""
			className={className}
		/>
	);
}

export const FOX_VARIANT_COUNT = 1;
