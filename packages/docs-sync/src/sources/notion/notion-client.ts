import type { z } from "zod";

import type { HttpFetch } from "../../locked-download.ts";
import {
	BlockListSchema,
	DataSourceQuerySchema,
	NOTION_API_VERSION,
	NotionErrorSchema,
	REQUEST_INCOMPLETE,
	type NotionBlock,
	type NotionBlockTree,
	type NotionPage,
} from "./notion-schemas.ts";

/**
 * Notion's HTTP API: pagination at every level, its rate limit, and retries. Requests run one at a time at most
 * `MIN_REQUEST_INTERVAL_MS` apart, which keeps to Notion's lowest documented limit (about 3 a second).
 */

const API_BASE_URL = "https://api.notion.com/v1";
export const MIN_REQUEST_INTERVAL_MS = 350;
export const REQUEST_TIMEOUT_MS = 30_000;
export const MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 500;
const MS_PER_SECOND = 1000;
const PAGE_SIZE = 100;
/** Notion nests only a few levels in practice; a deeper tree means a loop, not a document. */
const MAX_BLOCK_DEPTH = 20;

/** `rate_limited` is 429; 529 is `service_overload`; the rest are transient server failures. */
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504, 529]);

/** Block types whose children are their own documents, or are never read. */
const LEAF_BLOCK_TYPES: ReadonlySet<string> = new Set(["child_page", "child_database"]);

/** A request Notion refused or kept failing. The message never carries the token. */
export class NotionRequestError extends Error {
	public readonly status: number;

	public constructor(status: number, detail: string) {
		super(`Notion answered ${String(status)}: ${detail}`);
		this.name = "NotionRequestError";
		this.status = status;
	}
}

export interface NotionClientEnvironment {
	readonly fetch: HttpFetch;
	readonly sleep: (ms: number) => Promise<void>;
	readonly now: () => number;
	/** 0 to 1, for back-off jitter. */
	readonly random: () => number;
}

export const LIVE_NOTION_ENVIRONMENT: NotionClientEnvironment = {
	fetch: (input, init) => globalThis.fetch(input, init),
	sleep: (ms: number): Promise<void> =>
		new Promise((resolve) => {
			setTimeout(resolve, ms);
		}),
	now: () => Date.now(),
	random: () => Math.random(),
};

type JsonBody = Readonly<Record<string, string | number | boolean | object | null>>;

interface NotionRequest {
	readonly method: "GET" | "POST" | "PATCH";
	readonly path: string;
	readonly body?: JsonBody;
}

export class NotionClient {
	private readonly _token: string;
	private readonly _environment: NotionClientEnvironment;
	private _lastRequestAt = 0;

	public constructor(token: string, environment: NotionClientEnvironment) {
		this._token = token;
		this._environment = environment;
	}

	/** One validated response, retried while Notion asks to wait. */
	public async request<TSchema extends z.ZodType>(request: NotionRequest, schema: TSchema): Promise<z.output<TSchema>> {
		for (let attempt = 1; ; attempt += 1) {
			await this.waitForTurn();
			const response = await this.send(request);
			if (response.ok) {
				return schema.parse(await response.json());
			}
			if (!RETRYABLE_STATUSES.has(response.status) || attempt >= MAX_ATTEMPTS) {
				throw new NotionRequestError(response.status, await this.detailOf(response));
			}
			await this._environment.sleep(this.backoffMs(response, attempt));
		}
	}

	/** Sends a multipart form (a file upload). Fetch sets the boundary, so no content type is given here. */
	public async sendForm(path: string, form: FormData): Promise<void> {
		await this.waitForTurn();
		const response = await this._environment.fetch(`${API_BASE_URL}${path}`, {
			method: "POST",
			headers: { Authorization: `Bearer ${this._token}`, "Notion-Version": NOTION_API_VERSION },
			body: form,
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!response.ok) {
			throw new NotionRequestError(response.status, await this.detailOf(response));
		}
	}

	/** Every page in one data source that matches `filter` (all of them when it is null). Throws rather than return a list Notion cut short. */
	public async queryAll(dataSourceId: string, filter: object | null): Promise<readonly NotionPage[]> {
		const pages: NotionPage[] = [];
		let cursor: string | null = null;
		do {
			const body: JsonBody = { ...(filter === null ? {} : { filter }), page_size: PAGE_SIZE, ...(cursor === null ? {} : { start_cursor: cursor }) };
			const result: z.output<typeof DataSourceQuerySchema> = await this.request({ method: "POST", path: `/data_sources/${dataSourceId}/query`, body }, DataSourceQuerySchema);
			if (result.request_status?.type === REQUEST_INCOMPLETE) {
				throw new NotionRequestError(0, `the query for ${dataSourceId} was cut short at Notion's result cap`);
			}
			pages.push(...result.results.flatMap((item): NotionPage[] => (item.object === "page" ? [item] : [])));
			cursor = result.has_more ? result.next_cursor : null;
		} while (cursor !== null);
		return pages;
	}

	/** A block's children, recursively, following pagination at every level. */
	public async blockTree(blockId: string, depth = 0): Promise<readonly NotionBlockTree[]> {
		if (depth > MAX_BLOCK_DEPTH) {
			throw new NotionRequestError(0, `blocks under ${blockId} nest deeper than ${String(MAX_BLOCK_DEPTH)} levels`);
		}
		const trees: NotionBlockTree[] = [];
		for (const block of await this.children(blockId)) {
			const hasOwnChildren = block.has_children && !LEAF_BLOCK_TYPES.has(block.type);
			trees.push({ block, children: hasOwnChildren ? await this.blockTree(block.id, depth + 1) : [] });
		}
		return trees;
	}

	private async children(blockId: string): Promise<readonly NotionBlock[]> {
		const blocks: NotionBlock[] = [];
		let cursor: string | null = null;
		do {
			const query: string = cursor === null ? `page_size=${String(PAGE_SIZE)}` : `page_size=${String(PAGE_SIZE)}&start_cursor=${encodeURIComponent(cursor)}`;
			const result: z.output<typeof BlockListSchema> = await this.request({ method: "GET", path: `/blocks/${blockId}/children?${query}` }, BlockListSchema);
			blocks.push(...result.results);
			cursor = result.has_more ? result.next_cursor : null;
		} while (cursor !== null);
		return blocks;
	}

	private send(request: NotionRequest): Promise<Response> {
		return this._environment.fetch(`${API_BASE_URL}${request.path}`, {
			method: request.method,
			headers: { Authorization: `Bearer ${this._token}`, "Notion-Version": NOTION_API_VERSION, "Content-Type": "application/json" },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
		});
	}

	private async waitForTurn(): Promise<void> {
		const wait = this._lastRequestAt + MIN_REQUEST_INTERVAL_MS - this._environment.now();
		if (wait > 0) {
			await this._environment.sleep(wait);
		}
		this._lastRequestAt = this._environment.now();
	}

	/** Notion's `Retry-After` when it sends one, otherwise exponential back-off with jitter. */
	private backoffMs(response: Response, attempt: number): number {
		const retryAfter = Number(response.headers.get("retry-after"));
		if (Number.isFinite(retryAfter) && retryAfter > 0) {
			return retryAfter * MS_PER_SECOND;
		}
		const exponential = BASE_BACKOFF_MS * 2 ** (attempt - 1);
		return exponential + this._environment.random() * BASE_BACKOFF_MS;
	}

	private async detailOf(response: Response): Promise<string> {
		const parsed = NotionErrorSchema.safeParse(await response.json().catch(() => null));
		return parsed.success ? `${parsed.data.code}: ${parsed.data.message}` : "no error details";
	}
}
