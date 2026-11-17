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
const OPERATING_SYSTEM_COMMAND = "\u001B]";
const BELL = "\u0007";
/**
 * Mouse reports (1000) in SGR form (1006), so the wheel scrolls the panel: the alternate screen has no scrollback of its
 * own. Clicks are reported too and ignored; most terminals still select text with Option (macOS) or Shift held.
 */
const MOUSE_ON = `${ESCAPE}?1000h${ESCAPE}?1006h`;
const MOUSE_OFF = `${ESCAPE}?1006l${ESCAPE}?1000l`;
/** xterm's title stack: the person's own tab title is saved on the way in and put back on the way out. */
const SAVE_TITLE = `${ESCAPE}22;0t`;
const RESTORE_TITLE = `${ESCAPE}23;0t`;
const ENTER = `${SAVE_TITLE}${ESCAPE}?1049h${ESCAPE}?25l${ESCAPE}?7l${MOUSE_ON}`;
const LEAVE = `${MOUSE_OFF}${ESCAPE}?7h${ESCAPE}?25h${ESCAPE}?1049l${RESTORE_TITLE}`;
/** Control characters would end the title early or reach the terminal as commands. */
const CONTROL_CHARACTERS = /\p{Cc}/gu;

/**
 * Rings the terminal's bell, which a terminal in the background turns into a badge or a bounce: a run that took minutes
 * has usually lost the person's attention by the time it ends.
 */
export const TERMINAL_BELL = BELL;
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

	/** The tab or window title, so the progress shows while the person is in another tab. */
	public title(text: string): void {
		this._stream.write(`${OPERATING_SYSTEM_COMMAND}0;${text.replace(CONTROL_CHARACTERS, "")}${BELL}`);
	}

	/** Safe to call twice: the exit guard calls it too. */
	public close(): void {
		if (this._open) {
			this._open = false;
			this._stream.write(LEAVE);
		}
	}
}
