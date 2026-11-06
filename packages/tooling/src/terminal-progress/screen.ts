// The whole terminal, for as long as the dashboard runs. The alternate screen leaves the person's scrollback alone,
// and a frame can use every row without pushing the last one off the top.

/** The slice of a TTY stream the display uses. */
export interface ProgressStream {
	readonly isTTY?: boolean;
	readonly columns?: number;
	readonly rows?: number;
	hasColors?(): boolean;
	write(text: string): boolean;
}

const ESCAPE = "\u001B[";
const ENTER = `${ESCAPE}?1049h${ESCAPE}?25l${ESCAPE}?7l`;
const LEAVE = `${ESCAPE}?7h${ESCAPE}?25h${ESCAPE}?1049l`;
const HOME = `${ESCAPE}H`;
const CLEAR_LINE_END = `${ESCAPE}K`;
const CLEAR_BELOW = `${ESCAPE}0J`;
/** Terminals that know it paint a frame at once; the others ignore it. */
const BEGIN_FRAME = `${ESCAPE}?2026h`;
const END_FRAME = `${ESCAPE}?2026l`;

export class Screen {
	private readonly _stream: ProgressStream;
	private _open = false;

	public constructor(stream: ProgressStream) {
		this._stream = stream;
	}

	public open(): void {
		this._open = true;
		this._stream.write(ENTER);
	}

	/** Replaces the last frame in one write, so the terminal never shows half of one. */
	public draw(lines: readonly string[]): void {
		const body = lines.map((line) => `${line}${CLEAR_LINE_END}`).join("\r\n");
		this._stream.write(`${BEGIN_FRAME}${HOME}${body}${CLEAR_BELOW}${END_FRAME}`);
	}

	/** Safe to call twice: the exit guard calls it too. */
	public close(): void {
		if (this._open) {
			this._open = false;
			this._stream.write(LEAVE);
		}
	}
}
