import { ResourceDefinitionSchema, type ResourceDefinition } from "../schema/resource-definition";

export class ResourceParseError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "ResourceParseError";
	}
}

function extractDefineResourceObject(sourceText: string): string {
	const marker = "defineResource(";
	const startIndex = sourceText.indexOf(marker);
	if (startIndex === -1) {
		throw new ResourceParseError("Expected defineResource({ ... }) default export");
	}

	let index = startIndex + marker.length;
	while (index < sourceText.length) {
		const char = sourceText[index];
		if (char === undefined || /\s/.test(char)) {
			index += 1;
			continue;
		}
		break;
	}
	if (sourceText[index] !== "{") {
		throw new ResourceParseError("defineResource() expects one object literal argument");
	}

	let depth = 0;
	let inString: "'" | '"' | "`" | null = null;
	let escaped = false;
	const begin = index;

	for (; index < sourceText.length; index += 1) {
		const char = sourceText[index];
		if (inString !== null) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (char === "\\") {
				escaped = true;
				continue;
			}
			if (char === inString) {
				inString = null;
			}
			continue;
		}

		if (char === '"' || char === "'" || char === "`") {
			inString = char;
			continue;
		}

		if (char === "{") {
			depth += 1;
			continue;
		}
		if (char === "}") {
			depth -= 1;
			if (depth === 0) {
				return sourceText.slice(begin, index + 1);
			}
		}
	}

	throw new ResourceParseError("Unterminated object literal in defineResource()");
}

function quoteUnquotedKeys(objectLiteral: string): string {
	return objectLiteral.replace(/(^|[,{]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
}

function objectLiteralToJson(objectLiteral: string): string {
	const normalized = quoteUnquotedKeys(objectLiteral)
		.replace(/\/\/.*$/gm, "")
		.replace(/,\s*([}\]])/g, "$1");
	return normalized;
}

export function parseResourceDefinitionSource(sourceText: string, fileName: string): ResourceDefinition {
	if (/=>|function\s*\(/.test(sourceText)) {
		throw new ResourceParseError("Callbacks and functions are not allowed in resource definitions");
	}

	const objectLiteral = extractDefineResourceObject(sourceText);
	const jsonText = objectLiteralToJson(objectLiteral);
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonText);
	} catch (error) {
		throw new ResourceParseError(`Failed to parse ${fileName}: ${error instanceof Error ? error.message : "invalid JSON"}`);
	}

	return ResourceDefinitionSchema.parse(parsed);
}

export function parseResourceDefinitionFile(sourceText: string, filePath: string): ResourceDefinition {
	return parseResourceDefinitionSource(sourceText, filePath);
}
