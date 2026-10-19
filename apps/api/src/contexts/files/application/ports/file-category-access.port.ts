import type { CreateFileUploadUrlInput, FileCategory } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { AuthorizationError } from "../../../../platform/application/errors/app-error";

/** What the caller wants to do with an existing file. */
export type FileAccessAction = "complete" | "read" | "delete";

/** The authenticated person acting on a file (files are only reached by user sessions). */
export interface FileActor {
	readonly userId: string;
	readonly isSuperAdmin: boolean;
}

/** The facts of a stored file an access rule decides on. */
export interface FileAccessSubject {
	readonly id: string;
	readonly category: FileCategory;
	readonly uploadedById: string;
	readonly organizationId: string | null;
	readonly productId: string | null;
}

/**
 * Who may upload, complete, read and delete files of a category. Registered by
 * the context that owns the category's meaning (§7.8: same idea as the
 * reference guards); files never decides it alone. Each method throws the
 * owner's documented 403 when the caller may not.
 */
export interface FileCategoryAccessRule {
	readonly categories: readonly FileCategory[];
	assertCanUpload(actor: FileActor, request: CreateFileUploadUrlInput): Promise<void>;
	assertCanAct(actor: FileActor, file: FileAccessSubject, action: FileAccessAction): Promise<void>;
}

/** The 403 code each action answers with (unchanged since the previous FileAuthorizationService). */
const FORBIDDEN_CODE: Readonly<Record<FileAccessAction | "upload", string>> = {
	upload: "FILE_UPLOAD_FORBIDDEN",
	complete: "FILE_UPLOAD_FORBIDDEN",
	read: "FILE_VIEW_FORBIDDEN",
	delete: "FILE_DELETE_FORBIDDEN",
};

/** The 403 an access rule throws when the caller may not perform `action`, with the action's stable code. */
export function fileForbidden(action: FileAccessAction | "upload", message: string): AuthorizationError {
	return new AuthorizationError({ code: FORBIDDEN_CODE[action], message });
}

/** The rule personal files share after upload: only their uploader may complete, read or delete them. */
export function uploaderOnly(actor: FileActor, file: FileAccessSubject, action: FileAccessAction): Promise<void> {
	return file.uploadedById === actor.userId ? Promise.resolve() : Promise.reject(fileForbidden(action, "Not allowed to access this file"));
}

/** No owner registered an access rule for a category: a wiring bug, refused rather than allowed. */
export class FileCategoryAccessUnregisteredError extends Error {
	public constructor(category: FileCategory) {
		super(`No access rule is registered for ${category} files`);
		this.name = "FileCategoryAccessUnregisteredError";
	}
}

/**
 * Every owner's access rule, keyed by category. Platform SuperAdmins may act in
 * any category (the rule every category shares); everyone else is decided by
 * the category's owner. A category without a rule fails closed.
 */
export class FileCategoryAccessRegistry {
	private readonly rules = new Map<FileCategory, FileCategoryAccessRule>();

	public register(rule: FileCategoryAccessRule): void {
		for (const category of rule.categories) {
			this.rules.set(category, rule);
		}
	}

	public async assertCanUpload(actor: ActorContext, request: CreateFileUploadUrlInput): Promise<void> {
		const person = this.person(actor, "upload");
		if (person.isSuperAdmin) {
			return;
		}
		await this.ruleFor(request.category).assertCanUpload(person, request);
	}

	public async assertCanAct(actor: ActorContext, file: FileAccessSubject, action: FileAccessAction): Promise<void> {
		const person = this.person(actor, action);
		if (person.isSuperAdmin) {
			return;
		}
		await this.ruleFor(file.category).assertCanAct(person, file, action);
	}

	private ruleFor(category: FileCategory): FileCategoryAccessRule {
		const rule = this.rules.get(category);
		if (rule === undefined) {
			throw new FileCategoryAccessUnregisteredError(category);
		}
		return rule;
	}

	private person(actor: ActorContext, action: FileAccessAction | "upload"): FileActor {
		return fileActorOf(actor, action);
	}
}

/** The person behind a files request. Every `/files` route is a user session; any other actor is refused. */
export function fileActorOf(actor: ActorContext, action: FileAccessAction | "upload"): FileActor {
	if (actor.kind !== "user") {
		throw fileForbidden(action, "Not allowed to access this file");
	}
	return { userId: actor.userId, isSuperAdmin: actor.isSuperAdmin };
}
