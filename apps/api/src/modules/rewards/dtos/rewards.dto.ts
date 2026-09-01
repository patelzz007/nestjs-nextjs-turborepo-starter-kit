import {
	AcceptRewardLegalSchema,
	AdminCreateMerchantInviteSchema,
	AdminKybUpdateSchema,
	AdminRejectRewardSchema,
	CreateRewardClaimSchema,
	MarkRewardNotificationsReadSchema,
	MerchantCreateApiKeySchema,
	MerchantCreateRewardSchema,
	MerchantUpdateRewardSchema,
	RedemptionConfirmSchema,
	RedemptionValidateSchema,
	RequestClaimOtpSchema,
} from "@workspace/shared";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/** POST bodies with no fields — approve, publish, revoke. */
export class RewardsEmptyBodyDto extends createZodDto(z.object({}).strict()) {}

export class RequestClaimOtpDto extends createZodDto(RequestClaimOtpSchema) {}

export class CreateRewardClaimDto extends createZodDto(CreateRewardClaimSchema) {}

export class AcceptRewardLegalDto extends createZodDto(AcceptRewardLegalSchema) {}

export class MarkRewardNotificationsReadDto extends createZodDto(MarkRewardNotificationsReadSchema) {}

export class RedemptionValidateDto extends createZodDto(RedemptionValidateSchema) {}

export class RedemptionConfirmDto extends createZodDto(RedemptionConfirmSchema) {}

export class MerchantCreateRewardDto extends createZodDto(MerchantCreateRewardSchema) {}

export class MerchantUpdateRewardDto extends createZodDto(MerchantUpdateRewardSchema) {}

export class MerchantCreateApiKeyDto extends createZodDto(MerchantCreateApiKeySchema) {}

export class AdminCreateMerchantInviteDto extends createZodDto(AdminCreateMerchantInviteSchema) {}

export class AdminRejectRewardDto extends createZodDto(AdminRejectRewardSchema) {}

export class AdminKybUpdateDto extends createZodDto(AdminKybUpdateSchema) {}
