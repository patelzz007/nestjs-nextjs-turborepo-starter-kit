// Splits a chat turn's text into paragraphs for the Message Scroller examples.

export interface TurnParagraph {
	/**
	 * The paragraph's place in its turn. A turn's text only ever grows at the
	 * end (a streamed reply appends), so a paragraph keeps its place, and with
	 * it its identity, for as long as the turn is on screen.
	 */
	readonly id: string;
	readonly text: string;
}

const PARAGRAPH_SEPARATOR = "\n\n";

export function turnParagraphs(text: string): readonly TurnParagraph[] {
	return text.split(PARAGRAPH_SEPARATOR).map((paragraph: string, position: number): TurnParagraph => ({ id: `paragraph-${String(position + 1)}`, text: paragraph }));
}
