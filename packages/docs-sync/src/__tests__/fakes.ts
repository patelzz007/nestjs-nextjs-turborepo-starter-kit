import type { SourceAsset, SourceBody, SourceDocumentMeta } from "@workspace/docs-content/document";

import type { ContentStore } from "../content-store.ts";
import type { DocsSource, DownloadedAsset } from "../source.ts";
import type { SyncOptions } from "../run-sync.ts";

/** The repository in memory. */
export class MemoryStore implements ContentStore {
	public readonly files = new Map<string, string | Uint8Array>();
	public writes = 0;

	public constructor(initial: Readonly<Record<string, string>> = {}) {
		for (const [file, content] of Object.entries(initial)) {
			this.files.set(file, content);
		}
	}

	public read(file: string): Promise<string | null> {
		const content = this.files.get(file);
		return Promise.resolve(content === undefined ? null : Buffer.from(content).toString("utf8"));
	}

	public write(file: string, content: string | Uint8Array): Promise<void> {
		this.writes += 1;
		this.files.set(file, content);
		return Promise.resolve();
	}

	public remove(file: string): Promise<void> {
		this.files.delete(file);
		return Promise.resolve();
	}

	public list(folder: string): Promise<readonly string[]> {
		return Promise.resolve([...this.files.keys()].filter((file) => file.startsWith(`${folder}/`)).sort());
	}

	public text(file: string): string {
		return Buffer.from(this.files.get(file) ?? "").toString("utf8");
	}
}

export function guide(overrides: Partial<SourceDocumentMeta> = {}): SourceDocumentMeta {
	return {
		sourceId: "page-a",
		sourceUrl: "https://tool.example/page-a",
		collection: "docs",
		title: "Page A",
		slug: "guides/page-a",
		description: "About page A.",
		section: "Guides",
		order: 1,
		author: "Ada",
		tags: [],
		category: "Engineering",
		publishedAt: 900,
		lastUpdated: 950,
		editedAt: 1000,
		cover: { kind: "external", url: "https://images.example/cover.jpg" },
		issues: [],
		...overrides,
	};
}

export function body(markdown: string, overrides: Partial<SourceBody> = {}): SourceBody {
	return { markdown, assets: [], links: [], issues: [], ...overrides };
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

/** A second implementation of the port: what proves the engine depends on nothing Notion-specific. */
export class FakeSource implements DocsSource {
	public readonly kind = "NOTION";
	public converterVersion = 1;
	public documents: SourceDocumentMeta[] = [];
	public readonly bodies = new Map<string, SourceBody>();
	public readonly unreadable = new Set<string>();
	public readonly brokenAssets = new Set<string>();
	public reads: string[] = [];
	public listError: Error | null = null;

	public add(meta: SourceDocumentMeta, content: SourceBody = body(`Body of ${meta.title}.`)): void {
		this.documents = [...this.documents.filter((document) => document.sourceId !== meta.sourceId), meta];
		this.bodies.set(meta.sourceId, content);
	}

	public remove(sourceId: string): void {
		this.documents = this.documents.filter((document) => document.sourceId !== sourceId);
	}

	public list(): Promise<readonly SourceDocumentMeta[]> {
		return this.listError === null ? Promise.resolve(this.documents) : Promise.reject(this.listError);
	}

	public read(meta: SourceDocumentMeta): Promise<SourceBody> {
		this.reads.push(meta.sourceId);
		if (this.unreadable.has(meta.sourceId)) {
			return Promise.reject(new Error("timed out"));
		}
		return Promise.resolve(this.bodies.get(meta.sourceId) ?? body(""));
	}

	public fetchAsset(asset: SourceAsset): Promise<DownloadedAsset> {
		if (this.brokenAssets.has(asset.assetKey)) {
			return Promise.reject(new Error("The file's host answered 404"));
		}
		return Promise.resolve({ bytes: PNG_BYTES, extension: "png" });
	}
}

export const OPTIONS: SyncOptions = { runId: "run-1", trigger: "MANUAL", full: false, adopt: false, defaultAuthor: "Platform Team", now: () => 5000 };
