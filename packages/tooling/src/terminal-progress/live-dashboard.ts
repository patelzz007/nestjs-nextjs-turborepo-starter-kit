// The running dashboard: draws a frame on a timer and turns keys into what's on screen. It only ever looks at the
// checks; stopping them is the caller's, through `onCancel`.
import { applyKey, INITIAL_DASHBOARD, type DashboardState } from "./dashboard.ts";
import type { Keyboard, KeyboardOpener, KeyName } from "./keyboard.ts";
import { buildPanel, type Panel, type PanelContext, type PanelData } from "./panels.ts";
import { panelHeight, panelWidth, renderFrame, spinnerAt, windowTitle } from "./render.ts";
import type { RunHistory } from "./run-history.ts";
import { estimateRun } from "./run-history.ts";
import { Screen, type ProgressStream } from "./screen.ts";
import { sampleThroughput, startThroughput, type Throughput } from "./throughput.ts";
import type { Tint } from "./text.ts";

export interface LiveDashboardOptions {
	readonly title: string;
	readonly action: string;
	readonly stream: ProgressStream;
	readonly tint: Tint;
	readonly history: RunHistory | undefined;
	readonly startedAtMs: number;
	readonly data: () => PanelData;
	readonly isStopping: () => boolean;
	readonly onCancel: () => void;
	readonly openKeys: KeyboardOpener;
}

const FRAME_INTERVAL_MS = 100;
const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 24;
/** Past this a wide terminal only adds empty space between the columns. */
const MAX_WIDTH = 140;
export class LiveDashboard {
	private readonly _options: LiveDashboardOptions;
	private readonly _screen: Screen;
	private _state: DashboardState = INITIAL_DASHBOARD;
	private _keyboard: Keyboard | undefined;
	private _timer: NodeJS.Timeout | undefined;
	private _frame = 0;
	private _throughput: Throughput;
	/** Only a changed title is written: a title on every frame is wasted output. */
	private _title = "";

	public constructor(options: LiveDashboardOptions) {
		this._options = options;
		this._screen = new Screen(options.stream);
		this._throughput = startThroughput(options.startedAtMs);
	}

	/** A crash must not leave the person's terminal blank, cursorless and ignoring what they type. */
	private readonly restoreTerminal = (): void => {
		this._keyboard?.close();
		this._keyboard = undefined;
		this._screen.close();
	};

	public start(): void {
		process.once("exit", this.restoreTerminal);
		this._screen.open();
		this._keyboard = this._options.openKeys((key) => {
			this.onKey(key);
		});
		this.draw();
		this._timer = setInterval(() => {
			this.draw();
		}, FRAME_INTERVAL_MS);
	}

	public stop(): void {
		clearInterval(this._timer);
		this.restoreTerminal();
		process.off("exit", this.restoreTerminal);
	}

	private width(): number {
		return Math.min(this._options.stream.columns ?? DEFAULT_WIDTH, MAX_WIDTH);
	}

	private height(): number {
		return this._options.stream.rows ?? DEFAULT_HEIGHT;
	}

	private panel(data: PanelData, nowMs: number): Panel {
		const context: PanelContext = { width: panelWidth(this.width()), tint: this._options.tint, nowMs, spinner: spinnerAt(this._frame) };
		return buildPanel(this._state, data, context);
	}

	private onKey(key: KeyName): void {
		const data = this._options.data();
		const panel = this.panel(data, Date.now());
		const result = applyKey(this._state, key, {
			length: panel.length,
			tail: panel.tail,
			height: panelHeight(this.height(), data.checks.length),
			packageAt: (row) => panel.packageAt(row),
		});
		this._state = result.state;
		if (result.cancel) {
			this._options.onCancel();
		}
		this.draw();
	}

	private retitle(text: string): void {
		if (text !== this._title) {
			this._title = text;
			this._screen.title(text);
		}
	}

	private draw(): void {
		const { title, action, tint, history, startedAtMs, isStopping } = this._options;
		const nowMs = Date.now();
		const data = this._options.data();
		const estimate = estimateRun(data.checks, history, nowMs);
		this._frame += 1;
		this._throughput = sampleThroughput(
			this._throughput,
			data.checks.reduce((sum, check) => sum + check.testFiles, 0),
			nowMs,
		);
		this.retitle(windowTitle(title, data.checks, estimate));
		this._screen.draw(
			renderFrame({
				title,
				action,
				headline: data.changes.headline,
				checks: data.checks,
				panel: this.panel(data, nowMs),
				estimate,
				throughput: this._throughput.perSecond,
				frame: this._frame,
				elapsedMs: nowMs - startedAtMs,
				nowMs,
				width: this.width(),
				height: this.height(),
				tint,
				state: this._state,
				keysEnabled: this._keyboard !== undefined,
				stopping: isStopping(),
			}),
		);
	}
}
