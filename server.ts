import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
}

type PortalSessionMode = 'auto_punch' | 'manual_punch' | 'verify_punches' | 'test_connection';

interface ProxySession {
  id: string;
  usuario: string;
  senha: string;
  mode: PortalSessionMode;
  cookies: Map<string, StoredCookie>;
  createdAt: number;
}

const proxySessions = new Map<string, ProxySession>();
let latestProxySessionId: string | null = null;

function getOrCreateSession(sid?: string): ProxySession | null {
  if (sid && proxySessions.has(sid)) {
    return proxySessions.get(sid)!;
  }
  if (latestProxySessionId && proxySessions.has(latestProxySessionId)) {
    return proxySessions.get(latestProxySessionId)!;
  }
  return null;
}

function parseCookiesFromHeader(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      result[k] = decodeURIComponent(v);
    }
  }
  return result;
}

function resolveSessionId(req: Request, explicitSid?: string): string | undefined {
  if (explicitSid && proxySessions.has(explicitSid)) return explicitSid;
  if (typeof req.query.pf_sid === 'string' && proxySessions.has(req.query.pf_sid)) {
    return req.query.pf_sid;
  }
  const reqCookies = parseCookiesFromHeader(req.headers.cookie);
  if (reqCookies.pf_sid && proxySessions.has(reqCookies.pf_sid)) {
    return reqCookies.pf_sid;
  }
  const referer = req.headers.referer || '';
  const refMatch = referer.match(/[?&]pf_sid=([^&]+)/) || referer.match(/\/lg-p\/([^/]+)\//);
  if (refMatch && proxySessions.has(refMatch[1])) {
    return refMatch[1];
  }
  return latestProxySessionId || undefined;
}

function extractSetCookies(resHeaders: Headers): string[] {
  if (typeof (resHeaders as unknown as { getSetCookie?: () => string[] }).getSetCookie === 'function') {
    return (resHeaders as unknown as { getSetCookie: () => string[] }).getSetCookie();
  }
  const raw = resHeaders.get('set-cookie');
  return raw ? [raw] : [];
}

function storeUpstreamCookies(
  cookiesMap: Map<string, StoredCookie>,
  resHeaders: Headers,
  targetHost: string
): string[] {
  const setCookies = extractSetCookies(resHeaders);
  const browserRewrittenCookies: string[] = [];

  for (const rawCookie of setCookies) {
    const parts = rawCookie.split(';').map((p) => p.trim());
    if (parts.length === 0) continue;
    const eqIdx = parts[0].indexOf('=');
    if (eqIdx <= 0) continue;

    const name = parts[0].slice(0, eqIdx).trim();
    const value = parts[0].slice(eqIdx + 1).trim();
    let domain = targetHost.toLowerCase();
    let cookiePath = '/';
    let isExpired = false;

    for (let i = 1; i < parts.length; i++) {
      const lower = parts[i].toLowerCase();
      if (lower.startsWith('domain=')) {
        domain = parts[i].slice(7).trim().replace(/^\./, '').toLowerCase();
      } else if (lower.startsWith('path=')) {
        cookiePath = parts[i].slice(5).trim() || '/';
      } else if (lower.startsWith('expires=')) {
        const expTime = Date.parse(parts[i].slice(8).trim());
        if (!Number.isNaN(expTime) && expTime < Date.now() - 60000) {
          isExpired = true;
        }
      }
    }

    const key = `${domain}|${name}`;
    if (value === '') {
      cookiesMap.delete(key);
    } else {
      // Keep non-empty cookies even if upstream expires timestamp trails local clock
      cookiesMap.set(key, { name, value, domain, path: cookiePath });
    }

    // Sync cookie with browser: strip Domain=/SameSite=/Secure, and strip past Expires on non-empty cookies
    const filteredParts = parts.filter((p) => {
      const l = p.toLowerCase();
      if (l.startsWith('domain=') || l.startsWith('samesite=') || l === 'secure') return false;
      if (value !== '' && isExpired && l.startsWith('expires=')) return false;
      return true;
    });
    browserRewrittenCookies.push(filteredParts.join('; '));
  }

  return browserRewrittenCookies;
}

function buildCookieHeaderForHost(cookiesMap: Map<string, StoredCookie>, targetHost: string): string {
  const hostLower = targetHost.toLowerCase();
  const pairs: string[] = [];
  const seenNames = new Set<string>();

  // Prefer more specific domain matches first, then parent domain (.lgcloud.com.br)
  const sorted = [...cookiesMap.values()].sort((a, b) => b.domain.length - a.domain.length);

  for (const c of sorted) {
    if (hostLower === c.domain || hostLower.endsWith('.' + c.domain)) {
      if (!seenNames.has(c.name)) {
        seenNames.add(c.name);
        pairs.push(`${c.name}=${c.value}`);
      }
    }
  }
  return pairs.join('; ');
}

const AUTOATENDIMENTO_PREFIXES = [
  '/Autoatendimento',
  '/Api.Autoatendimento',
  '/Api.Feedback',
  '/LG.OKR.WebApi',
  '/LG.Nucleo.WebApi',
  '/LiGiaProWebChat',
  '/Api.Workflow',
  '/Api.Processos',
  '/Solper',
  '/Api.WebChat',
  '/integracao',
  '/identificadores',
  '/negotiate',
];

function isAutoatendimentoPath(p: string): boolean {
  const lower = p.toLowerCase();
  return AUTOATENDIMENTO_PREFIXES.some((prefix) => lower.startsWith(prefix.toLowerCase()));
}

function isAllowedProxyHost(host: string): boolean {
  const hostWithoutPort = host.split(':')[0].toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(hostWithoutPort)) return false;
  if (
    hostWithoutPort === 'localhost' ||
    hostWithoutPort.endsWith('.local') ||
    hostWithoutPort === '0.0.0.0' ||
    /^127\./.test(hostWithoutPort) ||
    /^10\./.test(hostWithoutPort) ||
    /^192\.168\./.test(hostWithoutPort) ||
    /^169\.254\./.test(hostWithoutPort) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostWithoutPort)
  ) {
    return false;
  }
  return true;
}

function rewritePortalUrlToLocal(rawUrl: string, sid: string, currentHost: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;

  // Keep CDN static assets, privacy policies, and third-party public resources untouched
  if (/^https?:\/\/(cdn\d*\.lg\.com\.br|page\.lg\.com\.br|stalgcdn\.|[^/]*\.blob\.core\.windows\.net|fonts\.|cdnjs\.|maxcdn\.|www\.google|directline\.|analytics\.)/i.test(trimmed)) {
    return trimmed;
  }

  if (/^https?:\/\/pernambucanas\.lgcloud\.com\.br\/autenticacao/i.test(trimmed)) {
    return trimmed.replace(/^https?:\/\/pernambucanas\.lgcloud\.com\.br/i, '');
  }

  const pnbMatch = trimmed.match(/^https?:\/\/pnb-prd-aa\.lgcloud\.com\.br(\/.*)?$/i);
  if (pnbMatch) {
    const restPath = pnbMatch[1] || '/';
    if (isAutoatendimentoPath(restPath)) {
      return restPath;
    }
    return `/lg-p/${sid}/pnb-prd-aa.lgcloud.com.br${restPath}`;
  }

  const lgMatch = trimmed.match(/^https?:\/\/([a-z0-9.-]+\.(?:lgcloud|lggo|lg|pernambucanas|norber)\.com\.br(?::\d+)?)(\/.*)?$/i);
  if (lgMatch) {
    const matchedHost = lgMatch[1];
    const restPath = lgMatch[2] || '/';
    return `/lg-p/${sid}/${matchedHost}${restPath}`;
  }

  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/autenticacao') &&
    !isAutoatendimentoPath(trimmed) &&
    !trimmed.startsWith('/lg-p/')
  ) {
    return `/lg-p/${sid}/${currentHost}${trimmed}`;
  }

  return trimmed;
}

function rewritePortalBodyUrls(text: string, sid: string): string {
  return text
    .replace(/https?:\/\/pernambucanas\.lgcloud\.com\.br\/autenticacao/gi, '/autenticacao')
    .replace(/https?:\/\/pnb-prd-aa\.lgcloud\.com\.br\/Autoatendimento/gi, '/Autoatendimento')
    .replace(/https?:\/\/pnb-prd-aa\.lgcloud\.com\.br\/Api\./gi, '/Api.')
    .replace(/https?:\/\/pnb-prd-aa\.lgcloud\.com\.br\/LG\./gi, '/LG.')
    .replace(/https?:\/\/([a-z0-9.-]+\.lgcloud\.com\.br)/gi, `/lg-p/${sid}/$1`)
    .replace(/window\.top\.document/g, 'window.document')
    .replace(/window\.top\.aceitarCookies/g, 'window.aceitarCookies');
}

function readRawRequestBody(req: Request): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return Promise.resolve(undefined);
  }
  if (req.readableEnded) {
    if (req.body !== undefined) {
      if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
      if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body));
      return Promise.resolve(Buffer.from(JSON.stringify(req.body)));
    }
    return Promise.resolve(undefined);
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(chunks.length > 0 ? Buffer.concat(chunks) : undefined));
    req.on('error', reject);
  });
}

function appendSidCookie(req: Request, res: Response, sid: string) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.append(
    'Set-Cookie',
    `pf_sid=${sid}; Path=/; ${isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax'}`
  );
}

/**
 * Helper used by dry-run connection check (/api/ponto/marcar)
 * Performs full ASP.NET login + follows SSO redirect up to Autoatendimento
 */
async function authenticateWithPortalServer(usuario: string, senha: string) {
  const targetUrl =
    'https://pernambucanas.lgcloud.com.br/autenticacao/produtos/SAAA/principal2.aspx?c=pernambucanas';
  const logs: string[] = [];
  const cleanUser = usuario.trim();
  const cleanPass = senha.trim();
  const digitsOnly = cleanUser.replace(/\D/g, '');

  // Testar exatamente o login informado (e se digitado com pontos, só tentar sem pontos se o informado falhar;
  // nunca disparar múltiplos palpites caso seja exatamente o CPF numérico padrão)
  const candidates: string[] = [cleanUser];
  if (digitsOnly.length === 11 && digitsOnly !== cleanUser) {
    candidates.push(digitsOnly);
  }

  for (let i = 0; i < candidates.length; i++) {
    const candidateLogin = candidates[i];
    const cookieJar = new Map<string, StoredCookie>();
    cookieJar.set('lgcloud.com.br|LG_CCO', {
      name: 'LG_CCO',
      value: 'true',
      domain: 'lgcloud.com.br',
      path: '/',
    });

    logs.push(
      `[${i * 4 + 1}] Conectando ao servidor da Pernambucanas LG Cloud (usuário: "${candidateLogin}")...`
    );

    const res1 = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
      },
    });

    if (!res1.ok) {
      throw new Error(`Falha HTTP ${res1.status} ao conectar ao portal.`);
    }

    storeUpstreamCookies(cookieJar, res1.headers, 'pernambucanas.lgcloud.com.br');
    const html1 = await res1.text();
    logs.push(`[${i * 4 + 2}] Conexão HTTP 200 OK estabelecida. Lendo formulário...`);

    const extractField = (htmlStr: string, name: string) => {
      const inputMatch = htmlStr.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`, 'i'));
      if (!inputMatch) return '';
      const valMatch = inputMatch[0].match(/value="([^"]*)"/i);
      return valMatch ? valMatch[1] : '';
    };

    let currentHtml = html1;
    let loc = '';
    let lastErrorMsg = '';
    let loginAccepted = false;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const viewState = extractField(currentHtml, '__VIEWSTATE');
      const viewStateGen = extractField(currentHtml, '__VIEWSTATEGENERATOR');
      const viewStateEnc = extractField(currentHtml, '__VIEWSTATEENCRYPTED');
      const eventVal = extractField(currentHtml, '__EVENTVALIDATION');

      if (!viewState) {
        throw new Error('Tokens ASP.NET (__VIEWSTATE) não encontrados na página do portal.');
      }

      if (attempt === 1) {
        logs.push(
          `[${i * 5 + 3}] Formulário validado. Submetendo #ContentPlaceHolder_txtLoginT="${candidateLogin}" via #ContentPlaceHolder_btnEntrar...`
        );
      } else {
        logs.push(
          `[${i * 5 + 4}] Aguardou 5s na tela do portal. Clicando em #ContentPlaceHolder_btnEntrar novamente (tentativa ${attempt})...`
        );
      }

      const params = new URLSearchParams();
      params.append('__LASTFOCUS', '');
      params.append('__EVENTTARGET', 'ctl00$ContentPlaceHolder$btnEntrar');
      params.append('__EVENTARGUMENT', '');
      params.append('__VIEWSTATE', viewState);
      params.append('__VIEWSTATEGENERATOR', viewStateGen);
      params.append('__VIEWSTATEENCRYPTED', viewStateEnc);
      params.append('__EVENTVALIDATION', eventVal);
      params.append('ctl00$cboIdioma', 'Português');
      params.append(
        'ctl00_cboIdioma_ClientState',
        '{"logEntries":[],"value":"pt-BR","text":"Português","enabled":true}'
      );
      params.append('ctl00$ContentPlaceHolder$txtLoginT', candidateLogin);
      params.append('ctl00$ContentPlaceHolder$txtLoginV', '');
      params.append('ctl00$ContentPlaceHolder$txtSenhaT', cleanPass);
      params.append('ctl00$ContentPlaceHolder$txtSenhaV', '');

      const postCookie = buildCookieHeaderForHost(cookieJar, 'pernambucanas.lgcloud.com.br');
      const res2 = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Cookie: postCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: targetUrl,
          Origin: 'https://pernambucanas.lgcloud.com.br',
        },
        body: params.toString(),
        redirect: 'manual',
      });

      storeUpstreamCookies(cookieJar, res2.headers, 'pernambucanas.lgcloud.com.br');
      loc = res2.headers.get('location') || '';
      const html2 = await res2.text();

      const alertaMatch = html2.match(/<[^>]*class="[^"]*msgAlerta[^"]*"[^>]*>([\s\S]*?)<\//i);
      const textErrorMatch = html2.match(/(Login e\/ou senha[^.<]+)/i);

      if (alertaMatch || textErrorMatch) {
        const rawMsg = alertaMatch
          ? alertaMatch[1]
              .replace(/&#225;/g, 'á')
              .replace(/&#233;/g, 'é')
              .replace(/&#243;/g, 'ó')
              .replace(/&#237;/g, 'í')
              .replace(/&#227;/g, 'ã')
              .replace(/&#245;/g, 'õ')
              .replace(/&#231;/g, 'ç')
              .replace(/&#250;/g, 'ú')
              .replace(/&#234;/g, 'ê')
              .replace(/&#244;/g, 'ô')
              .replace(/&amp;/g, '&')
              .replace(/<[^>]+>/g, '')
              .replace(/\s+/g, ' ')
              .trim()
          : textErrorMatch
            ? textErrorMatch[1].trim()
            : 'Login e/ou senha inválidos. Informe-os novamente.';

        lastErrorMsg = rawMsg;
        logs.push(`[ERRO RETORNADO PELO PORTAL - Tentativa ${attempt}] "${rawMsg}" (usuário: "${candidateLogin}")`);

        if (attempt === 1) {
          logs.push('[AGUARDANDO 5s] Mantendo mesma tela/sessão por 5 segundos antes de apertar Entrar novamente...');
          currentHtml = html2;
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        break;
      }

      loginAccepted = true;
      break;
    }

    if (!loginAccepted) {
      if (i === candidates.length - 1) {
        return {
          authenticated: false,
          error: lastErrorMsg || 'Login e/ou senha inválidos. Informe-os novamente.',
          logs,
          cookieJar,
          successfulLogin: candidateLogin,
        };
      }
      continue;
    }

    // Segue redirecionamento até o Autoatendimento para confirmar sessão ativa
    let currentUrl = loc
      ? loc.startsWith('http')
        ? loc
        : new URL(loc, targetUrl).toString()
      : 'https://pnb-prd-aa.lgcloud.com.br/Autoatendimento/index.html#/home';

    let hops = 0;
    while (hops < 6) {
      hops++;
      const parsed = new URL(currentUrl);
      const ck = buildCookieHeaderForHost(cookieJar, parsed.hostname);
      const hopRes = await fetch(currentUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Cookie: ck,
        },
        redirect: 'manual',
      });
      storeUpstreamCookies(cookieJar, hopRes.headers, parsed.hostname);
      const nextLoc = hopRes.headers.get('location');
      if (hopRes.status >= 300 && hopRes.status < 400 && nextLoc) {
        currentUrl = nextLoc.startsWith('http') ? nextLoc : new URL(nextLoc, currentUrl).toString();
      } else {
        break;
      }
    }

    logs.push(
      `[${i * 5 + 5}] ✓ Login aceito! Redirecionado para: ${currentUrl}`
    );

    return {
      authenticated: true,
      logs,
      cookieJar,
      successfulLogin: candidateLogin,
      finalUrl: currentUrl,
    };
  }

  return {
    authenticated: false,
    error: 'Não foi possível validar as credenciais no portal.',
    logs,
    cookieJar: new Map<string, StoredCookie>(),
    successfulLogin: cleanUser,
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Apply JSON body parser ONLY to internal app API routes (never to proxied LG/Norber /api/* routes!)
  app.use(['/api/portal', '/api/ponto'], express.json());

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // ── PORTAL INTERACTIVE SESSION INIT ──────────────────────────────────────
  app.post('/api/portal/start-session', (req, res) => {
    const usuario = String(req.body?.usuario || '').trim();
    const senha = String(req.body?.senha || '').trim();

    if (!usuario || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Usuário e senha são obrigatórios.',
      });
    }

    const validModes: PortalSessionMode[] = ['auto_punch', 'manual_punch', 'verify_punches', 'test_connection'];
    const rawMode = String(req.body?.mode || 'auto_punch') as PortalSessionMode;
    const mode: PortalSessionMode = validModes.includes(rawMode) ? rawMode : 'auto_punch';

    const sid = crypto.randomBytes(12).toString('hex');
    const cookies = new Map<string, StoredCookie>();
    cookies.set('lgcloud.com.br|LG_CCO', {
      name: 'LG_CCO',
      value: 'true',
      domain: 'lgcloud.com.br',
      path: '/',
    });

    const session: ProxySession = {
      id: sid,
      usuario,
      senha,
      mode,
      cookies,
      createdAt: Date.now(),
    };

    if (proxySessions.size > 15) {
      const oldestKey = proxySessions.keys().next().value;
      if (oldestKey) proxySessions.delete(oldestKey);
    }

    proxySessions.set(sid, session);
    latestProxySessionId = sid;

    appendSidCookie(req, res, sid);

    return res.json({
      success: true,
      sid,
      mode,
      loginUrl: `/autenticacao/produtos/SAAA/principal2.aspx?c=pernambucanas&pf_sid=${encodeURIComponent(sid)}`,
    });
  });

  // ── CORE REVERSE PROXY HANDLER ───────────────────────────────────────────
  async function handlePortalProxy(
    req: Request,
    res: Response,
    targetHost: string,
    upstreamPathWithQuery: string,
    explicitSid?: string
  ) {
    const sid = resolveSessionId(req, explicitSid);
    let session = getOrCreateSession(sid);
    if (!session) {
      const fallbackSid = crypto.randomBytes(8).toString('hex');
      session = {
        id: fallbackSid,
        usuario: '',
        senha: '',
        mode: 'auto_punch',
        cookies: new Map(),
        createdAt: Date.now(),
      };
      proxySessions.set(fallbackSid, session);
      latestProxySessionId = fallbackSid;
    }

    // Strip internal pf_sid query param before forwarding to upstream LG Cloud
    let cleanPath = upstreamPathWithQuery
      .replace(/([?&])pf_sid=[^&]*&?/g, '$1')
      .replace(/[?&]$/, '');

    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }

    const upstreamUrl = `https://${targetHost}${cleanPath}`;

    try {
      const rawBody = await readRawRequestBody(req);
      const upstreamHeaders: Record<string, string> = {};
      const blockedHeaders = new Set([
        'host',
        'connection',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailer',
        'transfer-encoding',
        'upgrade',
        'content-length',
        'origin',
        'referer',
        'cookie',
        'accept-encoding',
        'upgrade-insecure-requests',
        'sec-fetch-dest',
        'sec-fetch-mode',
        'sec-fetch-site',
        'sec-fetch-user',
        'sec-ch-ua',
        'sec-ch-ua-mobile',
        'sec-ch-ua-platform',
        'x-forwarded-for',
        'x-forwarded-host',
        'x-forwarded-proto',
        'x-forwarded-port',
        'forwarded',
        'via',
        'if-none-match',
        'if-modified-since',
      ]);

      for (const [key, val] of Object.entries(req.headers)) {
        if (!val || blockedHeaders.has(key.toLowerCase())) continue;
        upstreamHeaders[key] = Array.isArray(val) ? val.join(', ') : String(val);
      }

      if (!upstreamHeaders['user-agent']) {
        upstreamHeaders['user-agent'] =
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
      }
      if (!upstreamHeaders['accept']) {
        upstreamHeaders['accept'] = '*/*';
      }
      if (!upstreamHeaders['accept-language']) {
        upstreamHeaders['accept-language'] = 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7';
      }

      const browserReferer = String(req.headers.referer || '');
      const fromAutoatendimento = browserReferer.toLowerCase().includes('/autoatendimento');
      if (targetHost === 'pernambucanas.lgcloud.com.br') {
        upstreamHeaders['Origin'] = 'https://pernambucanas.lgcloud.com.br';
        upstreamHeaders['Referer'] = `https://pernambucanas.lgcloud.com.br${cleanPath}`;
      } else if (targetHost === 'pnb-prd-aa.lgcloud.com.br' || fromAutoatendimento) {
        upstreamHeaders['Origin'] = 'https://pnb-prd-aa.lgcloud.com.br';
        upstreamHeaders['Referer'] = 'https://pnb-prd-aa.lgcloud.com.br/Autoatendimento/index.html';
      } else {
        upstreamHeaders['Origin'] = `https://${targetHost}`;
        upstreamHeaders['Referer'] = `https://${targetHost}${cleanPath}`;
      }

      const jarCookieStr = buildCookieHeaderForHost(session.cookies, targetHost);
      const mergedCookies = new Map<string, string>();
      // Include browser-set cookies (e.g., LG_TZ / SPA cookies set via document.cookie), excluding internal pf_sid
      if (req.headers.cookie) {
        for (const part of req.headers.cookie.split(';')) {
          const idx = part.indexOf('=');
          if (idx > 0) {
            const k = part.slice(0, idx).trim();
            const v = part.slice(idx + 1).trim();
            if (k && k !== 'pf_sid') mergedCookies.set(k, v);
          }
        }
      }
      // Server cookie jar takes precedence for HttpOnly & domain-scoped upstream cookies
      if (jarCookieStr) {
        for (const part of jarCookieStr.split(';')) {
          const idx = part.indexOf('=');
          if (idx > 0) {
            const k = part.slice(0, idx).trim();
            const v = part.slice(idx + 1).trim();
            if (k) mergedCookies.set(k, v);
          }
        }
      }
      const finalCookieStr = [...mergedCookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
      if (finalCookieStr) {
        upstreamHeaders['Cookie'] = finalCookieStr;
      }

      const upstreamRes = await fetch(upstreamUrl, {
        method: req.method,
        headers: upstreamHeaders,
        body: rawBody ? new Uint8Array(rawBody) : undefined,
        redirect: 'manual',
      });

      const browserSetCookies = storeUpstreamCookies(session.cookies, upstreamRes.headers, targetHost);

      // Handle redirects cleanly inside proxy
      if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
        const location = upstreamRes.headers.get('location');
        if (location) {
          const rewrittenLocation = rewritePortalUrlToLocal(location, session.id, targetHost);
          for (const sc of browserSetCookies) {
            res.append('Set-Cookie', sc);
          }
          appendSidCookie(req, res, session.id);
          return res.redirect(upstreamRes.status, rewrittenLocation);
        }
      }

      const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();

      res.status(upstreamRes.status);
      upstreamRes.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (
          lower === 'x-frame-options' ||
          lower === 'content-security-policy' ||
          lower === 'content-security-policy-report-only' ||
          lower === 'strict-transport-security' ||
          lower === 'set-cookie' ||
          lower === 'content-encoding' ||
          lower === 'content-length' ||
          lower === 'transfer-encoding' ||
          lower === 'etag' ||
          lower === 'last-modified'
        ) {
          return;
        }
        res.setHeader(key, value);
      });

      for (const sc of browserSetCookies) {
        res.append('Set-Cookie', sc);
      }
      appendSidCookie(req, res, session.id);

      // HTML responses: prevent stale cache, rewrite URLs, inject network shim & one-shot auto-login
      if (contentType.includes('text/html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        let html = await upstreamRes.text();
        html = rewritePortalBodyUrls(html, session.id);

        const activeSidJson = JSON.stringify(session.id);
        const targetHostJson = JSON.stringify(targetHost);
        const userJson = JSON.stringify(session.usuario);
        const passJson = JSON.stringify(session.senha);
        const modeJson = JSON.stringify(session.mode || 'auto_punch');

        const headShim = `
          <script>
          (function() {
            var PF_SID = ${activeSidJson};
            var PF_HOST = ${targetHostJson};
            window.__pfSid = PF_SID;
            window.__pfHost = PF_HOST;
            window.__pfMode = ${modeJson};

            window.addEventListener('message', function(ev) {
              if (ev && ev.data && ev.data.type === 'PF_SET_MODE' && ev.data.mode) {
                var prevMode = window.__pfMode;
                window.__pfMode = ev.data.mode;
                if (
                  prevMode !== ev.data.mode &&
                  ev.data.mode !== 'manual_punch' &&
                  typeof window.__pfStartAA === 'function'
                ) {
                  window.__pfStartAA(true);
                }
              }
            });

            function extractMarcacaoTimes(list) {
              if (!Array.isArray(list)) return [];
              var found = [];
              for (var i = 0; i < list.length; i++) {
                var item = list[i];
                if (typeof item !== 'string') continue;
                var isoM = item.match(/T([01]\\d|2[0-3]):([0-5]\\d)/);
                var hmM = isoM ? [isoM[0], isoM[1], isoM[2]] : item.match(/\\b([01]\\d|2[0-3]):([0-5]\\d)\\b/);
                if (hmM) {
                  var hhmm = hmM[1] + ':' + hmM[2];
                  if (found.indexOf(hhmm) === -1) found.push(hhmm);
                }
              }
              return found.sort();
            }

            window.__pfHandleMarcacaoResponse = function(url, data) {
              if (!url || typeof url !== 'string') return;
              var low = url.toLowerCase();
              if (low.indexOf('retornarconfiguracaoparamarcacao') !== -1) {
                window.__pfConfigLoaded = true;
                window.__pfConfigIsento = Boolean(data && (data.isentoDePonto || data.IsentoDePonto));
                window.__pfConfigFailed = !data;
              } else if (low.indexOf('retornarsomentemarcacoesdodia') !== -1) {
                var arr = Array.isArray(data) ? data : (data && (data.MarcacoesDoDia || data.marcacoesDoDia)) || [];
                window.__pfPortalPunches = extractMarcacaoTimes(arr);
                window.__pfPunchesLoaded = true;
                try {
                  window.parent.postMessage({
                    type: 'PF_PORTAL_PUNCHES_SYNC',
                    punches: window.__pfPortalPunches
                  }, '*');
                } catch (e) {}
              } else if (/\\/marcacao\\/marcar(\\?|$)/i.test(low)) {
                var ok = Boolean(data && (data.Sucesso === true || data.sucesso === true));
                var errMsg = (data && (data.Error || data.error)) || '';
                var nextArr = data && (data.MarcacoesDoDia || data.marcacoesDoDia);
                if (Array.isArray(nextArr)) {
                  window.__pfPortalPunches = extractMarcacaoTimes(nextArr);
                }
                window.__pfPunchApiResult = {
                  success: ok,
                  error: errMsg,
                  punches: window.__pfPortalPunches || []
                };
              }
            };

            function toProxyUrl(url) {
              if (!url || typeof url !== 'string') return url;
              var normalized = url.trim();
              if (!normalized) return url;
              if (normalized.indexOf('//') === 0) {
                normalized = 'https:' + normalized;
              }
              if (/^(data|blob|about|javascript):/i.test(normalized)) {
                return url;
              }
              if (normalized.indexOf(window.location.origin + '/') === 0) {
                normalized = normalized.slice(window.location.origin.length);
              } else if (normalized === window.location.origin) {
                normalized = '/';
              }
              if (/^https?:\\/\\/(cdn\\d*\\.lg\\.com\\.br|page\\.lg\\.com\\.br|stalgcdn\\.[^/]+|[^/]*\\.blob\\.core\\.windows\\.net|fonts\\.[^/]+|cdnjs\\.[^/]+|maxcdn\\.[^/]+|www\\.google[^/]*|directline\\.[^/]+|analytics\\.[^/]+)/i.test(normalized)) {
                return url;
              }
              if (/^https?:\\/\\/pernambucanas\\.lgcloud\\.com\\.br\\/autenticacao/i.test(normalized)) {
                return normalized.replace(/^https?:\\/\\/pernambucanas\\.lgcloud\\.com\\.br/i, '');
              }
              if (/^https?:\\/\\/pnb-prd-aa\\.lgcloud\\.com\\.br\\/(Autoatendimento|Api\\.|LG\\.|LiGiaProWebChat|Solper|integracao|identificadores|negotiate)/i.test(normalized)) {
                return normalized.replace(/^https?:\\/\\/pnb-prd-aa\\.lgcloud\\.com\\.br/i, '');
              }
              var m = normalized.match(/^https?:\\/\\/([^/?#]+)([/?#].*)?$/i);
              if (m) {
                var extHost = m[1];
                var extRest = m[2] || '/';
                if (extRest.charAt(0) === '?' || extRest.charAt(0) === '#') {
                  extRest = '/' + extRest;
                }
                return '/lg-p/' + PF_SID + '/' + extHost + extRest;
              }
              return normalized;
            }

            if (window.fetch) {
              var origFetch = window.fetch.bind(window);
              window.fetch = function(input, init) {
                var resolvedUrl = '';
                if (typeof input === 'string') {
                  input = toProxyUrl(input);
                  resolvedUrl = input;
                } else if (input && typeof input.url === 'string') {
                  var nextUrl = toProxyUrl(input.url);
                  if (nextUrl !== input.url) {
                    input = new Request(nextUrl, input);
                  }
                  resolvedUrl = nextUrl;
                }
                var isMarcarCall = resolvedUrl && /\\/marcacao\\/marcar(\\?|$)/i.test(resolvedUrl);
                if (isMarcarCall) window.__pfMarcarInFlight = true;
                var promise = origFetch(input, init);
                if (resolvedUrl && resolvedUrl.toLowerCase().indexOf('/marcacao/') !== -1) {
                  promise.then(function(res) {
                    if (isMarcarCall) window.__pfMarcarInFlight = false;
                    try {
                      res.clone().json().then(function(data) {
                        window.__pfHandleMarcacaoResponse(resolvedUrl, data);
                      }).catch(function() {});
                    } catch (e) {}
                  }).catch(function() {
                    if (isMarcarCall) window.__pfMarcarInFlight = false;
                  });
                }
                return promise;
              };
            }

            if (window.XMLHttpRequest) {
              var origOpen = XMLHttpRequest.prototype.open;
              var origSend = XMLHttpRequest.prototype.send;
              XMLHttpRequest.prototype.open = function(method, url) {
                var args = Array.prototype.slice.call(arguments);
                if (typeof url === 'string') {
                  args[1] = toProxyUrl(url);
                  this.__pfReqUrl = args[1];
                }
                return origOpen.apply(this, args);
              };
              XMLHttpRequest.prototype.send = function() {
                var xhr = this;
                if (xhr.__pfReqUrl && xhr.__pfReqUrl.toLowerCase().indexOf('/marcacao/') !== -1 && !xhr.__pfLoadHooked) {
                  xhr.__pfLoadHooked = true;
                  var isXhrMarcar = /\\/marcacao\\/marcar(\\?|$)/i.test(xhr.__pfReqUrl);
                  if (isXhrMarcar) window.__pfMarcarInFlight = true;
                  xhr.addEventListener('loadend', function() {
                    if (isXhrMarcar) window.__pfMarcarInFlight = false;
                  });
                  xhr.addEventListener('load', function() {
                    try {
                      if (xhr.status >= 200 && xhr.status < 300 && typeof xhr.responseText === 'string' && xhr.responseText.trim()) {
                        var parsed = JSON.parse(xhr.responseText);
                        window.__pfHandleMarcacaoResponse(xhr.__pfReqUrl, parsed);
                      }
                    } catch (e) {}
                  });
                }
                return origSend.apply(this, arguments);
              };
            }

            function notifyParentStage() {
              try {
                window.parent.postMessage({
                  type: 'PF_PORTAL_STAGE',
                  host: PF_HOST,
                  path: window.location.pathname,
                  hash: window.location.hash,
                  href: window.location.href,
                  mode: window.__pfMode
                }, '*');
              } catch (e) {}
            }

            notifyParentStage();
            window.addEventListener('hashchange', notifyParentStage);
            window.addEventListener('load', notifyParentStage);
          })();
          </script>
        `;

        const loginAutoFillScript = `
          <script>
          (function() {
            var user = ${userJson};
            var pass = ${passJson};

            function hideCookiePopup() {
              try {
                var popups = document.querySelectorAll('.popup');
                popups.forEach(function(p) { p.style.display = 'none'; });
                if (typeof window.aceitarCookies === 'function') {
                  window.aceitarCookies();
                }
              } catch (e) {}
            }

            function setNativeValue(el, value) {
              var proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
              var desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
              if (desc && desc.set) {
                desc.set.call(el, value);
              } else {
                el.value = value;
              }
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }

            function setFloatingBanner(htmlText, bgHex) {
              var banner = document.getElementById('pontofacil-autofill-banner');
              if (!banner) {
                banner = document.createElement('div');
                banner.id = 'pontofacil-autofill-banner';
                banner.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:' + (bgHex || '#facc15') + ';color:#000;padding:7px 14px;border-radius:12px;font-family:sans-serif;font-size:12px;font-weight:900;z-index:9999999;box-shadow:0 4px 16px rgba(0,0,0,0.45);border:2px solid #000;text-align:center;max-width:92vw;pointer-events:none;';
                document.body.appendChild(banner);
              } else if (bgHex) {
                banner.style.background = bgHex;
              }
              banner.innerHTML = htmlText;
              return banner;
            }

            function performAutoLogin() {
              if (window.__pfAutoLoginAttempted) return;
              hideCookiePopup();

              var userField = document.getElementById('ContentPlaceHolder_txtLoginT');
              var passField = document.getElementById('ContentPlaceHolder_txtSenhaT');
              var btn = document.getElementById('ContentPlaceHolder_btnEntrar');

              if (!userField || !passField || !btn) {
                startAutoatendimentoAutomation();
                return;
              }

              // Se o portal retornou erro (.msgAlerta), mantém a tela atual, aguarda 5 segundos e aperta Entrar novamente
              var alertaEl = document.querySelector('.msgAlerta, #ContentPlaceHolder_lblMensagem, #ContentPlaceHolder_mensagens');
              var alertaText = alertaEl ? (alertaEl.innerText || alertaEl.textContent || '').trim() : '';

              if (alertaText.length > 0) {
                window.__pfAutoLoginAttempted = true;
                btn.disabled = false;
                if (user) setNativeValue(userField, user);
                if (pass) setNativeValue(passField, pass);

                var retryKey = 'pf_auto_retry_' + ${activeSidJson};
                var prevRetries = 0;
                try {
                  prevRetries = Number(window.sessionStorage.getItem(retryKey) || '0') || 0;
                } catch (e) {}

                var shouldAutoRetry = Boolean(user && pass && prevRetries < 1);

                try {
                  window.parent.postMessage({
                    type: 'PF_PORTAL_ERROR',
                    message: alertaText,
                    retryingInSeconds: shouldAutoRetry ? 5 : 0
                  }, '*');
                } catch (e) {}

                if (shouldAutoRetry) {
                  try {
                    window.sessionStorage.setItem(retryKey, String(prevRetries + 1));
                  } catch (e) {}

                  var countdownSec = 5;
                  setFloatingBanner('⏳ Erro detectado. Aguardando <strong>' + countdownSec + 's</strong> nesta tela para clicar em Entrar novamente...', '#fef08a');

                  var cancelledByManualClick = false;
                  var cancelAutoRetry = function(ev) {
                    if (ev && ev.isTrusted) {
                      cancelledByManualClick = true;
                      clearInterval(retryTick);
                      var rb = document.getElementById('pontofacil-autofill-banner');
                      if (rb && rb.parentNode) rb.parentNode.removeChild(rb);
                    }
                  };
                  btn.addEventListener('click', cancelAutoRetry, { once: true });

                  var retryTick = setInterval(function() {
                    if (cancelledByManualClick) {
                      clearInterval(retryTick);
                      return;
                    }
                    countdownSec--;
                    if (countdownSec > 0) {
                      setFloatingBanner('⏳ Erro detectado. Aguardando <strong>' + countdownSec + 's</strong> nesta tela para clicar em Entrar novamente...', '#fef08a');
                    } else {
                      clearInterval(retryTick);
                      setFloatingBanner('🔐 Clicando em Entrar novamente...', '#facc15');
                      btn.disabled = false;
                      if (user) setNativeValue(userField, user);
                      if (pass) setNativeValue(passField, pass);
                      btn.click();
                      setTimeout(function() {
                        if (btn) btn.disabled = false;
                      }, 6000);
                    }
                  }, 1000);
                }
                return;
              }

              if (!user || !pass) return;

              window.__pfAutoLoginAttempted = true;

              setNativeValue(userField, user);
              setNativeValue(passField, pass);

              setFloatingBanner('🔐 Login e senha preenchidos automaticamente! Entrando no Portal Nossa Gente...', '#facc15');

              // Aguarda __doPostBack e theForm do ASP.NET estarem 100% prontos antes de disparar um único envio
              var waitCount = 0;
              var waitTimer = setInterval(function() {
                waitCount++;
                var formReady = typeof window.__doPostBack === 'function' && (window.theForm || document.getElementById('form1'));
                if (formReady && waitCount >= 2) {
                  clearInterval(waitTimer);
                  if (!btn.disabled) {
                    btn.disabled = true;
                    window.__doPostBack('ctl00$ContentPlaceHolder$btnEntrar', '');
                    setTimeout(function() {
                      if (btn) btn.disabled = false;
                    }, 6000);
                  }
                } else if (waitCount > 25) {
                  clearInterval(waitTimer);
                  if (!btn.disabled) {
                    btn.click();
                    setTimeout(function() {
                      if (btn) btn.disabled = false;
                    }, 6000);
                  }
                }
              }, 150);
            }

            // ── AUTOATENDIMENTO AUTOMATION (Marcar ponto -> Sim / Verificar / Testar) ──
            function isElemVisible(el) {
              if (!el || !el.isConnected) return false;
              var style = window.getComputedStyle(el);
              if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
              var opacity = parseFloat(style.opacity || '1');
              if (!isNaN(opacity) && opacity < 0.05) return false;
              var rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            }

            function isElemDisabled(el) {
              if (!el) return true;
              return Boolean(
                el.disabled ||
                el.getAttribute('disabled') !== null ||
                el.getAttribute('aria-disabled') === 'true' ||
                el.classList.contains('p-disabled') ||
                el.classList.contains('p-button-loading') ||
                el.querySelector('.p-button-loading-icon, .pi-spin')
              );
            }

            function normalizeBtnText(el) {
              var lbl = el.querySelector && el.querySelector('.p-button-label');
              var raw = (lbl && (lbl.innerText || lbl.textContent)) || el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '';
              return raw.replace(/[\\u00a0\\s]+/g, ' ').trim().toLowerCase();
            }

            function collectDocs() {
              var docs = [document];
              try {
                var frames = document.querySelectorAll('iframe');
                for (var f = 0; f < frames.length; f++) {
                  try {
                    if (frames[f].contentDocument) docs.push(frames[f].contentDocument);
                  } catch (e) {}
                }
              } catch (e) {}
              return docs;
            }

            function findMarcarPontoButton() {
              var docs = collectDocs();
              for (var d = 0; d < docs.length; d++) {
                var doc = docs[d];
                var btns = doc.querySelectorAll('button, [role="button"], a.p-button, .p-button');
                // Tier 1: exact or keyword match on button text / aria-label / .p-button-label
                for (var i = 0; i < btns.length; i++) {
                  var b = btns[i];
                  if (!isElemVisible(b)) continue;
                  var txt = normalizeBtnText(b);
                  var aria = (b.getAttribute('aria-label') || '').replace(/[\\u00a0\\s]+/g, ' ').trim().toLowerCase();
                  var combined = txt || aria;
                  if (!combined) continue;
                  if (
                    combined === 'marcar ponto' ||
                    combined === 'bater ponto' ||
                    combined === 'registrar ponto' ||
                    combined === 'marcar meu ponto' ||
                    combined.indexOf('marcar ponto') !== -1 ||
                    combined.indexOf('bater ponto') !== -1 ||
                    combined.indexOf('registrar ponto') !== -1
                  ) {
                    return { el: b, disabled: isElemDisabled(b), text: combined };
                  }
                }

                // Tier 2: look inside official LG widget-ponto clock container (.lg-aa-widget-ponto__relogio)
                var widgetBtns = doc.querySelectorAll('[class*="lg-aa-widget-ponto__relogio"] button, [class*="lg-aa-widget-ponto"] button.p-button');
                for (var w = 0; w < widgetBtns.length; w++) {
                  var wb = widgetBtns[w];
                  if (!isElemVisible(wb)) continue;
                  var wTxt = normalizeBtnText(wb);
                  if (!wTxt) continue;
                  if (
                    wTxt.indexOf('atualizar') !== -1 ||
                    wTxt.indexOf('fechar') !== -1 ||
                    wTxt.indexOf('ajuda') !== -1 ||
                    wTxt.indexOf('historico') !== -1 ||
                    wTxt.indexOf('histórico') !== -1
                  ) {
                    continue;
                  }
                  return { el: wb, disabled: isElemDisabled(wb), text: wTxt };
                }
              }
              return null;
            }

            function findConfirmSimButton() {
              var docs = collectDocs();
              for (var di = docs.length - 1; di >= 0; di--) {
                var doc = docs[di];

                // 1. Direct PrimeVue ConfirmDialog accept class (highest accuracy, regardless of language)
                var directAccepts = doc.querySelectorAll('.p-confirm-dialog-accept');
                for (var a = directAccepts.length - 1; a >= 0; a--) {
                  var acc = directAccepts[a];
                  if (isElemVisible(acc)) {
                    var accStyle = window.getComputedStyle(acc);
                    if (!accStyle || accStyle.pointerEvents !== 'none') return acc;
                  }
                }

                // 2. Visible dialogs/modals rendered in portal
                var dialogs = doc.querySelectorAll('.p-confirm-dialog, .p-dialog, [role="dialog"], [role="alertdialog"]');
                for (var d = dialogs.length - 1; d >= 0; d--) {
                  var dlg = dialogs[d];
                  if (!isElemVisible(dlg)) continue;

                  var dBtns = dlg.querySelectorAll('button, [role="button"]');
                  for (var k = 0; k < dBtns.length; k++) {
                    var db = dBtns[k];
                    if (!isElemVisible(db)) continue;
                    var t = normalizeBtnText(db);
                    var aria = (db.getAttribute('aria-label') || '').replace(/[\\u00a0\\s]+/g, ' ').trim().toLowerCase();
                    var lbl = t || aria;
                    if (
                      lbl === 'sim' ||
                      lbl === 'confirmar' ||
                      lbl === 'aceitar' ||
                      lbl === 'yes' ||
                      lbl === 'ok'
                    ) {
                      return db;
                    }
                  }

                  // Fallback inside dialog footer: primary non-reject button
                  var footerBtn = dlg.querySelector('.p-dialog-footer button:not(.p-confirm-dialog-reject):not(.p-button-text)');
                  if (footerBtn && isElemVisible(footerBtn)) {
                    var ft = normalizeBtnText(footerBtn);
                    if (ft && ft !== 'não' && ft !== 'nao' && ft !== 'cancelar' && ft !== 'no' && ft !== 'fechar') {
                      return footerBtn;
                    }
                  }
                }
              }
              return null;
            }

            function triggerRobustClick(el) {
              if (!el) return;
              try {
                var r = el.getBoundingClientRect();
                if (r.top < 0 || r.bottom > window.innerHeight) {
                  el.scrollIntoView({ block: 'center', behavior: 'auto' });
                }
              } catch (e) {}
              try {
                if (typeof el.focus === 'function') el.focus({ preventScroll: true });
              } catch (e) {}
              el.click();
            }

            function collectAllTodayPunches() {
              var merged = [];
              var apiList = window.__pfPortalPunches || [];
              for (var a = 0; a < apiList.length; a++) {
                if (merged.indexOf(apiList[a]) === -1) merged.push(apiList[a]);
              }
              try {
                var timelines = document.querySelectorAll('.p-timeline, .p-timeline-event');
                timelines.forEach(function(tl) {
                  var text = (tl.innerText || tl.textContent || '');
                  var matches = text.match(/\\b([01]\\d|2[0-3]):([0-5]\\d)\\b/g) || [];
                  for (var m = 0; m < matches.length; m++) {
                    if (merged.indexOf(matches[m]) === -1) merged.push(matches[m]);
                  }
                });
              } catch (e) {}
              return merged.sort();
            }

            function hasFalhaNaConsultaCard() {
              var pontoCard = document.querySelector('[class*="lg-aa-widget-ponto"]');
              if (pontoCard) {
                var cText = pontoCard.innerText || pontoCard.textContent || '';
                if (cText.indexOf('Falha na Consulta') !== -1) return true;
              }
              return Boolean(window.__pfConfigFailed && !findMarcarPontoButton());
            }

            function postParentStep(step, extra) {
              try {
                var payload = { type: 'PF_AUTO_STEP', mode: window.__pfMode, step: step };
                if (extra) {
                  for (var k in extra) payload[k] = extra[k];
                }
                window.parent.postMessage(payload, '*');
              } catch (e) {}
            }

            var aaTimerHandle = null;
            function startAutoatendimentoAutomation(forceRestart) {
              var hostStr = String(window.__pfHost || window.location.hostname || '');
              var isAA =
                hostStr.indexOf('pnb-prd-aa') !== -1 ||
                window.location.pathname.toLowerCase().indexOf('/autoatendimento') !== -1 ||
                Boolean(document.querySelector('[class*="lg-aa-layout"], [class*="lg-aa-widget-ponto"]'));
              if (!isAA) return;
              if (window.__pfAAStarted && !forceRestart) return;

              var mode = window.__pfMode || 'auto_punch';
              if (mode === 'manual_punch') {
                if (aaTimerHandle) {
                  clearInterval(aaTimerHandle);
                  aaTimerHandle = null;
                }
                window.__pfAAStarted = false;
                return;
              }

              window.__pfAAStarted = true;
              if (aaTimerHandle) {
                clearInterval(aaTimerHandle);
                aaTimerHandle = null;
              }

              var clickedMarcar = false;
              var clickedMarcarAt = 0;
              var retriedMarcar = false;
              var clickedSim = false;
              var clickedSimAt = 0;
              var retriedSim = false;
              var punchesFirstReadyAt = 0;
              var lastProgressAt = Date.now();
              var maxStageWaitMs = 45000;

              if (mode === 'auto_punch') {
                postParentStep('finding_punch_button');
                setFloatingBanner('🤖 Automático: procurando botão "Marcar ponto"...', '#facc15');
              } else if (mode === 'verify_punches') {
                postParentStep('reading_punches');
                setFloatingBanner('🔍 Verificando batidas de hoje no portal oficial...', '#facc15');
              } else if (mode === 'test_connection') {
                postParentStep('testing_connection');
                setFloatingBanner('🛡️ Testando conexão e procurando botão "Marcar ponto" (sem bater ponto)...', '#facc15');
              }

              aaTimerHandle = setInterval(function() {
                var currentMode = window.__pfMode || mode;
                if (currentMode === 'manual_punch') {
                  clearInterval(aaTimerHandle);
                  aaTimerHandle = null;
                  window.__pfAAStarted = false;
                  var b = document.getElementById('pontofacil-autofill-banner');
                  if (b && b.parentNode) b.parentNode.removeChild(b);
                  return;
                }

                if (Date.now() - lastProgressAt > maxStageWaitMs) {
                  clearInterval(aaTimerHandle);
                  aaTimerHandle = null;
                  setFloatingBanner('⚠️ Tempo esgotado aguardando o card de ponto. Você pode clicar manualmente e salvar no (✕).', '#fca5a5');
                  if (currentMode === 'verify_punches') {
                    window.parent.postMessage({ type: 'PF_VERIFY_PUNCHES_RESULT', success: false, error: 'Tempo esgotado aguardando carregamento das marcações no Autoatendimento.' }, '*');
                  } else if (currentMode === 'test_connection') {
                    window.parent.postMessage({ type: 'PF_TEST_CONNECTION_RESULT', success: false, error: 'Tempo esgotado aguardando o botão Marcar ponto no Autoatendimento.' }, '*');
                  } else {
                    window.parent.postMessage({ type: 'PF_AUTO_PUNCH_RESULT', success: false, error: 'Tempo esgotado aguardando o botão Marcar ponto / confirmação Sim.' }, '*');
                  }
                  return;
                }

                // Detecta Falha na Consulta somente se o botão de marcação realmente não existir
                if (!clickedMarcar && !findMarcarPontoButton() && hasFalhaNaConsultaCard()) {
                  clearInterval(aaTimerHandle);
                  aaTimerHandle = null;
                  var errTxt = 'O card "Marcação de ponto" exibiu "Falha na Consulta" no portal.';
                  setFloatingBanner('❌ ' + errTxt, '#fca5a5');
                  if (currentMode === 'verify_punches') {
                    window.parent.postMessage({ type: 'PF_VERIFY_PUNCHES_RESULT', success: false, error: errTxt }, '*');
                  } else if (currentMode === 'test_connection') {
                    window.parent.postMessage({ type: 'PF_TEST_CONNECTION_RESULT', success: false, error: errTxt }, '*');
                  } else {
                    window.parent.postMessage({ type: 'PF_AUTO_PUNCH_RESULT', success: false, error: errTxt }, '*');
                  }
                  return;
                }

                // ── MODO VERIFY PUNCHES ─────────────────────────────────────
                if (currentMode === 'verify_punches') {
                  var btnInfo = findMarcarPontoButton();
                  var timelineLoaded = Boolean(window.__pfPunchesLoaded) || Boolean(btnInfo && !btnInfo.disabled && !document.querySelector('.p-skeleton'));
                  if (timelineLoaded) {
                    if (!punchesFirstReadyAt) punchesFirstReadyAt = Date.now();
                    if (Date.now() - punchesFirstReadyAt >= 800) {
                      clearInterval(aaTimerHandle);
                      aaTimerHandle = null;
                      var synced = collectAllTodayPunches();
                      setFloatingBanner('✅ Verificação concluída! ' + synced.length + ' marcação(ões) encontrada(s) hoje.', '#86efac');
                      window.parent.postMessage({
                        type: 'PF_VERIFY_PUNCHES_RESULT',
                        success: true,
                        punches: synced
                      }, '*');
                    }
                  }
                  return;
                }

                // ── MODO TEST CONNECTION (DRY-RUN SEM BATER PONTO) ─────────
                if (currentMode === 'test_connection') {
                  var testBtn = findMarcarPontoButton();
                  if ((testBtn && !testBtn.disabled) || window.__pfConfigIsento) {
                    if (!punchesFirstReadyAt) punchesFirstReadyAt = Date.now();
                    if (Date.now() - punchesFirstReadyAt >= 800) {
                      clearInterval(aaTimerHandle);
                      aaTimerHandle = null;
                      var testPunches = collectAllTodayPunches();
                      setFloatingBanner('✅ Conexão validada! Botão "Marcar ponto" encontrado e ativo (ponto NÃO batido).', '#86efac');
                      window.parent.postMessage({
                        type: 'PF_TEST_CONNECTION_RESULT',
                        success: true,
                        buttonFound: Boolean(testBtn && !testBtn.disabled),
                        isento: Boolean(window.__pfConfigIsento),
                        punches: testPunches
                      }, '*');
                    }
                  }
                  return;
                }

                // ── MODO AUTO PUNCH ─────────────────────────────────────────
                if (!clickedMarcar) {
                  var pBtn = findMarcarPontoButton();
                  if (pBtn && !pBtn.disabled) {
                    clickedMarcar = true;
                    clickedMarcarAt = Date.now();
                    lastProgressAt = Date.now();
                    postParentStep('clicking_punch_button');
                    setFloatingBanner('🖱️ Botão "Marcar ponto" encontrado! Clicando agora...', '#facc15');
                    setTimeout(function() {
                      var freshBtn = findMarcarPontoButton();
                      var targetBtn = (freshBtn && !freshBtn.disabled) ? freshBtn.el : pBtn.el;
                      try { triggerRobustClick(targetBtn); } catch (e) {}
                      clickedMarcarAt = Date.now();
                      postParentStep('finding_confirm_sim');
                      setFloatingBanner('⏳ Procurando botão de confirmação "Sim"...', '#fef08a');
                    }, 180);
                  }
                  return;
                }

                if (!clickedSim) {
                  var simBtn = findConfirmSimButton();
                  if (simBtn && !isElemDisabled(simBtn)) {
                    clickedSim = true;
                    clickedSimAt = Date.now();
                    lastProgressAt = Date.now();
                    postParentStep('clicking_confirm_sim');
                    setFloatingBanner('✅ Botão "Sim" encontrado! Confirmando ponto agora...', '#facc15');
                    setTimeout(function() {
                      var freshSim = findConfirmSimButton();
                      var targetSim = (freshSim && !isElemDisabled(freshSim)) ? freshSim : simBtn;
                      try { triggerRobustClick(targetSim); } catch (e) {}
                      clickedSimAt = Date.now();
                      postParentStep('waiting_portal_confirmation');
                      setFloatingBanner('⏳ Aguardando confirmação final da marcação...', '#fef08a');
                    }, 150);
                    return;
                  }

                  // Se o usuário já clicou manualmente no Sim e disparou /marcacao/Marcar
                  if (window.__pfMarcarInFlight || window.__pfPunchApiResult) {
                    clickedSim = true;
                    clickedSimAt = Date.now();
                    lastProgressAt = Date.now();
                    postParentStep('waiting_portal_confirmation');
                    return;
                  }

                  // Segurança: se após 2.4s de clicar em "Marcar ponto" o modal "Sim" ainda não apareceu, tenta 1 novo clique no botão
                  if (!retriedMarcar && clickedMarcarAt && Date.now() - clickedMarcarAt > 2400) {
                    var retryPBtn = findMarcarPontoButton();
                    if (retryPBtn && !retryPBtn.disabled) {
                      retriedMarcar = true;
                      clickedMarcarAt = Date.now();
                      try { triggerRobustClick(retryPBtn.el); } catch (e) {}
                    }
                  }
                  return;
                }

                // Segurança: se 900ms após clicar em "Sim" o dialog continuar visível e não houve chamada /marcacao/Marcar, re-clica no "Sim"
                if (
                  !retriedSim &&
                  clickedSimAt &&
                  Date.now() - clickedSimAt > 900 &&
                  !window.__pfMarcarInFlight &&
                  !window.__pfPunchApiResult
                ) {
                  var stillSim = findConfirmSimButton();
                  if (stillSim && !isElemDisabled(stillSim)) {
                    retriedSim = true;
                    clickedSimAt = Date.now();
                    try { triggerRobustClick(stillSim); } catch (e) {}
                    return;
                  }
                }

                // Após clicar em Sim, aguarda confirmação oficial (API /marcacao/Marcar ou Toast PrimeVue)
                if (window.__pfPunchApiResult) {
                  clearInterval(aaTimerHandle);
                  aaTimerHandle = null;
                  if (window.__pfPunchApiResult.success) {
                    setFloatingBanner('🎉 Ponto batido e confirmado pelo Portal Nossa Gente!', '#86efac');
                    window.parent.postMessage({
                      type: 'PF_AUTO_PUNCH_RESULT',
                      success: true,
                      punches: collectAllTodayPunches(),
                      timeIso: new Date().toISOString()
                    }, '*');
                  } else {
                    var apiErr = window.__pfPunchApiResult.error || 'O portal não confirmou a marcação.';
                    setFloatingBanner('❌ Erro na marcação: ' + apiErr, '#fca5a5');
                    window.parent.postMessage({
                      type: 'PF_AUTO_PUNCH_RESULT',
                      success: false,
                      error: apiErr
                    }, '*');
                  }
                  return;
                }

                var toastSuccess = document.querySelector('.p-toast-message-success');
                if (toastSuccess && isElemVisible(toastSuccess)) {
                  clearInterval(aaTimerHandle);
                  aaTimerHandle = null;
                  setFloatingBanner('🎉 Ponto batido e confirmado pelo Portal Nossa Gente!', '#86efac');
                  window.parent.postMessage({
                    type: 'PF_AUTO_PUNCH_RESULT',
                    success: true,
                    punches: collectAllTodayPunches(),
                    timeIso: new Date().toISOString()
                  }, '*');
                  return;
                }

                var toastErr = document.querySelector('.p-toast-message-error');
                if (toastErr && isElemVisible(toastErr)) {
                  clearInterval(aaTimerHandle);
                  aaTimerHandle = null;
                  var toastErrTxt = (toastErr.innerText || toastErr.textContent || 'Erro ao registrar ponto no portal.').trim();
                  setFloatingBanner('❌ ' + toastErrTxt, '#fca5a5');
                  window.parent.postMessage({
                    type: 'PF_AUTO_PUNCH_RESULT',
                    success: false,
                    error: toastErrTxt
                  }, '*');
                  return;
                }

                // Fallback de segurança caso a resposta já tenha concluído e o modal fechado (aguarda se requisição ainda estiver em voo)
                if (
                  clickedSimAt &&
                  !window.__pfMarcarInFlight &&
                  Date.now() - clickedSimAt > 3500 &&
                  !findConfirmSimButton()
                ) {
                  clearInterval(aaTimerHandle);
                  aaTimerHandle = null;
                  setFloatingBanner('🎉 Ponto enviado e confirmado!', '#86efac');
                  window.parent.postMessage({
                    type: 'PF_AUTO_PUNCH_RESULT',
                    success: true,
                    punches: collectAllTodayPunches(),
                    timeIso: new Date().toISOString()
                  }, '*');
                }
              }, 250);
            }
            window.__pfStartAA = startAutoatendimentoAutomation;

            function bootstrapPortalScripts() {
              performAutoLogin();
              startAutoatendimentoAutomation(false);
            }

            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', bootstrapPortalScripts);
              window.addEventListener('load', bootstrapPortalScripts);
            } else {
              bootstrapPortalScripts();
            }
            window.addEventListener('hashchange', function() {
              startAutoatendimentoAutomation(false);
            });
          })();
          </script>
        `;

        if (/<head[^>]*>/i.test(html)) {
          html = html.replace(/<head([^>]*)>/i, `<head$1>${headShim}`);
        } else {
          html = headShim + html;
        }

        if (/<\/body>/i.test(html)) {
          html = html.replace(/<\/body>/i, `${loginAutoFillScript}</body>`);
        } else {
          html += loginAutoFillScript;
        }

        return res.send(html);
      }

      if (
        contentType.includes('javascript') ||
        contentType.includes('ecmascript') ||
        contentType.includes('text/css')
      ) {
        let textBody = await upstreamRes.text();
        textBody = rewritePortalBodyUrls(textBody, session.id);
        return res.send(textBody);
      }

      if (upstreamRes.status === 204 || upstreamRes.status === 304) {
        return res.end();
      }

      const buffer = Buffer.from(await upstreamRes.arrayBuffer());
      return res.send(buffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(502).send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;text-align:center;">
          <div style="max-width:420px;background:#1c1917;border:1px solid #333;padding:24px;border-radius:16px;">
            <h3 style="margin:0 0 8px;color:#facc15;">Não foi possível carregar esta página do portal</h3>
            <p style="margin:0 0 16px;color:#a3a3a3;font-size:13px;">${msg}</p>
            <a href="https://pernambucanas.lgcloud.com.br/autenticacao/produtos/SAAA/principal2.aspx?c=pernambucanas" target="_blank" style="display:inline-block;background:#facc15;color:#000;padding:10px 18px;border-radius:10px;font-weight:bold;text-decoration:none;font-size:13px;">Abrir Portal Direto no Chrome</a>
          </div>
        </body>
        </html>
      `);
    }
  }

  // Mount direct routes for Pernambucanas Auth
  app.use('/autenticacao', (req, res) => {
    return handlePortalProxy(req, res, 'pernambucanas.lgcloud.com.br', req.originalUrl);
  });

  // Mount ALL Autoatendimento & LG Cloud API prefixes to pnb-prd-aa.lgcloud.com.br
  for (const prefix of AUTOATENDIMENTO_PREFIXES) {
    app.use(prefix, (req, res) => {
      return handlePortalProxy(req, res, 'pnb-prd-aa.lgcloud.com.br', req.originalUrl);
    });
  }

  // Forward any unrecognized /api/* requests that originated from inside the proxied portal iframe
  app.use('/api', (req, res, next) => {
    const referer = (req.headers.referer || '').toLowerCase();
    const hasSidCookie = Boolean(parseCookiesFromHeader(req.headers.cookie).pf_sid);
    const isInternalApi =
      req.path === '/health' ||
      req.path.startsWith('/portal/') ||
      req.path === '/portal-embed' ||
      req.path.startsWith('/ponto/');
    if (!isInternalApi && (hasSidCookie || referer.includes('/autoatendimento') || referer.includes('/autenticacao') || referer.includes('/lg-p/'))) {
      return handlePortalProxy(req, res, 'pnb-prd-aa.lgcloud.com.br', req.originalUrl);
    }
    return next();
  });

  // Generic host proxy for any intermediate LG / Norber / Pernambucanas hosts
  app.all('/lg-p/:sid/:host/*', (req, res) => {
    const { sid, host } = req.params;
    if (!isAllowedProxyHost(host)) {
      return res.status(400).json({ error: 'Host de destino inválido.' });
    }
    const prefix = `/lg-p/${sid}/${host}`;
    const rest = req.originalUrl.startsWith(prefix)
      ? req.originalUrl.slice(prefix.length) || '/'
      : '/';
    return handlePortalProxy(req, res, host, rest, sid);
  });

  app.all('/lg-p/:sid/:host', (req, res) => {
    const { sid, host } = req.params;
    if (!isAllowedProxyHost(host)) {
      return res.status(400).json({ error: 'Host de destino inválido.' });
    }
    return handlePortalProxy(req, res, host, '/', sid);
  });

  // Legacy helper redirect
  app.get('/api/portal-embed', (req, res) => {
    const user = String(req.query.u || '').trim();
    const pass = String(req.query.p || '').trim();
    const sid = crypto.randomBytes(12).toString('hex');
    const cookies = new Map<string, StoredCookie>();
    cookies.set('lgcloud.com.br|LG_CCO', {
      name: 'LG_CCO',
      value: 'true',
      domain: 'lgcloud.com.br',
      path: '/',
    });
    proxySessions.set(sid, {
      id: sid,
      usuario: user,
      senha: pass,
      mode: 'auto_punch',
      cookies,
      createdAt: Date.now(),
    });
    latestProxySessionId = sid;
    return res.redirect(
      302,
      `/autenticacao/produtos/SAAA/principal2.aspx?c=pernambucanas&pf_sid=${encodeURIComponent(sid)}`
    );
  });

  // ── ENDPOINT DE TESTE DE CONEXÃO, VERIFICAÇÃO E SIMULAÇÃO ────────────────
  app.post('/api/ponto/marcar', async (req, res) => {
    const { usuario, senha, mode = 'real' } = req.body;

    if (!usuario || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Usuário e senha são obrigatórios. Configure nas Configurações do app.',
      });
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour12: false });
    const dateStr = now.toLocaleDateString('pt-BR');

    if (mode === 'simulado') {
      await new Promise((r) => setTimeout(r, 700));
      return res.json({
        success: true,
        time: timeStr,
        date: dateStr,
        message: 'Ponto simulado registrado com sucesso!',
        simulated: true,
        isDryRun: false,
        executionMode: 'simulado',
      });
    }

    if (mode === 'verificar_pontos_simulado') {
      await new Promise((r) => setTimeout(r, 700));
      return res.json({
        success: true,
        punchesFound: [
          { time: '08:00:00', shortTime: '08:00', isLunch: false, type: 'entrada', status: 'confirmado' },
          { time: '12:00:00', shortTime: '12:00', isLunch: true, type: 'almoco_ida', status: 'confirmado' },
        ],
        message: 'Modo Simulação: 2 marcações de exemplo sincronizadas.',
        logs: ['[Simulação] Consulta de batidas simulada com sucesso.'],
      });
    }

    const logs: string[] = [];

    try {
      const authResult = await authenticateWithPortalServer(usuario, senha);
      logs.push(...authResult.logs);

      if (!authResult.authenticated) {
        return res.status(401).json({
          success: false,
          error:
            `O portal da Pernambucanas rejeitou o acesso com a mensagem oficial: ` +
            `"${authResult.error || 'Login e/ou senha inválidos. Informe-os novamente.'}". ` +
            `Por favor, confirme se seu usuário/CPF e senha nas configurações estão corretos.`,
          logs,
        });
      }

      if (mode === 'verificar_pontos') {
        // Verifica sessão autenticada no Autoatendimento
        const aaCookie = buildCookieHeaderForHost(authResult.cookieJar, 'pnb-prd-aa.lgcloud.com.br');
        let punchesFound: Array<{
          time: string;
          shortTime: string;
          isLunch: boolean;
          type: 'entrada' | 'almoco_ida' | 'almoco_volta' | 'saida';
          status: 'confirmado';
        }> = [];

        try {
          const checkRes = await fetch(
            'https://pnb-prd-aa.lgcloud.com.br/Autoatendimento/Produtos/AA/AASessao/Renove',
            {
              method: 'POST',
              headers: {
                Cookie: aaCookie,
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                Origin: 'https://pnb-prd-aa.lgcloud.com.br',
                Referer: 'https://pnb-prd-aa.lgcloud.com.br/Autoatendimento/index.html',
              },
            }
          );
          logs.push(`[5] Sessão verificada no Autoatendimento (HTTP ${checkRes.status}).`);
        } catch {
          // Non-fatal
        }

        return res.json({
          success: true,
          punchesFound,
          message:
            `Sessão autenticada como "${authResult.successfulLogin}" no Autoatendimento! ` +
            `Para bater ou conferir o espelho visualmente, clique em "Marcar ponto".`,
          logs,
        });
      }

      const t = new Date();
      return res.json({
        success: true,
        time: t.toLocaleTimeString('pt-BR', { hour12: false }),
        date: t.toLocaleDateString('pt-BR'),
        message: `Teste de Conexão no Portal 100% aprovado! Sessão autenticada como "${authResult.successfulLogin}" e redirecionada ao Autoatendimento.`,
        simulated: true,
        isDryRun: true,
        buttonFound: true,
        executionMode: 'pessoa_fisica',
        logs,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logs.push(`[FALHA TÉCNICA] ${errMsg}`);
      return res.status(500).json({ success: false, error: errMsg, logs });
    }
  });

  // ── Vite dev / produção estática ────────────────────────────────────────
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ PontoFácil rodando em http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
  process.exit(1);
});