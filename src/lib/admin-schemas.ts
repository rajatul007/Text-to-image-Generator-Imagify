import { z } from "zod";
import { STYLE_IDS } from "./ai/styles";
import { CATEGORY_IDS } from "@/data/prompt-categories";

export const promptTemplateSchema = z.object({
  title: z.string().trim().min(3).max(80),
  prompt: z.string().trim().min(10).max(2000),
  negativePrompt: z.string().trim().max(1000).optional().nullable(),
  category: z.enum(CATEGORY_IDS),
  style: z.enum(STYLE_IDS),
  aspectRatio: z.string().max(6).default("1:1"),
  previewImageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || v.startsWith("/") || v.startsWith("https://"), "Preview URL must be https:// or a site-relative path")
    .optional()
    .nullable(),
  tags: z.array(z.string().trim().toLowerCase().max(24)).max(10).default([]),
  featured: z.boolean().default(false),
  status: z.enum(["PUBLISHED", "PENDING", "ARCHIVED"]).default("PUBLISHED"),
});

export const packageSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,30}$/),
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(120).optional().nullable(),
  credits: z.number().int().min(1).max(1_000_000),
  pricePaise: z.number().int().min(100).max(100_000_000),
  active: z.boolean().default(true),
  highlight: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export const planPatchSchema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  description: z.string().trim().max(120).optional().nullable(),
  monthlyCredits: z.number().int().min(1).max(1_000_000).optional(),
  pricePaise: z.number().int().min(100).max(100_000_000).optional(),
  razorpayPlanId: z.string().trim().regex(/^plan_[A-Za-z0-9]+$/, "Razorpay plan ids look like plan_XXXXXXXX").optional().nullable(),
  features: z.array(z.string().trim().max(80)).max(8).optional(),
  active: z.boolean().optional(),
});

export const modelPatchSchema = z.object({
  enabled: z.boolean().optional(),
  displayName: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(300).optional().nullable(),
  creditsPerImage: z.number().int().min(0).max(10_000).optional(),
  hdMultiplier: z.number().int().min(1).max(10).optional(),
  maxImages: z.number().int().min(1).max(8).optional(),
  estimatedCostUsd: z.number().min(0).max(100).optional(),
  modelVersion: z.string().trim().min(1).max(120).optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(100),
  body: z.string().trim().min(3).max(1000),
  level: z.enum(["info", "success", "warning"]).default("info"),
  active: z.boolean().default(true),
  endsAt: z.string().datetime().optional().nullable(),
});
