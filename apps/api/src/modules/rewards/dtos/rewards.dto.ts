import { MerchantCreateMemberSchema, MerchantKybSubmissionFieldsSchema, MerchantOnboardingCompleteFieldsSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/** POST bodies with no fields — approve, publish, revoke. */
export class RewardsEmptyBodyDto extends createZodDto(z.object({}).strict()) {}

export class MerchantOnboardingCompleteDto extends createZodDto(MerchantOnboardingCompleteFieldsSchema) {}

export class MerchantKybSubmissionDto extends createZodDto(MerchantKybSubmissionFieldsSchema) {}

export class MerchantCreateMemberDto extends createZodDto(MerchantCreateMemberSchema) {}
