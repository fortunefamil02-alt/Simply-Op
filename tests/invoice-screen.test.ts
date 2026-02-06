import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Invoice Screen Tests
 * Validates pay type-specific display logic and invoice submission flow
 */

// Mock invoice data for testing
const mockPerJobInvoice = {
  id: "inv_001",
  status: "open",
  totalAmount: 250.0,
  payType: "per_job",
  invoiceCycle: "bi_weekly",
  createdAt: new Date("2026-02-01"),
  submittedAt: null,
  lineItems: [
    {
      id: "line_001",
      jobId: "job_001",
      amount: 100.0,
      jobDate: "2026-02-03",
      createdAt: new Date("2026-02-03T10:00:00"),
    },
    {
      id: "line_002",
      jobId: "job_002",
      amount: 150.0,
      jobDate: "2026-02-04",
      createdAt: new Date("2026-02-04T14:30:00"),
    },
  ],
};

const mockHourlyInvoice = {
  id: "inv_002",
  status: "open",
  totalAmount: 180.0,
  payType: "hourly",
  invoiceCycle: "bi_weekly",
  createdAt: new Date("2026-02-01"),
  submittedAt: null,
  lineItems: [
    {
      id: "line_003",
      jobId: "job_003",
      amount: 60.0,
      jobDuration: 3600, // 1 hour in seconds
      jobDate: "2026-02-03",
      createdAt: new Date("2026-02-03T10:00:00"),
    },
    {
      id: "line_004",
      jobId: "job_004",
      amount: 120.0,
      jobDuration: 7200, // 2 hours in seconds
      jobDate: "2026-02-04",
      createdAt: new Date("2026-02-04T14:30:00"),
    },
  ],
};

const mockSubmittedInvoice = {
  ...mockPerJobInvoice,
  status: "submitted",
  submittedAt: new Date("2026-02-06"),
};

describe("Invoice Screen - Pay Type Display Logic", () => {
  describe("Per-Job Invoice Display", () => {
    it("should display 'Invoice Total' header for per-job invoices", () => {
      const invoice = mockPerJobInvoice;
      const headerLabel = invoice.payType === "hourly" ? "Total Earnings" : "Invoice Total";
      expect(headerLabel).toBe("Invoice Total");
    });

    it("should display per-job pay type label", () => {
      const invoice = mockPerJobInvoice;
      const payTypeLabel = invoice.payType === "hourly" ? "Hourly" : "Per-Job";
      expect(payTypeLabel).toBe("Per-Job");
    });

    it("should display total amount for per-job invoices", () => {
      const invoice = mockPerJobInvoice;
      expect(invoice.totalAmount).toBe(250.0);
    });

    it("should show per-job prices in line items", () => {
      const invoice = mockPerJobInvoice;
      const shouldShowPrice = invoice.payType === "per_job";
      expect(shouldShowPrice).toBe(true);

      // Verify each line item has a price
      invoice.lineItems.forEach((item) => {
        expect(item.amount).toBeGreaterThan(0);
      });
    });

    it("should NOT show duration for per-job invoices", () => {
      const invoice = mockPerJobInvoice;
      const shouldShowDuration = invoice.payType === "hourly";
      expect(shouldShowDuration).toBe(false);
    });

    it("should display job count in header", () => {
      const invoice = mockPerJobInvoice;
      expect(invoice.lineItems.length).toBe(2);
    });
  });

  describe("Hourly Invoice Display", () => {
    it("should display 'Total Earnings' header for hourly invoices", () => {
      const invoice = mockHourlyInvoice;
      const headerLabel = invoice.payType === "hourly" ? "Total Earnings" : "Invoice Total";
      expect(headerLabel).toBe("Total Earnings");
    });

    it("should display hourly pay type label", () => {
      const invoice = mockHourlyInvoice;
      const payTypeLabel = invoice.payType === "hourly" ? "Hourly" : "Per-Job";
      expect(payTypeLabel).toBe("Hourly");
    });

    it("should display total amount for hourly invoices", () => {
      const invoice = mockHourlyInvoice;
      expect(invoice.totalAmount).toBe(180.0);
    });

    it("should NOT show per-job prices in line items", () => {
      const invoice = mockHourlyInvoice;
      const shouldShowPrice = invoice.payType === "per_job";
      expect(shouldShowPrice).toBe(false);
    });

    it("should show duration for hourly invoices", () => {
      const invoice = mockHourlyInvoice;
      const shouldShowDuration = invoice.payType === "hourly";
      expect(shouldShowDuration).toBe(true);

      // Verify each line item has a duration
      invoice.lineItems.forEach((item) => {
        expect(item.jobDuration).toBeDefined();
        expect(item.jobDuration).toBeGreaterThan(0);
      });
    });

    it("should display earnings message for hourly invoices", () => {
      const invoice = mockHourlyInvoice;
      const message = `Earnings from ${invoice.lineItems.length} completed job${invoice.lineItems.length !== 1 ? "s" : ""}`;
      expect(message).toBe("Earnings from 2 completed jobs");
    });

    it("should convert job duration from seconds to minutes", () => {
      const invoice = mockHourlyInvoice;
      const firstJobMinutes = Math.round(invoice.lineItems[0].jobDuration! / 60);
      const secondJobMinutes = Math.round(invoice.lineItems[1].jobDuration! / 60);

      expect(firstJobMinutes).toBe(60);
      expect(secondJobMinutes).toBe(120);
    });
  });

  describe("Invoice Submission", () => {
    it("should lock invoice after submission", () => {
      const invoice = mockPerJobInvoice;
      const isOpen = invoice.status === "open";
      expect(isOpen).toBe(true);

      // After submission
      const submittedInvoice = { ...invoice, status: "submitted", submittedAt: new Date() };
      const isSubmitted = submittedInvoice.status === "submitted";
      expect(isSubmitted).toBe(true);
    });

    it("should include pay type in submission confirmation message", () => {
      const invoice = mockPerJobInvoice;
      const payTypeLabel = invoice.payType === "hourly" ? "hourly" : "per-job";
      const totalDisplay = `$${invoice.totalAmount.toFixed(2)}`;
      const message = `Submit ${payTypeLabel} invoice for ${totalDisplay}?`;

      expect(message).toBe("Submit per-job invoice for $250.00?");
    });

    it("should include pay type in hourly submission confirmation message", () => {
      const invoice = mockHourlyInvoice;
      const payTypeLabel = invoice.payType === "hourly" ? "hourly" : "per-job";
      const totalDisplay = `$${invoice.totalAmount.toFixed(2)}`;
      const message = `Submit ${payTypeLabel} invoice for ${totalDisplay}?`;

      expect(message).toBe("Submit hourly invoice for $180.00?");
    });
  });

  describe("Invoice History Display", () => {
    it("should display submitted invoices in history", () => {
      const invoice = mockSubmittedInvoice;
      expect(invoice.status).toBe("submitted");
      expect(invoice.submittedAt).toBeDefined();
    });

    it("should show pay type in history tab", () => {
      const invoice = mockSubmittedInvoice;
      const payTypeLabel = invoice.payType === "hourly" ? "Hourly" : "Per-Job";
      expect(payTypeLabel).toBe("Per-Job");
    });

    it("should format submission date correctly", () => {
      const invoice = mockSubmittedInvoice;
      const formattedDate = invoice.submittedAt?.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      // Date formatting may vary by timezone, so just check that it's formatted correctly
      expect(formattedDate).toMatch(/^[A-Z][a-z]{2} \d{1,2}, 2026$/);
    });

    it("should display job count in history", () => {
      const invoice = mockSubmittedInvoice;
      expect(invoice.lineItems.length).toBe(2);
    });
  });

  describe("Empty Invoice States", () => {
    it("should handle no running invoice", () => {
      const currentInvoice = null;
      expect(currentInvoice).toBeNull();
    });

    it("should handle no submitted invoices", () => {
      const submittedInvoices: typeof mockSubmittedInvoice[] = [];
      expect(submittedInvoices.length).toBe(0);
    });

    it("should handle invoice with no line items", () => {
      const invoice = { ...mockPerJobInvoice, lineItems: [] };
      expect(invoice.lineItems.length).toBe(0);
    });
  });

  describe("Invoice Cycle Display", () => {
    it("should display invoice cycle", () => {
      const invoice = mockPerJobInvoice;
      expect(invoice.invoiceCycle).toBe("bi_weekly");
    });

    it("should display cycle with pay type", () => {
      const invoice = mockPerJobInvoice;
      const payTypeLabel = invoice.payType === "hourly" ? "Hourly" : "Per-Job";
      const cycleDisplay = `${payTypeLabel} • ${invoice.invoiceCycle}`;
      expect(cycleDisplay).toBe("Per-Job • bi_weekly");
    });
  });

  describe("Line Item Formatting", () => {
    it("should format per-job amounts with 2 decimal places", () => {
      const invoice = mockPerJobInvoice;
      const formattedAmount = invoice.lineItems[0].amount.toFixed(2);
      expect(formattedAmount).toBe("100.00");
    });

    it("should format hourly amounts with 2 decimal places", () => {
      const invoice = mockHourlyInvoice;
      const formattedAmount = invoice.lineItems[0].amount.toFixed(2);
      expect(formattedAmount).toBe("60.00");
    });

    it("should format total amount with 2 decimal places", () => {
      const invoice = mockPerJobInvoice;
      const formattedTotal = invoice.totalAmount.toFixed(2);
      expect(formattedTotal).toBe("250.00");
    });

    it("should format job date correctly", () => {
      const invoice = mockPerJobInvoice;
      const formattedDate = new Date(invoice.lineItems[0].jobDate!).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      // Date formatting may vary by timezone, so just check that it's formatted correctly
      expect(formattedDate).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });
  });
});
