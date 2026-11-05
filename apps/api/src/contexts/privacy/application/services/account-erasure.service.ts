import { Logger } from "@nestjs/common";
import { ACCOUNT_ERASURE_GRACE_DAYS, epochMs, type AccountErasureResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { AuthenticationError, AuthorizationError, ConflictError, NotFoundError } from "../../../../platform/application/errors/app-error";
import type { PersonalDataErasureRegistry } from "../../../../platform/application/personal-data/personal-data-erasure.registry";
import type { AccountErasureRecord, AccountErasureStore } from "../ports/account-erasure.store";

const MS_PER_DAY = 86_400_000;
/** The grace period (Q10). */
export const ACCOUNT_ERASURE_GRACE_MS = ACCOUNT_ERASURE_GRACE_DAYS * MS_PER_DAY;
/** How many due erasures one run carries out. */
export const ERASURES_PER_RUN = 25;

export interface AccountErasureServiceDependencies {
	readonly store: AccountErasureStore;
	readonly registry: PersonalDataErasureRegistry;
	readonly clock: Clock;
	readonly ids: { next(): string };
}

/** The outcome of one run of due erasures. */
export interface ErasureRun {
	readonly completed: number;
	readonly failed: number;
	readonly blocked: number;
}

/** An erasure request as the API returns it. */
export function toAccountErasureResponse(record: AccountErasureRecord): AccountErasureResponse {
	return {
		id: record.id,
		userId: record.userId,
		status: record.status,
		requestedBy: record.requestedByUserId === record.userId ? "self" : "support",
		reason: record.reason,
		requestedAt: epochMs(record.requestedAt),
		scheduledFor: epochMs(record.scheduledFor),
		cancelledAt: record.cancelledAt === null ? null : epochMs(record.cancelledAt),
		completedAt: record.completedAt === null ? null : epochMs(record.completedAt),
	};
}

/**
 * Account erasure (ADR 077). Asking: by the person (password) or by support (reason; the route checks
 * `DELETE USER`), refused while anything blocks it, then every session ends and a 30-day grace period starts.
 * Carrying out: mask the person in kept records, let every context erase its own rows, make the account the
 * tombstone, then mark the request completed. Every step is idempotent, so a rerun after a crash finishes.
 */
export class AccountErasureService {
	private readonly logger: Logger = new Logger(AccountErasureService.name);

	public constructor(private readonly deps: AccountErasureServiceDependencies) {}

	public async ownStatus(actor: ActorContext): Promise<AccountErasureResponse | null> {
		const userId = this.requirePerson(actor);
		const record = await this.deps.store.latestOwn(actor, userId);
		return record === null ? null : toAccountErasureResponse(record);
	}

	/** Support's view of an account's request. */
	public async statusOf(actor: ActorContext, userId: string): Promise<AccountErasureResponse | null> {
		this.requirePerson(actor);
		const record = await this.deps.store.latestOf(actor, userId);
		return record === null ? null : toAccountErasureResponse(record);
	}

	public async requestOwn(actor: ActorContext, password: string): Promise<AccountErasureResponse> {
		const userId = this.requirePerson(actor);
		if (!(await this.deps.registry.accountGateway().confirmPassword(userId, password))) {
			throw new AuthenticationError({ message: "That password isn't right." });
		}
		return this.request(actor, userId, userId, null);
	}

	public async requestBySupport(actor: ActorContext, userId: string, reason: string): Promise<AccountErasureResponse> {
		const supportUserId = this.requirePerson(actor);
		if (supportUserId === userId) {
			throw new AuthorizationError({ message: "Erase your own account from your own security settings." });
		}
		return this.request(actor, userId, supportUserId, reason);
	}

	public async cancelOwn(actor: ActorContext): Promise<AccountErasureResponse> {
		const userId = this.requirePerson(actor);
		return this.cancel(actor, userId, userId);
	}

	public async cancelBySupport(actor: ActorContext, userId: string): Promise<AccountErasureResponse> {
		return this.cancel(actor, userId, this.requirePerson(actor));
	}

	/** Carries out erasures whose grace period has ended (the daily job). */
	public async completeDue(actor: ActorContext): Promise<ErasureRun> {
		const now = this.deps.clock.now();
		const due = await this.deps.store.due(actor, now, ERASURES_PER_RUN);
		let completed = 0;
		let failed = 0;
		let blocked = 0;
		for (const request of due) {
			try {
				const email = await this.deps.registry.accountGateway().emailOf(request.userId);
				if (email === null) {
					// Already a tombstone (a crash after the last step): only the bookkeeping is left.
					await this.deps.store.complete(actor, request.id, this.deps.clock.now());
					completed += 1;
					continue;
				}
				if ((await this.blockersFor(request.userId, email)).length > 0) {
					// Something new blocks it (for example ownership of a tenant after the request); it waits.
					blocked += 1;
					continue;
				}
				await this.deps.store.maskInKeptRecords(actor, request.userId, email);
				for (const eraser of this.deps.registry.erasers()) {
					await eraser.erase({ userId: request.userId, email, actor });
				}
				await this.deps.registry.accountGateway().tombstone(request.userId, this.deps.clock.now(), actor);
				await this.deps.store.complete(actor, request.id, this.deps.clock.now());
				completed += 1;
			} catch (error) {
				failed += 1;
				this.logger.error({ event: "privacy.erasure.failed", erasureId: request.id, message: error instanceof Error ? error.message : "Unknown failure" });
			}
		}
		return { completed, failed, blocked };
	}

	private async request(actor: ActorContext, userId: string, requestedByUserId: string, reason: string | null): Promise<AccountErasureResponse> {
		const open = await this.deps.store.findOpen(actor, userId);
		if (open !== null) {
			return toAccountErasureResponse(open);
		}
		const email = await this.deps.registry.accountGateway().emailOf(userId);
		if (email === null) {
			throw new NotFoundError({ message: "There is no account to erase." });
		}
		const blockers = await this.blockersFor(userId, email);
		if (blockers.length > 0) {
			throw new ConflictError({ message: "This account can't be erased yet.", details: { reason: "ACCOUNT_ERASURE_BLOCKED", blockers: [...blockers] } });
		}
		const now = this.deps.clock.now();
		const record = await this.deps.store.create(actor, {
			id: this.deps.ids.next(),
			userId,
			requestedByUserId,
			reason,
			requestedAt: now,
			scheduledFor: now + ACCOUNT_ERASURE_GRACE_MS,
		});
		await this.deps.registry.accountGateway().endSessions(userId, actor);
		return toAccountErasureResponse(record);
	}

	private async cancel(actor: ActorContext, userId: string, cancelledByUserId: string): Promise<AccountErasureResponse> {
		const open = await this.deps.store.findOpen(actor, userId);
		if (open === null) {
			throw new NotFoundError({ message: "There is no erasure to cancel." });
		}
		return toAccountErasureResponse(await this.deps.store.cancel(actor, open.id, cancelledByUserId, this.deps.clock.now()));
	}

	private async blockersFor(userId: string, email: string): Promise<readonly string[]> {
		const found: string[] = [];
		for (const blocker of this.deps.registry.blockers()) {
			found.push(...(await blocker.blockers(userId, email)));
		}
		return found;
	}

	/** The signed-in person (never while impersonating). */
	private requirePerson(actor: ActorContext): string {
		if (actor.kind !== "user" || actor.impersonatorUserId !== null) {
			throw new AuthorizationError({ message: "Only a signed-in person can do this (never while impersonating)." });
		}
		return actor.userId;
	}
}
