import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, request } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_API_URL_RAW = process.env.BACKEND_API_URL || 'http://localhost:3001/api';
const BACKEND_API_URL = BACKEND_API_URL_RAW.endsWith('/') ? BACKEND_API_URL_RAW : `${BACKEND_API_URL_RAW}/`;
const AUTH_EMAIL = process.env.E2E_EMAIL || 'admin@hospital.local';
const AUTH_PASSWORD = process.env.E2E_PASSWORD || 'admin123';
const OUT_ROOT = process.env.UI_AUDIT_OUT_DIR || path.resolve('artifacts/ui-snapshots');

const ROUTES = ['/', '/users', '/contacts', '/messages', '/org-tree', '/documents', '/tests', '/learning'];
const VIEWPORTS = [
  { name: 'desktop', width: 1728, height: 1000 },
  { name: 'laptop', width: 1366, height: 820 },
];

function runStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function routeSlug(route) {
  if (route === '/') return 'home';
  return route.replace(/\//g, '-').replace(/^-+/, '') || 'root';
}

async function waitForRouteReady(page, route) {
  if (route === '/') {
    await page.getByText('Добро пожаловать,').first().waitFor({ state: 'visible', timeout: 8_000 });
    return;
  }
  if (route === '/users') {
    await page.getByRole('heading', { name: 'Управление пользователями' }).first().waitFor({ state: 'visible', timeout: 8_000 });
    return;
  }
  if (route === '/contacts') {
    await page.getByPlaceholder('Поиск по ФИО...').first().waitFor({ state: 'visible', timeout: 8_000 });
    return;
  }
  if (route === '/messages') {
    await page.getByRole('button', { name: 'Написать' }).first().waitFor({ state: 'visible', timeout: 8_000 });
    return;
  }
  if (route === '/org-tree') {
    await page.locator('.react-flow__node').first().waitFor({ state: 'visible', timeout: 8_000 });
    return;
  }
  if (route === '/documents') {
    await page.getByRole('heading', { name: 'Документы' }).first().waitFor({ state: 'visible', timeout: 8_000 });
    return;
  }
  if (route === '/tests') {
    await page.getByRole('heading', { name: 'Тестирование' }).first().waitFor({ state: 'visible', timeout: 8_000 });
    return;
  }
  if (route === '/learning') {
    await page.getByRole('heading', { name: 'Обучение' }).first().waitFor({ state: 'visible', timeout: 8_000 });
    return;
  }
  await page.waitForTimeout(300);
}

async function getAuthToken() {
  const api = await request.newContext({ baseURL: BACKEND_API_URL });
  try {
    const response = await api.post('auth/login', {
      data: { email: AUTH_EMAIL, password: AUTH_PASSWORD },
    });
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Login failed (${response.status()}): ${body}`);
    }

    const json = await response.json();
    const token = json?.data?.token;
    if (!token || typeof token !== 'string') {
      throw new Error('Token is missing in login response');
    }
    return token;
  } finally {
    await api.dispose();
  }
}

async function injectAuth(page, token) {
  await page.goto('/login');
  await page.evaluate((nextToken) => {
    localStorage.setItem('token', nextToken);
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: { token: nextToken },
        version: 0,
      })
    );
  }, token);
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const rootStyles = getComputedStyle(root);
    const bodyStyles = getComputedStyle(body);
    const maxScroll = root.scrollHeight - root.clientHeight;
    return {
      title: document.title,
      heading: document.querySelector('h1,h2,h3,h4,h5,h6')?.textContent?.trim() || null,
      docHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
      hasGlobalScroll: maxScroll > 1,
      bodyOverflow: bodyStyles.overflow,
      rootOverflow: rootStyles.overflow,
    };
  });
}

async function main() {
  const token = await getAuthToken();
  const runDir = path.join(OUT_ROOT, runStamp());
  await fs.mkdir(runDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        baseURL: FRONTEND_URL,
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      await injectAuth(page, token);

      for (const route of ROUTES) {
        const slug = routeSlug(route);
        const fileName = `${slug}__${viewport.name}.png`;
        const shotPath = path.join(runDir, fileName);

        await page.goto(route);
        await waitForRouteReady(page, route);
        const metrics = await collectMetrics(page);
        await page.screenshot({ path: shotPath, fullPage: false });

        results.push({
          route,
          viewport: viewport.name,
          width: viewport.width,
          height: viewport.height,
          screenshot: fileName,
          metrics,
        });
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  const reportJsonPath = path.join(runDir, 'report.json');
  await fs.writeFile(reportJsonPath, JSON.stringify({ createdAt: new Date().toISOString(), results }, null, 2), 'utf8');

  const markdown = [
    '# UI Snapshot Audit',
    '',
    `- createdAt: ${new Date().toISOString()}`,
    `- frontend: ${FRONTEND_URL}`,
    `- backendApi: ${BACKEND_API_URL}`,
    '',
    '| Route | Viewport | Scroll | Screenshot |',
    '|---|---|---|---|',
    ...results.map((item) => {
      const scroll = item.metrics.hasGlobalScroll ? 'global-scroll' : 'ok';
      return `| \`${item.route}\` | \`${item.viewport} ${item.width}x${item.height}\` | \`${scroll}\` | \`${item.screenshot}\` |`;
    }),
    '',
    '## Notes',
    '- Use this folder for visual review and iterative design fixes.',
    '- Re-run after each design iteration to compare screenshots.',
  ].join('\n');

  const reportMdPath = path.join(runDir, 'REPORT.md');
  await fs.writeFile(reportMdPath, markdown, 'utf8');

  console.log(`UI audit completed: ${runDir}`);
  console.log(`- report: ${reportMdPath}`);
  console.log(`- data:   ${reportJsonPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
