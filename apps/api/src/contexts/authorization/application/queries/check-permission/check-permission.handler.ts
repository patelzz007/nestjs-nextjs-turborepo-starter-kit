import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { CheckPermissionResponse } from "@workspace/shared";

import { SUBJECT_AUTHORIZATION_READ } from "../../ports/authorization.tokens";
import type { SubjectAuthorizationReadPort } from "../../ports/subject-authorization-read.port";
import { CheckPermissionQuery } from "./check-permission.query";

@QueryHandler(CheckPermissionQuery)
export class CheckPermissionHandler implements IQueryHandler<CheckPermissionQuery, CheckPermissionResponse> {
	public constructor(@Inject(SUBJECT_AUTHORIZATION_READ) private readonly subjects: SubjectAuthorizationReadPort) {}

	public async execute(query: CheckPermissionQuery): Promise<CheckPermissionResponse> {
		const { userId, action, resource } = query.input;
		return this.subjects.checkPermissionWithGrants(userId, action, resource);
	}
}
