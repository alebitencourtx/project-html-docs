import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { build } from '../scripts/build.mjs';

const execFileAsync = promisify(execFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function hasPlaywrightCli() {
  const probe = spawnSync('playwright-cli', ['--version'], { encoding: 'utf8' });
  return probe.status === 0;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
};

async function startStaticServer(baseDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = new URL(req.url, 'http://127.0.0.1').pathname;
      const rel = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath).replace(/^\/+/, '');
      const abs = path.resolve(baseDir, rel);
      if (!abs.startsWith(path.resolve(baseDir))) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      const data = await fs.readFile(abs);
      const ext = path.extname(abs).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function pw(session, args, cwd) {
  const { stdout } = await execFileAsync('playwright-cli', [`-s=${session}`, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 45000,
  });
  return stdout;
}

function extractResultJson(output) {
  const match = output.match(/### Result\s*\r?\n([^\r\n]+)/);
  if (!match) throw new Error(`Missing Playwright Result block in output:\n${output}`);
  return JSON.parse(match[1]);
}

const pwAvailable = hasPlaywrightCli();

test('M01, F10, F11, F12 & M05 headless Chromium: mobile drawer inert/Tab/Escape, Fit zoom-out/in monotonicity, print filtered table rows, and audience aria-pressed', { skip: !pwAvailable }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'phd-browser-doc-'));
  const session = `phd-doc-${process.pid}-${Date.now().toString(36)}`;
  let server;
  try {
    const rows = Array.from({ length: 8 }, (_, i) => `| \`col_${i}\` | row${i} | \`NOT NULL\` | Descr ${i} |`).join('\n');
    await fs.writeFile(path.join(dir, 'document.json'), JSON.stringify({
      title: 'Browser Regression Manual',
      subtitle: 'Chromium mobile & desktop verification',
      version: '1.10.0',
      updated: '2026-11-15',
      language: 'pt-BR',
      theme: 'vermelho',
      content: 'content.md',
      sections: [
        { id: 'overview', title: 'Visão Geral', audience: 'all' },
        { id: 'design', title: 'Desenho Amplo', audience: 'technical' },
        { id: 'dictionary', title: 'Dicionário Completo', audience: 'business' },
      ],
    }, null, 2));

    await fs.writeFile(path.join(dir, 'content.md'), [
      '## Visão Geral',
      '',
      'Texto introdutório com termos buscáveis.',
      '',
      '## Desenho Amplo',
      '',
      '```solution',
      JSON.stringify({
        title: 'Arquitetura Larga 4 Colunas',
        cols: 4,
        colWidth: 220,
        zones: [{ id: 'z1', title: 'PIPELINE', variant: 'warm', row: 0, colStart: 0, colSpan: 4 }],
        nodes: [
          { id: 'n0', col: 0, row: 0, role: 'regulator', title: 'Origem', lines: ['evento'] },
          { id: 'n1', col: 1, row: 0, step: 1, role: 'step', title: 'Ingestão', lines: ['spark'] },
          { id: 'n2', col: 2, row: 0, step: 2, role: 'step', title: 'Transformação', lines: ['delta'] },
          { id: 'n3', col: 3, row: 0, role: 'output', title: 'Entrega Final', lines: ['api'] },
        ],
        edges: [
          { from: 'n0', to: 'n1', label: 'lote' },
          { from: 'n1', to: 'n2', label: 'limpo' },
          { from: 'n2', to: 'n3', label: 'mart' },
        ],
      }),
      '```',
      '',
      '## Dicionário Completo',
      '',
      '| Coluna | Tag | Flags | Descrição |',
      '|---|---|---|---|',
      rows,
      '',
    ].join('\n'));

    await build(path.join(dir, 'document.json'), path.join(dir, 'doc.html'), { force: true });
    server = await startStaticServer(dir);

    await pw(session, ['open', '--browser=chromium', `${server.baseUrl}/doc.html`], dir);
    await pw(session, ['resize', '390', '844'], dir);

    const out = await pw(session, ['run-code', `async (page) => {
      const mobileChecks = await page.evaluate(() => {
        const sb = document.getElementById('sidebar');
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          sidebarInertInit: Boolean(sb && sb.inert),
          sidebarAriaHiddenInit: sb && sb.getAttribute('aria-hidden'),
        };
      });

      // F11: pressing Tab while drawer closed on 390px must never focus elements inside #sidebar
      const tabTargetsClosed = [];
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        const hit = await page.evaluate(() => {
          const el = document.activeElement;
          return { id: el?.id || '', tag: el?.tagName || '', insideSidebar: Boolean(el?.closest('#sidebar')) };
        });
        tabTargetsClosed.push(hit);
      }

      // Open drawer, verify inert swapped, close with Escape, verify focus restored
      await page.click('#nav-toggle');
      await page.waitForSelector('#sidebar.is-open');
      const drawerOpenState = await page.evaluate(() => ({
        sidebarInert: document.getElementById('sidebar').inert,
        mainInert: document.querySelector('main').inert,
      }));
      await page.keyboard.press('Escape');
      const drawerAfterEsc = await page.evaluate(() => ({
        isOpen: document.getElementById('sidebar').classList.contains('is-open'),
        sidebarInert: document.getElementById('sidebar').inert,
        mainInert: document.querySelector('main').inert,
        activeId: document.activeElement?.id || '',
      }));

      // F10: open wide diagram modal on mobile (Fit), verify Zoom-Out reduces width & Zoom-In increases
      await page.click('[data-expand-diagram]');
      await page.waitForSelector('#diagram-dialog[open]');
      const getDialogSvgMetrics = () => page.evaluate(() => {
        const svg = document.querySelector('#dialog-canvas svg');
        return {
          width: svg.getBoundingClientRect().width,
          label: document.getElementById('dialog-zoom-label').textContent,
          isFit: document.getElementById('dialog-canvas').classList.contains('is-fit'),
        };
      });
      const fitState = await getDialogSvgMetrics();
      await page.click('#dialog-zoom-out');
      const afterZoomOut = await getDialogSvgMetrics();
      await page.click('#dialog-fit');
      await page.click('#dialog-zoom-in');
      const afterZoomIn = await getDialogSvgMetrics();
      await page.keyboard.press('Escape');

      // M05: audience filter toggles aria-pressed cleanly
      await page.click('[data-audience-filter="technical"]');
      const audienceAria = await page.evaluate(() => ({
        all: document.querySelector('[data-audience-filter="all"]').getAttribute('aria-pressed'),
        tech: document.querySelector('[data-audience-filter="technical"]').getAttribute('aria-pressed'),
      }));
      await page.click('[data-audience-filter="all"]');

      // F12: filter table down to 1 row, verify beforeprint/media=print shows all 8, afterprint restores 1
      await page.fill('.table-filter input', 'row0');
      const filteredBeforePrint = await page.evaluate(() => ({
        total: document.querySelectorAll('.table-wrap tbody tr').length,
        hidden: document.querySelectorAll('.table-wrap tbody tr[hidden]').length,
      }));
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      await page.emulateMedia({ media: 'print' });
      const duringPrint = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('.table-wrap tbody tr')];
        return {
          hiddenAttrCount: rows.filter((r) => r.hidden).length,
          visibleComputedCount: rows.filter((r) => getComputedStyle(r).display !== 'none').length,
        };
      });
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      const restoredAfterPrint = await page.evaluate(() => document.querySelectorAll('.table-wrap tbody tr[hidden]').length);

      // Resize back to desktop 1440x900 and verify #sidebar becomes interactive again
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(80);
      const desktopAfterResize = await page.evaluate(() => ({
        sidebarInert: document.getElementById('sidebar').inert,
        sidebarAriaHidden: document.getElementById('sidebar').getAttribute('aria-hidden'),
      }));

      return JSON.stringify({
        mobileChecks,
        tabTargetsClosed,
        drawerOpenState,
        drawerAfterEsc,
        fitState,
        afterZoomOut,
        afterZoomIn,
        audienceAria,
        filteredBeforePrint,
        duringPrint,
        restoredAfterPrint,
        desktopAfterResize,
      });
    }`], dir);

    const res = JSON.parse(extractResultJson(out));
    assert.equal(res.mobileChecks.overflow, false, 'Mobile viewport should not overflow horizontally');
    assert.equal(res.mobileChecks.sidebarInertInit, true, 'Closed mobile sidebar must start inert');
    assert.equal(res.mobileChecks.sidebarAriaHiddenInit, 'true');
    assert.equal(res.tabTargetsClosed.some((t) => t.insideSidebar), false, 'Tab must never enter closed mobile sidebar');
    assert.equal(res.drawerOpenState.sidebarInert, false);
    assert.equal(res.drawerOpenState.mainInert, true);
    assert.equal(res.drawerAfterEsc.isOpen, false);
    assert.equal(res.drawerAfterEsc.sidebarInert, true);
    assert.equal(res.drawerAfterEsc.mainInert, false);
    assert.equal(res.drawerAfterEsc.activeId, 'nav-toggle');

    assert.equal(res.fitState.isFit, true, 'Wide diagram on 390px mobile opens in Fit mode');
    assert.ok(res.afterZoomOut.width < res.fitState.width, `Zoom-out from Fit must shrink diagram (${res.afterZoomOut.width} < ${res.fitState.width})`);
    assert.ok(res.afterZoomIn.width > res.fitState.width, `Zoom-in from Fit must enlarge diagram (${res.afterZoomIn.width} > ${res.fitState.width})`);

    assert.equal(res.audienceAria.all, 'false');
    assert.equal(res.audienceAria.tech, 'true');

    assert.equal(res.filteredBeforePrint.total, 8);
    assert.equal(res.filteredBeforePrint.hidden, 7);
    assert.equal(res.duringPrint.hiddenAttrCount, 0);
    assert.equal(res.duringPrint.visibleComputedCount, 8);
    assert.equal(res.restoredAfterPrint, 7);

    assert.equal(res.desktopAfterResize.sidebarInert, false);
    assert.equal(res.desktopAfterResize.sidebarAriaHidden, null);
  } finally {
    try { await pw(session, ['close'], dir); } catch {}
    if (server) await server.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('M05 headless Chromium: landing page WAI-ARIA tabs keyboard navigation and PT/EN aria-label translation', { skip: !pwAvailable }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'phd-browser-landing-'));
  const session = `phd-land-${process.pid}-${Date.now().toString(36)}`;
  let server;
  try {
    server = await startStaticServer(path.join(root, 'docs'));
    await pw(session, ['open', '--browser=chromium', `${server.baseUrl}/index.html`], dir);
    await pw(session, ['resize', '1440', '900'], dir);

    const out = await pw(session, ['run-code', `async (page) => {
      await page.focus('#tab-cli');
      await page.keyboard.press('ArrowRight');
      const afterArrowRight = await page.evaluate(() => ({
        activeId: document.activeElement?.id || '',
        manifestSelected: document.getElementById('tab-manifest').getAttribute('aria-selected'),
        cliTabIndex: document.getElementById('tab-cli').getAttribute('tabindex'),
        manifestTabIndex: document.getElementById('tab-manifest').getAttribute('tabindex'),
        panelLabelledBy: document.getElementById('panel-recipe').getAttribute('aria-labelledby'),
        hasRepoRoot: document.getElementById('recipe-code').textContent.includes('"repoRoot": ".."'),
      }));

      await page.click('[data-lang-btn="en"]');
      const afterEn = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        navAria: document.querySelector('.topbar-nav').getAttribute('aria-label'),
        tabsAria: document.querySelector('.recipe-tabs').getAttribute('aria-label'),
      }));

      return JSON.stringify({ afterArrowRight, afterEn });
    }`], dir);

    const res = JSON.parse(extractResultJson(out));
    assert.equal(res.afterArrowRight.activeId, 'tab-manifest');
    assert.equal(res.afterArrowRight.manifestSelected, 'true');
    assert.equal(res.afterArrowRight.cliTabIndex, '-1');
    assert.equal(res.afterArrowRight.manifestTabIndex, '0');
    assert.equal(res.afterArrowRight.panelLabelledBy, 'tab-manifest');
    assert.equal(res.afterArrowRight.hasRepoRoot, true);

    assert.equal(res.afterEn.lang, 'en');
    assert.equal(res.afterEn.navAria, 'Main navigation');
    assert.equal(res.afterEn.tabsAria, 'Usage examples');
  } finally {
    try { await pw(session, ['close'], dir); } catch {}
    if (server) await server.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
