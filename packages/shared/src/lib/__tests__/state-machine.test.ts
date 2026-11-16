import { describe, expect, it } from "vitest";

import { defineStateMachine, StateMachineDefinitionError, type StateMachineDefinition } from "../state-machine";

type DoorState = "OPEN" | "CLOSED" | "LOCKED" | "GONE";
type DoorEvent = "close" | "open" | "lock" | "unlock" | "remove";

const DOOR_STATES: readonly DoorState[] = ["OPEN", "CLOSED", "LOCKED", "GONE"];

const DOOR: StateMachineDefinition<DoorState, DoorEvent> = {
	name: "Door",
	states: DOOR_STATES,
	initial: ["CLOSED"],
	terminal: ["GONE"],
	transitions: {
		open: { from: ["CLOSED"], to: "OPEN" },
		close: { from: ["OPEN"], to: "CLOSED" },
		lock: { from: ["CLOSED"], to: "LOCKED" },
		unlock: { from: ["LOCKED"], to: "CLOSED" },
		remove: { from: ["OPEN", "CLOSED"], to: "GONE" },
	},
};

/** The problems a broken definition is refused with. */
function problemsOf(definition: StateMachineDefinition<DoorState, DoorEvent>): readonly string[] {
	try {
		defineStateMachine(definition);
	} catch (error) {
		if (error instanceof StateMachineDefinitionError) {
			return error.problems;
		}
		throw error;
	}
	return [];
}

describe("defineStateMachine", () => {
	const door = defineStateMachine(DOOR);

	it("answers whether a move may start from a state", () => {
		expect(door.can("open", "CLOSED")).toBe(true);
		expect(door.can("open", "LOCKED")).toBe(false);
		expect(door.can("remove", "OPEN")).toBe(true);
		expect(door.can("remove", "GONE")).toBe(false);
	});

	it("names where a move lands and where it may start", () => {
		expect(door.targetOf("lock")).toBe("LOCKED");
		expect(door.sourcesOf("remove")).toEqual(["OPEN", "CLOSED"]);
	});

	it("lists the moves out of a state in declaration order — what a UI offers", () => {
		expect(door.eventsFrom("CLOSED")).toEqual(["open", "lock", "remove"]);
		expect(door.eventsFrom("GONE")).toEqual([]);
	});

	it("knows its terminal states, its states and its name", () => {
		expect(door.isTerminal("GONE")).toBe(true);
		expect(door.isTerminal("OPEN")).toBe(false);
		expect(door.states).toEqual(DOOR_STATES);
		expect(door.name).toBe("Door");
	});

	it("flattens a move from several states into one edge each", () => {
		expect(door.edges.filter((edge) => edge.event === "remove")).toEqual([
			{ event: "remove", from: "OPEN", to: "GONE" },
			{ event: "remove", from: "CLOSED", to: "GONE" },
		]);
		expect(door.edges).toHaveLength(6);
	});

	it("draws itself as a Mermaid state diagram", () => {
		expect(door.toMermaid()).toBe(
			[
				"stateDiagram-v2",
				"    [*] --> CLOSED",
				"    CLOSED --> OPEN: open",
				"    OPEN --> CLOSED: close",
				"    CLOSED --> LOCKED: lock",
				"    LOCKED --> CLOSED: unlock",
				"    OPEN --> GONE: remove",
				"    CLOSED --> GONE: remove",
				"    GONE --> [*]",
			].join("\n"),
		);
	});

	it("marks states entered outside the table with a dashed outline", () => {
		const seeded = defineStateMachine({ ...DOOR, enteredOutsideMachine: { LOCKED: "seed data only" } });
		expect(seeded.toMermaid()).toContain("    classDef enteredOutsideMachine stroke-dasharray: 4 4\n    class LOCKED enteredOutsideMachine");
	});

	it("refuses a state nothing enters unless it is declared as entered outside the table", () => {
		const orphan: StateMachineDefinition<DoorState, DoorEvent> = { ...DOOR, transitions: { ...DOOR.transitions, lock: { from: ["CLOSED"], to: "CLOSED" } } };
		expect(problemsOf(orphan)).toContain('"LOCKED" is never entered — add the move that enters it, or list it in enteredOutsideMachine with why');
		expect(problemsOf({ ...orphan, enteredOutsideMachine: { LOCKED: "seed data only" } })).toEqual([]);
	});

	it("refuses a dead end that is not declared terminal, and a terminal state with a way out", () => {
		expect(problemsOf({ ...DOOR, terminal: [] })).toEqual(['"GONE" has no way out — add a move from it, or list it as terminal']);
		expect(problemsOf({ ...DOOR, terminal: ["GONE", "OPEN"] })).toEqual(['"OPEN" is listed as terminal but a move leaves it']);
	});

	it("refuses unknown states, duplicate states, a move from nowhere and a machine without a start", () => {
		const states: readonly DoorState[] = ["OPEN", "CLOSED", "LOCKED"];
		expect(problemsOf({ ...DOOR, states })).toEqual(['terminal names unknown state "GONE"', 'move "remove" names unknown state "GONE"']);
		expect(problemsOf({ ...DOOR, states: [...DOOR_STATES, "OPEN"] })).toEqual(["a state is listed more than once"]);
		expect(problemsOf({ ...DOOR, enteredOutsideMachine: { GONE: "x" }, states })).toContain('enteredOutsideMachine names unknown state "GONE"');
		expect(problemsOf({ ...DOOR, transitions: { ...DOOR.transitions, unlock: { from: [], to: "CLOSED" } } })).toEqual([
			'move "unlock" starts from no state',
			'"LOCKED" has no way out — add a move from it, or list it as terminal',
		]);
		expect(problemsOf({ ...DOOR, initial: [] })).toEqual(["no initial state"]);
	});

	it("names the machine and every problem in the error message", () => {
		expect(() => defineStateMachine({ ...DOOR, initial: [] })).toThrow("State machine Door is not well formed: no initial state");
	});
});
