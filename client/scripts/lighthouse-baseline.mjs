import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const cwd = process.cwd();
const reportsDir = path.join(cwd, '.lighthouse');
const latestReportPath = path.join(reportsDir, 'desktop-latest.report.json');
const latestSummaryPath = path.join(reportsDir, 'desktop-latest.summary.json');
const baselineSummaryPath = path.join(reportsDir, 'desktop-baseline.summary.json');
const baselineReportPath = path.join(reportsDir, 'desktop-baseline.report.json');
const chromeProfileDir = path.join(cwd, '.lh-profile');
const shouldBuild = !process.argv.includes('--no-build');
const shouldUpdateBaseline = process.argv.includes('--update-baseline');
const pagePath = process.env.LH_PATH || '/login';
const runs = Number(process.env.LH_RUNS || 1);
const preferredPort = Number(process.env.LH_PORT || 0);
const NODE_BIN = process.execPath;
const VITE_CLI = path.join(cwd, 'node_modules', 'vite', 'bin', 'vite.js');
const LIGHTHOUSE_CLI = path.join(cwd, 'node_modules', 'lighthouse', 'cli', 'index.js');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: 'inherit',
      ...options,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      return reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPreviewReady(baseUrl, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) return;
    } catch {
      // keep retrying
    }
    await wait(400);
  }
  throw new Error(`Preview server did not become ready in ${timeoutMs}ms`);
}

function startPreview(preferredPort) {
  const args = [VITE_CLI, 'preview', '--port', String(preferredPort)];
  const child = spawn(NODE_BIN, args, {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let localUrl = '';
  child.stdout.on('data', (chunk) => {
    const text = String(chunk);
    process.stdout.write(text);
    if (!localUrl) {
      const match = text.match(/Local:\s+(https?:\/\/[^\s]+)/);
      if (match?.[1]) {
        localUrl = match[1].replace(/\/$/, '');
      }
    }
  });
  child.stderr.on('data', (chunk) => process.stderr.write(String(chunk)));
  return {
    child,
    getLocalUrl: () => localUrl,
  };
}

function killProcess(child) {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
}

function extractSummary(reportJson, url) {
  const categories = reportJson.categories || {};
  const audits = reportJson.audits || {};
  return {
    url,
    performance: Math.round((categories.performance?.score || 0) * 100),
    accessibility: Math.round((categories.accessibility?.score || 0) * 100),
    bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
    seo: Math.round((categories.seo?.score || 0) * 100),
    fcpMs: Math.round(audits['first-contentful-paint']?.numericValue || 0),
    lcpMs: Math.round(audits['largest-contentful-paint']?.numericValue || 0),
    speedIndexMs: Math.round(audits['speed-index']?.numericValue || 0),
    tbtMs: Math.round(audits['total-blocking-time']?.numericValue || 0),
    cls: Number(audits['cumulative-layout-shift']?.numericValue || 0),
    requests: audits['network-requests']?.details?.items?.length || 0,
    totalBytes: audits['total-byte-weight']?.numericValue || 0,
  };
}

function averageSummaries(items) {
  if (!items.length) return null;
  const avg = { ...items[0] };
  const keys = ['performance', 'accessibility', 'bestPractices', 'seo', 'fcpMs', 'lcpMs', 'speedIndexMs', 'tbtMs', 'cls', 'requests', 'totalBytes'];
  for (const key of keys) {
    avg[key] = items.reduce((sum, x) => sum + Number(x[key] || 0), 0) / items.length;
  }
  avg.performance = Math.round(avg.performance);
  avg.accessibility = Math.round(avg.accessibility);
  avg.bestPractices = Math.round(avg.bestPractices);
  avg.seo = Math.round(avg.seo);
  avg.fcpMs = Math.round(avg.fcpMs);
  avg.lcpMs = Math.round(avg.lcpMs);
  avg.speedIndexMs = Math.round(avg.speedIndexMs);
  avg.tbtMs = Math.round(avg.tbtMs);
  avg.cls = Number(avg.cls.toFixed(3));
  avg.requests = Math.round(avg.requests);
  avg.totalBytes = Math.round(avg.totalBytes);
  return avg;
}

function formatDelta(now, prev) {
  if (typeof prev !== 'number') return 'n/a';
  const delta = now - prev;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}`;
}

async function runLighthouse(url, outputPath) {
  const args = [
    LIGHTHOUSE_CLI,
    url,
    '--preset=desktop',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--output=json',
    `--output-path=${outputPath}`,
    `--chrome-flags=--headless --disable-gpu --disable-dev-shm-usage --window-size=1350,940 --no-sandbox --user-data-dir=${chromeProfileDir}`,
    '--max-wait-for-load=60000',
    '--quiet',
  ];
  try {
    await runCommand(NODE_BIN, args);
  } catch (err) {
    if (fs.existsSync(outputPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        if (parsed?.categories) {
          console.warn('[lh] lighthouse exited non-zero on Windows, but report was generated. Continue.');
          return;
        }
      } catch {
        // ignore and throw original error below
      }
    }
    throw err;
  }
}

async function main() {
  ensureDir(reportsDir);
  ensureDir(chromeProfileDir);

  if (shouldBuild) {
    console.log('\n[lh] building production bundle...');
    await runCommand('npm', ['run', 'build']);
  }

  let url;
  const runResults = [];
  const tempReports = [];

  let preview;
  try {
    console.log(`\n[lh] starting preview server (preferred port: ${preferredPort || 'auto'})`);
    const previewCtl = startPreview(preferredPort);
    preview = previewCtl.child;
    const started = Date.now();
    while (!previewCtl.getLocalUrl() && Date.now() - started < 20000) {
      if (preview.exitCode !== null) {
        throw new Error('[lh] preview server exited before becoming ready');
      }
      await wait(300);
    }
    const localBase = previewCtl.getLocalUrl();
    if (!localBase) {
      throw new Error('[lh] failed to detect preview local URL');
    }
    await waitForPreviewReady(localBase);
    url = `${localBase}${pagePath}`;

    for (let i = 0; i < runs; i += 1) {
      const file = path.join(reportsDir, `desktop-run-${i + 1}.json`);
      tempReports.push(file);
      console.log(`\n[lh] run ${i + 1}/${runs} -> ${url}`);
      await runLighthouse(url, file);
      const report = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (report.runtimeError) {
        throw new Error(`[lh] runtime error: ${report.runtimeError.code} ${report.runtimeError.message}`);
      }
      runResults.push(extractSummary(report, url));
    }
  } finally {
    killProcess(preview);
  }

  const summary = averageSummaries(runResults);
  const latestReportSource = tempReports[tempReports.length - 1];
  fs.copyFileSync(latestReportSource, latestReportPath);
  fs.writeFileSync(latestSummaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  for (const file of tempReports) {
    if (file !== latestReportPath && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  let baseline = null;
  if (fs.existsSync(baselineSummaryPath)) {
    baseline = JSON.parse(fs.readFileSync(baselineSummaryPath, 'utf8'));
  }
  if (shouldUpdateBaseline || !baseline) {
    fs.copyFileSync(latestReportPath, baselineReportPath);
    fs.writeFileSync(baselineSummaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    baseline = summary;
    console.log('[lh] baseline updated.');
  }

  console.log('\n[lh] latest summary');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\n[lh] compare vs baseline');
  console.log(`performance:   ${summary.performance} (${formatDelta(summary.performance, baseline.performance)})`);
  console.log(`accessibility: ${summary.accessibility} (${formatDelta(summary.accessibility, baseline.accessibility)})`);
  console.log(`bestPractices: ${summary.bestPractices} (${formatDelta(summary.bestPractices, baseline.bestPractices)})`);
  console.log(`seo:           ${summary.seo} (${formatDelta(summary.seo, baseline.seo)})`);
  console.log(`fcpMs:         ${summary.fcpMs} (${formatDelta(summary.fcpMs, baseline.fcpMs)})`);
  console.log(`lcpMs:         ${summary.lcpMs} (${formatDelta(summary.lcpMs, baseline.lcpMs)})`);
  console.log(`speedIndexMs:  ${summary.speedIndexMs} (${formatDelta(summary.speedIndexMs, baseline.speedIndexMs)})`);
  console.log(`tbtMs:         ${summary.tbtMs} (${formatDelta(summary.tbtMs, baseline.tbtMs)})`);
  console.log(`requests:      ${summary.requests} (${formatDelta(summary.requests, baseline.requests)})`);
  console.log(`totalBytes:    ${summary.totalBytes} (${formatDelta(summary.totalBytes, baseline.totalBytes)})`);
  console.log('\n[lh] artifacts');
  console.log(`- ${path.relative(cwd, latestReportPath)}`);
  console.log(`- ${path.relative(cwd, latestSummaryPath)}`);
  console.log(`- ${path.relative(cwd, baselineSummaryPath)}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
