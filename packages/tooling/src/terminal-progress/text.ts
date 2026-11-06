// Text helpers shared by what the hooks draw. `Tint` is the only thing that knows about colour.

/** Colours the text; the identity when colour is off. */
export interface Tint {
	readonly title: (text: string) => string;
	readonly active: (text: string) => string;
	readonly pass: (text: string) => string;
	readonly fail: (text: string) => string;
	readonly warn: (text: string) => string;
	readonly quiet: (text: string) => string;
}

const ELLIPSIS = "…";
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");
const PACKAGE_SCOPE = /^@[^/]+\//u;

/** Keeps the end of a path, the part that names the file. */
export function fitStart(text: string, width: number): string {
	if (width <= 0) {
		return "";
	}
	return text.length <= width ? text : `${ELLIPSIS}${text.slice(text.length - width + 1)}`;
}

export function fitEnd(text: string, width: number): string {
	if (width <= 0) {
		return "";
	}
	return text.length <= width ? text : `${text.slice(0, width - 1)}${ELLIPSIS}`;
}

export function formatCount(count: number): string {
	return NUMBER_FORMAT.format(count);
}

export function plural(count: number, noun: string): string {
	return `${formatCount(count)} ${noun}${count === 1 ? "" : "s"}`;
}

/** A package's name without its scope, which every package in a repository tends to share. */
export function shortPackage(name: string): string {
	return name.replace(PACKAGE_SCOPE, "");
}
