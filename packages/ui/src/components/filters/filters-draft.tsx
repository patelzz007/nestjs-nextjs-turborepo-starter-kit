import type { FilterDraft, FilterDraftStep, FilterOperatorArity, FilterValue } from "./filters-types";

/**
 * The filter builder's step machine. Pure: no React or DOM import, so the whole
 * create and amend flow is a table test. Arity arrives ON THE ACTION, which
 * keeps the reducer free of the schema index while it still owns the branch
 * that skips the value step. The shipped chrome drives `openCreate`, browse,
 * query, `selectField` and `close`; the rest is published surface for a
 * consumer composing their own panel.
 */
export type FilterDraftAction =
	| { readonly type: "openCreate"; readonly cascaderPath?: readonly string[] | undefined }
	| {
			readonly type: "openAmend";
			readonly ruleId: string;
			readonly step: FilterDraftStep;
			readonly path: readonly string[];
			readonly operator: string | null;
			readonly value: FilterValue | undefined;
			readonly cascaderPath?: readonly string[] | undefined;
	  }
	| { readonly type: "close" }
	/** Where the user is BROWSING, not the selected field's path. */
	| { readonly type: "setCascaderPath"; readonly path: readonly string[] }
	| { readonly type: "setQuery"; readonly query: string }
	| { readonly type: "selectField"; readonly path: readonly string[]; readonly defaultOperator: string | null }
	| {
			readonly type: "selectOperator";
			readonly operator: string;
			readonly arity: FilterOperatorArity;
			/** Carried across the operator change, already coerced. */
			readonly value: FilterValue | undefined;
	  }
	| { readonly type: "setValue"; readonly value: FilterValue | undefined }
	| { readonly type: "commit"; readonly value?: FilterValue | undefined }
	| { readonly type: "back" }
	| { readonly type: "goto"; readonly step: FilterDraftStep };

export function createFilterDraft(cascaderPath: readonly string[] = []): FilterDraft {
	return { step: "field", status: "editing", ruleId: null, path: [], cascaderPath, operator: null, value: undefined, query: "" };
}

/** null means Back closes the builder rather than stepping back. */
function previousStep(step: FilterDraftStep): FilterDraftStep | null {
	if (step === "value") {
		return "operator";
	}
	if (step === "operator") {
		return "field";
	}
	return null;
}

function assertNeverFilterDraftAction(value: never): never {
	throw new Error(`Unhandled filter draft action: ${JSON.stringify(value)}`);
}

/** The actions that only make sense on an open draft. */
function reduceOpenDraft(state: FilterDraft, action: Exclude<FilterDraftAction, { readonly type: "openCreate" | "openAmend" | "close" }>): FilterDraft | null {
	switch (action.type) {
		case "setCascaderPath":
			return state.cascaderPath === action.path ? state : { ...state, cascaderPath: action.path };
		case "setQuery":
			return state.query === action.query ? state : { ...state, query: action.query };
		case "selectField":
			// Choosing a field COMMITS at once; the condition is picked on the chip.
			// A field change invalidates the value: "Active" means nothing once the
			// field becomes "Created at".
			return { ...state, path: action.path, operator: action.defaultOperator, status: "ready", value: undefined, step: "operator", query: "" };
		case "selectOperator":
			// arity "none" is the whole filter; a value step would be an empty panel.
			if (action.arity === "none") {
				return { ...state, operator: action.operator, value: undefined, status: "ready", query: "" };
			}
			return { ...state, operator: action.operator, value: action.value, step: "value", status: "editing", query: "" };
		case "setValue":
			return { ...state, value: action.value };
		case "commit":
			return { ...state, value: action.value ?? state.value, status: "ready" };
		case "back": {
			const step = previousStep(state.step);
			return step === null ? null : { ...state, step, status: "editing", query: "" };
		}
		case "goto":
			return state.step === action.step ? state : { ...state, step: action.step, status: "editing", query: "" };
		default:
			return assertNeverFilterDraftAction(action);
	}
}

/**
 * `null` is the closed state, not a separate boolean: `{ open, draft }` would
 * make "open with no draft" and "closed but still holding one" representable.
 */
export function filterDraftReducer(state: FilterDraft | null, action: FilterDraftAction): FilterDraft | null {
	switch (action.type) {
		case "openCreate":
			return createFilterDraft(action.cascaderPath ?? []);
		case "openAmend":
			return {
				step: action.step,
				status: "editing",
				ruleId: action.ruleId,
				path: action.path,
				// Defaults the picker to the field's own level, so amend opens beside
				// its siblings, not at the root.
				cascaderPath: action.cascaderPath ?? action.path.slice(0, -1),
				operator: action.operator,
				value: action.value,
				query: "",
			};
		case "close":
			return null;
		default:
			return state === null ? null : reduceOpenDraft(state, action);
	}
}

/**
 * A path is enough. Not an operator: the flow commits when the field is picked,
 * so `operator: ""` is a legitimate committed state.
 */
export function isFilterDraftCommittable(draft: FilterDraft | null): draft is FilterDraft {
	return draft !== null && draft.path.length > 0;
}
