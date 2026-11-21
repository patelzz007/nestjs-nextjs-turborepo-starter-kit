// The spreadsheet formula language, read into a typed tree: numbers, "text", TRUE / FALSE, cell references (B2, $B$2),
// ranges (A1:C4), the operators + - * / ^ & = <> < <= > >= with their usual precedence, unary minus, parentheses and
// function calls. Shared by the web and native spreadsheets. Pure.
//
// Precedence, lowest first: comparison, & (join text), + -, * /, ^, unary - +.

import { z } from "zod";

import { offsetSpreadsheetCellRef, parseSpreadsheetCellRef, spreadsheetColumnLetters, type SpreadsheetCellRef } from "./address";

/** A cell reference as written: where it points, and which parts are pinned with `$` (they do not move on fill). */
export interface FormulaCellRef {
	readonly ref: SpreadsheetCellRef;
	readonly absoluteColumn: boolean;
	readonly absoluteRow: boolean;
}

export type FormulaBinaryOperator = "+" | "-" | "*" | "/" | "^" | "&" | "=" | "<>" | "<" | "<=" | ">" | ">=";

/**
 * What a formula shows when it cannot give a value. `#DIV/0!`: a division by zero. `#REF!`: a reference moved off the
 * sheet. `#NAME?`: an unknown name or function. `#VALUE!`: a value of the wrong kind (text where a number is needed).
 * `#CYCLE!`: the formula depends on itself. `#ERROR!`: the text is not a formula at all.
 */
export const SpreadsheetFormulaErrorSchema = z.enum(["#DIV/0!", "#REF!", "#NAME?", "#VALUE!", "#CYCLE!", "#ERROR!"]);

export type SpreadsheetFormulaError = z.output<typeof SpreadsheetFormulaErrorSchema>;

export type FormulaNode =
	| { readonly kind: "number"; readonly value: number }
	| { readonly kind: "string"; readonly value: string }
	| { readonly kind: "boolean"; readonly value: boolean }
	| { readonly kind: "cell"; readonly cell: FormulaCellRef }
	| { readonly kind: "range"; readonly start: FormulaCellRef; readonly end: FormulaCellRef }
	| { readonly kind: "unary"; readonly operator: "-" | "+"; readonly operand: FormulaNode }
	| { readonly kind: "binary"; readonly operator: FormulaBinaryOperator; readonly left: FormulaNode; readonly right: FormulaNode }
	| { readonly kind: "call"; readonly name: string; readonly args: readonly FormulaNode[] }
	/** A name that is not a function call or a reference: evaluates to `#NAME?`. */
	| { readonly kind: "name"; readonly name: string }
	/** An error written into the formula itself, such as `#REF!` after a reference moved off the sheet. */
	| { readonly kind: "error"; readonly error: SpreadsheetFormulaError }
	/** Text that is not a formula: evaluates to `#ERROR!`. */
	| { readonly kind: "invalid" };

type Token =
	| { readonly kind: "number"; readonly value: number }
	| { readonly kind: "string"; readonly value: string }
	| { readonly kind: "ref"; readonly text: string }
	| { readonly kind: "name"; readonly text: string }
	| { readonly kind: "error"; readonly error: SpreadsheetFormulaError }
	| { readonly kind: "op"; readonly text: string };

/** A formula is a cell text that starts with `=`. */
export function isSpreadsheetFormula(text: string): boolean {
	return text.startsWith("=");
}

/** Splits a formula body into tokens, or returns `null` at the first character that belongs to no token. */
function tokenize(body: string): Token[] | null {
	const tokens: Token[] = [];
	let index = 0;
	while (index < body.length) {
		// A fresh literal per step: Hermes drops named groups on a reused or copied regex.
		const match =
			/\s*(?:(?<number>\d+(?:\.\d+)?)|(?<string>"(?:[^"]|"")*")|(?<error>#DIV\/0!|#REF!|#NAME\?|#VALUE!|#CYCLE!|#ERROR!)|(?<ref>\$?[A-Za-z]+\$?[1-9]\d*)(?![A-Za-z0-9_(])|(?<name>[A-Za-z_][A-Za-z0-9_.]*)|(?<op><=|>=|<>|[-+*/^&=<>(),:]))/y;
		match.lastIndex = index;
		const found = match.exec(body);
		const [whole = ""] = found ?? [];
		const groups = found?.groups;
		if (groups === undefined || whole.length === 0) {
			return body.slice(index).trim() === "" ? tokens : null;
		}
		index = match.lastIndex;
		if (groups.number !== undefined) {
			tokens.push({ kind: "number", value: Number(groups.number) });
		} else if (groups.string !== undefined) {
			tokens.push({ kind: "string", value: groups.string.slice(1, -1).replaceAll('""', '"') });
		} else if (groups.error !== undefined) {
			const error = SpreadsheetFormulaErrorSchema.safeParse(groups.error);
			if (!error.success) {
				return null;
			}
			tokens.push({ kind: "error", error: error.data });
		} else if (groups.ref !== undefined) {
			tokens.push({ kind: "ref", text: groups.ref });
		} else if (groups.name !== undefined) {
			tokens.push({ kind: "name", text: groups.name });
		} else if (groups.op !== undefined) {
			tokens.push({ kind: "op", text: groups.op });
		}
	}
	return tokens;
}

/** `$B$2` → where it points and what is pinned; `null` for text that is not a reference. */
function readCellRef(text: string): FormulaCellRef | null {
	const groups = /^(?<colPin>\$?)(?<letters>[A-Za-z]+)(?<rowPin>\$?)(?<digits>[1-9]\d*)$/u.exec(text)?.groups;
	if (groups === undefined) {
		return null;
	}
	const ref = parseSpreadsheetCellRef(`${groups.letters ?? ""}${groups.digits ?? ""}`);
	return ref === null ? null : { ref, absoluteColumn: groups.colPin === "$", absoluteRow: groups.rowPin === "$" };
}

const COMPARISON_OPERATORS = new Set(["=", "<>", "<", "<=", ">", ">="]);
const ADDITIVE_OPERATORS = new Set(["+", "-"]);
const MULTIPLICATIVE_OPERATORS = new Set(["*", "/"]);
const BINARY_OPERATORS: readonly FormulaBinaryOperator[] = ["+", "-", "*", "/", "^", "&", "=", "<>", "<", "<=", ">", ">="];

function toBinaryOperator(text: string): FormulaBinaryOperator | null {
	return BINARY_OPERATORS.find((operator) => operator === text) ?? null;
}

/** A recursive-descent reader over the tokens. Every method returns `null` on a syntax error. */
class FormulaReader {
	private _position = 0;

	public constructor(private readonly _tokens: readonly Token[]) {}

	public readFormula(): FormulaNode | null {
		const node = this.readComparison();
		return node !== null && this._position === this._tokens.length ? node : null;
	}

	private peekOp(): string | null {
		const token = this._tokens.at(this._position);
		return token?.kind === "op" ? token.text : null;
	}

	private readLeftAssociative(operators: ReadonlySet<string>, readOperand: () => FormulaNode | null): FormulaNode | null {
		let left = readOperand();
		while (left !== null) {
			const text = this.peekOp();
			const operator = text === null || !operators.has(text) ? null : toBinaryOperator(text);
			if (operator === null) {
				return left;
			}
			this._position += 1;
			const right = readOperand();
			left = right === null ? null : { kind: "binary", operator, left, right };
		}
		return null;
	}

	private readComparison(): FormulaNode | null {
		return this.readLeftAssociative(COMPARISON_OPERATORS, (): FormulaNode | null => this.readConcat());
	}

	private readConcat(): FormulaNode | null {
		return this.readLeftAssociative(new Set(["&"]), (): FormulaNode | null => this.readAdditive());
	}

	private readAdditive(): FormulaNode | null {
		return this.readLeftAssociative(ADDITIVE_OPERATORS, (): FormulaNode | null => this.readMultiplicative());
	}

	private readMultiplicative(): FormulaNode | null {
		return this.readLeftAssociative(MULTIPLICATIVE_OPERATORS, (): FormulaNode | null => this.readPower());
	}

	/** `^` binds to the right: 2^3^2 is 2^(3^2). */
	private readPower(): FormulaNode | null {
		const base = this.readUnary();
		if (base === null || this.peekOp() !== "^") {
			return base;
		}
		this._position += 1;
		const exponent = this.readPower();
		return exponent === null ? null : { kind: "binary", operator: "^", left: base, right: exponent };
	}

	private readUnary(): FormulaNode | null {
		const text = this.peekOp();
		if (text === "-" || text === "+") {
			this._position += 1;
			const operand = this.readUnary();
			return operand === null ? null : { kind: "unary", operator: text, operand };
		}
		return this.readPrimary();
	}

	private readPrimary(): FormulaNode | null {
		const token = this._tokens.at(this._position);
		if (token === undefined) {
			return null;
		}
		this._position += 1;
		switch (token.kind) {
			case "number":
				return { kind: "number", value: token.value };
			case "string":
				return { kind: "string", value: token.value };
			case "ref":
				return this.readReference(token.text);
			case "name":
				return this.readName(token.text);
			case "error":
				return { kind: "error", error: token.error };
			case "op":
				return token.text === "(" ? this.readParenthesised() : null;
		}
	}

	private readReference(text: string): FormulaNode | null {
		const start = readCellRef(text);
		if (start === null) {
			return null;
		}
		if (this.peekOp() !== ":") {
			return { kind: "cell", cell: start };
		}
		this._position += 1;
		const endToken = this._tokens.at(this._position);
		const end = endToken?.kind === "ref" ? readCellRef(endToken.text) : null;
		if (end === null) {
			return null;
		}
		this._position += 1;
		return { kind: "range", start, end };
	}

	private readName(text: string): FormulaNode | null {
		const upper = text.toUpperCase();
		if (this.peekOp() === "(") {
			this._position += 1;
			return this.readCall(upper);
		}
		if (upper === "TRUE" || upper === "FALSE") {
			return { kind: "boolean", value: upper === "TRUE" };
		}
		return { kind: "name", name: text };
	}

	private readCall(name: string): FormulaNode | null {
		const args: FormulaNode[] = [];
		if (this.peekOp() === ")") {
			this._position += 1;
			return { kind: "call", name, args };
		}
		for (;;) {
			const arg = this.readComparison();
			if (arg === null) {
				return null;
			}
			args.push(arg);
			const separator = this.peekOp();
			this._position += 1;
			if (separator === ")") {
				return { kind: "call", name, args };
			}
			if (separator !== ",") {
				return null;
			}
		}
	}

	private readParenthesised(): FormulaNode | null {
		const inner = this.readComparison();
		if (inner === null || this.peekOp() !== ")") {
			return null;
		}
		this._position += 1;
		return inner;
	}
}

/** Reads a formula (`=` included) into its tree; text that is not a formula reads as `invalid`. */
export function parseSpreadsheetFormula(formula: string): FormulaNode {
	const body = isSpreadsheetFormula(formula) ? formula.slice(1) : formula;
	const tokens = tokenize(body);
	const node = tokens === null || tokens.length === 0 ? null : new FormulaReader(tokens).readFormula();
	return node ?? { kind: "invalid" };
}

// ── Writing a tree back, and moving its references ─────────────────────────

function writeCellRef(cell: FormulaCellRef): string {
	const column = `${cell.absoluteColumn ? "$" : ""}${spreadsheetColumnLetters(cell.ref.column)}`;
	return `${column}${cell.absoluteRow ? "$" : ""}${String(cell.ref.row + 1)}`;
}

/** Operator strength, so the written formula keeps exactly the parentheses its meaning needs. */
const PRECEDENCE: Readonly<Record<FormulaBinaryOperator, number>> = {
	"=": 1,
	"<>": 1,
	"<": 1,
	"<=": 1,
	">": 1,
	">=": 1,
	"&": 2,
	"+": 3,
	"-": 3,
	"*": 4,
	"/": 4,
	"^": 5,
};
const UNARY_PRECEDENCE = 6;

function precedenceOf(node: FormulaNode): number {
	if (node.kind === "binary") {
		return PRECEDENCE[node.operator];
	}
	return node.kind === "unary" ? UNARY_PRECEDENCE : Number.POSITIVE_INFINITY;
}

function writeNode(node: FormulaNode): string {
	switch (node.kind) {
		case "number":
			return String(node.value);
		case "string":
			return `"${node.value.replaceAll('"', '""')}"`;
		case "boolean":
			return node.value ? "TRUE" : "FALSE";
		case "cell":
			return writeCellRef(node.cell);
		case "range":
			return `${writeCellRef(node.start)}:${writeCellRef(node.end)}`;
		case "unary": {
			const operand = writeNode(node.operand);
			return `${node.operator}${precedenceOf(node.operand) < UNARY_PRECEDENCE ? `(${operand})` : operand}`;
		}
		case "binary": {
			const own = PRECEDENCE[node.operator];
			// `^` groups to the right, every other operator to the left; the side that groups away needs brackets at equal strength.
			const rightAssociative = node.operator === "^";
			const left = writeNode(node.left);
			const right = writeNode(node.right);
			const wrapLeft = precedenceOf(node.left) < own || (rightAssociative && precedenceOf(node.left) === own);
			const wrapRight = precedenceOf(node.right) < own || (!rightAssociative && precedenceOf(node.right) === own);
			return `${wrapLeft ? `(${left})` : left}${node.operator}${wrapRight ? `(${right})` : right}`;
		}
		case "call":
			return `${node.name}(${node.args.map(writeNode).join(",")})`;
		case "name":
			return node.name;
		case "error":
			return node.error;
		case "invalid":
			return "";
	}
}

/** Writes a tree back as a formula, `=` included. */
export function formatSpreadsheetFormula(node: FormulaNode): string {
	return `=${writeNode(node)}`;
}

function shiftCellRef(cell: FormulaCellRef, rows: number, columns: number): FormulaCellRef | null {
	const moved = offsetSpreadsheetCellRef(cell.ref, cell.absoluteRow ? 0 : rows, cell.absoluteColumn ? 0 : columns);
	return moved === null ? null : { ...cell, ref: moved };
}

/** A reference moved off the sheet: the formula reads `#REF!` from then on, as spreadsheets do. */
const OFF_SHEET: FormulaNode = { kind: "error", error: "#REF!" };

function shiftNode(node: FormulaNode, rows: number, columns: number): FormulaNode {
	switch (node.kind) {
		case "cell": {
			const cell = shiftCellRef(node.cell, rows, columns);
			return cell === null ? OFF_SHEET : { kind: "cell", cell };
		}
		case "range": {
			const start = shiftCellRef(node.start, rows, columns);
			const end = shiftCellRef(node.end, rows, columns);
			return start === null || end === null ? OFF_SHEET : { kind: "range", start, end };
		}
		case "unary":
			return { ...node, operand: shiftNode(node.operand, rows, columns) };
		case "binary":
			return { ...node, left: shiftNode(node.left, rows, columns), right: shiftNode(node.right, rows, columns) };
		case "call":
			return { ...node, args: node.args.map((arg) => shiftNode(arg, rows, columns)) };
		default:
			return node;
	}
}

/**
 * A formula moved by whole rows and columns, as a fill or a paste moves it: relative references move with it, `$`
 * parts stay. Text that is not a formula comes back unchanged.
 */
export function shiftSpreadsheetFormula(formula: string, rows: number, columns: number): string {
	if (!isSpreadsheetFormula(formula)) {
		return formula;
	}
	const node = parseSpreadsheetFormula(formula);
	return node.kind === "invalid" ? formula : formatSpreadsheetFormula(shiftNode(node, rows, columns));
}
