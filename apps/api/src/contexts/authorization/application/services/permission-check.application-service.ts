import { Inject, Injectable } from "@nestjs/common";
import type { CheckPermissionResponse, PermissionAction, PermissionResource } from "@workspace/shared";

import { SUBJECT_AUTHORIZATION_READ } from "../ports/authorization.tokens";
import type { SubjectAuthorizationReadPort } from "../ports/subject-authorization-read.port";

/** The user and permission the admin inspector asks about. */
export interface CheckPermissionInput {
	readonly userId: string;
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
}

/** The admin permission inspector (ADR 096): whether a user holds a permission, and which grants satisfy it. */
@Injectable()
export class PermissionCheckApplicationService {
	public constructor(@Inject(SUBJECT_AUTHORIZATION_READ) private readonly subjects: SubjectAuthorizationReadPort) {}

	public check(input: CheckPermissionInput): Promise<CheckPermissionResponse> {
		return this.subjects.checkPermissionWithGrants(input.userId, input.action, input.resource);
	}
}
