/**
 * Explicit state machines (docs/architecture/state-machines.md).
 *
 * A record with a `status`/`state` column is a state machine whether or not the code says so. Left
 * implicit, its graph is scattered across `if (status !== "X")` guards, `*_STATES` arrays and UI
 * button logic that each re-derive "what may happen next" — and drift apart. A machine declared
 * with {@link defineStateMachine} is the ONE table of named moves: the server enforces it, a UI asks
 * it which actions to offer, and the docs draw it.
 *
 * The definition is checked when it is built, so a new status forces a decision: a state nothing
 * enters, or one with no way out that is not declared terminal, fails at module load and in tests.
 */

/** One named move: the states it may start from and the state it lands in. */
export interface StateTransition<TState extends string> {
	readonly from: readonly TState[];
	readonly to: TState;
}

/** The source of a {@link StateMachine}: every state, every named move, and the deliberate exceptions. */
export interface StateMachineDefinition<TState extends string, TEvent extends string> {
	/** A PascalCase name for errors and diagrams (`TenantLifecycle`). */
	readonly name: string;
	/** Every state the column can hold — pass the zod enum's `.options` so the two never drift. */
	readonly states: readonly TState[];
	/** States a new record is created in. */
	readonly initial: readonly NoInfer<TState>[];
	/** States with no way out. Every state without an outgoing move must be listed here, and only those. */
	readonly terminal: readonly NoInfer<TState>[];
	/** The named moves (`suspend`, `approve`, …), named after the command that makes them. */
	readonly transitions: Readonly<Record<TEvent, StateTransition<NoInfer<TState>>>>;
	/**
	 * States no move in this table enters, and why (seed data only, a planned command, an operator).
	 * Every non-initial state must be entered by a move or be listed here, so an orphan is a decision.
	 */
	readonly enteredOutsideMachine?: Readonly<Partial<Record<NoInfer<TState>, string>>>;
}

/** One edge of the graph: the move's name, where it starts and where it lands. */
export interface StateMachineEdge<TState extends string, TEvent extends string> {
	readonly event: TEvent;
	readonly from: TState;
	readonly to: TState;
}

/** A definition that breaks the rules above (thrown when the module declaring it loads). */
export class StateMachineDefinitionError extends Error {
	public constructor(
		public readonly machine: string,
		public readonly problems: readonly string[],
	) {
		super(`State machine ${machine} is not well formed: ${problems.join("; ")}`);
		this.name = "StateMachineDefinitionError";
	}
}

/** The move names, typed (`Object.keys` widens to `string`; each key is matched back to the record). */
function eventsOf<TState extends string, TEvent extends string>(definition: StateMachineDefinition<TState, TEvent>): TEvent[] {
	return Object.keys(definition.transitions).filter((key: string): key is TEvent => Object.hasOwn(definition.transitions, key));
}

function edgesOf<TState extends string, TEvent extends string>(definition: StateMachineDefinition<TState, TEvent>): StateMachineEdge<TState, TEvent>[] {
	return eventsOf(definition).flatMap((event) => {
		const { from, to } = definition.transitions[event];
		return from.map((start) => ({ event, from: start, to }));
	});
}

/** What is wrong with a definition; empty when it is well formed. */
function definitionProblems<TState extends string, TEvent extends string>(
	definition: StateMachineDefinition<TState, TEvent>,
	edges: readonly StateMachineEdge<TState, TEvent>[],
): string[] {
	const known = new Set<string>(definition.states);
	const external = Object.keys(definition.enteredOutsideMachine ?? {});
	const problems: string[] = [];
	const checkKnown = (where: string, states: readonly string[]): void => {
		states.filter((state) => !known.has(state)).forEach((state) => problems.push(`${where} names unknown state "${state}"`));
	};
	if (known.size !== definition.states.length) {
		problems.push("a state is listed more than once");
	}
	if (definition.initial.length === 0) {
		problems.push("no initial state");
	}
	checkKnown("initial", definition.initial);
	checkKnown("terminal", definition.terminal);
	checkKnown("enteredOutsideMachine", external);
	for (const event of eventsOf(definition)) {
		const { from, to } = definition.transitions[event];
		checkKnown(`move "${event}"`, [...from, to]);
		if (from.length === 0) {
			problems.push(`move "${event}" starts from no state`);
		}
	}
	const leaves = new Set<string>(edges.map((edge) => edge.from));
	const entered = new Set<string>([...edges.map((edge) => edge.to), ...definition.initial, ...external]);
	const terminal = new Set<string>(definition.terminal);
	for (const state of definition.states) {
		if (!entered.has(state)) {
			problems.push(`"${state}" is never entered — add the move that enters it, or list it in enteredOutsideMachine with why`);
		}
		if (!leaves.has(state) && !terminal.has(state)) {
			problems.push(`"${state}" has no way out — add a move from it, or list it as terminal`);
		}
		if (leaves.has(state) && terminal.has(state)) {
			problems.push(`"${state}" is listed as terminal but a move leaves it`);
		}
	}
	return problems;
}

/**
 * A checked, queryable state machine. The server asks {@link can} before a move and {@link targetOf}
 * for where it lands; a UI asks {@link can} or {@link eventsFrom} which actions to offer.
 */
export class StateMachine<TState extends string, TEvent extends string> {
	private readonly _edges: readonly StateMachineEdge<TState, TEvent>[];

	public constructor(public readonly definition: StateMachineDefinition<TState, TEvent>) {
		this._edges = edgesOf(definition);
		const problems = definitionProblems(definition, this._edges);
		if (problems.length > 0) {
			throw new StateMachineDefinitionError(definition.name, problems);
		}
	}

	public get name(): string {
		return this.definition.name;
	}

	public get states(): readonly TState[] {
		return this.definition.states;
	}

	/** Every edge, in declaration order (a move from three states is three edges). */
	public get edges(): readonly StateMachineEdge<TState, TEvent>[] {
		return this._edges;
	}

	/** Whether `event` may start from `state`. */
	public can(event: TEvent, state: TState): boolean {
		return this.definition.transitions[event].from.includes(state);
	}

	/** The states `event` may start from — for a query that selects the rows a job may move (`status IN (…)`). */
	public sourcesOf(event: TEvent): readonly TState[] {
		return this.definition.transitions[event].from;
	}

	/** The state `event` lands in. */
	public targetOf(event: TEvent): TState {
		return this.definition.transitions[event].to;
	}

	/** The moves that may start from `state`, in declaration order. */
	public eventsFrom(state: TState): readonly TEvent[] {
		return this._edges.filter((edge) => edge.from === state).map((edge) => edge.event);
	}

	/** Whether `state` has no way out. */
	public isTerminal(state: TState): boolean {
		return this.definition.terminal.includes(state);
	}

	/** The graph as a Mermaid `stateDiagram-v2`, drawn from the table itself (the docs embed it verbatim). */
	public toMermaid(): string {
		const external = Object.keys(this.definition.enteredOutsideMachine ?? {});
		const lines: string[] = [
			"stateDiagram-v2",
			...this.definition.initial.map((state) => `    [*] --> ${state}`),
			...this._edges.map((edge) => `    ${edge.from} --> ${edge.to}: ${edge.event}`),
			...this.definition.terminal.map((state) => `    ${state} --> [*]`),
		];
		if (external.length > 0) {
			lines.push("    classDef enteredOutsideMachine stroke-dasharray: 4 4", `    class ${external.join(",")} enteredOutsideMachine`);
		}
		return lines.join("\n");
	}
}

/** Builds and checks a state machine; throws {@link StateMachineDefinitionError} when it is not well formed. */
export function defineStateMachine<TState extends string, TEvent extends string>(definition: StateMachineDefinition<TState, TEvent>): StateMachine<TState, TEvent> {
	return new StateMachine(definition);
}
