import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export class ReviewEnvError extends Error {}

export function browserCandidates(platform = process.platform, env = process.env) {
  if (platform === 'darwin') {
    const apps = ['Google Chrome', 'Microsoft Edge', 'Chromium', 'Google Chrome Canary'];
    return apps.flatMap(app => ['/Applications', path.join(os.homedir(), 'Applications')]
      .map(root => path.join(root, `${app}.app`, 'Contents', 'MacOS', app)));
  }
  if (platform === 'win32') {
    const roots = [env.PROGRAMFILES, env.ProgramFiles, env['PROGRAMFILES(X86)'], env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean);
    return [...new Set(roots)].flatMap(root => ['Google/Chrome/Application/chrome.exe', 'Microsoft/Edge/Application/msedge.exe', 'Chromium/Application/chrome.exe'].map(p => path.join(root, p)));
  }
  return (env.PATH || '/usr/bin:/usr/local/bin:/snap/bin').split(path.posix.delimiter)
    .flatMap(root => ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable'].map(name => path.join(root, name)));
}

export function findBrowser({ explicit = null, env = process.env, platform = process.platform } = {}) {
  const forced = explicit || env.PHD_BROWSER;
  const usable = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  if (forced) return { ok: usable(forced), path: forced, source: explicit ? '--browser' : 'PHD_BROWSER' };
  const hit = browserCandidates(platform, env).find(usable);
  return { ok: Boolean(hit), path: hit || null, source: 'system' };
}

export async function launchBrowser(executable, { timeout = 20000 } = {}) {
  if (typeof WebSocket === 'undefined') throw new ReviewEnvError('review requires Node.js >= 22 with native WebSocket');
  const profile = await fsp.mkdtemp(path.join(os.tmpdir(), 'phd-review-'));
  const child = spawn(executable, [
    '--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--force-color-profile=srgb', '--allow-file-access-from-files', 'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let launchError, stderr = '', socket;
  child.on('error', e => { launchError = e; });
  child.stderr.on('data', data => { stderr = (stderr + data).slice(-4000); });
  const pending = new Map();
  const rejectPending = () => {
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Browser connection closed')); }
    pending.clear();
  };
  const close = async () => {
    if (child.exitCode === null) {
      if (socket?.readyState === WebSocket.OPEN) {
        try { socket.send(JSON.stringify({ id: 0, method: 'Browser.close' })); } catch {}
      } else child.kill();
      await new Promise(resolve => { const timer = setTimeout(resolve, 3000); child.once('exit', () => { clearTimeout(timer); resolve(); }); });
      if (child.exitCode === null) child.kill();
    }
    socket?.close();
    rejectPending();
    await fsp.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  };
  try {
    const deadline = Date.now() + timeout;
    let port;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (child.exitCode !== null) throw Error(`Browser exited (${child.exitCode}): ${stderr}`);
      try { port = Number((await fsp.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch {}
      if (port) break;
      await new Promise(r => setTimeout(r, 100));
    }
    if (!port) throw Error('Timed out waiting for browser DevTools');
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(timeout) }).then(r => r.json());
    const target = targets.find(t => t.type === 'page');
    if (!target) throw Error('No browser page target');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('DevTools connection timeout')), timeout);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(Error('DevTools connection failed')); }, { once: true });
    });
    let nextId = 0;
    const errors = [];
    socket.addEventListener('close', rejectPending);
    socket.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.id) {
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id); clearTimeout(p.timer);
        if (msg.error) p.reject(Error(msg.error.message)); else p.resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push(msg.params.args.map(a => a.value ?? a.description ?? '').join(' '));
      }
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, timeout);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (fn, ...args) => {
      const expression = typeof fn === 'function' ? `(${fn.toString()})(${args.map(a => JSON.stringify(a)).join(',')})` : fn;
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    return {
      send, evaluate, errors, close,
      async viewport(width, height = 1000) { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); },
      async navigate(htmlPath) {
        errors.length = 0;
        // Leave the previous document before polling readyState to avoid accepting its state.
        await send('Page.navigate', { url: 'about:blank' });
        const url = pathToFileURL(htmlPath).href;
        const nav = await send('Page.navigate', { url });
        if (nav.errorText) throw Error(nav.errorText);
        const until = Date.now() + timeout;
        while (!(await evaluate(u => location.href === u && document.readyState === 'complete', url))) {
          if (Date.now() > until) throw Error('Page load timeout');
          await new Promise(r => setTimeout(r, 50));
        }
        await evaluate(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
      },
      async screenshot(file, { top = 0, height = 1000, width = 1440 } = {}) {
        const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: top, width, height, scale: 1 } });
        await fsp.writeFile(file, Buffer.from(data, 'base64'));
      },
    };
  } catch (e) { await close(); throw new ReviewEnvError(`Cannot start visual review: ${e.message}`); }
}
