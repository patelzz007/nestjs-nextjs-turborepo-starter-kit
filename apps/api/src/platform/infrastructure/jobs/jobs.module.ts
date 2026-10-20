import { Module } from "@nestjs/common";

import { TenantEnumeratorService } from "./tenant-enumerator.service";
import { TenantJobContextService } from "./tenant-job-context.service";

@Module({
	providers: [TenantJobContextService, TenantEnumeratorService],
	exports: [TenantJobContextService, TenantEnumeratorService],
})
export class JobsModule {}
