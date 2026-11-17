import { fireEvent, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";

import { fakeDeviceBoundaries, renderShowcaseExample, runOut } from "../../../../test/showcase-example";
import { SHOWCASE_FEATURE_INDEX } from "../generated/feature-index";
import { SHOWCASE_FEATURE_SETS } from "../generated/feature-sets";
import type { ShowcaseComponentModule } from "../showcase-feature";

/** Long enough for the longest sample run (a plan applied, agents working, files encoding) to finish. */
const RUN_MS = 12_000;
/** One example's runs, each control used twice, on the fake clock. */
const EXAMPLE_TIMEOUT_MS = 30_000;

const ANCHORS: readonly string[] = (SHOWCASE_FEATURE_INDEX.get("trace") ?? []).map((feature) => feature.anchor);
/** Every control the reader can use, as the example stands now. */
function controls(): TestInstance[] {
	return [...screen.queryAllByRole("button"), ...screen.queryAllByRole("radio"), ...screen.queryAllByRole("link")];
}

/**
 * Uses each control in turn, first to last, then last to first (so a pair such as Deny / Apply is tried both ways),
 * letting each run play out; the list is read afresh before every press, since a press changes what is there.
 */
async function useEveryControl(): Promise<void> {
	const count = controls().length;
	for (let step = 0; step < count * 2; step += 1) {
		const fresh = controls();
		const target = step < count ? fresh.at(step) : fresh.at(fresh.length - 1 - (step - count));
		if (target !== undefined) {
			await fireEvent.press(target);
			await playOut();
		}
	}
}

/** Lets a sample run play out to its end, timer by timer (the runs that tick every 24–160 ms included). */
async function playOut(): Promise<void> {
	await runOut(RUN_MS);
}

function loadTrace(): Promise<ShowcaseComponentModule> {
	const load = SHOWCASE_FEATURE_SETS.get("trace");
	if (load === undefined) {
		throw new Error("The showcase has no trace examples");
	}
	return load();
}

/**
 * How long loading the trace examples may take. On a cold Jest cache (or with coverage instrumenting them) this load
 * is where Babel compiles every example; it runs up front so the first test's budget is spent playing, not compiling.
 */
const COLD_COMPILE_TIMEOUT_MS = 180_000;

beforeAll(async (): Promise<void> => {
	await loadTrace();
}, COLD_COMPILE_TIMEOUT_MS);

beforeEach((): void => {
	jest.useFakeTimers();
	fakeDeviceBoundaries();
});

afterEach((): void => {
	jest.useRealTimers();
});

describe("the trace examples, played out", () => {
	it.each(ANCHORS)(
		"%s runs to its end, opens every step, and runs again from there",
		async (anchor) => {
			const { features } = await loadTrace();
			const feature = features.find((candidate) => candidate.anchor === anchor);
			if (feature === undefined) {
				throw new Error(`No trace example "${anchor}"`);
			}
			await renderShowcaseExample(feature.render(), `trace-${anchor}`);
			await playOut();
			await useEveryControl();
			expect(screen.getByTestId(`trace-${anchor}`)).toBeOnTheScreen();
		},
		EXAMPLE_TIMEOUT_MS,
	);
});
