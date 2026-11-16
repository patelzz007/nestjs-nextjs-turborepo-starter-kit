// What a file is, from its extension, name or MIME type: the family (document, image, archive…), the
// colour tone it takes and the short label printed on its icon. The rules match ReUI's FileType
// (`getFileType`, `getFileTypeCategory`), so its docs apply. Framework-free: the web's and the phone's
// FileType icons both draw from it.

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

/** The families that can be passed as a `type` on their own, glyph only. */
export const FileTypeFamilySchema = z.enum([
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
export const FILE_TYPE_CATEGORIES = FileTypeFamilySchema.options;

/** The family a type belongs to. It picks the glyph and the default colour; `file` is any unknown type. */
export type FileTypeCategory = z.infer<typeof FileTypeFamilySchema> | "file";

/** A categorical tone token (`--tone-*`), or the muted neutral. */
export type FileTypeTone = "neutral" | "blue" | "green" | "yellow" | "red" | "orange" | "teal" | "violet";

export interface FileTypeExtension {
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
export const FILE_TYPE_CATEGORY_TONES: Readonly<Record<FileTypeCategory, FileTypeTone>> = {
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
export const FILE_TYPE_EXTENSIONS = {
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

export type FileTypeExtensionName = keyof typeof FILE_TYPE_EXTENSIONS;

/** Every type the table knows. Any other string renders as a neutral file. */
export type FileTypeName = FileTypeExtensionName | z.infer<typeof FileTypeFamilySchema>;

const extensions: Readonly<Record<string, FileTypeExtension>> = FILE_TYPE_EXTENSIONS;

function isExtensionName(key: string): key is FileTypeExtensionName {
	return Object.hasOwn(FILE_TYPE_EXTENSIONS, key);
}

/** Every extension the table knows. */
export const FILE_TYPE_EXTENSION_NAMES: readonly FileTypeExtensionName[] = Object.keys(FILE_TYPE_EXTENSIONS).filter(isExtensionName);

function lookup<V>(record: Readonly<Record<string, V>>, key: string): V | undefined {
	return Object.hasOwn(record, key) ? record[key] : undefined;
}

/* -------------------------------------------------------------------------- */
/*                                 Resolution                                 */
/* -------------------------------------------------------------------------- */

export interface ResolvedFileType {
	readonly type: string;
	readonly category: FileTypeCategory;
	/** The extension label, or undefined for a family or an empty file. */
	readonly label?: string;
	readonly tone: FileTypeTone;
}

const LEADING_DOTS = /^\.+/;

export function resolveFileType(type?: string): ResolvedFileType {
	const key = (type ?? "").trim().toLowerCase().replace(LEADING_DOTS, "");
	if (key === "" || key === "empty") {
		return { type: "empty", category: "empty", tone: FILE_TYPE_CATEGORY_TONES.empty };
	}
	const extension = lookup(extensions, key);
	if (extension !== undefined) {
		return { type: key, category: extension.category, label: extension.label ?? key.toUpperCase(), tone: extension.tone };
	}
	const family = FileTypeFamilySchema.safeParse(key);
	if (family.success) {
		return { type: key, category: family.data, tone: FILE_TYPE_CATEGORY_TONES[family.data] };
	}
	return { type: key, category: "file", label: key.toUpperCase(), tone: FILE_TYPE_CATEGORY_TONES.file };
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
const FILE_NAMES = {
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
} satisfies Readonly<Record<string, FileTypeName>>;

/** Other extensions of a known type. */
const EXTENSION_ALIASES = {
	cer: "crt",
	mak: "makefile",
	mk: "makefile",
	sqlite3: "sqlite",
} satisfies Readonly<Record<string, FileTypeName>>;

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

const MIME_FAMILIES = {
	image: "image",
	video: "video",
	audio: "audio",
	font: "font",
	text: "txt",
} satisfies Readonly<Record<string, FileTypeName>>;

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
export function getFileType(value: string): string {
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
export function getFileTypeCategory(type?: string): FileTypeCategory {
	return resolveFileType(type).category;
}
