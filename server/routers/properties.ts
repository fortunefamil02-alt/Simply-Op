import { router, managerProcedure } from "@/server/_core/trpc";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { properties } from "@/server/db/schema";
import { randomUUID } from "crypto";

/**
 * Properties Router - Manage properties for cleaning jobs
 */
export const propertiesRouter = router({
  /**
   * List all properties for manager's company
   */
  list: managerProcedure.query(async ({ ctx }: any) => {
    const db = (await getDb()) as any;
    if (!db) throw new Error("Database connection failed");

    const managerProperties = await db.query.properties.findMany({
      where: eq(properties.companyId, ctx.user.companyId),
    });

    return managerProperties;
  }),

  /**
   * Get single property by ID
   */
  getById: managerProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ input, ctx }: any) => {
      const db = (await getDb()) as any;
      if (!db) throw new Error("Database connection failed");

      const { propertyId } = input;

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, propertyId),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      if (property.companyId !== ctx.user.companyId) {
        throw new Error("Unauthorized");
      }

      return property;
    }),

  /**
   * Create new property
   */
  create: managerProcedure
    .input(
      z.object({
        name: z.string().min(1),
        address: z.string().min(1),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        unitType: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const db = (await getDb()) as any;
      if (!db) throw new Error("Database connection failed");

      const propertyId = randomUUID();
      const { name, address, city, state, zipCode, unitType, notes } = input;

      await db.insert(properties).values({
        id: propertyId,
        companyId: ctx.user.companyId,
        managerId: ctx.user.id,
        name,
        address,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        unitType: unitType || null,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        id: propertyId,
        name,
        address,
        city,
        state,
        zipCode,
        unitType,
        notes,
      };
    }),

  /**
   * Update property
   */
  update: managerProcedure
    .input(
      z.object({
        propertyId: z.string(),
        name: z.string().min(1).optional(),
        address: z.string().min(1).optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        unitType: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const db = (await getDb()) as any;
      if (!db) throw new Error("Database connection failed");

      const { propertyId, ...updateData } = input;

      // Verify property exists and belongs to manager's company
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, propertyId),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      if (property.companyId !== ctx.user.companyId) {
        throw new Error("Unauthorized");
      }

      // Build update object with only provided fields
      const updateFields: any = {
        updatedAt: new Date(),
      };

      if (updateData.name) updateFields.name = updateData.name;
      if (updateData.address) updateFields.address = updateData.address;
      if (updateData.city !== undefined) updateFields.city = updateData.city || null;
      if (updateData.state !== undefined) updateFields.state = updateData.state || null;
      if (updateData.zipCode !== undefined) updateFields.zipCode = updateData.zipCode || null;
      if (updateData.unitType !== undefined) updateFields.unitType = updateData.unitType || null;
      if (updateData.notes !== undefined) updateFields.notes = updateData.notes || null;

      await db
        .update(properties)
        .set(updateFields)
        .where(eq(properties.id, propertyId));

      return { success: true };
    }),

  /**
   * Delete property (soft delete - just mark as deleted)
   */
  delete: managerProcedure
    .input(z.object({ propertyId: z.string() }))
    .mutation(async ({ input, ctx }: any) => {
      const db = (await getDb()) as any;
      if (!db) throw new Error("Database connection failed");

      const { propertyId } = input;

      // Verify property exists and belongs to manager's company
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, propertyId),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      if (property.companyId !== ctx.user.companyId) {
        throw new Error("Unauthorized");
      }

      // TODO: Check if property has active jobs before deletion
      // For now, just delete it
      await db.delete(properties).where(eq(properties.id, propertyId));

      return { success: true };
    }),
});
