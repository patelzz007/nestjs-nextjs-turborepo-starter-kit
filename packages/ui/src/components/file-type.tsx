"use client";

// Ported from ReUI (https://reui.io/r/base-vega/file-type.json). Exports, props,
// `data-slot` / `data-type` / `data-category` / `data-variant` / `data-size`
// attributes and the resolution rules (`getFileType`, `getFileTypeCategory`)
// match ReUI, so its docs and examples apply, with these deliberate deviations:
// - Colours are the kit's categorical tone tokens (`text-tone-*`), not Tailwind
//   palette steps: brand colours map to the nearest tone, so every type themes in
//   light and dark. The label and solid-glyph colour is the tone's soft fill
//   (`--file-type-foreground`), which meets AA on the tone in both themes.
// - The accessible name ("PDF file", "Spreadsheet") comes from the `fileType`
//   family of `UiKitLabels`, so the component needs a `UiKitLabelsProvider`.
// - `type` / `getFileType` are typed `string` (known names are `FileTypeName`).
// - ReUI's per-style square page (lyra / sera) is dropped: the kit has one style.
// - The root forwards its ref.
import { isStringPrimitive } from "@workspace/shared";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

/** The families that can be passed as a `type` on their own, glyph only. */
const FileTypeFamilySchema = z.enum([
	"archive",
	"audio",
	"code",
	"design",
	"document",
	"empty",
	"executable",
	"folder",
	"font",
	"image",
	"presentation",
	"spreadsheet",
	"video",
]);

/** The families that can be passed as a `type` on their own, glyph only. */
const FILE_TYPE_CATEGORIES = FileTypeFamilySchema.options;

/** The family a type belongs to. It picks the glyph and the default colour; `file` is any unknown type. */
type FileTypeCategory = z.infer<typeof FileTypeFamilySchema> | "file";

/** A categorical tone token (`--tone-*`), or the muted neutral. */
type FileTypeTone = "neutral" | "blue" | "green" | "yellow" | "red" | "orange" | "teal" | "violet";

interface FileTypeExtension {
	readonly category: FileTypeCategory;
	readonly tone: FileTypeTone;
	/** A short label for a key too long for the band, as DOCK for Dockerfile. */
	readonly label?: string;
}

/** Copy for the accessible name — the `fileType` family of `UiKitLabels`. */
export interface FileTypeLabels {
	/** The name of a family or a type with no label ("Image", "Folder"). */
	readonly categories: Readonly<Record<FileTypeCategory, string>>;
	/** The name of a type with a label, from its spelled-out key ("PDF" → "PDF file"). */
	readonly typeFile: (type: string) => string;
	/** A custom string `label` joined with the type name ("V3", "DOCX file" → "V3, DOCX file"). */
	readonly labelledType: (label: string, typeName: string) => string;
}

/* -------------------------------------------------------------------------- */
/*                                 Type table                                 */
/* -------------------------------------------------------------------------- */

/** The family tones, which a format without a brand tone of its own takes. */
const CATEGORY_TONES: Readonly<Record<FileTypeCategory, FileTypeTone>> = {
	archive: "neutral",
	audio: "red",
	code: "blue",
	design: "violet",
	document: "blue",
	empty: "neutral",
	executable: "neutral",
	file: "neutral",
	folder: "violet",
	font: "neutral",
	image: "violet",
	presentation: "red",
	spreadsheet: "green",
	video: "blue",
};

/**
 * Known extensions. A format takes its brand's nearest tone (Word blue, Excel
 * green, the GitHub language colours for code), else its family's; a format
 * with neither (archives, plain text, data, config, fonts, installers) is neutral.
 */
const FILE_TYPE_EXTENSIONS = {
	// Documents
	pdf: { category: "document", tone: "orange" },
	doc: { category: "document", tone: "blue" },
	docx: { category: "document", tone: "blue" },
	odt: { category: "document", tone: "blue" },
	rtf: { category: "document", tone: "blue" },
	pages: { category: "document", tone: "yellow" },
	txt: { category: "document", tone: "neutral" },
	md: { category: "document", tone: "neutral" },
	log: { category: "document", tone: "neutral" },
	mdx: { category: "document", tone: "yellow" },
	mdc: { category: "document", tone: "neutral" },
	eml: { category: "document", tone: "neutral" },
	srt: { category: "document", tone: "neutral" },
	vtt: { category: "document", tone: "neutral" },
	// Spreadsheets
	xls: { category: "spreadsheet", tone: "green" },
	xlsx: { category: "spreadsheet", tone: "green" },
	xlsm: { category: "spreadsheet", tone: "green" },
	ods: { category: "spreadsheet", tone: "green" },
	csv: { category: "spreadsheet", tone: "green" },
	tsv: { category: "spreadsheet", tone: "green" },
	numbers: { category: "spreadsheet", tone: "green", label: "NUM" },
	parquet: { category: "spreadsheet", tone: "neutral", label: "PARQ" },
	sqlite: { category: "spreadsheet", tone: "blue" },
	db: { category: "spreadsheet", tone: "neutral" },
	// Presentations
	ppt: { category: "presentation", tone: "red" },
	pptx: { category: "presentation", tone: "red" },
	odp: { category: "presentation", tone: "red" },
	key: { category: "presentation", tone: "blue" },
	// Images
	png: { category: "image", tone: "yellow" },
	jpg: { category: "image", tone: "violet" },
	jpeg: { category: "image", tone: "violet" },
	gif: { category: "image", tone: "violet" },
	webp: { category: "image", tone: "violet" },
	avif: { category: "image", tone: "violet" },
	heic: { category: "image", tone: "violet" },
	bmp: { category: "image", tone: "violet" },
	tif: { category: "image", tone: "violet" },
	tiff: { category: "image", tone: "violet" },
	ico: { category: "image", tone: "violet" },
	raw: { category: "image", tone: "neutral" },
	svg: { category: "image", tone: "yellow" },
	jxl: { category: "image", tone: "violet" },
	// Video
	mp4: { category: "video", tone: "blue" },
	mov: { category: "video", tone: "blue" },
	avi: { category: "video", tone: "blue" },
	mkv: { category: "video", tone: "blue" },
	webm: { category: "video", tone: "blue" },
	mpeg: { category: "video", tone: "blue" },
	mpg: { category: "video", tone: "blue" },
	wmv: { category: "video", tone: "blue" },
	m3u8: { category: "video", tone: "blue" },
	// Audio
	mp3: { category: "audio", tone: "red" },
	wav: { category: "audio", tone: "red" },
	aac: { category: "audio", tone: "red" },
	flac: { category: "audio", tone: "red" },
	ogg: { category: "audio", tone: "red" },
	m4a: { category: "audio", tone: "red" },
	aiff: { category: "audio", tone: "red" },
	opus: { category: "audio", tone: "red" },
	// Code and data
	js: { category: "code", tone: "yellow" },
	jsx: { category: "code", tone: "yellow" },
	mjs: { category: "code", tone: "yellow" },
	ts: { category: "code", tone: "blue" },
	tsx: { category: "code", tone: "blue" },
	html: { category: "code", tone: "orange" },
	htm: { category: "code", tone: "orange" },
	css: { category: "code", tone: "violet" },
	scss: { category: "code", tone: "red" },
	json: { category: "code", tone: "neutral" },
	xml: { category: "code", tone: "neutral" },
	yaml: { category: "code", tone: "neutral" },
	yml: { category: "code", tone: "neutral" },
	sql: { category: "code", tone: "neutral" },
	py: { category: "code", tone: "blue" },
	java: { category: "code", tone: "orange" },
	php: { category: "code", tone: "blue" },
	rb: { category: "code", tone: "red" },
	go: { category: "code", tone: "teal" },
	rs: { category: "code", tone: "orange" },
	c: { category: "code", tone: "neutral" },
	cpp: { category: "code", tone: "blue" },
	h: { category: "code", tone: "neutral" },
	cs: { category: "code", tone: "violet" },
	sh: { category: "code", tone: "green" },
	rss: { category: "code", tone: "orange" },
	cjs: { category: "code", tone: "yellow" },
	mts: { category: "code", tone: "blue" },
	vue: { category: "code", tone: "green" },
	svelte: { category: "code", tone: "orange" },
	astro: { category: "code", tone: "orange" },
	graphql: { category: "code", tone: "red", label: "GQL" },
	gql: { category: "code", tone: "red" },
	prisma: { category: "code", tone: "blue" },
	wasm: { category: "code", tone: "blue" },
	map: { category: "code", tone: "neutral" },
	kt: { category: "code", tone: "violet" },
	kts: { category: "code", tone: "violet" },
	swift: { category: "code", tone: "red" },
	dart: { category: "code", tone: "teal" },
	lua: { category: "code", tone: "blue" },
	r: { category: "code", tone: "blue" },
	scala: { category: "code", tone: "red" },
	ex: { category: "code", tone: "violet" },
	exs: { category: "code", tone: "violet" },
	hpp: { category: "code", tone: "blue" },
	cc: { category: "code", tone: "blue" },
	cu: { category: "code", tone: "green" },
	ps1: { category: "code", tone: "blue" },
	bat: { category: "code", tone: "green" },
	bash: { category: "code", tone: "green" },
	zsh: { category: "code", tone: "green" },
	gradle: { category: "code", tone: "teal" },
	ipynb: { category: "code", tone: "orange" },
	// Config and infrastructure
	env: { category: "code", tone: "neutral" },
	toml: { category: "code", tone: "neutral" },
	ini: { category: "code", tone: "neutral" },
	conf: { category: "code", tone: "neutral" },
	jsonc: { category: "code", tone: "neutral" },
	lock: { category: "code", tone: "neutral" },
	git: { category: "code", tone: "red" },
	ignore: { category: "code", tone: "neutral" },
	dockerfile: { category: "code", tone: "blue", label: "DOCK" },
	makefile: { category: "code", tone: "green", label: "MAKE" },
	tf: { category: "code", tone: "violet" },
	tfvars: { category: "code", tone: "violet" },
	hcl: { category: "code", tone: "violet" },
	proto: { category: "code", tone: "blue" },
	jsonl: { category: "code", tone: "neutral" },
	ndjson: { category: "code", tone: "neutral" },
	diff: { category: "code", tone: "neutral" },
	patch: { category: "code", tone: "neutral" },
	pem: { category: "code", tone: "neutral" },
	crt: { category: "code", tone: "neutral" },
	// Archives
	zip: { category: "archive", tone: "neutral" },
	rar: { category: "archive", tone: "neutral" },
	"7z": { category: "archive", tone: "neutral" },
	tar: { category: "archive", tone: "neutral" },
	gz: { category: "archive", tone: "neutral" },
	tgz: { category: "archive", tone: "neutral" },
	bz2: { category: "archive", tone: "neutral" },
	xz: { category: "archive", tone: "neutral" },
	zst: { category: "archive", tone: "neutral" },
	jar: { category: "archive", tone: "orange" },
	whl: { category: "archive", tone: "blue" },
	// Model weights, packed like an archive
	safetensors: { category: "archive", tone: "neutral", label: "SAFE" },
	gguf: { category: "archive", tone: "neutral" },
	onnx: { category: "archive", tone: "neutral" },
	pt: { category: "archive", tone: "red" },
	// Design
	fig: { category: "design", tone: "violet" },
	sketch: { category: "design", tone: "yellow" },
	psd: { category: "design", tone: "blue" },
	ai: { category: "design", tone: "orange" },
	eps: { category: "design", tone: "violet" },
	indd: { category: "design", tone: "red" },
	aep: { category: "design", tone: "violet" },
	xd: { category: "design", tone: "violet" },
	// Applications
	exe: { category: "executable", tone: "neutral" },
	msi: { category: "executable", tone: "neutral" },
	dmg: { category: "executable", tone: "neutral" },
	apk: { category: "executable", tone: "green" },
	deb: { category: "executable", tone: "red" },
	iso: { category: "executable", tone: "neutral" },
	app: { category: "executable", tone: "neutral" },
	pkg: { category: "executable", tone: "neutral" },
	ipa: { category: "executable", tone: "neutral" },
	aab: { category: "executable", tone: "green" },
	rpm: { category: "executable", tone: "red" },
	// Fonts
	ttf: { category: "font", tone: "neutral" },
	otf: { category: "font", tone: "neutral" },
	woff: { category: "font", tone: "neutral" },
	woff2: { category: "font", tone: "neutral" },
} satisfies Record<string, FileTypeExtension>;

type FileTypeExtensionName = keyof typeof FILE_TYPE_EXTENSIONS;

/** Every type the table knows. Any other string renders as a neutral file. */
type FileTypeName = FileTypeExtensionName | z.infer<typeof FileTypeFamilySchema>;

const extensions: Readonly<Record<string, FileTypeExtension>> = FILE_TYPE_EXTENSIONS;

function isExtensionName(key: string): key is FileTypeExtensionName {
	return Object.hasOwn(FILE_TYPE_EXTENSIONS, key);
}

/** Every extension the table knows. */
const FILE_TYPE_EXTENSION_NAMES: readonly FileTypeExtensionName[] = Object.keys(FILE_TYPE_EXTENSIONS).filter(isExtensionName);

function lookup<V>(record: Readonly<Record<string, V>>, key: string): V | undefined {
	return Object.hasOwn(record, key) ? record[key] : undefined;
}

/* -------------------------------------------------------------------------- */
/*                                 Resolution                                 */
/* -------------------------------------------------------------------------- */

interface ResolvedFileType {
	readonly type: string;
	readonly category: FileTypeCategory;
	/** The extension label, or undefined for a family or an empty file. */
	readonly label?: string;
	readonly tone: FileTypeTone;
}

const LEADING_DOTS = /^\.+/;

function resolveFileType(type?: string): ResolvedFileType {
	const key = (type ?? "").trim().toLowerCase().replace(LEADING_DOTS, "");
	if (key === "" || key === "empty") {
		return { type: "empty", category: "empty", tone: CATEGORY_TONES.empty };
	}
	const extension = lookup(extensions, key);
	if (extension !== undefined) {
		return { type: key, category: extension.category, label: extension.label ?? key.toUpperCase(), tone: extension.tone };
	}
	const family = FileTypeFamilySchema.safeParse(key);
	if (family.success) {
		return { type: key, category: family.data, tone: CATEGORY_TONES[family.data] };
	}
	return { type: key, category: "file", label: key.toUpperCase(), tone: CATEGORY_TONES.file };
}

/**
 * MIME types whose subtype does not name the extension. Anything else under
 * image/, video/, audio/ or font/ falls back to its family.
 */
const MIME_TYPES: Readonly<Record<string, FileTypeName>> = {
	"application/pdf": "pdf",
	"application/msword": "doc",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
	"application/vnd.oasis.opendocument.text": "odt",
	"application/rtf": "rtf",
	"application/vnd.ms-excel": "xls",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
	"application/vnd.oasis.opendocument.spreadsheet": "ods",
	"application/vnd.ms-powerpoint": "ppt",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
	"application/vnd.oasis.opendocument.presentation": "odp",
	"application/vnd.ms-excel.sheet.macroenabled.12": "xlsm",
	"application/vnd.apple.keynote": "key",
	"application/zip": "zip",
	"application/x-zip-compressed": "zip",
	"application/vnd.rar": "rar",
	"application/x-rar-compressed": "rar",
	"application/x-7z-compressed": "7z",
	"application/x-tar": "tar",
	"application/gzip": "gz",
	"application/x-gzip": "gz",
	"application/x-bzip2": "bz2",
	"application/json": "json",
	"application/xml": "xml",
	"application/yaml": "yaml",
	"application/x-yaml": "yaml",
	"application/rss+xml": "rss",
	"application/javascript": "js",
	"application/x-httpd-php": "php",
	"application/x-sh": "sh",
	"application/x-msdownload": "exe",
	"application/x-msi": "msi",
	"application/vnd.android.package-archive": "apk",
	"application/vnd.debian.binary-package": "deb",
	"application/x-apple-diskimage": "dmg",
	"application/x-iso9660-image": "iso",
	"application/x-font-ttf": "ttf",
	"application/font-woff": "woff",
	"application/postscript": "eps",
	"application/vnd.adobe.photoshop": "psd",
	"image/vnd.adobe.photoshop": "psd",
	"image/jpeg": "jpg",
	"image/svg+xml": "svg",
	"image/x-icon": "ico",
	"image/vnd.microsoft.icon": "ico",
	"video/quicktime": "mov",
	"video/x-msvideo": "avi",
	"video/x-matroska": "mkv",
	"audio/mpeg": "mp3",
	"audio/wav": "wav",
	"audio/x-wav": "wav",
	"audio/mp4": "m4a",
	"audio/x-m4a": "m4a",
	"audio/x-flac": "flac",
	"audio/x-aiff": "aiff",
	"video/x-ms-wmv": "wmv",
	"text/plain": "txt",
	"text/markdown": "md",
	"text/x-markdown": "md",
	"text/x-python": "py",
	"text/x-c": "c",
	"text/yaml": "yaml",
	"text/csv": "csv",
	"text/tab-separated-values": "tsv",
	"text/html": "html",
	"text/css": "css",
	"text/javascript": "js",
	"text/xml": "xml",
	"application/node": "cjs",
	"application/java-archive": "jar",
	"application/x-ipynb+json": "ipynb",
	"application/x-ndjson": "ndjson",
	"application/vnd.sqlite3": "sqlite",
	"application/x-sqlite3": "sqlite",
	"application/vnd.apple.mpegurl": "m3u8",
	"application/x-mpegurl": "m3u8",
	"application/x-subrip": "srt",
	"message/rfc822": "eml",
	"application/x-rpm": "rpm",
	"application/x-pem-file": "pem",
	"application/x-x509-ca-cert": "crt",
	"application/pkix-cert": "crt",
	"application/zstd": "zst",
	"application/x-xz": "xz",
	"text/x-c++src": "cpp",
	"text/x-c++hdr": "hpp",
	"text/x-kotlin": "kt",
	"text/x-swift": "swift",
	"text/x-rsrc": "r",
	"text/x-lua": "lua",
	"text/x-scala": "scala",
	"text/x-diff": "diff",
	"text/x-patch": "patch",
	"text/x-makefile": "makefile",
};

/**
 * Names that carry their type with no extension of their own, or with one
 * that names something else ("go.mod" is not a tracker module).
 */
const FILE_NAMES: Readonly<Record<string, FileTypeName>> = {
	containerfile: "dockerfile",
	gnumakefile: "makefile",
	".dev.vars": "env",
	".gitignore": "git",
	".gitattributes": "git",
	".gitmodules": "git",
	".gitkeep": "git",
	".gitconfig": "git",
	".git-blame-ignore-revs": "git",
	".mailmap": "git",
	"bun.lockb": "lock",
	"go.sum": "lock",
	"go.mod": "go",
	"go.work": "go",
	gemfile: "rb",
	rakefile: "rb",
	brewfile: "rb",
	podfile: "rb",
	vagrantfile: "rb",
	fastfile: "rb",
	".bashrc": "bash",
	".bash_profile": "bash",
	".bash_aliases": "bash",
	".bash_logout": "bash",
	".zshrc": "zsh",
	".zprofile": "zsh",
	".zshenv": "zsh",
	".zlogin": "zsh",
	".envrc": "sh",
	".profile": "sh",
	".editorconfig": "ini",
	".npmrc": "ini",
	".pypirc": "ini",
	".flake8": "ini",
	".pylintrc": "ini",
	".coveragerc": "ini",
	caddyfile: "conf",
	".htaccess": "conf",
	".babelrc": "json",
	".swcrc": "json",
	".cursorrules": "md",
	readme: "txt",
	license: "txt",
	licence: "txt",
	changelog: "txt",
	codeowners: "txt",
	".nvmrc": "txt",
	".node-version": "txt",
	".python-version": "txt",
	".ruby-version": "txt",
	".tool-versions": "txt",
	".terraform-version": "txt",
};

/** Other extensions of a known type. */
const EXTENSION_ALIASES: Readonly<Record<string, FileTypeName>> = {
	cer: "crt",
	mak: "makefile",
	mk: "makefile",
	sqlite3: "sqlite",
};

/**
 * Name families, read only when the name does not end in a known extension:
 * ".env.local" is an env file and "Dockerfile.dev" a Dockerfile, while
 * "Dockerfile.md" is Markdown.
 */
const NAME_PATTERNS: readonly (readonly [pattern: RegExp, type: FileTypeName])[] = [
	[/^\.env\./, "env"],
	[/^(docker|container)file\./, "dockerfile"],
	[/^\.[\w-]+ignore$/, "ignore"],
];

const MIME_FAMILIES: Readonly<Record<string, FileTypeName>> = {
	image: "image",
	video: "video",
	audio: "audio",
	font: "font",
	text: "txt",
};

const MIME_PATTERN = /^(application|audio|font|image|message|model|multipart|text|video)\/[\w.+-]+$/;
const URL_ORIGIN = /^[a-z][\w+.-]*:\/\/[^/]*/;
const QUERY_OR_HASH = /[?#]/;
const PATH_SEPARATOR = /[\\/]/;
/**
 * A value ending in an extension or a slash carries no query or hash. An
 * extension has a letter, so "?v=1.2" is still a query.
 */
const NAME_END = /(\.\d*[a-z][a-z\d]*|[\\/])$/;

function stripQuery(input: string): string {
	const [path = ""] = input.split(QUERY_OR_HASH);
	return path;
}

function resolveMimeType(mime: string): string {
	const mapped = lookup(MIME_TYPES, mime);
	if (mapped !== undefined) {
		return mapped;
	}
	const [family = "", subtype = ""] = mime.split("/");
	// A known extension after a dot makes it a storage key ("image/a.png").
	const tail = subtype.slice(subtype.lastIndexOf(".") + 1);
	if (subtype.includes(".") && lookup(extensions, tail) !== undefined) {
		return tail;
	}
	// A media subtype counts only inside its own family: audio/webm is audio.
	const subtypeExtension = lookup(extensions, subtype);
	if (subtypeExtension !== undefined && (family === "application" || family === "text" || subtypeExtension.category === family)) {
		return subtype;
	}
	return lookup(MIME_FAMILIES, family) ?? "empty";
}

/**
 * Resolves a file name, path, URL, bare extension or MIME type to a `type`.
 * A path ending in a slash is a folder; a well-known name resolves to its
 * type (Dockerfile, .env.local, go.mod, LICENSE); any other name without an
 * extension is an empty file; an unknown extension is returned as is and
 * renders neutral.
 */
function getFileType(value: string): string {
	let input = value.trim().toLowerCase();

	// A URL is read by its path, so a bare host is not a ".com" file. A "?" or
	// "#" can be part of a plain name ("invoice #12.pdf"), so outside a URL it
	// starts a query only when the value does not already end like a name.
	if (URL_ORIGIN.test(input)) {
		input = stripQuery(input).replace(URL_ORIGIN, "");
		if (input === "/") {
			return "empty";
		}
	} else if (!NAME_END.test(input)) {
		input = stripQuery(input);
	}
	if (input === "") {
		return "empty";
	}
	if (input.endsWith("/") || input.endsWith("\\")) {
		return "folder";
	}

	const [mimeHead = ""] = input.split(";");
	const mime = mimeHead.trim();
	if (MIME_PATTERN.test(mime)) {
		return resolveMimeType(mime);
	}

	const name = input.split(PATH_SEPARATOR).pop() ?? "";
	const named = lookup(FILE_NAMES, name);
	if (named !== undefined) {
		return named;
	}
	const dot = name.lastIndexOf(".");
	const extension = name.slice(dot + 1);
	const alias = lookup(EXTENSION_ALIASES, extension);
	if (alias !== undefined) {
		return alias;
	}
	if (lookup(extensions, extension) === undefined) {
		const match = NAME_PATTERNS.find(([pattern]) => pattern.test(name));
		if (match !== undefined) {
			const [, type] = match;
			return type;
		}
	}
	// No dot, or only a leading one: a bare extension or family ("pdf",
	// ".pdf", "image") resolves, anything else ("notes", ".hidden") has no type.
	if (dot <= 0) {
		return resolveFileType(extension).category === "file" ? "empty" : extension;
	}
	return extension === "" ? "empty" : extension;
}

/** The family of any `type`, for grouping or filtering a file list. */
function getFileTypeCategory(type?: string): FileTypeCategory {
	return resolveFileType(type).category;
}

/* -------------------------------------------------------------------------- */
/*                                   Glyphs                                   */
/* -------------------------------------------------------------------------- */

/*
 * Every glyph is drawn in the 24-unit page grid inside one box, x 7 to 17 and
 * y 10 to 20, so it sits under the fold at the same optical weight, and is
 * shown at 75% of it (full size up to 20px, where every pixel counts).
 * Parallel strokes are at least 3 units apart: the stroke stays 1px at every
 * size, and closer lines merge at `mini` (18px, where a unit is 0.75px).
 */
const STROKE: { readonly vectorEffect: "non-scaling-stroke" } = { vectorEffect: "non-scaling-stroke" };

const GLYPHS: Partial<Record<FileTypeCategory, React.ReactNode>> = {
	document: <path {...STROKE} d="M8 12h8M8 15h5.5M8 18h7" />,
	spreadsheet: (
		<>
			<rect {...STROKE} x="7.5" y="11" width="9" height="8" rx="1" />
			<path {...STROKE} d="M7.5 14.5h9M11 11v8" />
		</>
	),
	presentation: (
		<>
			<rect {...STROKE} x="7" y="11" width="10" height="5.5" rx="1" />
			<path {...STROKE} d="m9.5 19.5 2.5-3 2.5 3" />
		</>
	),
	image: (
		<>
			<path {...STROKE} d="m7 19.5 3.5-5.5 2.75 3.75 1.25-1.75 2.5 3.5Z" />
			<circle {...STROKE} cx="14.25" cy="12" r="1.25" />
		</>
	),
	video: <path {...STROKE} d="M9.5 11v8l7-4Z" />,
	audio: (
		<>
			<path {...STROKE} d="M12.5 18v-7l3 1.5" />
			<circle {...STROKE} cx="10.75" cy="18" r="1.75" />
		</>
	),
	code: <path {...STROKE} d="m10 12-3 3 3 3m4-6 3 3-3 3" />,
	archive: (
		<>
			<rect {...STROKE} x="7" y="11" width="10" height="3" rx="0.75" />
			<path {...STROKE} d="M8 14v4.5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V14M11 16.5h2" />
		</>
	),
	design: (
		<>
			<circle {...STROKE} cx="10.5" cy="13" r="2.5" />
			<rect {...STROKE} x="12" y="14.5" width="5" height="5" rx="1" />
		</>
	),
	executable: (
		<>
			<rect {...STROKE} x="7.5" y="10.75" width="3.5" height="3.5" rx="0.75" />
			<rect {...STROKE} x="13" y="10.75" width="3.5" height="3.5" rx="0.75" />
			<rect {...STROKE} x="7.5" y="16.25" width="3.5" height="3.5" rx="0.75" />
			<rect {...STROKE} x="13" y="16.25" width="3.5" height="3.5" rx="0.75" />
		</>
	),
	font: <path {...STROKE} d="M8.5 12.5V11h7v1.5M12 11v8m-1.5 0h3" />,
	folder: <path {...STROKE} d="M7 12a1 1 0 0 1 1-1h2.25a1 1 0 0 1 .8.4l.9 1.1H16a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1Z" />,
};

/* -------------------------------------------------------------------------- */
/*                                  Variants                                  */
/* -------------------------------------------------------------------------- */

/** The page: 16 by 20 units with 2-unit corners and a rounded 6-unit fold. */
const PAGE_PATH = "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7.586a2 2 0 0 1 1.414.586l4.414 4.414A2 2 0 0 1 20 8.414V20a2 2 0 0 1-2 2Z";
const FOLD_PATH = "M14 2v5a1 1 0 0 0 1 1h5";
/** The folded corner, traced along the page edge so it never leaves the page. */
const FLAP_PATH = "M13.586 2a2 2 0 0 1 1.414.586l4.414 4.414A2 2 0 0 1 20 8.414V8h-5a1 1 0 0 1-1-1V2Z";

/**
 * Each tone colours the page through `currentColor`, and sets the text drawn on
 * that colour (the label, the solid glyph) to the tone's soft fill: the pair
 * the token tests hold to AA in both themes.
 */
const TONE_CLASS: Readonly<Record<FileTypeTone, string>> = {
	neutral: "text-muted-foreground [--file-type-foreground:var(--background)]",
	blue: "text-tone-blue [--file-type-foreground:var(--tone-blue-soft)]",
	green: "text-tone-green [--file-type-foreground:var(--tone-green-soft)]",
	yellow: "text-tone-yellow [--file-type-foreground:var(--tone-yellow-soft)]",
	red: "text-tone-red [--file-type-foreground:var(--tone-red-soft)]",
	orange: "text-tone-orange [--file-type-foreground:var(--tone-orange-soft)]",
	teal: "text-tone-teal [--file-type-foreground:var(--tone-teal-soft)]",
	violet: "text-tone-violet [--file-type-foreground:var(--tone-violet-soft)]",
};

/**
 * CSS variable architecture, all read from the root:
 *
 *   --file-type-size        box width and height, set by `size`
 *   --file-type-stroke      line width; unset, 1px up to 40px, then proportional
 *   --file-type-border      page outline in outline, light and mono; unset, 40%
 *                           muted-foreground, 65% up to 20px
 *   --file-type-fill        solid page; unset, the type colour
 *   --file-type-glyph       glyph, custom icon and label in solid; unset, the
 *                           foreground
 *   --file-type-foreground  label text, and the glyph in solid
 *   --file-type-radius      label corners; unset, 10cqw
 *
 * The root is an inline-size container and everything inside is measured in
 * `cqw` against it, so a plain Tailwind size class (`size-20`, `size-full`)
 * resizes the label and stroke with the box, not just the box. The type colour
 * is the root's text colour, so one `text-*` class recolours a type.
 */
const fileTypeVariants = cva("@container relative inline-block size-(--file-type-size) shrink-0 align-middle leading-none select-none", {
	variants: {
		size: {
			mini: "[--file-type-size:--spacing(4.5)]",
			xs: "[--file-type-size:--spacing(6)]",
			sm: "[--file-type-size:--spacing(8)]",
			default: "[--file-type-size:--spacing(10)]",
			lg: "[--file-type-size:--spacing(12)]",
			xl: "[--file-type-size:--spacing(14)]",
		},
	},
	defaultVariants: {
		size: "default",
	},
});

type FileTypeVariant = "outline" | "solid" | "light" | "mono";

type FileTypeSize = NonNullable<VariantProps<typeof fileTypeVariants>["size"]>;

const PAGE_CLASS: Readonly<Record<FileTypeVariant, string>> = {
	outline: "fill-transparent stroke-(color:--file-type-outline)",
	light: "fill-muted stroke-(color:--file-type-outline)",
	solid: "fill-[var(--file-type-fill,currentColor)] stroke-[var(--file-type-fill,currentColor)]",
	mono: "fill-transparent stroke-(color:--file-type-outline)",
};

const FOLD_CLASS: Readonly<Record<FileTypeVariant, string>> = {
	outline: "stroke-(color:--file-type-outline)",
	light: "stroke-(color:--file-type-outline)",
	solid: "[stroke:color-mix(in_oklab,var(--file-type-foreground)_45%,transparent)]",
	mono: "stroke-(color:--file-type-outline)",
};

/** Solid paints the glyph in the foreground; the others in the type colour, which the tone tokens already lift in dark mode. */
const GLYPH_CLASS: Readonly<Record<FileTypeVariant, string>> = {
	outline: "",
	light: "",
	solid: "text-[color:var(--file-type-glyph,var(--file-type-foreground))]",
	mono: "",
};

const LABEL_TEXT_CLASS: Readonly<Record<FileTypeVariant, string>> = {
	outline: "text-(color:--file-type-foreground)",
	light: "text-(color:--file-type-foreground)",
	solid: "max-w-[calc(200cqw/3)] text-[color:var(--file-type-glyph,var(--file-type-foreground))]",
	mono: "text-(color:--file-type-foreground)",
};

/**
 * The label overhangs the page's left edge, so it is a band in front of the
 * sheet. Solid has no band: the text sits on the filled page in the glyph's
 * colour, across the page's width. Every label up to 4 characters takes one
 * size, so a row of mixed types reads even; a longer one shrinks to fit.
 */
const LABEL_CLASS: Readonly<Record<FileTypeVariant, string>> = {
	outline: "bg-current",
	light: "bg-current",
	solid:
		"left-1/6 w-2/3 px-[3cqw] text-[length:min(20.5cqw,calc(65.6cqw/(var(--file-type-chars)*0.8)))] @max-[21px]:px-0 @max-[21px]:text-[length:min(32.5cqw,5.8px,calc(66cqw/(var(--file-type-chars)*0.9)))]",
	mono: "bg-current",
};

/** The character count the label fit assumes for a non-string label. */
const DEFAULT_LABEL_CHARS = 4;

type FileTypeLabelStyle = React.CSSProperties & Record<`--${string}`, number>;

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */

interface FileTypeProps extends Omit<React.ComponentProps<"span">, "children"> {
	/**
	 * An extension (`"pdf"`, `".docx"`), a family (`"image"`, `"folder"`) or
	 * `"empty"`. Unknown extensions render as a neutral file with their label.
	 * Use `getFileType` to resolve a file name or MIME type.
	 */
	readonly type?: string | undefined;
	/** `mono` draws every type in the theme's muted grey instead of its own tone. */
	readonly variant?: FileTypeVariant | undefined;
	/** A preset box size. A Tailwind `size-*` class in `className` overrides it. */
	readonly size?: FileTypeSize | undefined;
	/** Replaces the extension label, for a version tag or a document code. `null` or `""` hides it. */
	readonly label?: React.ReactNode;
	/** Shows the family glyph instead of the label. A family `type` or a type with no label shows its glyph anyway. */
	readonly glyph?: boolean | undefined;
	/** A custom icon drawn on the page in place of the glyph and the label, in the glyph's colour. */
	readonly icon?: React.ReactNode;
	/** Classes for the label badge, merged last. The text is a child of the badge: recolour it with `*:text-*`. */
	readonly labelClassName?: string | undefined;
	/** Per-usage overrides of the `fileType` copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"fileType"> | undefined;
}

function hasContent(node: React.ReactNode): boolean {
	return node !== undefined && node !== null && node !== false && node !== "";
}

/** A file-type icon: a page in the type's tone with its extension label or family glyph. Exposed as an image named after the type. */
const FileType = React.forwardRef<HTMLSpanElement, FileTypeProps>(function FileType(
	{ type, variant = "outline", size = "default", label, glyph = false, icon, labelClassName, labels: labelsOverride, className, ...props },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("fileType", labelsOverride);
	const resolved = resolveFileType(type);
	// `null` hides the label like "", where `??` would fall back to it.
	const text = label === undefined ? resolved.label : label;
	const hasText = hasContent(text);
	// The name spells out a key its label shortens (DOCKERFILE, not DOCK).
	const spelled = resolved.label === undefined ? undefined : resolved.type.toUpperCase();
	const typeName = spelled === undefined ? labels.categories[resolved.category] : labels.typeFile(spelled);
	// A custom string label is part of what the icon says ("V3, DOCX file").
	const custom = isStringPrimitive(label) ? label : "";
	const customUpper = custom.toUpperCase();
	const name = custom !== "" && customUpper !== resolved.label && customUpper !== spelled ? labels.labelledType(custom, typeName) : typeName;
	const hasIcon = hasContent(icon);
	const showLabel = hasText && !glyph && !hasIcon;
	const glyphNode = showLabel || hasIcon ? null : GLYPHS[resolved.category];
	const labelStyle = React.useMemo((): FileTypeLabelStyle => ({ "--file-type-chars": isStringPrimitive(text) ? text.length : DEFAULT_LABEL_CHARS }), [text]);

	return (
		<span
			ref={ref}
			role="img"
			aria-label={name}
			data-slot="file-type"
			data-type={resolved.type}
			data-category={resolved.category}
			data-tone={variant === "mono" ? "neutral" : resolved.tone}
			data-variant={variant}
			data-size={size}
			className={cn(fileTypeVariants({ size }), TONE_CLASS[variant === "mono" ? "neutral" : resolved.tone], className)}
			{...props}>
			<svg
				data-slot="file-type-icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
				focusable="false"
				className="absolute inset-0 size-full overflow-visible [stroke-width:var(--file-type-stroke,max(1px,2.5cqw))] [--file-type-outline:var(--file-type-border,color-mix(in_oklab,var(--muted-foreground)_40%,transparent))] @max-[21px]:[--file-type-outline:var(--file-type-border,color-mix(in_oklab,var(--muted-foreground)_65%,transparent))]">
				<path {...STROKE} d={PAGE_PATH} className={PAGE_CLASS[variant]} />
				{variant === "solid" ? <path d={FLAP_PATH} className="[fill:color-mix(in_oklab,var(--file-type-foreground)_30%,transparent)] stroke-none" /> : null}
				<path {...STROKE} d={FOLD_PATH} className={FOLD_CLASS[variant]} />
				{glyphNode === null || glyphNode === undefined ? null : (
					<g data-slot="file-type-glyph" stroke="currentColor" className={cn("origin-[12px_15px] scale-75 @max-[21px]:scale-100", GLYPH_CLASS[variant])}>
						{glyphNode}
					</g>
				)}
			</svg>
			{hasIcon ? (
				<span
					data-slot="file-type-custom-icon"
					aria-hidden="true"
					className={cn(
						"absolute top-[62.5%] left-1/2 flex size-[37.5cqw] -translate-1/2 items-center justify-center @max-[21px]:size-[50cqw] [&>svg]:size-full",
						GLYPH_CLASS[variant],
					)}>
					{icon}
				</span>
			) : null}
			{showLabel ? (
				<span
					data-slot="file-type-label"
					style={labelStyle}
					className={cn(
						"absolute top-(--file-type-label-y) left-[5%] flex h-(--file-type-label-h) max-w-[95%] items-center justify-center overflow-hidden rounded-[var(--file-type-radius,var(--file-type-label-radius,10cqw))] px-[var(--file-type-label-px,7cqw)] font-medium whitespace-nowrap",
						"text-[length:min(24cqw,calc((95cqw-2*var(--file-type-label-px,7cqw))/(var(--file-type-chars)*0.72)))] [--file-type-label-h:35%] [--file-type-label-y:45%]",
						"supports-[margin:round(1cap,1px)]:mt-[calc(round(nearest,calc(var(--file-type-label-y)+(var(--file-type-label-h)+1cap)/2),1px)-var(--file-type-label-y)-(var(--file-type-label-h)+1cap)/2)]",
						"@max-[21px]:px-[4cqw] @max-[21px]:text-[length:min(32.5cqw,5.8px,calc(87cqw/(var(--file-type-chars)*0.88)))] @max-[21px]:font-semibold @max-[21px]:[--file-type-label-h:45%] @max-[21px]:[--file-type-label-y:40%]",
						"[--file-type-label-px:7cqw] [--file-type-label-radius:10cqw]",
						LABEL_CLASS[variant],
						labelClassName,
					)}>
					<span
						className={cn(
							"max-w-[min(95cqw,calc(100%+2*max(0px,var(--file-type-label-px,7cqw)-7cqw)))] shrink-0 truncate py-[0.25em] [text-box:trim-both_cap_alphabetic] @max-[21px]:max-w-full",
							LABEL_TEXT_CLASS[variant],
						)}>
						{text}
					</span>
				</span>
			) : null}
		</span>
	);
});

export {
	FILE_TYPE_CATEGORIES,
	FILE_TYPE_EXTENSION_NAMES,
	FileType,
	fileTypeVariants,
	getFileType,
	getFileTypeCategory,
	type FileTypeCategory,
	type FileTypeName,
	type FileTypeProps,
	type FileTypeSize,
	type FileTypeTone,
	type FileTypeVariant,
};
