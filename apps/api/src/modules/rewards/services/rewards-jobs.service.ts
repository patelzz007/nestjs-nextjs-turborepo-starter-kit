import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { RewardsAdminService } from "./rewards-admin.service";

@Injectable()
export class RewardsJobsService {
	public constructor(private readonly rewardsAdminService: RewardsAdminService) {}

	@Cron(CronExpression.EVERY_10_MINUTES)
	public async runRewardMaintenanceJobs(): Promise<void> {
		await this.rewardsAdminService.runScheduledJobs();
	}
}
