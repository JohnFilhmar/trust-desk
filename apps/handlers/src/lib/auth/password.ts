import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Auth } from "#app/interfaces/deps.ts";

/** The cost Rails uses for `has_secure_password` outside of tests. */
const bcrypt_cost = 12;

/**
 * Builds the password checker.
 *
 * @returns An `Auth` that compares against bcrypt hashes written by Rails.
 *   It hashes a random value once, at startup, and uses that hash whenever
 *   no user matched.
 */
export async function create_auth(): Promise<Auth> {
  const placeholder_digest = await bcrypt.hash(
    randomBytes(32).toString("hex"),
    bcrypt_cost,
  );

  return {
    async verify_password(password, digest) {
      if (digest === null) {
        await bcrypt.compare(password, placeholder_digest);
        return false;
      }
      try {
        return await bcrypt.compare(password, digest);
      } catch {
        return false;
      }
    },
  };
}
