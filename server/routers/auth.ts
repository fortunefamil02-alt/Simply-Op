import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { users, businesses } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// ============================================================================
// TYPES
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: "super_manager" | "manager" | "cleaner";
  businessId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Hash password using SHA-256 (for Alpha testing only)
 * Production should use bcrypt or similar
 */
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

/**
 * Verify password
 */
function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Generate user ID
 */
function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate business ID (for first-time users)
 */
function generateBusinessId(): string {
  return `business_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// ROUTER
// ============================================================================

export const authRouter = router({
  /**
   * Login / Registration (Merged)
   * - First-time login: creates user and business
   * - Returning login: validates credentials and returns user
   * 
   * Alpha constraints:
   * - Email/password only
   * - Isolated Alpha users
   * - No external identity providers
   * - Session persists across app restarts
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
      })
    )
    .mutation(async ({ input }) => {
      const db = (await getDb()) as any;
      if (!db) {
        throw new Error("Database connection failed");
      }

      const { email, password } = input;

      try {
        // Check if user exists
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (existingUser) {
          // Returning user: validate credentials
          if (!verifyPassword(password, existingUser.passwordHash)) {
            throw new Error("Invalid email or password");
          }

          if (!existingUser.isActive) {
            throw new Error("User account is inactive");
          }

          // Return user as auth context
          return {
            id: existingUser.id,
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            role: existingUser.role,
            businessId: existingUser.businessId,
            isActive: existingUser.isActive,
            createdAt: existingUser.createdAt,
            updatedAt: existingUser.updatedAt,
          } as AuthUser;
        }

        // First-time login: create user and business
        const businessId = generateBusinessId();
        const userId = generateUserId();
        const passwordHash = hashPassword(password);

        // Extract name from email (e.g., "john.doe@example.com" -> "John Doe")
        const nameParts = email.split("@")[0].split(".");
        const firstName = nameParts[0]?.charAt(0).toUpperCase() + nameParts[0]?.slice(1);
        const lastName = nameParts[1]?.charAt(0).toUpperCase() + nameParts[1]?.slice(1);

        // Create business (Alpha sandbox)
        await (db as any).insert(businesses).values({
          id: businessId,
          name: `${firstName}'s Business`,
          email: email,
          isSandbox: true, // Alpha is sandbox mode
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create user (super_manager for first-time user)
        await (db as any).insert(users).values({
          id: userId,
          businessId: businessId,
          email: email,
          passwordHash: passwordHash,
          firstName: firstName || null,
          lastName: lastName || null,
          role: "super_manager", // First user is super_manager
          payType: "per_job",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Return newly created user
        return {
          id: userId,
          email: email,
          firstName: firstName || null,
          lastName: lastName || null,
          role: "super_manager" as const,
          businessId: businessId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as AuthUser;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Login failed";
        throw new Error(message);
      }
    }),

  /**
   * Get current user (already exists in routers.ts)
   * Kept here for reference
   */
  me: publicProcedure.query(async (opts) => {
    if (!opts.ctx.user) return null;
    const db = (await getDb()) as any;
    if (!db) return null;
    try {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, opts.ctx.user.id),
      });
      if (!dbUser || !dbUser.isActive) return null;
      return {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role,
        businessId: dbUser.businessId,
        isActive: dbUser.isActive,
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
      } as AuthUser;
    } catch (error) {
      console.error("[Auth.me] Error:", error);
      return null;
    }
  }),

  /**
   * Logout (already exists in routers.ts)
   * Kept here for reference
   */
  logout: publicProcedure.mutation(({ ctx }) => {
    // Logout is handled by clearing the session cookie in routers.ts
    return { success: true } as const;
  }),
});

export type AuthRouter = typeof authRouter;
