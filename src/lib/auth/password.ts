import bcrypt from "bcryptjs";
import { z } from "zod";

const COST = process.env.NODE_ENV === "test" ? 4 : 12;

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Password must contain letters and numbers");

export function hashPassword(password: string) {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// Used to keep login timing uniform when the account does not exist.
let dummyHash: string | null = null;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= await bcrypt.hash("pixelforge-timing-equaliser", COST);
  await bcrypt.compare(password, dummyHash).catch(() => false);
}
