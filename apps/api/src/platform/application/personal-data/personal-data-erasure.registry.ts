import { Injectable } from "@nestjs/common";

import type { ActorContext } from "../actor-context";
import type { SystemOperationName } from "../system-operation-names";

/**
 * The account-erasure operations. Cross-context (privacy runs them; identity's erasure pieces run under them), so
 * they are named once here, beside the seam both contexts already share.
 */
export const ACCOUNT_ERASURE_REQUEST_OPERATION: SystemOperationName = "privacy.account.erasure.request";
export const ACCOUNT_ERASE_OPERATION: SystemOperationName = "privacy.account.erase";

/** Whose account an erasure is about, and the system actor it runs as (`privacy.account.erase`). */
export interface ErasureSubject {
	readonly userId: string;
	/** The account's email, captured before the tombstone replaces it (to find copies of it). */
	readonly email: string;
	readonly actor: ActorContext;
}

/**
 * One context's part of account erasure (ADR 077): removes or ends its own rows about the person (the "ERASE"
 * class of `prisma/personal-data.ts`) and clears copied personal values in rows it keeps ("ANONYMISE").
 * Idempotent: a rerun after a crash changes nothing more. Returns how many rows it changed.
 */
export interface PersonalDataEraser {
	readonly section: string;
	erase(subject: ErasureSubject): Promise<number>;
}

/** Something that stops an erasure until it is resolved (owning a tenant, an open MFA recovery, a pending payment). */
export interface ErasureBlocker {
	readonly name: string;
	/** People-readable reasons it is blocked; empty when it isn't. */
	blockers(userId: string, email: string): Promise<readonly string[]>;
}

/** What account erasure needs from identity, which owns the account. */
export interface ErasureAccountGateway {
	/** Whether `password` is the account's current password. */
	confirmPassword(userId: string, password: string): Promise<boolean>;
	/** The live account's email, or null when there is no live account. */
	emailOf(userId: string): Promise<string | null>;
	/** Ends every session of the account at once. */
	endSessions(userId: string, actor: ActorContext): Promise<void>;
	/** Replaces the account's personal values with the tombstone and sets `erasedAt`. */
	tombstone(userId: string, erasedAt: number, actor: ActorContext): Promise<void>;
}

/**
 * Every context registers its eraser and its blockers here from its module's `onModuleInit`, and identity
 * provides the account gateway, so the privacy context carries out an erasure without importing any context.
 */
@Injectable()
export class PersonalDataErasureRegistry {
	private readonly erasersBySection = new Map<string, PersonalDataEraser>();
	private readonly blockersByName = new Map<string, ErasureBlocker>();
	private gateway: ErasureAccountGateway | null = null;

	public registerEraser(eraser: PersonalDataEraser): void {
		if (this.erasersBySection.has(eraser.section)) {
			throw new Error(`Two erasers claim the section "${eraser.section}"`);
		}
		this.erasersBySection.set(eraser.section, eraser);
	}

	public registerBlocker(blocker: ErasureBlocker): void {
		if (this.blockersByName.has(blocker.name)) {
			throw new Error(`Two erasure blockers are named "${blocker.name}"`);
		}
		this.blockersByName.set(blocker.name, blocker);
	}

	public provideAccountGateway(gateway: ErasureAccountGateway): void {
		if (this.gateway !== null) {
			throw new Error("The erasure account gateway is provided twice");
		}
		this.gateway = gateway;
	}

	/** Every eraser, by section (a stable order). */
	public erasers(): readonly PersonalDataEraser[] {
		return [...this.erasersBySection.values()].sort((left, right) => left.section.localeCompare(right.section));
	}

	public blockers(): readonly ErasureBlocker[] {
		return [...this.blockersByName.values()].sort((left, right) => left.name.localeCompare(right.name));
	}

	/** Identity's gateway; erasure can't run without it, so its absence is a wiring error. */
	public accountGateway(): ErasureAccountGateway {
		if (this.gateway === null) {
			throw new Error("No erasure account gateway: IdentityModule must provide it");
		}
		return this.gateway;
	}
}
