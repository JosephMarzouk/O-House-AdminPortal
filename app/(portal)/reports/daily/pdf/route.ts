import type { NextRequest } from 'next/server';
import puppeteer, { type Browser } from 'puppeteer-core';
import { can, getProfile } from '@/lib/auth';
import { listDepartments } from '@/lib/db/places';
import { LOCALE_COOKIE } from '@/lib/i18n';
import { reportParams } from '@/lib/report';
import { ACCESS_COOKIE } from '@/lib/session';

/**
 * The daily report as a PDF file. Headless Chrome prints the report page
 * itself (../page.tsx, with its A4 @page and print: styles), signed in as the
 * caller, so the file is exactly what they see: Arabic shaping, RTL, photos,
 * and only the rows RLS gives them. A PDF library would lay Arabic out badly.
 *
 * Chrome comes from CHROME_PATH (no download): the installed Chrome locally,
 * the `chromium` package on Railway (railway.env.template).
 */

// One Chrome per server process, launched on first use. A crash or a close
// drops it, and the next request launches a fresh one.
// ponytail: no queue; each request is one tab in its own context, which is
// plenty for a club's admins. Add a pool or a queue if exports pile up.
let browser: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browser) {
    const launching = puppeteer.launch({
      executablePath: process.env.CHROME_PATH,
      headless: true,
      // In a Linux container Chrome runs as root, which its sandbox refuses,
      // and /dev/shm is tiny. It only ever loads this portal's own page.
      args: process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
    });
    const forget = () => {
      if (browser === launching) browser = null;
    };
    launching.then((b) => b.on('disconnected', forget), forget);
    browser = launching;
  }
  return browser;
}

/**
 * Where Chrome loads the report: this portal, never a host the caller picks.
 * With CLUB_HOST (development, or a deployment pinned to one club) the club
 * does not depend on the host, so it goes straight to this process. Otherwise
 * the club IS the host, and this request's Host is one proxy.ts has already
 * matched to a club (it answers 404 to any other); nextUrl's protocol already
 * follows x-forwarded-proto.
 */
function reportOrigin(request: NextRequest): string {
  return process.env.CLUB_HOST
    ? `http://localhost:${request.nextUrl.port}`
    : `${request.nextUrl.protocol}//${request.headers.get('host')}`;
}

export async function GET(request: NextRequest) {
  if (!can(await getProfile(), 'reports.view')) return new Response('Forbidden', { status: 403 });

  // A day, or a range up to a week (the weekly email).
  const params = reportParams(request.nextUrl.searchParams);
  if (!params) return new Response('Bad request', { status: 400 });
  const { date, to, dept } = params;

  const origin = reportOrigin(request);
  const target = `${origin}/reports/daily?date=${date}${to !== date ? `&to=${to}` : ''}&dept=${dept}`;

  // "daily-report-2026-09-24-house-keeping.pdf", "weekly-report-2026-10-10_2026-10-16-….pdf":
  // ASCII, so every browser keeps it.
  const deptName =
    dept === 'all' ? '' : ((await listDepartments()).find((d) => d.id === dept)?.name_en ?? '');
  const slug = deptName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const period = to !== date ? `weekly-report-${date}_${to}` : `daily-report-${date}`;
  const filename = `${period}${dept === 'all' ? '' : `-${slug || dept}`}.pdf`;

  let context;
  try {
    context = await (await getBrowser()).createBrowserContext();
  } catch (e) {
    console.error('reports/daily/pdf: Chrome did not start (CHROME_PATH?)', e);
    return new Response('PDF export is not available right now.', { status: 503 });
  }

  try {
    // The caller's own session and language, in a context of its own, so two
    // people exporting at once never share cookies. proxy.ts has already
    // refreshed a dying access token on this request, so Chrome's is fresh.
    // Never the refresh token: were Chrome to rotate it, the caller's own
    // browser would later replay the old one and lose its whole session.
    const { hostname, protocol } = new URL(origin);
    await context.setCookie(
      ...[ACCESS_COOKIE, LOCALE_COOKIE].flatMap((name) => {
        const value = request.cookies.get(name)?.value;
        return value
          ? [{ name, value, domain: hostname, path: '/', httpOnly: name !== LOCALE_COOKIE, secure: protocol === 'https:', sameSite: 'Lax' as const }]
          : [];
      }),
    );

    const page = await context.newPage();
    await page.emulateMediaType('print');
    const res = await page.goto(target, { waitUntil: 'networkidle0', timeout: 30_000 });
    // A session that died on the way lands on /login with a 200: never print that.
    if (!res?.ok() || new URL(page.url()).pathname !== '/reports/daily') {
      throw new Error(`the report page answered ${res?.status()} at ${page.url()}`);
    }
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    // Typed ArrayBufferLike, but a plain ArrayBuffer underneath (never shared).
    return new Response(pdf as Uint8Array<ArrayBuffer>, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('reports/daily/pdf: rendering failed', e);
    return new Response('Could not make the PDF.', { status: 500 });
  } finally {
    // Closes its page too, however the render ended.
    await context.close().catch(() => {});
  }
}
