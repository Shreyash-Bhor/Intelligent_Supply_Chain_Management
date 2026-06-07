import { z } from "zod";

const email = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());
const password = z
  .string()
  .min(8, "Password must contain at least 8 characters")
  .max(72);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password,
});

export const loginSchema = z.object({ email, password });
