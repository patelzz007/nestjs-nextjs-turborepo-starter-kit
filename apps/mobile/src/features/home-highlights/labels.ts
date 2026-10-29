// Copy of the Home screen's "Discover" carousel (features/home-highlights).

export const HOME_HIGHLIGHTS_COPY = {
	title: "Discover",
	description: "A few things to try first.",
} satisfies Record<string, string>;

/** Names a card's dot for screen readers: "Highlight 2 of 4". */
export function homeHighlightSlideLabel(position: number, total: number): string {
	return `Highlight ${String(position)} of ${String(total)}`;
}
