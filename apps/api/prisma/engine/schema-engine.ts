/**
 * The schema engine: gives every Prisma model the base model's fields, in place, inside `prisma/schema.prisma`.
 *
 * Prisma has no inheritance, so the base model is declared ONCE at the top of schema.prisma as a comment block
 * (Prisma ignores comments, so it never becomes a table):
 *
 *   // @base-model BaseModel
 *   //   id        String @id @default(uuid(7))
 *   //   ...
 *   // @end-base-model
 *
 * and every model opts in with a doc-comment directive:
 *
 *   /// @extends BaseModel
 *   model Thing {
 *     name String
 *   }
 *
 * `pnpm db:schema` writes the base fields into each model as a fenced, managed block at the top of its body
 * (between {@link MANAGED_BLOCK_START} and {@link MANAGED_BLOCK_END}) and rewrites that block on every run, so a
 * change to the base definition reaches every model. The file is always plain, valid Prisma: the editor and
 * `prisma validate` see every field.
 *
 * A model overrides a base field by declaring a field of the same name below the managed block (e.g. an integer
 * dataset id); a model with its own primary key (an `@id` field of another name, or a composite `@@id`) does not
 * get the base `id`. Every other block (generator, datasource, enum, comments) passes through untouched.
 *
 * Rules, checked on every run: the base block exists and holds only fields; every model declares
 * `/// @extends BaseModel`; a model name is declared once; a managed block is closed.
 *
 * `pnpm db:schema` rewrites the file; `--check` fails when it is not already what the engine would write.
 */

/** The base model every model extends. */
export const BASE_MODEL = "BaseModel";

/** The comment lines that open and close the base model's definition. */
export const BASE_BLOCK_START = `// @base-model ${BASE_MODEL}`;
export const BASE_BLOCK_END = "// @end-base-model";

/** The comment lines that fence the base fields the engine writes into a model. */
export const MANAGED_BLOCK_START = `// ── ${BASE_MODEL}: managed by \`pnpm db:schema\`, do not edit ──`;
export const MANAGED_BLOCK_END = `// ── end ${BASE_MODEL} ──`;

/** Thrown when the schema breaks a rule; the message names the model. */
export class SchemaEngineError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "SchemaEngineError";
	}
}

/** One base field: its name and its declaration. */
interface BaseField {
	readonly name: string;
	readonly declaration: string;
}

const HEADER_PATTERN = /^model\s+(?<name>\w+)\s*\{\s*$/;
const EXTENDS_DIRECTIVE = /^\s*\/\/\/\s*@extends\s+(?<base>\w+)\s*$/;
const DOC_COMMENT_PATTERN = /^\s*\/\/\//;
const COMMENT_PATTERN = /^\s*\/\//;
const COMMENT_PREFIX = /^\s*\/\/\s?/;
const FIELD_NAME_PATTERN = /^\s*(?<name>\w+)\s+\S/;
const BLOCK_ATTRIBUTE_PATTERN = /^\s*@@/;
const ID_ATTRIBUTE_PATTERN = /\s@id(?:\s|\(|$)/;
const COMPOSITE_ID_PATTERN = /^\s*@@id\(/;
const FIELD_INDENT = "  ";

/** A body line's field name, or `undefined` for comments, blank lines and block attributes. */
function fieldName(line: string): string | undefined {
	if (BLOCK_ATTRIBUTE_PATTERN.test(line) || COMMENT_PATTERN.test(line)) {
		return undefined;
	}
	return FIELD_NAME_PATTERN.exec(line)?.groups?.name;
}

/** The base fields declared between {@link BASE_BLOCK_START} and {@link BASE_BLOCK_END}. */
function readBaseFields(lines: readonly string[]): readonly BaseField[] {
	const start = lines.findIndex((line: string): boolean => line.trim() === BASE_BLOCK_START);
	const end = lines.findIndex((line: string, at: number): boolean => at > start && line.trim() === BASE_BLOCK_END);
	if (start === -1 || end === -1) {
		throw new SchemaEngineError(`schema.prisma must declare the base model between \`${BASE_BLOCK_START}\` and \`${BASE_BLOCK_END}\``);
	}
	const declarations = lines
		.slice(start + 1, end)
		.map((line: string): string => line.replace(COMMENT_PREFIX, "").trim())
		.filter((line: string): boolean => line.length > 0);
	return declarations.map((declaration: string): BaseField => {
		const name = fieldName(declaration);
		if (name === undefined) {
			throw new SchemaEngineError(`The base model may only declare fields, not \`${declaration}\``);
		}
		return { name, declaration };
	});
}

/** A model body without its managed block (and the blank line the engine puts after it). */
function withoutManagedBlock(model: string, body: readonly string[]): string[] {
	const start = body.findIndex((line: string): boolean => line.trim() === MANAGED_BLOCK_START);
	if (start === -1) {
		return [...body];
	}
	const end = body.findIndex((line: string, at: number): boolean => at > start && line.trim() === MANAGED_BLOCK_END);
	if (end === -1) {
		throw new SchemaEngineError(`model ${model}: the managed ${BASE_MODEL} block is never closed with \`${MANAGED_BLOCK_END}\``);
	}
	const after = (body.at(end + 1) ?? "").trim() === "" ? end + 2 : end + 1;
	return [...body.slice(0, start), ...body.slice(after)];
}

/** The base fields a model gets: all but the ones it overrides, and no `id` when it has its own primary key. */
function inheritedFields(base: readonly BaseField[], own: readonly string[]): readonly BaseField[] {
	const ownNames = new Set(own.map(fieldName).filter((name): name is string => name !== undefined));
	const ownPrimaryKey = own.some((line: string): boolean => COMPOSITE_ID_PATTERN.test(line) || (fieldName(line) !== undefined && ID_ATTRIBUTE_PATTERN.test(line)));
	return base.filter((field: BaseField): boolean => !ownNames.has(field.name) && !(ownPrimaryKey && ID_ATTRIBUTE_PATTERN.test(field.declaration)));
}

/** The doc comments right above line `index` (the model header). */
function docsAbove(lines: readonly string[], index: number): readonly string[] {
	let start = index;
	while (start > 0 && DOC_COMMENT_PATTERN.test(lines.at(start - 1) ?? "")) {
		start -= 1;
	}
	return lines.slice(start, index);
}

/** The schema with every model's managed block rewritten from the base model. */
export function applyBaseModel(schema: string): string {
	const lines = schema.split("\n");
	const base = readBaseFields(lines);
	const output: string[] = [];
	const declared = new Set<string>();
	let index = 0;
	while (index < lines.length) {
		const line = lines.at(index) ?? "";
		const name = HEADER_PATTERN.exec(line)?.groups?.name;
		if (name === undefined) {
			output.push(line);
			index += 1;
			continue;
		}
		if (declared.has(name)) {
			throw new SchemaEngineError(`model ${name} is declared twice`);
		}
		declared.add(name);
		const close = lines.findIndex((candidate: string, at: number): boolean => at > index && candidate.trim() === "}");
		if (close === -1) {
			throw new SchemaEngineError(`model ${name} is never closed`);
		}
		const directive = docsAbove(lines, index)
			.map((doc: string): string | undefined => EXTENDS_DIRECTIVE.exec(doc)?.groups?.base)
			.find((baseName): baseName is string => baseName !== undefined);
		if (directive !== BASE_MODEL) {
			throw new SchemaEngineError(`model ${name} must declare \`/// @extends ${BASE_MODEL}\` directly above it`);
		}
		const own = withoutManagedBlock(name, lines.slice(index + 1, close));
		const firstOwn = own.findIndex((ownLine: string): boolean => ownLine.trim() !== "");
		const body = firstOwn === -1 ? [] : own.slice(firstOwn);
		const managed = [
			`${FIELD_INDENT}${MANAGED_BLOCK_START}`,
			...inheritedFields(base, body).map((field: BaseField): string => `${FIELD_INDENT}${field.declaration}`),
			`${FIELD_INDENT}${MANAGED_BLOCK_END}`,
		];
		output.push(line, ...managed, ...(body.length > 0 ? ["", ...body] : []), "}");
		index = close + 1;
	}
	return output.join("\n");
}
