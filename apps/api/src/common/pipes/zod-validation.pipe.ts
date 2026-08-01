import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import type { z } from "zod";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
	constructor(private readonly schema: z.ZodType) {}

	transform(value: unknown): unknown {
		const result = this.schema.safeParse(value);

		if (!result.success) {
			const issues = result.error.issues.map((issue) => ({
				path: issue.path.join("."),
				message: issue.message,
			}));

			throw new BadRequestException({
				message: "Validation failed",
				errors: issues,
			});
		}

		return result.data;
	}
}
