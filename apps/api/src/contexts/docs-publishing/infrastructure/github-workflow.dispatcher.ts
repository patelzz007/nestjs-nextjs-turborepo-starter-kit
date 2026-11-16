import type { DocsSyncDispatch, DocsSyncDispatcherPort } from "../application/ports/docs-publishing.ports";

/**
 * Starts the docs sync with `workflow_dispatch`, not `repository_dispatch`: it needs only the Actions permission,
 * while `repository_dispatch` needs contents: write, which could push code (plan §11). Rapid edits collapse in the
 * workflow's concurrency group, so this needs no queue of its own.
 */

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const DOCS_SYNC_WORKFLOW = "docs-sync.yml";
const DISPATCH_TIMEOUT_MS = 10_000;

/** GitHub refused to start the workflow. */
export class DocsSyncDispatchError extends Error {
	public constructor(status: number) {
		super(`GitHub answered ${String(status)} to the workflow dispatch`);
		this.name = "DocsSyncDispatchError";
	}
}

export interface GithubWorkflowTarget {
	readonly token: string;
	readonly repository: string;
	readonly ref: string;
}

export class GithubWorkflowDispatcher implements DocsSyncDispatcherPort {
	public constructor(
		private readonly target: GithubWorkflowTarget,
		private readonly send: (url: string, init: RequestInit) => Promise<Response>,
	) {}

	public async dispatch(request: DocsSyncDispatch): Promise<void> {
		const { token, repository, ref } = this.target;
		const response = await this.send(`${GITHUB_API_URL}/repos/${repository}/actions/workflows/${DOCS_SYNC_WORKFLOW}/dispatches`, {
			method: "POST",
			headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": GITHUB_API_VERSION },
			body: JSON.stringify({ ref, inputs: { trigger: request.trigger, full: String(request.full) } }),
			signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
		});
		if (!response.ok) {
			throw new DocsSyncDispatchError(response.status);
		}
	}
}
