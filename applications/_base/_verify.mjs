import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({});
const ctx = await browser.newContext({
  viewport: { width: 850, height: 1400 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const url = 'file:///' + resolve(__dirname, 'resume.html').replace(/\\/g, '/');
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Measure overflow against the PRINT-MODE content area, not the screen body height.
// Screen has overflow:visible on body so content can render into the bottom-padding
// region invisibly. Print honors padding-bottom, so any content past
// (body_top + body_height - padding_bottom) spills to page 2.
const measurements = await page.evaluate(() => {
  const body = document.body;
  const bodyStyles = getComputedStyle(body);
  const bodyRect = body.getBoundingClientRect();
  const header = document.querySelector('header.hero');
  const headerRect = header.getBoundingClientRect();
  const sections = document.querySelectorAll('section');
  const last = sections[sections.length - 1];
  const lastRect = last.getBoundingClientRect();

  const paddingTop = parseFloat(bodyStyles.paddingTop);
  const paddingBottom = parseFloat(bodyStyles.paddingBottom);
  const bodyTop = bodyRect.top;
  const pageHeightPx = 1123;  // A4 297mm @ 96dpi

  // Print-mode content area: from (bodyTop + paddingTop) to (bodyTop + pageHeight - paddingBottom)
  const contentAreaBottom = bodyTop + pageHeightPx - paddingBottom;
  const contentAreaTop = bodyTop + paddingTop;

  // The thing that actually matters: does content fit in the print content area?
  const print_overflow_px = lastRect.bottom - contentAreaBottom;

  // Screen-only metric (for the balance dial)
  const top_space = headerRect.top - bodyTop;
  const bottom_space = (bodyTop + pageHeightPx) - lastRect.bottom;

  return {
    // PRINT GATE — this is the ship-or-don't number
    print_overflow_px: +print_overflow_px.toFixed(2),
    print_overflow_inches: +(print_overflow_px / 96).toFixed(3),
    print_content_area_height_in: +((pageHeightPx - paddingTop - paddingBottom) / 96).toFixed(3),

    // Legacy on-screen overflow (kept for compat; measures vs body's 11in mark, NOT print content area)
    content_overflow_past_11in: +(lastRect.bottom - (bodyTop + pageHeightPx)).toFixed(2),

    // Balance gate
    top_space_px: +top_space.toFixed(2),
    bottom_space_px: +bottom_space.toFixed(2),
    asymmetry_px: +(top_space - bottom_space).toFixed(2),
    top_space_inches: +(top_space / 96).toFixed(3),
    bottom_space_inches: +(bottom_space / 96).toFixed(3),

    // Body padding (for debugging)
    padding_top_px: paddingTop,
    padding_bottom_px: paddingBottom,
  };
});
console.log('MEASUREMENTS:', JSON.stringify(measurements, null, 2));

const out = resolve(__dirname, '_verify-screenshot.png');
await page.screenshot({ path: out, fullPage: true });
console.log('Wrote', out);
await browser.close();
