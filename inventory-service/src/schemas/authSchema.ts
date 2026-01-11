import { z } from "zod";

export const authSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
      "Password must include lowercase, uppercase, number and special characters"
    ),
});
