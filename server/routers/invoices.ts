import { router, publicProcedure } from "@/server/_core/trpc";
import { getDb } from "@/server/db";
import { invoices, invoiceLineItems, cleaningJobs } from "@/drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

export const invoicesRouter = router({
  /**
   * Get the current (open) invoice for the authenticated cleaner
   * Returns running tally with all line items
   */
  getCurrent: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) {
      throw new Error("Unauthorized");
    }

    const db = await getDb();
    if (!db) {
      throw new Error("Database unavailable");
    }

    // Get the current open invoice for this cleaner
    const currentInvoice = await (db as any).query.invoices.findFirst({
      where: and(
        eq(invoices.cleanerId, ctx.user.id),
        eq(invoices.status, "open")
      ),
      with: {
        lineItems: {
          orderBy: desc(invoiceLineItems.createdAt),
        },
      },
    });

    if (!currentInvoice) {
      return {
        id: null,
        status: "no_invoice",
        totalAmount: 0,
        lineItems: [],
        payType: "per_job",
        paymentCycle: "monthly",
        createdAt: null,
        message: "No running invoice. Complete a job to start one.",
      };
    }

    return {
      id: currentInvoice.id,
      status: currentInvoice.status,
      totalAmount: currentInvoice.totalAmount,
      lineItems: currentInvoice.lineItems,
      payType: currentInvoice.payType,
      paymentCycle: currentInvoice.paymentCycle,
      createdAt: currentInvoice.createdAt,
      submittedAt: currentInvoice.submittedAt,
    };
  }),

  /**
   * Get invoice history (submitted invoices only)
   */
  getHistory: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) {
      throw new Error("Unauthorized");
    }

    const db = await getDb();
    if (!db) {
      throw new Error("Database unavailable");
    }

    const submittedInvoices = await (db as any).query.invoices.findMany({
      where: and(
        eq(invoices.cleanerId, ctx.user.id),
        eq(invoices.status, "submitted")
      ),
      orderBy: desc(invoices.submittedAt),
      with: {
        lineItems: true,
      },
    });

    return submittedInvoices.map((inv: any) => ({
      id: inv.id,
      status: inv.status,
      totalAmount: inv.totalAmount,
      lineItems: inv.lineItems,
      payType: inv.payType,
      paymentCycle: inv.paymentCycle,
      submittedAt: inv.submittedAt,
      createdAt: inv.createdAt,
    }));
  }),

  /**
   * Submit the current open invoice
   * Locks it from further edits
   * Returns submission confirmation
   */
  submit: publicProcedure
    .input(
      z.object({
        invoiceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error("Unauthorized");
      }

      const db = await getDb();
      if (!db) {
        throw new Error("Database unavailable");
      }

      // Get the invoice
      const invoice = await (db as any).query.invoices.findFirst({
        where: eq(invoices.id, input.invoiceId),
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      // Verify ownership
      if (invoice.cleanerId !== ctx.user.id) {
        throw new Error("Unauthorized");
      }

      // Verify it's open
      if (invoice.status !== "open") {
        throw new Error("Invoice is already submitted or closed");
      }

      // Submit the invoice
      await db
        .update(invoices)
        .set({
          status: "submitted",
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, input.invoiceId));

      // Fetch updated invoice
      const updated = await (db as any).query.invoices.findFirst({
        where: eq(invoices.id, input.invoiceId),
      });

      return {
        id: updated?.id,
        status: updated?.status,
        totalAmount: updated?.totalAmount,
        submittedAt: updated?.submittedAt,
        message: "Invoice submitted successfully",
      };
    }),

  /**
   * Get invoice details (for viewing submitted invoices)
   */
  getDetail: publicProcedure
    .input(
      z.object({
        invoiceId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error("Unauthorized");
      }

      const db = await getDb();
      if (!db) {
        throw new Error("Database unavailable");
      }

      const invoice = await (db as any).query.invoices.findFirst({
        where: eq(invoices.id, input.invoiceId),
        with: {
          lineItems: {
            orderBy: desc(invoiceLineItems.createdAt),
          },
        },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      // Verify ownership
      if (invoice.cleanerId !== ctx.user.id) {
        throw new Error("Unauthorized");
      }

      return {
        id: invoice.id,
        status: invoice.status,
        totalAmount: invoice.totalAmount,
        lineItems: invoice.lineItems,
        payType: invoice.payType,
        paymentCycle: invoice.paymentCycle,
        createdAt: invoice.createdAt,
        submittedAt: invoice.submittedAt,
      };
    }),
});
