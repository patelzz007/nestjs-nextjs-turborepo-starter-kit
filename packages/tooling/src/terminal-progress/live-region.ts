// The part of the terminal the display owns: each frame replaces the one before it, and the lines above stay put.

/** The slice of a TTY stream the display uses. */
export interface ProgressStream {
	readonly isTTY?: boolean;
	readonly columns?: number;
	readonly rows?: number;
	hasColors?(): boolean;
	write(text: string): boolean;
}

const ESCAPE = "\u001B[";
const HIDE_CURSOR = `${ESCAPE}?25l`;
const SHOW_CURSOR = `${ESCAPE}?25h`;
const CLEAR_BELOW = `${ESCAPE}0J`;

export class LiveRegion {
	private readonly _stream: ProgressStream;
	private _height = 0;

	public constructor(stream: ProgressStream) {
		this._stream = stream;
	}

	public open(): void {
		this._stream.write(HIDE_CURSOR);
	}

	/** Replaces the last frame in one write, so the terminal never shows half of one. */
	public draw(lines: readonly string[]): void {
		const moveUp = this._height === 0 ? "" : `${ESCAPE}${String(this._height)}F`;
		this._stream.write(`${moveUp}${CLEAR_BELOW}${lines.join("\n")}\n`);
		this._height = lines.length;
	}

	public close(): void {
		this._stream.write(SHOW_CURSOR);
		this._height = 0;
	}
}
