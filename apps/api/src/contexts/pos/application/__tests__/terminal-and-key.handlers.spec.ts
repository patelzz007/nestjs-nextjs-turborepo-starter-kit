import { epochMs, POS_PAIRING_CODE_TTL_MS, PosPairingCodeSchema, type MerchantTerminalSummary, type PaginatedServiceResult } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { FakeMerchantAccessPort } from "../../../../platform/application/__tests__/fakes/fake-merchant-access.port";
import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { AuthenticationError } from "../../../../platform/application/errors/app-error";
import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";
import {
	ApiKeyLocationRequiredError,
	ApiKeyNotFoundError,
	MerchantProfileNotFoundError,
	TenantNotActiveError,
	PairingCodeInvalidError,
	TerminalIdUnavailableError,
	TerminalNotFoundError,
	TerminalStoreNotActiveError,
} from "../../domain/errors/pos.errors";
import { AuthorizationDeniedError } from "../../../../platform/domain/errors/authorization-denied.error";
import { ChangePosSettingsCommand } from "../commands/change-pos-settings/change-pos-settings.command";
import { ChangePosSettingsHandler } from "../commands/change-pos-settings/change-pos-settings.handler";
import { IssueApiKeyCommand } from "../commands/issue-api-key/issue-api-key.command";
import { IssueApiKeyHandler } from "../commands/issue-api-key/issue-api-key.handler";
import { IssuePairingCodeCommand } from "../commands/issue-pairing-code/issue-pairing-code.command";
import { IssuePairingCodeHandler } from "../commands/issue-pairing-code/issue-pairing-code.handler";
import { PairTerminalCommand } from "../commands/pair-terminal/pair-terminal.command";
import { PairTerminalHandler } from "../commands/pair-terminal/pair-terminal.handler";
import { RegisterTerminalCommand } from "../commands/register-terminal/register-terminal.command";
import { RegisterTerminalHandler } from "../commands/register-terminal/register-terminal.handler";
import { RemoveTerminalCommand } from "../commands/remove-terminal/remove-terminal.command";
import { RemoveTerminalHandler } from "../commands/remove-terminal/remove-terminal.handler";
import { RevokeApiKeyCommand } from "../commands/revoke-api-key/revoke-api-key.command";
import { RevokeApiKeyHandler } from "../commands/revoke-api-key/revoke-api-key.handler";
import type { TerminalReadPort } from "../ports/pos-read.port";
import { GetPosSettingsQuery } from "../queries/get-pos-settings/get-pos-settings.query";
import { GetPosSettingsHandler } from "../queries/get-pos-settings/get-pos-settings.handler";
import { GetTerminalQuery } from "../queries/get-terminal/get-terminal.query";
import { GetTerminalHandler } from "../queries/get-terminal/get-terminal.handler";
import { ListTerminalsQuery } from "../queries/list-terminals/list-terminals.query";
import { ListTerminalsHandler } from "../queries/list-terminals/list-terminals.handler";
import { anonymous, apiKeyActor, FakeCredentials, InMemoryPosStore, member, MEMBER, NOW, TENANT_ID, SequentialIds, STORE_A, STORE_B } from "./fakes/pos.fakes";

const PAIRING_CODE = PosPairingCodeSchema.parse("PARKCD22");

describe("terminal commands", () => {
	let store: InMemoryPosStore;
	let access: FakeMerchantAccessPort;
	let credentials: FakeCredentials;
	const clock = new FixedClock(NOW);

	beforeEach(() => {
		store = new InMemoryPosStore();
		access = new FakeMerchantAccessPort();
		credentials = new FakeCredentials();
	});

	describe("RegisterTerminalHandler", () => {
		it("registers a till at the member's store with its first code, audited, in the tenant's RLS session", async () => {
			const handler = new RegisterTerminalHandler(store.uow, access, credentials, new SequentialIds("terminal"), clock);

			const pairing = await handler.execute(new RegisterTerminalCommand(member(), { tenantId: TENANT_ID, locationId: STORE_A, name: "Front till" }));

			expect(pairing.pairingCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/u);
			expect(pairing).toMatchObject({
				pairingCodeExpiresAt: NOW + POS_PAIRING_CODE_TTL_MS,
				terminal: { id: "terminal-1", status: "AWAITING_PAIRING", locationName: "Store A" },
			});
			expect(access.requests.map((recorded) => recorded.request)).toEqual([{ tenantId: TENANT_ID, capability: "merchant:manage_api_keys", locationId: STORE_A }]);
			expect(store.terminals.rows.get("terminal-1")).toMatchObject({ createdByUserId: MEMBER, state: { pairingCode: { issuedByUserId: MEMBER, issuedAt: NOW } } });
			expect(pairing.terminal.terminalId).toMatch(/^TERM-/u);
			expect(store.audit.entries).toEqual([
				{
					tenantId: TENANT_ID,
					actorUserId: MEMBER,
					action: "merchant.terminal_created",
					metadata: { terminalId: "terminal-1", terminalLabel: pairing.terminal.terminalId, locationId: STORE_A },
				},
			]);
			expect(store.uow.committed.at(-1)?.actor).toMatchObject({ kind: "user", tenantId: TENANT_ID });
		});

		it("keeps the terminal id the member chose", async () => {
			const handler = new RegisterTerminalHandler(store.uow, access, credentials, new SequentialIds("terminal"), clock);

			await expect(
				handler.execute(new RegisterTerminalCommand(member(), { tenantId: TENANT_ID, locationId: STORE_A, name: "Till", terminalId: "KL-REGISTER-01" })),
			).resolves.toMatchObject({
				terminal: { terminalId: "KL-REGISTER-01" },
			});
		});

		it("skips generated ids already used (retired tills count) and gives up after three", async () => {
			const handler = new RegisterTerminalHandler(store.uow, access, credentials, new SequentialIds("terminal"), clock);
			credentials.terminalIds.push("TERM-USED2222", "TERM-FREE2222");
			store.terminals.retiredTerminalIds.add("TERM-USED2222");

			await expect(handler.execute(new RegisterTerminalCommand(member(), { tenantId: TENANT_ID, locationId: STORE_A, name: "Till" }))).resolves.toMatchObject({
				terminal: { terminalId: "TERM-FREE2222" },
			});

			credentials.terminalIds.push("TERM-A2222222", "TERM-B2222222", "TERM-C2222222");
			for (const terminalId of credentials.terminalIds) {
				store.terminals.retiredTerminalIds.add(terminalId);
			}
			await expect(handler.execute(new RegisterTerminalCommand(member(), { tenantId: TENANT_ID, locationId: STORE_A, name: "Till" }))).rejects.toBeInstanceOf(
				TerminalIdUnavailableError,
			);
		});

		it("refuses a store that is closed (or closing) under the store's lock, saving nothing", async () => {
			const handler = new RegisterTerminalHandler(store.uow, access, credentials, new SequentialIds("terminal"), clock);
			store.posSettings.closedStores.add(STORE_A);

			await expect(handler.execute(new RegisterTerminalCommand(member(), { tenantId: TENANT_ID, locationId: STORE_A, name: "Till" }))).rejects.toBeInstanceOf(
				TerminalStoreNotActiveError,
			);
			expect(store.posSettings.lockedStores).toEqual([`${TENANT_ID}/${STORE_A}`]);
			expect(store.terminals.rows.size).toBe(0);
			expect(store.audit.entries).toEqual([]);
		});

		it("saves nothing when the member lacks the capability", async () => {
			const handler = new RegisterTerminalHandler(store.uow, access.deny("merchant:manage_api_keys"), credentials, new SequentialIds("terminal"), clock);

			await expect(handler.execute(new RegisterTerminalCommand(member(), { tenantId: TENANT_ID, locationId: STORE_A, name: "Till" }))).rejects.toBeInstanceOf(
				AuthorizationDeniedError,
			);
			expect(store.terminals.rows.size).toBe(0);
			expect(store.uow.committed).toEqual([]);
		});

		it("is for signed-in members only", async () => {
			const handler = new RegisterTerminalHandler(store.uow, access, credentials, new SequentialIds("terminal"), clock);

			await expect(handler.execute(new RegisterTerminalCommand(apiKeyActor(), { tenantId: TENANT_ID, locationId: STORE_A, name: "Till" }))).rejects.toBeInstanceOf(
				AuthenticationError,
			);
		});
	});

	describe("IssuePairingCodeHandler (D33)", () => {
		it("replaces the code under the terminal's row lock and audits it", async () => {
			store.terminals.seed({ id: "terminal-1", pairingCode: { hash: "old", expiresAt: epochMs(NOW + 1), issuedByUserId: "someone", issuedAt: NOW } });
			const handler = new IssuePairingCodeHandler(store.uow, access, credentials, clock);

			const pairing = await handler.execute(new IssuePairingCodeCommand(member(), { tenantId: TENANT_ID, terminalRowId: "terminal-1" }));

			expect(store.terminals.locked).toEqual(["terminal-1"]);
			expect(store.terminals.rows.get("terminal-1")?.state.pairingCode).toEqual({
				hash: `hash:${pairing.pairingCode}`,
				expiresAt: NOW + POS_PAIRING_CODE_TTL_MS,
				issuedByUserId: MEMBER,
				issuedAt: NOW,
			});
			expect(store.audit.actions()).toEqual(["merchant.terminal_pairing_code_issued"]);
		});

		it("answers another store's till (for a store-limited member) and a missing one as not found", async () => {
			store.terminals.seed({ id: "terminal-1", locationId: STORE_B });
			const handler = new IssuePairingCodeHandler(store.uow, access.grantLocations([STORE_A]), credentials, clock);

			await expect(handler.execute(new IssuePairingCodeCommand(member(), { tenantId: TENANT_ID, terminalRowId: "terminal-1" }))).rejects.toBeInstanceOf(TerminalNotFoundError);
			await expect(handler.execute(new IssuePairingCodeCommand(member(), { tenantId: TENANT_ID, terminalRowId: "missing" }))).rejects.toBeInstanceOf(TerminalNotFoundError);
			expect(store.audit.entries).toEqual([]);
		});

		it("answers another tenant's till as not found", async () => {
			store.terminals.seed({ id: "terminal-1", tenantId: "another-org" });

			await expect(
				new IssuePairingCodeHandler(store.uow, access, credentials, clock).execute(
					new IssuePairingCodeCommand(member(), { tenantId: TENANT_ID, terminalRowId: "terminal-1" }),
				),
			).rejects.toBeInstanceOf(TerminalNotFoundError);
			expect(store.terminals.rows.get("terminal-1")?.state.pairingCode).toBeNull();
		});

		it("saves nothing when the member lacks the capability", async () => {
			store.terminals.seed({ id: "terminal-1" });

			await expect(
				new IssuePairingCodeHandler(store.uow, access.deny("merchant:manage_api_keys"), credentials, clock).execute(
					new IssuePairingCodeCommand(member(), { tenantId: TENANT_ID, terminalRowId: "terminal-1" }),
				),
			).rejects.toBeInstanceOf(AuthorizationDeniedError);
			expect(store.terminals.locked).toEqual([]);
			expect(store.terminals.rows.get("terminal-1")?.state.pairingCode).toBeNull();
		});
	});

	describe("RemoveTerminalHandler", () => {
		it("soft-deletes the till and revokes its key in the same unit of work", async () => {
			store.terminals.seed({ id: "terminal-1", apiKeyId: "key-1", pairedAt: NOW });
			store.apiKeys.seed("key-1");
			const handler = new RemoveTerminalHandler(store.uow, access, clock);

			await expect(handler.execute(new RemoveTerminalCommand(member(), { tenantId: TENANT_ID, terminalRowId: "terminal-1" }))).resolves.toEqual({ ok: true });

			expect(store.terminals.rows.get("terminal-1")?.deleted).toBe(true);
			expect(store.apiKeys.rows.get("key-1")?.revokedAt).toBe(NOW);
			expect(store.audit.entries).toEqual([
				{ tenantId: TENANT_ID, actorUserId: MEMBER, action: "merchant.terminal_removed", metadata: { terminalId: "terminal-1", revokedApiKeyId: "key-1" } },
			]);
		});

		it("keeps an already revoked key's revocation as it was", async () => {
			store.terminals.seed({ id: "terminal-1", apiKeyId: "key-1" });
			store.apiKeys.seed("key-1", { revokedAt: epochMs(NOW - 5) });

			await new RemoveTerminalHandler(store.uow, access, clock).execute(new RemoveTerminalCommand(member(), { tenantId: TENANT_ID, terminalRowId: "terminal-1" }));

			expect(store.apiKeys.rows.get("key-1")?.revokedAt).toBe(NOW - 5);
		});

		it("answers another store's till as not found", async () => {
			store.terminals.seed({ id: "terminal-1", locationId: STORE_B });

			await expect(
				new RemoveTerminalHandler(store.uow, access.grantLocations([STORE_A]), clock).execute(
					new RemoveTerminalCommand(member(), { tenantId: TENANT_ID, terminalRowId: "terminal-1" }),
				),
			).rejects.toBeInstanceOf(TerminalNotFoundError);
			expect(store.terminals.rows.get("terminal-1")?.deleted).toBe(false);
		});

		it("answers another tenant's till as not found, and removes nothing without the capability", async () => {
			store.terminals.seed({ id: "foreign", tenantId: "another-org" });
			store.terminals.seed({ id: "terminal-1" });

			await expect(
				new RemoveTerminalHandler(store.uow, access, clock).execute(new RemoveTerminalCommand(member(), { tenantId: TENANT_ID, terminalRowId: "foreign" })),
			).rejects.toBeInstanceOf(TerminalNotFoundError);
			await expect(
				new RemoveTerminalHandler(store.uow, new FakeMerchantAccessPort().deny("merchant:manage_api_keys"), clock).execute(
					new RemoveTerminalCommand(member(), { tenantId: TENANT_ID, terminalRowId: "terminal-1" }),
				),
			).rejects.toBeInstanceOf(AuthorizationDeniedError);
			expect([...store.terminals.rows.values()].map((row) => row.deleted)).toEqual([false, false]);
			expect(store.audit.entries).toEqual([]);
		});
	});

	describe("PairTerminalHandler", () => {
		function pairable(patch: { readonly apiKeyId?: string; readonly issuedByUserId?: string | null; readonly expiresAt?: number } = {}): void {
			store.terminals.seed({
				id: "terminal-1",
				label: "Front till",
				apiKeyId: patch.apiKeyId ?? null,
				pairingCode: {
					hash: `hash:${PAIRING_CODE}`,
					expiresAt: epochMs(patch.expiresAt ?? NOW + 1),
					issuedByUserId: patch.issuedByUserId === undefined ? MEMBER : patch.issuedByUserId,
					issuedAt: NOW,
				},
			});
		}

		it("exchanges the code for a POS key minted in the issuer's name, as the pairing system operation", async () => {
			pairable();
			const handler = new PairTerminalHandler(store.uow, credentials, new SequentialIds("key"), clock);

			const paired = await handler.execute(new PairTerminalCommand(anonymous(), { pairingCode: PAIRING_CODE }));

			expect(paired.apiKey).toMatch(/^mk_live_/u);
			expect(paired.terminalId).toBe(store.terminals.rows.get("terminal-1")?.state.terminalId);
			expect(paired).toMatchObject({
				terminalName: "Front till",
				tenant: { slug: "brew-bean", displayName: "Brew & Bean" },
				location: { id: STORE_A, name: "Store A" },
			});
			expect(store.apiKeys.rows.get("key-1")).toMatchObject({ scope: "POS", locationId: STORE_A, createdByUserId: MEMBER, name: "Front till" });
			expect(store.terminals.rows.get("terminal-1")?.state).toMatchObject({ apiKeyId: "key-1", pairedAt: NOW, pairingCode: null });
			expect(store.audit.entries).toEqual([
				{
					tenantId: TENANT_ID,
					actorUserId: MEMBER,
					action: "pos.terminal_paired",
					metadata: { terminalId: "terminal-1", apiKeyId: "key-1", replacedApiKeyId: null },
				},
			]);
			expect(store.uow.committed.map((commit) => commit.operation)).toEqual(["pos.terminal.pair"]);
		});

		it("re-pairing rotates the key: the previous one is revoked", async () => {
			store.apiKeys.seed("old-key");
			pairable({ apiKeyId: "old-key" });

			await new PairTerminalHandler(store.uow, credentials, new SequentialIds("key"), clock).execute(new PairTerminalCommand(anonymous(), { pairingCode: PAIRING_CODE }));

			expect(store.apiKeys.rows.get("old-key")?.revokedAt).toBe(NOW);
			expect(store.audit.entries.at(0)?.metadata).toMatchObject({ replacedApiKeyId: "old-key" });
		});

		it("answers an unknown, expired and already-used code alike", async () => {
			const handler = new PairTerminalHandler(store.uow, credentials, new SequentialIds("key"), clock);
			await expect(handler.execute(new PairTerminalCommand(anonymous(), { pairingCode: PAIRING_CODE }))).rejects.toBeInstanceOf(PairingCodeInvalidError);

			pairable({ expiresAt: NOW - 1 });
			await expect(handler.execute(new PairTerminalCommand(anonymous(), { pairingCode: PAIRING_CODE }))).rejects.toBeInstanceOf(PairingCodeInvalidError);

			pairable();
			await handler.execute(new PairTerminalCommand(anonymous(), { pairingCode: PAIRING_CODE }));
			await expect(handler.execute(new PairTerminalCommand(anonymous(), { pairingCode: PAIRING_CODE }))).rejects.toBeInstanceOf(PairingCodeInvalidError);
		});

		it("refuses a code issued before issuer tracking rather than attributing the key to someone else", async () => {
			pairable({ issuedByUserId: null });

			await expect(
				new PairTerminalHandler(store.uow, credentials, new SequentialIds("key"), clock).execute(new PairTerminalCommand(anonymous(), { pairingCode: PAIRING_CODE })),
			).rejects.toBeInstanceOf(PairingCodeInvalidError);
			expect(store.apiKeys.rows.size).toBe(0);
		});

		it("rolls back for a merchant that is not operating, so the code survives a reactivation", async () => {
			pairable();
			store.posSettings.tenant = { slug: "brew-bean", displayName: "Brew & Bean", operating: false, requireRegisteredTerminals: false };

			await expect(
				new PairTerminalHandler(store.uow, credentials, new SequentialIds("key"), clock).execute(new PairTerminalCommand(anonymous(), { pairingCode: PAIRING_CODE })),
			).rejects.toBeInstanceOf(TenantNotActiveError);
			expect(store.terminals.rows.get("terminal-1")?.state.pairingCode).not.toBeNull();
			expect(store.apiKeys.rows.size).toBe(0);
		});
	});

	describe("POS settings", () => {
		it("reads the policy (off without a merchant profile) and writes it through tenants, audited", async () => {
			const read = new GetPosSettingsHandler(store.uow, access);
			const write = new ChangePosSettingsHandler(store.uow, access, new FixedClock(NOW));

			await expect(read.execute(new GetPosSettingsQuery(member(), { tenantId: TENANT_ID }))).resolves.toEqual({ requireRegisteredTerminals: false });
			await expect(write.execute(new ChangePosSettingsCommand(member(), { tenantId: TENANT_ID, requireRegisteredTerminals: true }))).resolves.toEqual({
				requireRegisteredTerminals: true,
			});
			await expect(read.execute(new GetPosSettingsQuery(member(), { tenantId: TENANT_ID }))).resolves.toEqual({ requireRegisteredTerminals: true });
			expect(store.audit.entries).toEqual([
				{ tenantId: TENANT_ID, actorUserId: MEMBER, action: "merchant.terminal_settings_updated", metadata: { requireRegisteredTerminals: true } },
			]);

			store.posSettings.hasProfile = false;
			await expect(read.execute(new GetPosSettingsQuery(member(), { tenantId: TENANT_ID }))).resolves.toEqual({ requireRegisteredTerminals: false });
			await expect(write.execute(new ChangePosSettingsCommand(member(), { tenantId: TENANT_ID, requireRegisteredTerminals: false }))).rejects.toBeInstanceOf(
				MerchantProfileNotFoundError,
			);
		});
	});
});

describe("API key commands", () => {
	let store: InMemoryPosStore;
	let access: FakeMerchantAccessPort;

	beforeEach(() => {
		store = new InMemoryPosStore();
		access = new FakeMerchantAccessPort();
	});

	it("mints a key once, stores only its hash, and audits it", async () => {
		const handler = new IssueApiKeyHandler(store.uow, access, new FakeCredentials(), new SequentialIds("key"));

		const created = await handler.execute(new IssueApiKeyCommand(member(), { tenantId: TENANT_ID, scope: "INTEGRATION", locationId: STORE_A, name: "ERP" }));

		expect(created.apiKey).toMatch(/^mk_live_/u);
		expect(created).toMatchObject({ id: "key-1", name: "ERP", scope: "INTEGRATION", locationId: STORE_A });
		expect(store.apiKeys.rows.get("key-1")).toMatchObject({ keyHash: `hash:${created.apiKey}`, createdByUserId: MEMBER });
		expect(store.audit.entries).toEqual([
			{
				tenantId: TENANT_ID,
				actorUserId: MEMBER,
				action: "merchant.api_key_created",
				metadata: { keyId: "key-1", name: "ERP", scope: "INTEGRATION", locationId: STORE_A },
			},
		]);
	});

	it("names an unnamed key, and lets only an all-stores member mint a tenant-wide one", async () => {
		const handler = new IssueApiKeyHandler(store.uow, access, new FakeCredentials(), new SequentialIds("key"));

		await expect(handler.execute(new IssueApiKeyCommand(member(), { tenantId: TENANT_ID, scope: "POS" }))).resolves.toMatchObject({
			name: "API key",
			locationId: null,
		});
		access.grantLocations([STORE_A]);
		await expect(handler.execute(new IssueApiKeyCommand(member(), { tenantId: TENANT_ID, scope: "POS" }))).rejects.toBeInstanceOf(ApiKeyLocationRequiredError);
	});

	it("revokes a key once (compare-and-set): a second revoke succeeds without changing or auditing anything", async () => {
		store.apiKeys.seed("key-1", { locationId: STORE_A });
		const handler = new RevokeApiKeyHandler(store.uow, access, new FixedClock(NOW));

		await expect(handler.execute(new RevokeApiKeyCommand(member(), { tenantId: TENANT_ID, keyId: "key-1" }))).resolves.toEqual({ ok: true });
		await expect(
			new RevokeApiKeyHandler(store.uow, access, new FixedClock(epochMs(NOW + 10))).execute(new RevokeApiKeyCommand(member(), { tenantId: TENANT_ID, keyId: "key-1" })),
		).resolves.toEqual({
			ok: true,
		});

		expect(store.apiKeys.rows.get("key-1")?.revokedAt).toBe(NOW);
		expect(store.audit.entries).toEqual([{ tenantId: TENANT_ID, actorUserId: MEMBER, action: "merchant.api_key_revoked", metadata: { keyId: "key-1" } }]);
	});

	it("does not audit a revocation a concurrent request made first", async () => {
		store.apiKeys.seed("key-1");
		store.apiKeys.revokedConcurrently.add("key-1");

		await expect(
			new RevokeApiKeyHandler(store.uow, access, new FixedClock(NOW)).execute(new RevokeApiKeyCommand(member(), { tenantId: TENANT_ID, keyId: "key-1" })),
		).resolves.toEqual({ ok: true });
		expect(store.audit.entries).toEqual([]);
	});

	it("answers another store's key, a tenant-wide key (for a store-limited member) and a missing one as not found", async () => {
		store.apiKeys.seed("store-b-key", { locationId: STORE_B });
		store.apiKeys.seed("org-wide-key", { locationId: null });
		const handler = new RevokeApiKeyHandler(store.uow, access.grantLocations([STORE_A]), new FixedClock(NOW));

		for (const keyId of ["store-b-key", "org-wide-key", "missing"]) {
			await expect(handler.execute(new RevokeApiKeyCommand(member(), { tenantId: TENANT_ID, keyId }))).rejects.toBeInstanceOf(ApiKeyNotFoundError);
		}
	});

	it("answers another tenant's key as not found, leaving it live", async () => {
		store.apiKeys.seed("foreign-key", { tenantId: "another-org" });

		await expect(
			new RevokeApiKeyHandler(store.uow, access, new FixedClock(NOW)).execute(new RevokeApiKeyCommand(member(), { tenantId: TENANT_ID, keyId: "foreign-key" })),
		).rejects.toBeInstanceOf(ApiKeyNotFoundError);
		expect(store.apiKeys.rows.get("foreign-key")?.revokedAt).toBeNull();
	});

	it("mints and revokes nothing without the capability", async () => {
		store.apiKeys.seed("key-1");
		access.deny("merchant:manage_api_keys");

		await expect(
			new IssueApiKeyHandler(store.uow, access, new FakeCredentials(), new SequentialIds("key")).execute(
				new IssueApiKeyCommand(member(), { tenantId: TENANT_ID, scope: "POS" }),
			),
		).rejects.toBeInstanceOf(AuthorizationDeniedError);
		await expect(
			new RevokeApiKeyHandler(store.uow, access, new FixedClock(NOW)).execute(new RevokeApiKeyCommand(member(), { tenantId: TENANT_ID, keyId: "key-1" })),
		).rejects.toBeInstanceOf(AuthorizationDeniedError);
		expect([...store.apiKeys.rows.keys()]).toEqual(["key-1"]);
		expect(store.apiKeys.rows.get("key-1")?.revokedAt).toBeNull();
		expect(store.uow.committed).toEqual([]);
	});
});

describe("terminal queries", () => {
	const summary: MerchantTerminalSummary = {
		id: "terminal-1",
		terminalId: "TERM-AAAA2222",
		name: "Till",
		locationId: STORE_B,
		locationName: "Store B",
		status: "UNPAIRED",
		pairingCodeExpiresAt: null,
		pairedAt: null,
		lastSeenAt: null,
		createdAt: NOW,
		updatedAt: NOW,
		isDeleted: false,
		deletedAt: null,
	};

	/** A read port that records the grant and actor it was asked with. */
	function recordingReads(): TerminalReadPort & { readonly grants: MerchantAccessGrant[] } {
		const grants: MerchantAccessGrant[] = [];
		return {
			grants,
			list: (_actor, grant): Promise<PaginatedServiceResult<MerchantTerminalSummary>> => {
				grants.push(grant);
				return Promise.resolve({ items: [summary], total: 1, page: 1, limit: 20, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false });
			},
			summary: () => Promise.reject(new Error("not used")),
			find: () => Promise.resolve(summary),
		};
	}

	it("lists within the member's grant (narrowed by the requested store)", async () => {
		const access = new FakeMerchantAccessPort();
		const reads = recordingReads();

		await new ListTerminalsHandler(access, reads, new FixedClock(NOW)).execute(
			new ListTerminalsQuery(member(), { tenantId: TENANT_ID, locationId: STORE_A, limit: 20, page: 1 }),
		);

		expect(access.requests.at(0)?.request).toEqual({ tenantId: TENANT_ID, capability: "merchant:manage_api_keys", locationId: STORE_A });
		expect(reads.grants).toEqual([{ tenantId: TENANT_ID, locationScope: "SELECTED", locationIds: [STORE_A] }]);
	});

	it("lists a store-limited member's own stores, and refuses a requested store outside them", async () => {
		const reads = recordingReads();
		const handler = new ListTerminalsHandler(new FakeMerchantAccessPort().grantLocations([STORE_A]), reads, new FixedClock(NOW));

		await handler.execute(new ListTerminalsQuery(member(), { tenantId: TENANT_ID, limit: 20, page: 1 }));
		await expect(handler.execute(new ListTerminalsQuery(member(), { tenantId: TENANT_ID, locationId: STORE_B, limit: 20, page: 1 }))).rejects.toBeInstanceOf(
			AuthorizationDeniedError,
		);

		expect(reads.grants).toEqual([{ tenantId: TENANT_ID, locationScope: "SELECTED", locationIds: [STORE_A] }]);
	});

	it("reads one terminal of the member's stores and answers another store's as not found", async () => {
		const handler = (access: FakeMerchantAccessPort): GetTerminalHandler => new GetTerminalHandler(access, recordingReads(), new FixedClock(NOW));

		await expect(handler(new FakeMerchantAccessPort()).execute(new GetTerminalQuery(member(), { tenantId: TENANT_ID, terminalRowId: "terminal-1" }))).resolves.toEqual(
			summary,
		);
		await expect(
			handler(new FakeMerchantAccessPort().grantLocations([STORE_A])).execute(new GetTerminalQuery(member(), { tenantId: TENANT_ID, terminalRowId: "terminal-1" })),
		).rejects.toBeInstanceOf(TerminalNotFoundError);
	});
});
