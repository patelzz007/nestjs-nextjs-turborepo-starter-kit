/**
 * `workspace/naming-convention` — a port of typescript-eslint's
 * `@typescript-eslint/naming-convention` (v8.72, MIT), which oxlint does not
 * implement, so the naming rules in `base.js` / `nestjs.js` keep their exact
 * meaning after the move off ESLint.
 *
 * Ported unchanged: every selector and meta-selector, the precedence order
 * (individual selector > `method`/`property` > other meta-selectors; more
 * modifiers first; a `filter` outranks everything), `format`,
 * `leadingUnderscore` / `trailingUnderscore`, `prefix` / `suffix`, `custom`,
 * `filter`, the format checkers, and the `requiresQuotes` behaviour (a name
 * that needs quotes fails every predefined format).
 *
 * Not ported, and rejected by the schema so a config cannot rely on them
 * silently: `types` (needs the type checker) and the modifiers derived from
 * scope analysis — `const`, `destructured`, `global`, `exported`, `unused`,
 * `async`, `default`, `namespace`. Supported modifiers: `readonly`, `static`,
 * `public`, `protected`, `private`, `#private`, `abstract`, `override`,
 * `requiresQuotes`.
 */

// ── Enums (values match upstream so the precedence sort is identical) ──────

const FORMATS = { camelCase: 1, strictCamelCase: 2, PascalCase: 3, StrictPascalCase: 4, snake_case: 5, UPPER_CASE: 6 };
const FORMAT_NAMES = Object.fromEntries(Object.entries(FORMATS).map(([name, value]) => [value, name]));

const UNDERSCORE = { forbid: 1, allow: 2, require: 3, requireDouble: 4, allowDouble: 5, allowSingleOrDouble: 6 };

const SELECTORS = {
	variable: 1,
	function: 2,
	parameter: 4,
	parameterProperty: 8,
	classicAccessor: 16,
	enumMember: 32,
	classMethod: 64,
	objectLiteralMethod: 128,
	typeMethod: 256,
	classProperty: 512,
	objectLiteralProperty: 1024,
	typeProperty: 2048,
	autoAccessor: 4096,
	class: 8192,
	interface: 16384,
	typeAlias: 32768,
	enum: 65536,
	typeParameter: 131072,
	import: 262144,
};

const META_SELECTORS = {
	default: -1,
	variableLike: 7,
	memberLike: 8184,
	typeLike: 253952,
	method: 448,
	property: 3584,
	accessor: 4112,
};

const MODIFIERS = {
	readonly: 2,
	static: 4,
	public: 8,
	protected: 16,
	private: 32,
	"#private": 64,
	abstract: 128,
	requiresQuotes: 4096,
	override: 8192,
};

// ── Format checkers (upstream format.js, from tslint-consistent-codestyle) ──

function isPascalCase(name) {
	return name.length === 0 || (name.charAt(0) === name.charAt(0).toUpperCase() && !name.includes("_"));
}

function isCamelCase(name) {
	return name.length === 0 || (name.charAt(0) === name.charAt(0).toLowerCase() && !name.includes("_"));
}

function hasStrictCamelHumps(name, startsUpper) {
	let isUpper = startsUpper;
	const isUppercaseChar = (char) => char === char.toUpperCase() && char !== char.toLowerCase();
	if (name.startsWith("_")) {
		return false;
	}
	for (let index = 1; index < name.length; index += 1) {
		const char = name.charAt(index);
		if (char === "_") {
			return false;
		}
		if (isUpper === isUppercaseChar(char)) {
			if (isUpper) {
				return false;
			}
		} else {
			isUpper = !isUpper;
		}
	}
	return true;
}

function isStrictPascalCase(name) {
	return name.length === 0 || (name.charAt(0) === name.charAt(0).toUpperCase() && hasStrictCamelHumps(name, true));
}

function isStrictCamelCase(name) {
	return name.length === 0 || (name.charAt(0) === name.charAt(0).toLowerCase() && hasStrictCamelHumps(name, false));
}

/** No leading, trailing or adjacent underscores. */
function validateUnderscores(name) {
	if (name.startsWith("_")) {
		return false;
	}
	let wasUnderscore = false;
	for (let index = 1; index < name.length; index += 1) {
		if (name.charAt(index) === "_") {
			if (wasUnderscore) {
				return false;
			}
			wasUnderscore = true;
		} else {
			wasUnderscore = false;
		}
	}
	return !wasUnderscore;
}

function isSnakeCase(name) {
	return name.length === 0 || (name === name.toLowerCase() && validateUnderscores(name));
}

function isUpperCase(name) {
	return name.length === 0 || (name === name.toUpperCase() && validateUnderscores(name));
}

const FORMAT_CHECKS = {
	[FORMATS.camelCase]: isCamelCase,
	[FORMATS.PascalCase]: isPascalCase,
	[FORMATS.snake_case]: isSnakeCase,
	[FORMATS.strictCamelCase]: isStrictCamelCase,
	[FORMATS.StrictPascalCase]: isStrictPascalCase,
	[FORMATS.UPPER_CASE]: isUpperCase,
};

// ── Option schema ───────────────────────────────────────────────────────────

const SELECTOR_NAMES = [...Object.keys(SELECTORS), ...Object.keys(META_SELECTORS)];
const FORMAT_OPTION = { oneOf: [{ type: "null" }, { type: "array", items: { enum: Object.keys(FORMATS) } }] };
const UNDERSCORE_OPTION = { enum: Object.keys(UNDERSCORE) };
const MATCH_REGEX = { type: "object", properties: { match: { type: "boolean" }, regex: { type: "string" } }, required: ["match", "regex"], additionalProperties: false };

const OPTION_SCHEMA = {
	type: "object",
	properties: {
		selector: { oneOf: [{ enum: SELECTOR_NAMES }, { type: "array", items: { enum: SELECTOR_NAMES }, minItems: 1 }] },
		format: FORMAT_OPTION,
		leadingUnderscore: UNDERSCORE_OPTION,
		trailingUnderscore: UNDERSCORE_OPTION,
		prefix: { type: "array", items: { type: "string", minLength: 1 } },
		suffix: { type: "array", items: { type: "string", minLength: 1 } },
		custom: MATCH_REGEX,
		filter: { oneOf: [{ type: "string", minLength: 1 }, MATCH_REGEX] },
		modifiers: { type: "array", items: { enum: Object.keys(MODIFIERS) }, uniqueItems: true },
	},
	required: ["selector", "format"],
	additionalProperties: false,
};

// ── Option normalisation and precedence (upstream parse-options.js / validator.js) ──

const FILTER_WEIGHT = 2 ** 30;

function isMetaSelector(selector) {
	return Object.values(META_SELECTORS).includes(selector);
}

function isMethodOrPropertySelector(selector) {
	return selector === META_SELECTORS.method || selector === META_SELECTORS.property;
}

function selectorValue(name) {
	return name in META_SELECTORS ? META_SELECTORS[name] : SELECTORS[name];
}

function toRegExpMatcher(option) {
	if (option === undefined) {
		return null;
	}
	if (option.regex === undefined) {
		return { match: true, regex: new RegExp(option, "u") };
	}
	return { match: option.match, regex: new RegExp(option.regex, "u") };
}

function normalizeOption(option) {
	let weight = 0;
	for (const modifier of option.modifiers ?? []) {
		weight |= MODIFIERS[modifier];
	}
	if (option.filter !== undefined) {
		weight |= FILTER_WEIGHT;
	}
	const normalized = {
		custom: option.custom === undefined ? null : { match: option.custom.match, regex: new RegExp(option.custom.regex, "u") },
		filter: toRegExpMatcher(option.filter),
		format: option.format === null ? null : option.format.map((format) => FORMATS[format]),
		leadingUnderscore: option.leadingUnderscore === undefined ? null : UNDERSCORE[option.leadingUnderscore],
		trailingUnderscore: option.trailingUnderscore === undefined ? null : UNDERSCORE[option.trailingUnderscore],
		modifiers: option.modifiers === undefined ? null : option.modifiers.map((modifier) => MODIFIERS[modifier]),
		prefix: option.prefix !== undefined && option.prefix.length > 0 ? option.prefix : null,
		suffix: option.suffix !== undefined && option.suffix.length > 0 ? option.suffix : null,
		modifierWeight: weight,
	};
	const selectors = [option.selector].flat();
	return selectors.map((selector) => ({ selector: selectorValue(selector), ...normalized }));
}

function compareConfigs(a, b) {
	if (a.selector === b.selector) {
		return b.modifierWeight - a.modifierWeight;
	}
	const aIsMeta = isMetaSelector(a.selector);
	const bIsMeta = isMetaSelector(b.selector);
	if (aIsMeta && !bIsMeta) {
		return 1;
	}
	if (!aIsMeta && bIsMeta) {
		return -1;
	}
	const aIsMethodOrProperty = isMethodOrPropertySelector(a.selector);
	const bIsMethodOrProperty = isMethodOrPropertySelector(b.selector);
	if (aIsMethodOrProperty && !bIsMethodOrProperty) {
		return -1;
	}
	if (!aIsMethodOrProperty && bIsMethodOrProperty) {
		return 1;
	}
	return b.selector - a.selector;
}

/** "classMethod" → "Class Method" (upstream selectorTypeToMessageString). */
function selectorLabel(selectorName) {
	const spaced = selectorName.replaceAll(/([A-Z])/gu, " $1");
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Whether `name` must be quoted as a property key (it is not a valid identifier). */
function requiresQuoting(name) {
	return !/^[\p{ID_Start}$_][\p{ID_Continue}$‌‍]*$/u.test(name);
}

function nameOf(node) {
	return node.type === "Identifier" || node.type === "PrivateIdentifier" ? node.name : String(node.value);
}

function createValidator(selectorName, context, allConfigs) {
	const selectorType = SELECTORS[selectorName];
	const configs = allConfigs.filter((config) => (config.selector & selectorType) !== 0 || config.selector === META_SELECTORS.default).sort(compareConfigs);
	const type = selectorLabel(selectorName);

	function reportData({ affixes, count, custom, formats, originalName, position, processedName }) {
		return {
			affixes: affixes?.join(", "),
			count,
			formats: formats?.map((format) => FORMAT_NAMES[format]).join(", "),
			name: originalName,
			position,
			processedName,
			regex: custom?.regex.toString(),
			regexMatch: custom === undefined ? undefined : custom.match ? "match" : "not match",
			type,
		};
	}

	function validateUnderscore(position, config, name, node, originalName) {
		const option = position === "leading" ? config.leadingUnderscore : config.trailingUnderscore;
		if (option === null) {
			return name;
		}
		const isLeading = position === "leading";
		const hasSingle = isLeading ? name.startsWith("_") : name.endsWith("_");
		const hasDouble = isLeading ? name.startsWith("__") : name.endsWith("__");
		const trimSingle = () => (isLeading ? name.slice(1) : name.slice(0, -1));
		const trimDouble = () => (isLeading ? name.slice(2) : name.slice(0, -2));
		switch (option) {
			case UNDERSCORE.allow:
				return hasSingle ? trimSingle() : name;
			case UNDERSCORE.allowDouble:
				return hasDouble ? trimDouble() : name;
			case UNDERSCORE.allowSingleOrDouble:
				if (hasDouble) {
					return trimDouble();
				}
				return hasSingle ? trimSingle() : name;
			case UNDERSCORE.forbid:
				if (hasSingle) {
					context.report({ node, messageId: "unexpectedUnderscore", data: reportData({ count: "one", originalName, position }) });
					return null;
				}
				return name;
			case UNDERSCORE.require:
				if (!hasSingle) {
					context.report({ node, messageId: "missingUnderscore", data: reportData({ count: "one", originalName, position }) });
					return null;
				}
				return trimSingle();
			case UNDERSCORE.requireDouble:
				if (!hasDouble) {
					context.report({ node, messageId: "missingUnderscore", data: reportData({ count: "two", originalName, position }) });
					return null;
				}
				return trimDouble();
			default:
				return name;
		}
	}

	function validateAffix(position, config, name, node, originalName) {
		const affixes = config[position];
		if (affixes === null) {
			return name;
		}
		for (const affix of affixes) {
			if (position === "prefix" ? name.startsWith(affix) : name.endsWith(affix)) {
				return position === "prefix" ? name.slice(affix.length) : name.slice(0, -affix.length);
			}
		}
		context.report({ node, messageId: "missingAffix", data: reportData({ affixes, originalName, position }) });
		return null;
	}

	function validateCustom(config, name, node, originalName) {
		const custom = config.custom;
		if (custom === null) {
			return true;
		}
		if (custom.regex.test(name) === custom.match) {
			return true;
		}
		context.report({ node, messageId: "satisfyCustom", data: reportData({ custom, originalName }) });
		return false;
	}

	function validateFormat(config, name, node, originalName, modifiers) {
		const formats = config.format;
		if (formats === null || formats.length === 0) {
			return true;
		}
		if (!modifiers.has(MODIFIERS.requiresQuotes) && formats.some((format) => FORMAT_CHECKS[format](name))) {
			return true;
		}
		context.report({
			node,
			messageId: originalName === name ? "doesNotMatchFormat" : "doesNotMatchFormatTrimmed",
			data: reportData({ formats, originalName, processedName: name }),
		});
		return false;
	}

	return (node, modifiers = new Set()) => {
		const originalName = nameOf(node);
		for (const config of configs) {
			if (config.filter !== null && config.filter.regex.test(originalName) !== config.filter.match) {
				continue;
			}
			if (config.modifiers?.some((modifier) => !modifiers.has(modifier))) {
				continue;
			}
			let name = validateUnderscore("leading", config, originalName, node, originalName);
			if (name === null) {
				return;
			}
			name = validateUnderscore("trailing", config, name, node, originalName);
			if (name === null) {
				return;
			}
			name = validateAffix("prefix", config, name, node, originalName);
			if (name === null) {
				return;
			}
			name = validateAffix("suffix", config, name, node, originalName);
			if (name === null) {
				return;
			}
			if (!validateCustom(config, name, node, originalName)) {
				return;
			}
			validateFormat(config, name, node, originalName, modifiers);
			return;
		}
	};
}

// ── AST helpers ─────────────────────────────────────────────────────────────

/** The identifiers a binding pattern declares (upstream uses scope-manager's PatternVisitor). */
function identifiersOf(pattern) {
	switch (pattern?.type) {
		case "Identifier":
			return [pattern];
		case "ObjectPattern":
			return pattern.properties.flatMap((property) => identifiersOf(property.type === "RestElement" ? property.argument : property.value));
		case "ArrayPattern":
			return pattern.elements.flatMap((element) => (element === null ? [] : identifiersOf(element)));
		case "RestElement":
			return identifiersOf(pattern.argument);
		case "AssignmentPattern":
			return identifiersOf(pattern.left);
		default:
			return [];
	}
}

function memberModifiers(node) {
	const modifiers = new Set();
	if (node.key?.type === "PrivateIdentifier") {
		modifiers.add(MODIFIERS["#private"]);
	} else if (node.accessibility !== undefined && node.accessibility !== null) {
		modifiers.add(MODIFIERS[node.accessibility]);
	} else {
		modifiers.add(MODIFIERS.public);
	}
	if (node.static === true) {
		modifiers.add(MODIFIERS.static);
	}
	if (node.readonly === true) {
		modifiers.add(MODIFIERS.readonly);
	}
	if (node.override === true) {
		modifiers.add(MODIFIERS.override);
	}
	if (node.type === "TSAbstractPropertyDefinition" || node.type === "TSAbstractMethodDefinition" || node.type === "TSAbstractAccessorProperty") {
		modifiers.add(MODIFIERS.abstract);
	}
	return modifiers;
}

function withQuoteModifier(key, modifiers) {
	if (requiresQuoting(nameOf(key))) {
		modifiers.add(MODIFIERS.requiresQuotes);
	}
	return modifiers;
}

// ── The rule ────────────────────────────────────────────────────────────────

const namingConvention = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Enforce naming conventions (port of @typescript-eslint/naming-convention).",
		},
		schema: { type: "array", items: OPTION_SCHEMA, minItems: 1 },
		messages: {
			doesNotMatchFormat: "{{type}} name `{{name}}` must match one of the following formats: {{formats}}",
			doesNotMatchFormatTrimmed: "{{type}} name `{{name}}` trimmed as `{{processedName}}` must match one of the following formats: {{formats}}",
			missingAffix: "{{type}} name `{{name}}` must have one of the following {{position}}es: {{affixes}}",
			missingUnderscore: "{{type}} name `{{name}}` must have {{count}} {{position}} underscore(s).",
			satisfyCustom: "{{type}} name `{{name}}` must {{regexMatch}} the RegExp: {{regex}}",
			unexpectedUnderscore: "{{type}} name `{{name}}` must not have a {{position}} underscore.",
		},
	},
	create(context) {
		const configs = context.options.flatMap(normalizeOption);
		const validators = Object.fromEntries(Object.keys(SELECTORS).map((name) => [name, createValidator(name, context, configs)]));

		const member = (validator) => (node) => {
			validator(node.key, withQuoteModifier(node.key, memberModifiers(node)));
		};
		const publicMember = (validator) => (node) => {
			validator(node.key, withQuoteModifier(node.key, new Set([MODIFIERS.public])));
		};
		const named = (validator) => (node) => {
			if (node.id !== null && node.id !== undefined) {
				validator(node.id, new Set());
			}
		};

		return {
			"FunctionDeclaration, TSDeclareFunction, FunctionExpression": named(validators.function),
			"ImportDefaultSpecifier, ImportNamespaceSpecifier, ImportSpecifier"(node) {
				if (node.type === "ImportSpecifier" && !(node.imported.type === "Identifier" && node.imported.name === "default")) {
					return;
				}
				validators.import(node.local, new Set());
			},
			VariableDeclarator(node) {
				for (const id of identifiersOf(node.id)) {
					validators.variable(id, new Set());
				}
			},
			':matches(PropertyDefinition, TSAbstractPropertyDefinition)[computed = false][value.type != "ArrowFunctionExpression"][value.type != "FunctionExpression"][value.type != "TSEmptyBodyFunctionExpression"]':
				member(validators.classProperty),
			':not(ObjectPattern) > Property[computed = false][kind = "init"][value.type != "ArrowFunctionExpression"][value.type != "FunctionExpression"][value.type != "TSEmptyBodyFunctionExpression"]':
				publicMember(validators.objectLiteralProperty),
			[[
				':matches(PropertyDefinition, TSAbstractPropertyDefinition)[computed = false][value.type = "ArrowFunctionExpression"]',
				':matches(PropertyDefinition, TSAbstractPropertyDefinition)[computed = false][value.type = "FunctionExpression"]',
				':matches(PropertyDefinition, TSAbstractPropertyDefinition)[computed = false][value.type = "TSEmptyBodyFunctionExpression"]',
				':matches(MethodDefinition, TSAbstractMethodDefinition)[computed = false][kind = "method"]',
			].join(", ")]: member(validators.classMethod),
			[['MethodDefinition[computed = false]:matches([kind = "get"], [kind = "set"])', 'TSAbstractMethodDefinition[computed = false]:matches([kind="get"], [kind="set"])'].join(
				", ",
			)]: member(validators.classicAccessor),
			[[
				'Property[computed = false][kind = "init"][value.type = "ArrowFunctionExpression"]',
				'Property[computed = false][kind = "init"][value.type = "FunctionExpression"]',
				'Property[computed = false][kind = "init"][value.type = "TSEmptyBodyFunctionExpression"]',
			].join(", ")]: publicMember(validators.objectLiteralMethod),
			[["TSMethodSignature[computed = false]", 'TSPropertySignature[computed = false][typeAnnotation.typeAnnotation.type = "TSFunctionType"]'].join(", ")]: publicMember(
				validators.typeMethod,
			),
			"AccessorProperty, TSAbstractAccessorProperty": member(validators.autoAccessor),
			"FunctionDeclaration, TSDeclareFunction, TSEmptyBodyFunctionExpression, FunctionExpression, ArrowFunctionExpression"(node) {
				for (const param of node.params) {
					if (param.type === "TSParameterProperty") {
						continue;
					}
					for (const id of identifiersOf(param)) {
						validators.parameter(id, new Set());
					}
				}
			},
			'Property[computed = false]:matches([kind = "get"], [kind = "set"])': publicMember(validators.classicAccessor),
			TSParameterProperty(node) {
				const modifiers = memberModifiers(node);
				for (const id of identifiersOf(node.parameter)) {
					validators.parameterProperty(id, modifiers);
				}
			},
			'TSPropertySignature[computed = false][typeAnnotation.typeAnnotation.type != "TSFunctionType"]'(node) {
				const modifiers = new Set([MODIFIERS.public]);
				if (node.readonly === true) {
					modifiers.add(MODIFIERS.readonly);
				}
				validators.typeProperty(node.key, withQuoteModifier(node.key, modifiers));
			},
			"ClassDeclaration, ClassExpression"(node) {
				if (node.id !== null && node.id !== undefined) {
					validators.class(node.id, new Set(node.abstract === true ? [MODIFIERS.abstract] : []));
				}
			},
			TSEnumDeclaration(node) {
				validators.enum(node.id, new Set());
			},
			TSEnumMember(node) {
				validators.enumMember(node.id, withQuoteModifier(node.id, new Set()));
			},
			TSInterfaceDeclaration(node) {
				validators.interface(node.id, new Set());
			},
			TSTypeAliasDeclaration(node) {
				validators.typeAlias(node.id, new Set());
			},
			"TSTypeParameterDeclaration > TSTypeParameter"(node) {
				validators.typeParameter(node.name, new Set());
			},
		};
	},
};

export default namingConvention;
