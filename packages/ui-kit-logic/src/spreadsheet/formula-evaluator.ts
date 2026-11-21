// Working out spreadsheet formulas, shared by the web and native spreadsheets. A value is a tagged union, so nothing
// here inspects types at run time. A sheet evaluator works each formula cell out once (memoised) and catches a
// formula that depends on itself (`#CYCLE!`). Pure: the caller hands over a reader for the cells' contents.

import { isBooleanPrimitive, isNumberPrimitive, isStringPrimitive } from "@workspace/shared";

import { spreadsheetRangeCells, type SpreadsheetCellRef } from "./address";
import { isSpreadsheetFormula, parseSpreadsheetFormula, type FormulaBinaryOperator, type FormulaNode, type SpreadsheetFormulaError } from "./formula-parser";

export type SpreadsheetValue =
	| { readonly kind: "number"; readonly value: number }
	| { readonly kind: "string"; readonly value: string }
	| { readonly kind: "boolean"; readonly value: boolean }
	| { readonly kind: "error"; readonly error: SpreadsheetFormulaError }
	| { readonly kind: "empty" };

/** What a cell holds before it is worked out: a typed value, or text (a formula when it starts with `=`). */
export type SpreadsheetCellInput = number | string | boolean | null;

/** Reads what the cell at a reference holds; `null` for an empty cell or one off the sheet. */
export type SpreadsheetCellReader = (ref: SpreadsheetCellRef) => SpreadsheetCellInput;

const EMPTY: SpreadsheetValue = { kind: "empty" };
const NUMERIC_TEXT = /^\s*[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?\s*$/u;

function error(code: SpreadsheetFormulaError): SpreadsheetValue {
	return { kind: "error", error: code };
}

function numberValue(value: number): SpreadsheetValue {
	return Number.isFinite(value) ? { kind: "number", value } : error("#VALUE!");
}

/** A plain (non-formula) cell's value: numbers stay numbers, numeric text reads as a number, empty text is empty. */
export function spreadsheetLiteralValue(input: SpreadsheetCellInput): SpreadsheetValue {
	if (input === null || input === "") {
		return EMPTY;
	}
	if (isNumberPrimitive(input)) {
		return numberValue(input);
	}
	if (isBooleanPrimitive(input)) {
		return { kind: "boolean", value: input };
	}
	return NUMERIC_TEXT.test(input) ? numberValue(Number(input)) : { kind: "string", value: input };
}

// ── Coercion ───────────────────────────────────────────────────────────────

/** A value as a number: booleans count 1 / 0, empty counts 0, numeric text is read, other text is `#VALUE!`. */
function toNumber(value: SpreadsheetValue): SpreadsheetValue {
	switch (value.kind) {
		case "number":
		case "error":
			return value;
		case "boolean":
			return { kind: "number", value: value.value ? 1 : 0 };
		case "empty":
			return { kind: "number", value: 0 };
		case "string":
			return NUMERIC_TEXT.test(value.value) ? numberValue(Number(value.value)) : error("#VALUE!");
	}
}

/** A value as text, the way a cell shows it. */
export function formatSpreadsheetValue(value: SpreadsheetValue): string {
	switch (value.kind) {
		case "number":
			return String(value.value);
		case "string":
			return value.value;
		case "boolean":
			return value.value ? "TRUE" : "FALSE";
		case "error":
			return value.error;
		case "empty":
			return "";
	}
}

/** A value as a condition: zero, FALSE and empty are false; text is `#VALUE!` unless it reads as a number. */
function toBoolean(value: SpreadsheetValue): SpreadsheetValue {
	if (value.kind === "boolean" || value.kind === "error") {
		return value;
	}
	const number = toNumber(value);
	return number.kind === "number" ? { kind: "boolean", value: number.value !== 0 } : number;
}

// ── Operators ──────────────────────────────────────────────────────────────

/** Order across kinds when two values of different kinds are compared: numbers, then text, then booleans. */
const KIND_ORDER: Readonly<Record<"number" | "string" | "boolean", number>> = { number: 0, string: 1, boolean: 2 };

/** A step that either gives a result or fails with the value (an error) the formula then shows. */
type Outcome<TResult> = { readonly ok: true; readonly result: TResult } | { readonly ok: false; readonly failure: SpreadsheetValue };

function succeed<TResult>(result: TResult): Outcome<TResult> {
	return { ok: true, result };
}

function fail<TResult>(failure: SpreadsheetValue): Outcome<TResult> {
	return { ok: false, failure };
}

/** How two values order: negative, zero or positive. An error on either side fails the comparison. */
function compare(left: SpreadsheetValue, right: SpreadsheetValue): Outcome<number> {
	if (left.kind === "error") {
		return fail(left);
	}
	if (right.kind === "error") {
		return fail(right);
	}
	// An empty cell compares as the other side's empty value: 0, "" or FALSE.
	const a = left.kind === "empty" ? emptyLike(right) : left;
	const b = right.kind === "empty" ? emptyLike(left) : right;
	if (a.kind === "number" && b.kind === "number") {
		return succeed(Math.sign(a.value - b.value));
	}
	if (a.kind === "string" && b.kind === "string") {
		return succeed(a.value.localeCompare(b.value, undefined, { sensitivity: "base" }));
	}
	if (a.kind === "boolean" && b.kind === "boolean") {
		return succeed(Number(a.value) - Number(b.value));
	}
	return succeed(Math.sign(kindRank(a) - kindRank(b)));
}

function emptyLike(other: SpreadsheetValue): SpreadsheetValue {
	if (other.kind === "string") {
		return { kind: "string", value: "" };
	}
	return other.kind === "boolean" ? { kind: "boolean", value: false } : { kind: "number", value: 0 };
}

function kindRank(value: SpreadsheetValue): number {
	return value.kind === "number" || value.kind === "string" || value.kind === "boolean" ? KIND_ORDER[value.kind] : 0;
}

/** Whether an order (negative, zero, positive) meets a comparison operator. */
function meetsComparison(operator: "=" | "<>" | "<" | "<=" | ">" | ">=", order: number): boolean {
	switch (operator) {
		case "=":
			return order === 0;
		case "<>":
			return order !== 0;
		case "<":
			return order < 0;
		case "<=":
			return order <= 0;
		case ">":
			return order > 0;
		case ">=":
			return order >= 0;
	}
}

function applyArithmetic(operator: "+" | "-" | "*" | "/" | "^", a: number, b: number): SpreadsheetValue {
	switch (operator) {
		case "+":
			return numberValue(a + b);
		case "-":
			return numberValue(a - b);
		case "*":
			return numberValue(a * b);
		case "/":
			return b === 0 ? error("#DIV/0!") : numberValue(a / b);
		case "^":
			return numberValue(a ** b);
	}
}

function applyBinary(operator: FormulaBinaryOperator, left: SpreadsheetValue, right: SpreadsheetValue): SpreadsheetValue {
	if (operator === "&") {
		if (left.kind === "error") {
			return left;
		}
		return right.kind === "error" ? right : { kind: "string", value: formatSpreadsheetValue(left) + formatSpreadsheetValue(right) };
	}
	if (operator === "=" || operator === "<>" || operator === "<" || operator === "<=" || operator === ">" || operator === ">=") {
		const order = compare(left, right);
		return order.ok ? { kind: "boolean", value: meetsComparison(operator, order.result) } : order.failure;
	}
	const a = toNumber(left);
	const b = toNumber(right);
	if (a.kind !== "number") {
		return a;
	}
	return b.kind === "number" ? applyArithmetic(operator, a.value, b.value) : b;
}

// ── Functions ──────────────────────────────────────────────────────────────

/** A function's arguments as evaluated: a range becomes its cells, in order; any other argument is one value. */
interface FunctionArg {
	readonly values: readonly SpreadsheetValue[];
	readonly fromRange: boolean;
}

type SpreadsheetFunction = (args: readonly FunctionArg[]) => SpreadsheetValue;

/** The numbers an aggregate reads: from a range only real numbers count (text and empty are skipped); a direct argument is coerced. */
function collectNumbers(args: readonly FunctionArg[]): Outcome<number[]> {
	const numbers: number[] = [];
	for (const arg of args) {
		for (const value of arg.values) {
			if (value.kind === "error") {
				return fail(value);
			}
			if (arg.fromRange) {
				if (value.kind === "number") {
					numbers.push(value.value);
				}
				continue;
			}
			const number = toNumber(value);
			if (number.kind !== "number") {
				return fail(number);
			}
			numbers.push(number.value);
		}
	}
	return succeed(numbers);
}

function aggregate(combine: (numbers: number[]) => SpreadsheetValue): SpreadsheetFunction {
	return (args) => {
		const numbers = collectNumbers(args);
		return numbers.ok ? combine(numbers.result) : numbers.failure;
	};
}

function single(args: readonly FunctionArg[], position: number): SpreadsheetValue | null {
	const arg = args.at(position);
	if (arg === undefined) {
		return null;
	}
	const [value, ...rest] = arg.values;
	return rest.length > 0 || value === undefined ? error("#VALUE!") : value;
}

const DECIMAL_BASE = 10;
const FIRST_ARG = 0;
const SECOND_ARG = 1;
const THIRD_ARG = 2;

function logical(combine: (values: boolean[]) => boolean): SpreadsheetFunction {
	return (args) => {
		const flags: boolean[] = [];
		for (const arg of args) {
			for (const value of arg.values) {
				if (arg.fromRange && value.kind !== "boolean" && value.kind !== "number") {
					continue;
				}
				const flag = toBoolean(value);
				if (flag.kind !== "boolean") {
					return flag;
				}
				flags.push(flag.value);
			}
		}
		return flags.length === 0 ? error("#VALUE!") : { kind: "boolean", value: combine(flags) };
	};
}

/** The functions a formula may call, by upper-case name. */
export const SPREADSHEET_FUNCTIONS: Readonly<Record<string, SpreadsheetFunction>> = {
	SUM: aggregate((numbers) => numberValue(numbers.reduce((total, number) => total + number, 0))),
	AVERAGE: aggregate((numbers) => (numbers.length === 0 ? error("#DIV/0!") : numberValue(numbers.reduce((total, number) => total + number, 0) / numbers.length))),
	MIN: aggregate((numbers) => numberValue(numbers.length === 0 ? 0 : Math.min(...numbers))),
	MAX: aggregate((numbers) => numberValue(numbers.length === 0 ? 0 : Math.max(...numbers))),
	COUNT: (args) => ({ kind: "number", value: args.flatMap((arg) => arg.values).filter((value) => value.kind === "number").length }),
	ABS: (args) => {
		const value = single(args, FIRST_ARG);
		const number = value === null ? error("#VALUE!") : toNumber(value);
		return number.kind === "number" ? numberValue(Math.abs(number.value)) : number;
	},
	ROUND: (args) => {
		const value = single(args, FIRST_ARG);
		const digitsValue = single(args, SECOND_ARG);
		const number = value === null ? error("#VALUE!") : toNumber(value);
		const digits: SpreadsheetValue = digitsValue === null ? { kind: "number", value: 0 } : toNumber(digitsValue);
		if (number.kind !== "number") {
			return number;
		}
		if (digits.kind !== "number") {
			return digits;
		}
		const factor = DECIMAL_BASE ** Math.trunc(digits.value);
		return numberValue((Math.sign(number.value) * Math.round(Math.abs(number.value) * factor)) / factor);
	},
	IF: (args) => {
		const condition = single(args, FIRST_ARG);
		const flag = condition === null ? error("#VALUE!") : toBoolean(condition);
		if (flag.kind !== "boolean") {
			return flag;
		}
		const chosen = single(args, flag.value ? SECOND_ARG : THIRD_ARG);
		return chosen ?? { kind: "boolean", value: false };
	},
	CONCAT: (args) => {
		const values = args.flatMap((arg) => arg.values);
		const failed = values.find((value) => value.kind === "error");
		return failed ?? { kind: "string", value: values.map(formatSpreadsheetValue).join("") };
	},
	AND: logical((flags) => flags.every(Boolean)),
	OR: logical((flags) => flags.some(Boolean)),
	NOT: (args) => {
		const value = single(args, FIRST_ARG);
		const flag = value === null ? error("#VALUE!") : toBoolean(value);
		return flag.kind === "boolean" ? { kind: "boolean", value: !flag.value } : flag;
	},
};

// ── Evaluation ─────────────────────────────────────────────────────────────

/** Works out one formula tree, reading other cells through `valueOf`. */
export function evaluateSpreadsheetFormula(node: FormulaNode, valueOf: (ref: SpreadsheetCellRef) => SpreadsheetValue): SpreadsheetValue {
	switch (node.kind) {
		case "number":
			return numberValue(node.value);
		case "string":
			return { kind: "string", value: node.value };
		case "boolean":
			return { kind: "boolean", value: node.value };
		case "cell":
			return valueOf(node.cell.ref);
		case "range":
			// A range means something only as a function's argument.
			return error("#VALUE!");
		case "unary": {
			const operand = toNumber(evaluateSpreadsheetFormula(node.operand, valueOf));
			return operand.kind === "number" && node.operator === "-" ? numberValue(-operand.value) : operand;
		}
		case "binary":
			return applyBinary(node.operator, evaluateSpreadsheetFormula(node.left, valueOf), evaluateSpreadsheetFormula(node.right, valueOf));
		case "call": {
			const fn = SPREADSHEET_FUNCTIONS[node.name];
			if (fn === undefined) {
				return error("#NAME?");
			}
			const args = node.args.map((arg): FunctionArg =>
				arg.kind === "range"
					? { values: spreadsheetRangeCells({ start: arg.start.ref, end: arg.end.ref }).map(valueOf), fromRange: true }
					: { values: [evaluateSpreadsheetFormula(arg, valueOf)], fromRange: false },
			);
			return fn(args);
		}
		case "name":
			return error("#NAME?");
		case "error":
			return error(node.error);
		case "invalid":
			return error("#ERROR!");
	}
}

/** A sheet's worked-out values, read cell by cell. */
export interface SpreadsheetEvaluator {
	/** The value a cell shows: its formula's result, or its own value. */
	readonly valueOf: (ref: SpreadsheetCellRef) => SpreadsheetValue;
}

function cellKey(ref: SpreadsheetCellRef): string {
	return `${String(ref.column)}:${String(ref.row)}`;
}

/**
 * An evaluator over one state of a sheet. Each formula cell is worked out once and remembered; a cell met again
 * while it is still being worked out is part of a cycle and shows `#CYCLE!`. Make a new one when the cells change.
 */
export function createSpreadsheetEvaluator(read: SpreadsheetCellReader): SpreadsheetEvaluator {
	const done = new Map<string, SpreadsheetValue>();
	const inProgress = new Set<string>();

	const valueOf = (ref: SpreadsheetCellRef): SpreadsheetValue => {
		const key = cellKey(ref);
		const known = done.get(key);
		if (known !== undefined) {
			return known;
		}
		if (inProgress.has(key)) {
			return error("#CYCLE!");
		}
		const input = read(ref);
		if (!isStringPrimitive(input) || !isSpreadsheetFormula(input)) {
			const literal = spreadsheetLiteralValue(input);
			done.set(key, literal);
			return literal;
		}
		inProgress.add(key);
		const value = evaluateSpreadsheetFormula(parseSpreadsheetFormula(input), valueOf);
		inProgress.delete(key);
		done.set(key, value);
		return value;
	};

	return { valueOf };
}
