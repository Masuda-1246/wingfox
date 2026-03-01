import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const MAIN_EMAIL = "edwardeffendy07@gmail.com";
const MAIN_PASSWORD = "testpass123";

test("Record Phase 2 - Match & Chat", async ({ page, context }) => {
  test.setTimeout(120_000);

  // Login
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
    await page.goto("/chat");
  }

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // --- My Persona page ---
  const personaLink = page.locator('a[href="/personas/me"]');
  if (await personaLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await personaLink.click();
  } else {
    await page.goto("/personas/me");
  }

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);

  // Scroll through Fox description
  await page.mouse.wheel(0, 250);
  await page.waitForTimeout(1500);

  // Click DNA tab if visible
  const dnaTab = page.getByRole("button", { name: "DNA" });
  if (await dnaTab.isVisible().catch(() => false)) {
    await dnaTab.click();
    await page.waitForTimeout(2500);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(1500);
  }

  // Go back to Bio tab
  const bioTab = page.getByRole("button", { name: "Bio" });
  if (await bioTab.isVisible().catch(() => false)) {
    await bioTab.click();
    await page.waitForTimeout(1000);
  }

  // --- Navigate to Chat ---
  await page.goto("/chat");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // Try to click a match card
  const allButtons = page.locator('button[type="button"]');
  const buttonCount = await allButtons.count();

  let matchClicked = false;
  for (let i = 0; i < buttonCount && !matchClicked; i++) {
    const btn = allButtons.nth(i);
    const text = await btn.textContent().catch(() => "");
    // Match cards typically have longer text content with names/scores
    if (text && text.length > 20 && !text.includes("Explore")) {
      await btn.click();
      await page.waitForTimeout(2000);
      matchClicked = true;
    }
  }

  if (matchClicked) {
    // Show Fox Conversation tab
    const foxConvTab = page.getByRole("button", {
      name: /fox conversation/i,
    });
    if (await foxConvTab.isVisible().catch(() => false)) {
      await foxConvTab.click();
      await page.waitForTimeout(2500);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(1500);
    }

    // Show Chat with Fox tab
    const chatFoxTab = page.getByRole("button", {
      name: /chat with fox/i,
    });
    if (await chatFoxTab.isVisible().catch(() => false)) {
      await chatFoxTab.click();
      await page.waitForTimeout(2500);
    }
  }

  // Show the Explore Foxes button area
  const exploreFoxBtn = page.getByRole("button", {
    name: /explore foxes/i,
  });
  if (await exploreFoxBtn.isVisible().catch(() => false)) {
    await page.waitForTimeout(1500);
  }

  await page.waitForTimeout(2000);

  // Copy the recorded video to public/
  const videoPath = await page.video()?.path();
  await context.close();

  if (videoPath) {
    const destPath = path.join(__dirname, "..", "public", "demo-phase2.webm");
    fs.copyFileSync(videoPath, destPath);
    console.log(`Video saved to ${destPath}`);
  }
});
