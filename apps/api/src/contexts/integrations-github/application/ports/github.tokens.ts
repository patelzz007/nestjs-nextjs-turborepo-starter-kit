import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** Injection tokens of the integrations-github ports. */
export const GITHUB_CONTRIBUTIONS = Symbol("GITHUB_CONTRIBUTIONS");
export const GITHUB_TOKEN_CIPHER = Symbol("GITHUB_TOKEN_CIPHER");
export const GITHUB_TOKEN_OWNER = Symbol("GITHUB_TOKEN_OWNER");
export const GITHUB_ACCOUNT_LINK_READS = Symbol("GITHUB_ACCOUNT_LINK_READS");
export const GITHUB_UNIT_OF_WORK = Symbol("GITHUB_UNIT_OF_WORK");
export const GITHUB_PULL_REQUEST_CACHE = Symbol("GITHUB_PULL_REQUEST_CACHE");
export const GITHUB_PULL_REQUEST_READS = Symbol("GITHUB_PULL_REQUEST_READS");
export const GITHUB_PULL_REQUEST_WRITES = Symbol("GITHUB_PULL_REQUEST_WRITES");
export const GITHUB_REPOSITORY_FILES = Symbol("GITHUB_REPOSITORY_FILES");
export const COMMENT_PICTURE_UPLOADS = Symbol("COMMENT_PICTURE_UPLOADS");
export const GITHUB_WEBHOOK_ENDPOINT = Symbol("GITHUB_WEBHOOK_ENDPOINT");
export const GITHUB_WEBHOOKS = Symbol("GITHUB_WEBHOOKS");
export const GITHUB_WEBHOOK_STORE = Symbol("GITHUB_WEBHOOK_STORE");
export const GITHUB_CHANGE_SIGNALS = Symbol("GITHUB_CHANGE_SIGNALS");
export const GITHUB_CLOCK = Symbol("GITHUB_CLOCK");

/** The `github.webhook.deliveries` system operation, named once for every route and adapter that runs under it. */
export const GITHUB_WEBHOOK_DELIVERIES_OPERATION: SystemOperationName = "github.webhook.deliveries";
