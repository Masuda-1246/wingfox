import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const DEMO_EMAIL = `demo-phase1-${Date.now()}@test.com`;
const DEMO_PASSWORD = "testpass123!";
const MAIN_EMAIL = "edwardeffendy07@gmail.com";
const MAIN_PASSWORD = "testpass123";

test("Record Phase 1 - Onboarding Flow", async ({ page, context }) => {
  test.setTimeout(120_000);

  // --- Part 1: New account registration + onboarding ---
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  await page.locator("#identifier").fill(DEMO_EMAIL);
  await page.waitForTimeout(400);
  await page.locator("#password").fill(DEMO_PASSWORD);
  await page.waitForTimeout(400);
  await page.locator("#confirmPassword").fill(DEMO_PASSWORD);
  await page.waitForTimeout(800);

  await page.getByRole("button", { name: /sign up/i }).click();

  // Wait for either navigation or error
  try {
    await page.waitForURL(/\/(onboarding|chat)/, { timeout: 30000 });
  } catch {
    // If registration fails, skip to Part 2 (completed persona)
    console.log("Registration failed or timed out, skipping to Part 2");
    await page.waitForTimeout(2000);
  }

  const currentUrl = page.url();

  if (currentUrl.includes("/onboarding")) {
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Profile page
    const nicknameInput = page.locator("#onboarding-nickname");
    if (await nicknameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nicknameInput.fill("Alex");
      await page.waitForTimeout(500);
      await page.locator("#onboarding-birth-year").fill("1995");
      await page.waitForTimeout(500);
      await page.locator("#onboarding-gender").selectOption("male");
      await page.waitForTimeout(800);

      await page.getByRole("button", { name: /continue/i }).click();

      try {
        await page.waitForURL("**/onboarding/quiz**", { timeout: 15000 });
      } catch {
        console.log("Failed to navigate to quiz page");
      }
    }

    // Quiz page
    if (page.url().includes("/quiz")) {
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(1000);

        // Find answer option buttons (inside the quiz grid)
        const answerButtons = page.locator(
          '[class*="grid"] button[type="button"]',
        );
        const count = await answerButtons.count();

        if (count > 0) {
          const pickIndex = i % Math.min(count, 4);
          await answerButtons.nth(pickIndex).click();
          await page.waitForTimeout(500);
        }

        // Click Next or Submit
        const nextBtn = page.getByRole("button", { name: /^next$/i });
        const submitBtn = page.getByRole("button", { name: /^submit$/i });

        if (await submitBtn.isVisible().catch(() => false)) {
          await submitBtn.click();
          break;
        } else if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
        }

        await page.waitForTimeout(500);
      }

      // Wait for navigation to speed-dating
      try {
        await page.waitForURL("**/onboarding/speed-dating**", {
          timeout: 15000,
        });
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(5000);
      } catch {
        console.log("Failed to navigate to speed-dating");
      }
    }
  }

  // --- Part 2: Show completed persona (main account) ---
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  await page.locator("#identifier").fill(MAIN_EMAIL);
  await page.locator("#password").fill(MAIN_PASSWORD);
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: /log in/i }).click();

  try {
    await page.waitForURL(/\/chat/, { timeout: 20000 });
  } catch {
    console.log("Login redirect failed, trying direct navigation");
    await page.goto("/chat");
  }

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // Navigate to My Persona
  const personaLink = page.locator('a[href="/personas/me"]');
  if (await personaLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await personaLink.click();
  } else {
    await page.goto("/personas/me");
  }

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);

  // Scroll through the persona page
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(2000);

  await page.waitForTimeout(1000);

  // Copy the recorded video to public/
  const videoPath = await page.video()?.path();
  await context.close();

  if (videoPath) {
    const destPath = path.join(__dirname, "..", "public", "demo-phase1.webm");
    fs.copyFileSync(videoPath, destPath);
    console.log(`Video saved to ${destPath}`);
  }
});
