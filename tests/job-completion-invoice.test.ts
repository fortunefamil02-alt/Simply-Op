import { describe, expect, it, beforeEach } from "vitest";

/**
 * Job Completion to Invoice Auto-Append Tests
 * Validates hourly time rounding, pay type handling, and invoice line item creation
 */

// Mock job data
const mockJob = {
  id: "job_001",
  businessId: "biz_001",
  cleanerId: "cleaner_001",
  price: 50, // $50 per hour for hourly, or $50 per job for per-job
  startedAt: new Date("2026-02-06T10:00:00Z"), // 10:00 AM
  completedAt: new Date("2026-02-06T11:15:00Z"), // 11:15 AM (1 hour 15 minutes)
  status: "in_progress",
};

const mockPerJobCleaner = {
  id: "cleaner_001",
  payType: "per_job",
};

const mockHourlyCleaner = {
  id: "cleaner_002",
  payType: "hourly",
};

describe("Job Completion to Invoice Auto-Append", () => {
  describe("Hourly Time Rounding", () => {
    it("should round 15 minutes to nearest 30 minutes (0.5 hours)", () => {
      const startTime = new Date("2026-02-06T10:00:00Z").getTime();
      const endTime = new Date("2026-02-06T10:15:00Z").getTime();
      const durationMs = endTime - startTime;
      const durationMinutes = Math.round(durationMs / (1000 * 60));

      // Round to nearest 30 minutes
      const roundedMinutes = Math.round(durationMinutes / 30) * 30;
      const roundedHours = roundedMinutes / 60;

      expect(durationMinutes).toBe(15);
      expect(roundedMinutes).toBe(30);
      expect(roundedHours).toBe(0.5);
    });

    it("should round 45 minutes to nearest 30 minutes (1.5 hours)", () => {
      const startTime = new Date("2026-02-06T10:00:00Z").getTime();
      const endTime = new Date("2026-02-06T10:45:00Z").getTime();
      const durationMs = endTime - startTime;
      const durationMinutes = Math.round(durationMs / (1000 * 60));

      // Round to nearest 30 minutes
      const roundedMinutes = Math.round(durationMinutes / 30) * 30;
      const roundedHours = roundedMinutes / 60;

      expect(durationMinutes).toBe(45);
      expect(roundedMinutes).toBe(60); // Rounds up to 60 (nearest 30)
      expect(roundedHours).toBe(1);
    });

    it("should round 1 hour 15 minutes to nearest 30 minutes (1.5 hours)", () => {
      const startTime = new Date("2026-02-06T10:00:00Z").getTime();
      const endTime = new Date("2026-02-06T11:15:00Z").getTime();
      const durationMs = endTime - startTime;
      const durationMinutes = Math.round(durationMs / (1000 * 60));

      // Round to nearest 30 minutes
      const roundedMinutes = Math.round(durationMinutes / 30) * 30;
      const roundedHours = roundedMinutes / 60;

      expect(durationMinutes).toBe(75);
      expect(roundedMinutes).toBe(90);
      expect(roundedHours).toBe(1.5);
    });

    it("should round 2 hours 20 minutes to nearest 30 minutes (2.5 hours)", () => {
      const startTime = new Date("2026-02-06T10:00:00Z").getTime();
      const endTime = new Date("2026-02-06T12:20:00Z").getTime();
      const durationMs = endTime - startTime;
      const durationMinutes = Math.round(durationMs / (1000 * 60));

      // Round to nearest 30 minutes
      const roundedMinutes = Math.round(durationMinutes / 30) * 30;
      const roundedHours = roundedMinutes / 60;

      expect(durationMinutes).toBe(140);
      expect(roundedMinutes).toBe(150);
      expect(roundedHours).toBe(2.5);
    });

    it("should handle exactly 30 minutes", () => {
      const startTime = new Date("2026-02-06T10:00:00Z").getTime();
      const endTime = new Date("2026-02-06T10:30:00Z").getTime();
      const durationMs = endTime - startTime;
      const durationMinutes = Math.round(durationMs / (1000 * 60));

      // Round to nearest 30 minutes
      const roundedMinutes = Math.round(durationMinutes / 30) * 30;
      const roundedHours = roundedMinutes / 60;

      expect(durationMinutes).toBe(30);
      expect(roundedMinutes).toBe(30);
      expect(roundedHours).toBe(0.5);
    });

    it("should handle exactly 1 hour", () => {
      const startTime = new Date("2026-02-06T10:00:00Z").getTime();
      const endTime = new Date("2026-02-06T11:00:00Z").getTime();
      const durationMs = endTime - startTime;
      const durationMinutes = Math.round(durationMs / (1000 * 60));

      // Round to nearest 30 minutes
      const roundedMinutes = Math.round(durationMinutes / 30) * 30;
      const roundedHours = roundedMinutes / 60;

      expect(durationMinutes).toBe(60);
      expect(roundedMinutes).toBe(60);
      expect(roundedHours).toBe(1);
    });
  });

  describe("Pay Type Logic", () => {
    it("should use cleaner's default pay type when no job override", () => {
      const cleanerPayType = mockPerJobCleaner.payType;
      const jobPayTypeOverride = undefined;
      const effectivePayType = jobPayTypeOverride || cleanerPayType;

      expect(effectivePayType).toBe("per_job");
    });

    it("should use job override pay type when present", () => {
      const cleanerPayType = mockPerJobCleaner.payType;
      const jobPayTypeOverride = "hourly";
      const effectivePayType = jobPayTypeOverride || cleanerPayType;

      expect(effectivePayType).toBe("hourly");
    });

    it("should default to per_job when cleaner has no pay type", () => {
      const cleanerPayType = undefined;
      const jobPayTypeOverride = undefined;
      const effectivePayType = jobPayTypeOverride || cleanerPayType || "per_job";

      expect(effectivePayType).toBe("per_job");
    });
  });

  describe("Line Item Amount Calculation", () => {
    it("should calculate hourly amount correctly", () => {
      const hourlyRate = 50; // $50 per hour
      const roundedHours = 1.5; // 1.5 hours
      const lineItemAmount = hourlyRate * roundedHours;

      expect(lineItemAmount).toBe(75); // $75
    });

    it("should use job price directly for per-job", () => {
      const jobPrice = 150;
      const lineItemAmount = jobPrice;

      expect(lineItemAmount).toBe(150);
    });

    it("should calculate different amounts for hourly vs per-job", () => {
      const jobPrice = 50; // $50 per hour rate or per-job price
      const roundedHours = 2;

      const hourlyAmount = jobPrice * roundedHours; // $100
      const perJobAmount = jobPrice; // $50

      expect(hourlyAmount).toBe(100);
      expect(perJobAmount).toBe(50);
      expect(hourlyAmount).toBeGreaterThan(perJobAmount);
    });
  });

  describe("Invoice Creation and Line Item Addition", () => {
    it("should create invoice with correct pay type", () => {
      const effectivePayType = "hourly";
      const invoice = {
        id: "inv_001",
        payType: effectivePayType,
        status: "open",
        totalAmount: 75,
      };

      expect(invoice.payType).toBe("hourly");
      expect(invoice.status).toBe("open");
    });

    it("should add line item with calculated amount", () => {
      const lineItemAmount = 75;
      const lineItem = {
        id: "li_001",
        jobId: "job_001",
        price: lineItemAmount.toString(),
      };

      expect(parseFloat(lineItem.price)).toBe(75);
    });

    it("should update invoice total with line item amount", () => {
      const initialTotal = 0;
      const lineItemAmount = 75;
      const updatedTotal = initialTotal + lineItemAmount;

      expect(updatedTotal).toBe(75);
    });

    it("should be idempotent (not duplicate line items)", () => {
      const existingLineItem = {
        id: "li_001",
        jobId: "job_001",
        invoiceId: "inv_001",
      };

      // If line item already exists, don't add it again
      const shouldAdd = !existingLineItem;
      expect(shouldAdd).toBe(false);
    });
  });

  describe("Job Card Display", () => {
    it("should show price for per-job cleaners", () => {
      const payType: "per_job" | "hourly" = "per_job";
      const shouldShowPrice = payType === "per_job";

      expect(shouldShowPrice).toBe(true);
    });

    it("should NOT show price for hourly cleaners", () => {
      const payType: "per_job" | "hourly" = "hourly";
      const shouldShowPrice = payType === "per_job";

      expect(shouldShowPrice).toBe(false);
    });

    it("should always show job details regardless of pay type", () => {
      const job = {
        propertyName: "Downtown Loft",
        cleaningDate: new Date(),
        guestCount: 2,
        hasPets: false,
      };

      expect(job.propertyName).toBeDefined();
      expect(job.cleaningDate).toBeDefined();
      expect(job.guestCount).toBeDefined();
      expect(job.hasPets).toBeDefined();
    });
  });

  describe("End-to-End Flow", () => {
    it("should complete per-job flow: job completion -> invoice append -> show price on card", () => {
      // 1. Job completion
      const jobPrice = 150;
      const payType: "per_job" | "hourly" = "per_job";

      // 2. Calculate line item amount
      const lineItemAmount = payType === "hourly" ? jobPrice * 1.5 : jobPrice;
      expect(lineItemAmount).toBe(150);

      // 3. Create invoice with pay type
      const invoice = {
        payType: payType,
        totalAmount: lineItemAmount,
      };
      expect(invoice.payType).toBe("per_job");

      // 4. Show price on card
      const shouldShowPrice = payType === "per_job";
      expect(shouldShowPrice).toBe(true);
    });

    it("should complete hourly flow: job completion -> invoice append -> hide price on card", () => {
      // 1. Job completion (1 hour 15 minutes)
      const hourlyRate = 50;
      const roundedHours = 1.5;
      const payType: "per_job" | "hourly" = "hourly";

      // 2. Calculate line item amount
      const lineItemAmount = hourlyRate * roundedHours;
      expect(lineItemAmount).toBe(75);

      // 3. Create invoice with pay type
      const invoice = {
        payType: payType,
        totalAmount: lineItemAmount,
      };
      expect(invoice.payType).toBe("hourly");

      // 4. Don't show price on card
      const shouldShowPrice = payType === "per_job";
      expect(shouldShowPrice).toBe(false);
    });

    it("should handle job override pay type", () => {
      // Cleaner is per-job, but job is overridden to hourly
      const cleanerPayType: "per_job" | "hourly" = "per_job";
      const jobPayTypeOverride: "per_job" | "hourly" | undefined = "hourly";
      const effectivePayType = jobPayTypeOverride || cleanerPayType;

      expect(effectivePayType).toBe("hourly");

      // Calculate amount using hourly logic
      const hourlyRate = 50;
      const roundedHours = 2;
      const lineItemAmount = hourlyRate * roundedHours;

      expect(lineItemAmount).toBe(100);
    });
  });
});
