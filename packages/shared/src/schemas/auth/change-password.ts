import { z } from "zod";

import { strongPassword } from "./auth";

export const ChangePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "Current password is required"),
		newPassword: strongPassword,
		confirmPassword: z.string().min(1, "Please confirm your new password"),
	})
	.strict()
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	})
	.refine((data) => data.currentPassword !== data.newPassword, {
		message: "New password must be different from current password",
		path: ["newPassword"],
	});

export type ChangePasswordInput = z.output<typeof ChangePasswordSchema>;

export const ChangePasswordResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type ChangePasswordResponse = z.output<typeof ChangePasswordResponseSchema>;
