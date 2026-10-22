import { expect, test } from "@playwright/test";
import { latestEmailLink } from "./helpers";

test("main user journey: sign up → verify → enhance → generate → publish → explore → share → revoke", async ({ page, browser }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // Landing page works logged out
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Turn Your Imagination Into Reality." })).toBeVisible();
  await page.getByLabel("Describe your image").fill("a lighthouse on a cliff in a storm");
  await page.getByRole("button", { name: /Generate – it's free to start/ }).click();

  // Sign up (redirected with the prompt preserved)
  await expect(page).toHaveURL(/\/signup\?next=/);
  await page.locator("#name").fill("E2E Tester");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("forge1234");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/generate/);
  await expect(page.getByText("Verify your email to start generating.")).toBeVisible();
  await expect(page.getByLabel("Prompt", { exact: true })).toHaveValue("a lighthouse on a cliff in a storm");

  // Verify email via the link that was "sent"
  await page.goto(await latestEmailLink(email, "verifyEmail"));
  await expect(page.getByText("Email verified")).toBeVisible();
  await expect(page.getByText(/25 credits/)).toBeVisible();

  // Prompt enhancer
  await page.goto("/generate?prompt=a%20cat%20in%20space");
  await page.getByRole("button", { name: "Prompt enhancer" }).click();
  await page.getByRole("radiogroup", { name: "Enhancement mode" }).getByRole("radio", { name: "Cinematic" }).click();
  await page.getByRole("button", { name: "Enhance prompt" }).last().click();
  const enhanced = page.getByLabel("Enhanced prompt 1");
  await expect(enhanced).toHaveValue(/highly detailed cinematic scene of a cat in space/);
  await page.getByRole("button", { name: "Use this prompt" }).click();
  await expect(page.getByLabel("Prompt", { exact: true })).toHaveValue(/cinematic scene of a cat in space/);

  // Generate with a fixed seed (Stable Image Core via the provider stub)
  await page.locator("#model").selectOption("stability-core");
  await page.getByText("Advanced settings").click();
  await page.locator("#seed").fill("4242");
  await expect(page.getByText("3 credits", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const card = page.locator("article").first();
  await expect(card.getByText("Completed")).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText(/seed 4242/)).toBeVisible();
  await expect(page.getByRole("link", { name: /22 credits/ })).toBeVisible();

  // History records the job with its seed
  await page.goto("/history");
  await expect(page.getByText(/seed 4242/).first()).toBeVisible();

  // Publish from My Creations
  await page.goto("/creations");
  await page.getByRole("button", { name: "Open image details" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("4242")).toBeVisible();
  await dialog.getByRole("switch", { name: "Show in Explore" }).click();
  await expect(page.getByText("Published to Explore")).toBeVisible();

  // Create a share link
  await dialog.getByRole("button", { name: "Create share link" }).click();
  const shareUrl = await dialog.getByLabel("Share URL").inputValue();
  expect(shareUrl).toMatch(/\/share\/[A-Za-z0-9_-]{30,}/);
  await page.keyboard.press("Escape");

  // Visible to an anonymous visitor in Explore and through the share link
  const anon = await browser.newContext();
  const visitor = await anon.newPage();
  await visitor.goto("/explore?sort=recent");
  await expect(visitor.locator('a[href^="/image/"]').first()).toBeVisible();
  await visitor.goto(shareUrl);
  await expect(visitor.getByRole("heading", { name: /Shared by E2E Tester/ })).toBeVisible();

  // Revoke → link stops working immediately
  await page.goto("/creations");
  await page.getByRole("button", { name: "Open image details" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Revoke link" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Revoke link" }).click();
  await expect(page.getByText("Share link revoked")).toBeVisible();
  await visitor.goto(shareUrl);
  await expect(visitor.getByRole("heading", { name: "This link isn't available" })).toBeVisible();

  // Make it private again → gone from Explore
  await page.getByRole("dialog").getByRole("switch", { name: "Show in Explore" }).click();
  await expect(page.getByText("Image is private again")).toBeVisible();
  await visitor.goto("/explore?sort=recent");
  await expect(visitor.getByText("Nothing here yet")).toBeVisible();
  await anon.close();

  // Ledger shows the welcome bonus and the generation charge
  await page.goto("/transactions");
  await expect(page.getByRole("button", { name: "Welcome bonus" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Image generation" })).toBeVisible();
});

test("protected pages redirect anonymous visitors to log in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("@mobile homepage and navigation work at phone width without horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Turn Your Imagination Into Reality." })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Pricing" }).click();
  await expect(page.getByRole("heading", { name: "Simple, credit-based pricing" })).toBeVisible();
});
