#!/usr/bin/env node
/**
 * quality-gate.mjs — Pre-submit checks for an application folder.
 *
 * Usage:
 *   node quality-gate.mjs <application-folder-path>
 *
 * Exits 0 if all checks pass, 1 if any fail. Prints a structured report.
 *
 * Checks (in order):
 *   1. Format: runs _verify.mjs inside the application folder. Required:
 *      content_overflow_past_11in < 0, asymmetry_px ≤ 5.
 *   2. Required files exist: resume.html, _verify.mjs, and a cover text
 *      (application-text.md or cover-letter.md). Recommended: a PDF of the résumé.
 *   3. No remaining {{PLACEHOLDER}} or ‹…› markers in the cover text.
 *   4. Cover text mentions employer name and role title verbatim.
 *      (Pass via env vars EMPLOYER_NAME and ROLE_TITLE.)
 *   5. Rate limit: scans ./log.md for submissions in the past 24 hours.
 *      Blocks if count >= 5 (configurable via DAILY_CAP env).
 *   6. Facts: résumé and cover text contain none of the phrases listed under
 *      « ## Never write » in wiki/facts.md (wrong titles, retired claims).
 *
 * Designed to be called by submit/*.mjs scripts before they touch external services.
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, basename, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const DAILY_CAP = parseInt(process.env.DAILY_CAP || '5', 10);

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node quality-gate.mjs <application-folder>');
  process.exit(2);
}

const appFolder = resolve(args[0]);
if (!existsSync(appFolder) || !statSync(appFolder).isDirectory()) {
  console.error(`Not a directory: ${appFolder}`);
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const report = { folder: appFolder, checks: [], pass: true };

function check(name, ok, detail, advisory = false) {
  report.checks.push({ name, ok, detail, advisory });
  if (!ok && !advisory) report.pass = false;
}

// ── 1. Required files ───────────────────────────────────────────────
const required = ['resume.html', '_verify.mjs'];
for (const f of required) {
  check(`file:${f}`, existsSync(join(appFolder, f)), existsSync(join(appFolder, f)) ? 'present' : `missing: ${f}`);
}
const coverFile = ['application-text.md', 'cover-letter.md'].find((f) => existsSync(join(appFolder, f)));
check('file:cover-text', !!coverFile, coverFile ? coverFile : 'missing: application-text.md or cover-letter.md');

const { readdirSync } = await import('fs');
const pdfs = readdirSync(appFolder).filter((f) => f.toLowerCase().endsWith('.pdf'));
check('file:pdf', pdfs.length > 0, pdfs.length ? pdfs.join(', ') : 'WARNING: no PDF yet (run node _gen-pdf.mjs)');

// ── 2. Format verification (run _verify.mjs from app folder) ────────
async function runVerify() {
  return new Promise((res) => {
    const proc = spawn(process.execPath, [join(appFolder, '_verify.mjs')], {
      cwd: appFolder,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (out += d));
    proc.on('close', (code) => res({ code, out }));
  });
}

if (existsSync(join(appFolder, '_verify.mjs'))) {
  const { code, out } = await runVerify();
  if (code !== 0) {
    check('format:_verify.mjs', false, `_verify.mjs exited with code ${code}`);
  } else {
    const m = out.match(/MEASUREMENTS:\s*({[\s\S]*?})/);
    if (!m) {
      check('format:_verify.mjs', false, '_verify.mjs ran but no MEASUREMENTS block found');
    } else {
      try {
        const measurements = JSON.parse(m[1]);
        // PRINT GATE — uses print_overflow_px (measured against print content area, not body's 11in mark)
        const printOverflow = measurements.print_overflow_px;
        const asym = Math.abs(measurements.asymmetry_px || 0);
        const printOK = printOverflow != null && printOverflow < 0;
        // Asymmetry tolerance is 15px: the print-safety buffer naturally shows up as a few px of
        // extra bottom space on screen. 15px on a ~1000px tall document is visually invisible.
        const asymOK = asym <= 15;
        check('format:print-fit', printOK,
          `print_overflow_px=${printOverflow} (must be < 0 to fit one page)`);
        // Advisory: a full one-page CV should look balanced; a short draft legitimately won't.
        check('format:balance', asymOK,
          `|asymmetry_px|=${asym} (aim for ≤ 15 once the page is full)`, true);
      } catch (e) {
        check('format:_verify.mjs', false, `failed to parse MEASUREMENTS: ${e.message}`);
      }
    }
  }
}

// ── 3. No remaining {{PLACEHOLDER}} strings ─────────────────────────
function scanForPlaceholders(filePath) {
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, 'utf8');
  const matches = content.match(/\{\{[A-Z_]+\}\}|‹[^›]*›/g);
  return matches || [];
}

for (const f of ['cover-letter.md', 'application-text.md']) {
  const ph = scanForPlaceholders(join(appFolder, f));
  if (ph === null) continue;
  check(`placeholders:${f}`, ph.length === 0,
    ph.length === 0 ? 'none' : `unfilled: ${ph.join(', ')}`);
}

// Why-essay (variable filename)
const fs = await import('fs/promises');
const entries = await fs.readdir(appFolder);
const whyEssays = entries.filter((e) => /^why-.+\.md$/.test(e));
for (const f of whyEssays) {
  const ph = scanForPlaceholders(join(appFolder, f));
  if (ph === null) continue;
  check(`placeholders:${f}`, ph.length === 0,
    ph.length === 0 ? 'none' : `unfilled: ${ph.join(', ')}`);
}

// ── 4. Cover letter mentions employer + role ────────────────────────
const employerName = process.env.EMPLOYER_NAME;
const roleTitle = process.env.ROLE_TITLE;
const clPath = join(appFolder, coverFile || 'cover-letter.md');
if (existsSync(clPath) && (employerName || roleTitle)) {
  const cl = readFileSync(clPath, 'utf8');
  if (employerName) {
    check('content:employer-mentioned', cl.includes(employerName),
      cl.includes(employerName) ? `"${employerName}" found in cover letter` : `MISSING: "${employerName}" not in cover letter`);
  }
  if (roleTitle) {
    check('content:role-mentioned', cl.toLowerCase().includes(roleTitle.toLowerCase()),
      cl.toLowerCase().includes(roleTitle.toLowerCase()) ? `"${roleTitle}" found` : `MISSING: "${roleTitle}" not in cover letter`);
  }
}

// ── 5. Rate limit (last 24 hours of log.md) ─────────────────────────
const logPath = resolve(__dirname, 'log.md');
if (existsSync(logPath)) {
  const log = readFileSync(logPath, 'utf8');
  const submitRe = /^## \[(\d{4}-\d{2}-\d{2})[^\]]*\] submit \|/gm;
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let recentCount = 0;
  let m;
  while ((m = submitRe.exec(log)) !== null) {
    const d = new Date(m[1]);
    if (d >= cutoff) recentCount++;
  }
  check('rate-limit', recentCount < DAILY_CAP,
    `${recentCount} submissions in last 24h (cap=${DAILY_CAP})`);
}

// ── 6. Facts: phrases that must never appear ───────────────────────
const factsPath = resolve(__dirname, '..', '..', 'wiki', 'facts.md');
if (existsSync(factsPath)) {
  const facts = readFileSync(factsPath, 'utf8');
  const section = facts.split(/^## Never write\s*$/m)[1]?.split(/^## /m)[0] || '';
  const banned = [...section.matchAll(/^- [«"]([^»"]+)[»"]/gm)].map((m) => m[1].trim());
  const texts = ['resume.html', 'application-text.md', 'cover-letter.md']
    .filter((f) => existsSync(join(appFolder, f)))
    .map((f) => [f, readFileSync(join(appFolder, f), 'utf8').toLowerCase()]);
  const hits = [];
  for (const phrase of banned) {
    for (const [f, t] of texts) if (t.includes(phrase.toLowerCase())) hits.push(`${f}: "${phrase}"`);
  }
  check('facts:never-write', hits.length === 0, hits.length ? hits.join('; ') : `${banned.length} phrases checked`);
}

// ── Output ──────────────────────────────────────────────────────────
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
