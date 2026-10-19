// ============================================
// github-webhooks.client.ts - A repository's webhook, with an admin's token (ADR 052)
// ============================================
// Turning live updates on registers one webhook on the repository (REST, which
// takes a fine-grained token with "Webhooks: Read and write"); turning them off
// deletes it. A hook already pointing at this server (a database reset, a hook
// made by hand) is adopted and brought up to date instead of duplicated.

import { Injectable } from "@nestjs/common";
import { GITHUB_WEBHOOK_EVENTS, type GithubRepositoryParams } from "@workspace/shared";

import { GITHUB_REST_API_URL } from "./github.constants";
import { GithubRepositoryNotFoundError, GithubResponseError, repositoryTarget, type GithubReadTarget } from "../../application/errors/github.errors";
import { GithubHttpTransport, type GithubCredential } from "./github-http.transport";
import { GITHUB_REPOSITORY_VISIBLE_QUERY } from "./github-pull-requests.queries";
import { GithubHookListWireSchema, GithubHookWireSchema, GithubRepositoryVisibleResponseWireSchema, type GithubHookWire } from "./github-pull-requests.wire-schemas";

/** Where a hook delivers and how it signs — the server's own settings. */
export interface WebhookEndpoint {
	readonly url: string;
	readonly secret: string;
}

/** Hooks listed per page while looking for one of ours (GitHub's largest page; a repository rarely has more than a few). */
const HOOK_PAGE_SIZE = 100;

function hooksPath(params: GithubRepositoryParams): string {
	return `${GITHUB_REST_API_URL}/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repository)}/hooks`;
}

/** What GitHub is told about our hook: JSON deliveries of the pull-request events, signed with the secret. */
function hookSettings(endpoint: WebhookEndpoint): { readonly active: boolean; readonly events: string[]; readonly config: Record<string, string> } {
	return { active: true, events: [...GITHUB_WEBHOOK_EVENTS], config: { url: endpoint.url, content_type: "json", secret: endpoint.secret, insecure_ssl: "0" } };
}

@Injectable()
export class GithubWebhooksClient {
	public constructor(private readonly transport: GithubHttpTransport) {}

	/** Whether the token can see the repository at all (GitHub answers an unseen one as missing). */
	public async canSee(credential: GithubCredential, params: GithubRepositoryParams): Promise<boolean> {
		const envelope = await this.transport.graphql(credential, GithubRepositoryVisibleResponseWireSchema, GITHUB_REPOSITORY_VISIBLE_QUERY, repositoryTarget(params), {
			owner: params.owner,
			name: params.repository,
		});
		return (envelope.data?.repository ?? null) !== null;
	}

	/** Registers our hook on the repository — or adopts and refreshes one already delivering to us — and answers its id. */
	public async createHook(credential: GithubCredential, params: GithubRepositoryParams, endpoint: WebhookEndpoint): Promise<bigint> {
		const target = repositoryTarget(params);
		const existing = await this.findHook(credential, params, endpoint.url, target);
		if (existing !== null) {
			await this.repointHook(credential, params, BigInt(existing.id), endpoint);
			return BigInt(existing.id);
		}
		const response = await this.transport.post(credential, hooksPath(params), { name: "web", ...hookSettings(endpoint) }, target, "Webhooks");
		return BigInt((await this.transport.parseBody(response, GithubHookWireSchema, target)).id);
	}

	/**
	 * Brings an existing hook up to date — this server's address and secret,
	 * the events, active. `false` when the hook no longer exists on GitHub.
	 */
	public async repointHook(credential: GithubCredential, params: GithubRepositoryParams, hookId: bigint, endpoint: WebhookEndpoint): Promise<boolean> {
		const target = repositoryTarget(params);
		try {
			const response = await this.transport.patch(credential, `${hooksPath(params)}/${hookId.toString()}`, hookSettings(endpoint), target, "Webhooks");
			await this.transport.parseBody(response, GithubHookWireSchema, target);
			return true;
		} catch (error: unknown) {
			if (error instanceof GithubRepositoryNotFoundError) {
				return false;
			}
			throw error;
		}
	}

	/** Deletes the hook; one already gone is already the state asked for. */
	public async deleteHook(credential: GithubCredential, params: GithubRepositoryParams, hookId: bigint): Promise<void> {
		try {
			await this.transport.delete(credential, `${hooksPath(params)}/${hookId.toString()}`, repositoryTarget(params), "Webhooks");
		} catch (error: unknown) {
			if (error instanceof GithubRepositoryNotFoundError) {
				return;
			}
			throw error;
		}
	}

	private async findHook(credential: GithubCredential, params: GithubRepositoryParams, url: string, target: GithubReadTarget): Promise<GithubHookWire | null> {
		const query = new URLSearchParams({ per_page: String(HOOK_PAGE_SIZE) });
		let response: Response;
		try {
			response = await this.transport.send(credential, `${hooksPath(params)}?${query.toString()}`, { method: "GET" }, target);
		} catch (error: unknown) {
			// Listing hooks needs the same "Webhooks" permission: without it, creating says so precisely.
			if (error instanceof GithubResponseError || error instanceof GithubRepositoryNotFoundError) {
				return null;
			}
			throw error;
		}
		const hooks = await this.transport.parseBody(response, GithubHookListWireSchema, target);
		return hooks.find((hook: GithubHookWire): boolean => hook.config.url === url) ?? null;
	}
}
