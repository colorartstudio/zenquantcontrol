import 'dotenv/config';
import fs from 'node:fs';
import cors from 'cors';
import express from 'express';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';

const {
  API_PORT = '4174',
  VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  AUTOMATION_API_TOKEN,
  WORKER_BASE_URL = 'http://127.0.0.1:4175',
  WORKER_INTERNAL_TOKEN = AUTOMATION_API_TOKEN || 'zenquant_worker_internal_2026',
  ZENQUANT_BROWSER_PATH,
  ZENQUANT_HEADLESS = 'true',
  ZENQUANT_REFRESH_MS = '15000'
} = process.env;

const ZENQUANT_LOGIN_URL = 'https://www.zenquantai.com/#/pages/login/login/';
const ZENQUANT_TRADE_URL = 'https://www.zenquantai.com/#/pages/UITransaction/trade';
const LIVE_REFRESH_MS = Number(ZENQUANT_REFRESH_MS);
const liveSessions = new Map();
const FIXED_PLUS_ALLOCATION = 50;
const CYCLE_TIMER_SECONDS = 10800;
const TIMER_WORKER_MS = 1000;
let timerWorkerHandle = null;
let timerWorkerRunning = false;

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env.');
}

const app = express();

const toOptionalNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toStoredTimer = (value, fallback = 10800) => {
  const parsed = toOptionalNumber(value);
  return parsed ?? fallback;
};

const supabaseAdmin = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const toClientAccount = (row) => ({
  id: row.id,
  apelido: row.apelido,
  login: row.login,
  status: row.status,
  allocated_360days: Number(row.allocated_360days) || 0,
  allocated_plus: Number(row.allocated_plus) || 0,
  allocated_3hours: Number(row.allocated_3hours) || 0,
  timer: toStoredTimer(row.timer),
  plus_countdown_label: row.plus_countdown_label || null,
  plus_countdown_seconds: toOptionalNumber(row.plus_countdown_seconds),
  hours3_countdown_label: row.hours3_countdown_label || null,
  hours3_countdown_seconds: toOptionalNumber(row.hours3_countdown_seconds),
  days360_countdown_label: row.days360_countdown_label || null,
  days360_countdown_seconds: toOptionalNumber(row.days360_countdown_seconds),
  balance: Number(row.balance) || 0,
  trade_limit: Number(row.trade_limit) || 300,
  created_at: row.created_at,
  live_synced_at: row.live_synced_at || null,
  credencial_configurada: Boolean(row.credencial_configurada),
  connection_state: row.connection_state || 'desconectada',
  last_connected_at: row.last_connected_at || null
});

const callWorker = async (path, options = {}) => {
  const response = await fetch(`${WORKER_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-worker-token': WORKER_INTERNAL_TOKEN,
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let message = 'Falha ao comunicar com o worker ZenQuant.';

    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const requireAutomationToken = (req, res, next) => {
  if (!AUTOMATION_API_TOKEN || req.header('x-automation-token') !== AUTOMATION_API_TOKEN) {
    res.status(401).json({ error: 'Token interno inválido.' });
    return;
  }

  next();
};

const resolveBrowserExecutablePath = () => {
  const candidates = [
    ZENQUANT_BROWSER_PATH,
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);

  const executablePath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!executablePath) {
    throw new Error('Nenhum navegador compatível foi encontrado. Defina ZENQUANT_BROWSER_PATH no .env.');
  }

  return executablePath;
};

const normalizeText = (value) => value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeZenQuantLogin = (value) => {
  const digits = value.replace(/\D/g, '');

  if (digits.startsWith('55') && digits.length >= 12) {
    return digits.slice(2);
  }

  return digits;
};

const extractNumber = (text, regex) => {
  const match = text.match(regex);
  if (!match?.[1]) {
    return 0;
  }

  return Number(match[1].replace(/,/g, ''));
};

const roundCurrency = (value, decimals = 6) => Number((Number(value) || 0).toFixed(decimals));

const parseTradeSnapshot = (rawText, previousLimit = 300) => {
  const text = normalizeText(rawText);
  const positionsSection =
    text.match(/Open positions\s+([\s\S]*?)\s+Trading limit/i)?.[1] ||
    text.match(/Posi[cç][oõ]es abertas\s+([\s\S]*?)\s+(?:Trading limit|Limite de negocia[cç][aã]o)/i)?.[1] ||
    text;
  const allocated360Days =
    extractNumber(positionsSection, /360Days(?:\s+\d+(?:\.\d+)?%)?\s+([\d.]+)\s*USD/i) ||
    extractNumber(positionsSection, /360Days\s+([\d.]+)\s*USD/i);
  const allocatedPlus =
    extractNumber(positionsSection, /Plus(?:\s+\d+(?:\.\d+)?%)?\s+([\d.]+)\s*USD/i) ||
    extractNumber(positionsSection, /Plus\s+([\d.]+)\s*USD/i);
  const allocated3Hours =
    extractNumber(positionsSection, /3Hours(?:\s+\d+(?:\.\d+)?%)?\s+([\d.]+)\s*USD/i) ||
    extractNumber(positionsSection, /3Hours\s+([\d.]+)\s*USD/i);
  const balance =
    extractNumber(text, /Dispon[ií]vel\s+([\d.]+)\s*USD/i) ||
    extractNumber(text, /Available\s+([\d.]+)\s*USD/i);

  const limitPair =
    text.match(/(?:Trading limit|Limite de negocia[cç][aã]o)\s+([\d.]+)\s*USD\s+(?:Increase Quota|Aumentar Cota)\s+([\d.]+)\s*\/\s*([\d.]+)\b/i) ||
    text.match(/(?:Aumentar Cota|Increase Quota)\s+([\d.]+)\s*\/\s*([\d.]+)\b/i);

  let tradeLimit = previousLimit;
  if (limitPair) {
    tradeLimit = Number(limitPair[limitPair.length - 1].replace(/,/g, '')) || previousLimit;
  } else {
    const remaining = extractNumber(text, /Limit(?:e)? de negocia[cç][aã]o\s+([\d.]+)\s*USD/i);
    const remainingEnglish = extractNumber(text, /Trading limit\s+([\d.]+)\s*USD/i);
    if (remaining > 0 || remainingEnglish > 0) {
      tradeLimit = (remaining || remainingEnglish) + allocated360Days + allocatedPlus + allocated3Hours;
    }
  }

  return {
    allocated360Days,
    allocatedPlus,
    allocated3Hours,
    balance,
    tradeLimit: tradeLimit || previousLimit,
    rawText: text.slice(0, 2000)
  };
};

const loadContaById = async (id) => {
  const { data, error } = await supabaseAdmin.from('contas').select('*').eq('id', id).single();

  if (error) {
    throw error;
  }

  return data;
};

const loadContaSecret = async (id) => {
  const { data, error } = await supabaseAdmin
    .from('conta_secrets')
    .select('conta_id, senha')
    .eq('conta_id', id)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

const updateContaFromSnapshot = async (contaId, snapshot, currentConta) => {
  const updatePayload = {
    balance: snapshot.balance,
    allocated_360days: snapshot.allocated360Days,
    allocated_plus: snapshot.allocatedPlus,
    allocated_3hours: snapshot.allocated3Hours,
    trade_limit: snapshot.tradeLimit || Number(currentConta.trade_limit) || 300,
    live_synced_at: new Date().toISOString(),
    connection_state: 'conectada'
  };

  const { error } = await supabaseAdmin.from('contas').update(updatePayload).eq('id', contaId);

  if (error) {
    throw error;
  }
};

const countVisibleExactText = async (page, text) => {
  const locator = page.getByText(text, { exact: true });
  const count = await locator.count();
  let visibleCount = 0;

  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) {
      visibleCount += 1;
    }
  }

  return visibleCount;
};

const getVisibleExactTextLocator = async (page, text, { pick = 'last' } = {}) => {
  const locator = page.getByText(text, { exact: true });
  const count = await locator.count();
  const visibleIndexes = [];

  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) {
      visibleIndexes.push(index);
    }
  }

  if (visibleIndexes.length === 0) {
    return null;
  }

  const targetIndex = pick === 'first' ? visibleIndexes[0] : visibleIndexes[visibleIndexes.length - 1];
  return locator.nth(targetIndex);
};

const clickVisibleExactText = async (page, text, options = {}) => {
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitForActionOverlayToClear(page, 12000);
    const locator = await getVisibleExactTextLocator(page, text, options);

    if (!locator) {
      throw new Error(`O elemento "${text}" não está visível na tela do ZenQuant.`);
    }

    try {
      await locator.scrollIntoViewIfNeeded().catch(() => {});
      await locator.click({ timeout: 10000, force: attempt === 2 });
      return locator;
    } catch (error) {
      lastError = error;
      if (attempt === 1) {
        try {
          await locator.evaluate((node) => {
            node.click();
          });
          return locator;
        } catch (jsError) {
          lastError = jsError;
        }
      }
      await page.waitForTimeout(1200);
    }
  }

  throw lastError || new Error(`Falha ao clicar em "${text}" no ZenQuant.`);
};

const parseClaimDialog = (rawText) => {
  const text = normalizeText(rawText);

  return {
    orderAmount: extractNumber(text, /Order Amount\s+([\d.]+)\s*USD/i),
    roi: extractNumber(text, /ROI\s*≈?\s+([\d.]+)%/i),
    netIncome: extractNumber(text, /Net Income:\s*([\d.]+)\s*USD/i)
  };
};

const waitForActionOverlayToClear = async (page, timeout = 15000) => {
  const overlay = page.locator('.trade-inject-flow-mask');

  try {
    await overlay.waitFor({ state: 'hidden', timeout });
  } catch {
    await page.waitForTimeout(2000);
  }
};

const claimOnePosition = async (page) => {
  await waitForActionOverlayToClear(page);
  const claimableButton = await getVisibleExactTextLocator(page, 'Claimable', { pick: 'first' });
  if (!claimableButton) {
    return null;
  }

  await claimableButton.click({ timeout: 10000 });
  await page.waitForTimeout(1200);

  const modalText = await page.locator('body').innerText({ timeout: 20000 });
  if (!/Current Interest Payout Time/i.test(modalText)) {
    throw new Error('A modal de resgate não apareceu como esperado.');
  }

  const summary = parseClaimDialog(modalText);
  await clickVisibleExactText(page, 'Confirm', { pick: 'first' });
  await page.waitForTimeout(5000);
  await waitForActionOverlayToClear(page);

  return summary;
};

const claimAllAvailablePositions = async (page) => {
  const claimed = [];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const claimableCount = await countVisibleExactText(page, 'Claimable');
    if (claimableCount === 0) {
      break;
    }

    const claim = await claimOnePosition(page);
    if (!claim) {
      break;
    }

    claimed.push(claim);
    await page.waitForTimeout(2000);
    await ensureTradePageReady(page);
  }

  return claimed;
};

const enterInjectionAmount = async (page, amount) => {
  const amountInput = page.locator('input:visible').first();
  await amountInput.click({ timeout: 10000 });
  await page.keyboard.press('Control+A').catch(() => {});
  await page.keyboard.press('Backspace').catch(() => {});
  await page.keyboard.type(String(amount), { delay: 80 });
  await page.waitForTimeout(1200);
};

const injectIntoStrategy = async (page, strategyName, amount) => {
  if (!amount || amount <= 0) {
    return false;
  }

  await waitForActionOverlayToClear(page);
  await clickVisibleExactText(page, strategyName, { pick: 'last' });
  await page.waitForTimeout(1000);
  await enterInjectionAmount(page, amount);
  await clickVisibleExactText(page, 'Confirm injection', { pick: 'first' });
  await page.waitForTimeout(6000);
  await waitForActionOverlayToClear(page);
  return true;
};

const executeRescueCycle = async (contaId) => {
  const session = liveSessions.get(contaId);
  if (!session) {
    throw new Error('Conecte a conta antes de executar o resgate real.');
  }

  if (session.actionPromise) {
    return session.actionPromise;
  }

  session.actionPromise = (async () => {
    if (session.syncPromise) {
      await session.syncPromise;
    }

    await ensureTradePageReady(session.page);
    const claimed = await claimAllAvailablePositions(session.page);

    let currentConta = await loadContaById(contaId);
    let pageText = await ensureTradePageReady(session.page);
    let snapshot = parseTradeSnapshot(pageText, Number(currentConta.trade_limit) || 300);

    const plusGap = Math.max(0, FIXED_PLUS_ALLOCATION - snapshot.allocatedPlus);
    const plusAmount = snapshot.balance >= plusGap ? plusGap : 0;
    const injections = [];

    if (plusAmount > 0) {
      const injectedPlus = await injectIntoStrategy(session.page, 'Plus', plusAmount);
      if (injectedPlus) {
        injections.push({ strategy: 'Plus', amount: plusAmount });
        currentConta = await loadContaById(contaId);
        pageText = await ensureTradePageReady(session.page);
        snapshot = parseTradeSnapshot(pageText, Number(currentConta.trade_limit) || 300);
      }
    }

    const amount3Hours = Math.floor(snapshot.balance);
    if (amount3Hours > 0) {
      const injected3Hours = await injectIntoStrategy(session.page, '3Hours', amount3Hours);
      if (injected3Hours) {
        injections.push({ strategy: '3Hours', amount: amount3Hours });
        currentConta = await loadContaById(contaId);
        pageText = await ensureTradePageReady(session.page);
        snapshot = parseTradeSnapshot(pageText, Number(currentConta.trade_limit) || 300);
      }
    }

    currentConta = await loadContaById(contaId);
    await updateContaFromSnapshot(contaId, snapshot, currentConta);
    await supabaseAdmin
      .from('contas')
      .update({
        timer: CYCLE_TIMER_SECONDS,
        status: 'Executando',
        balance: roundCurrency(snapshot.balance, 4)
      })
      .eq('id', contaId);

    const updatedConta = await loadContaById(contaId);
    session.lastTimerTickAt = Date.now();

    return {
      conta: toClientAccount(updatedConta),
      cycle: {
        claimed,
        injections
      }
    };
  })().finally(() => {
    session.actionPromise = null;
  });

  return session.actionPromise;
};

const ensureTradePageReady = async (page) => {
  await page.goto(ZENQUANT_TRADE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  const bodyText = await page.locator('body').innerText({ timeout: 20000 });
  if (!/360days|3hours|plus/i.test(bodyText)) {
    throw new Error('A tela de negociação não exibiu os cards esperados do ZenQuant.');
  }

  return bodyText;
};

const loginToZenQuant = async (page, login, senha) => {
  await page.goto(ZENQUANT_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const currentText = await page.locator('body').innerText().catch(() => '');
  const alreadyLoggedIn = /my assets|historical profit|wallet|running/i.test(currentText);

  if (!alreadyLoggedIn) {
    const visibleInputs = page.locator('input:visible');
    const loginInput = visibleInputs.nth(0);
    const passwordInput = visibleInputs.nth(1);
    const loginButton = page.locator('uni-view.zq-cta');

    await loginInput.waitFor({ state: 'visible', timeout: 20000 });
    await passwordInput.waitFor({ state: 'visible', timeout: 20000 });
    await loginInput.fill(normalizeZenQuantLogin(login));
    await passwordInput.fill(senha);

    await Promise.allSettled([
      page.waitForURL(/#\/pages\/(index\/index|UITransaction\/trade)/, { timeout: 30000 }),
      loginButton.click({ force: true, timeout: 10000 })
    ]);

    await page.waitForTimeout(4000);
  }

  return ensureTradePageReady(page);
};

const createLiveSession = async (contaId, login, senha) => {
  const executablePath = resolveBrowserExecutablePath();
  const browser = await chromium.launch({
    headless: ZENQUANT_HEADLESS !== 'false',
    executablePath,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    locale: 'pt-BR',
    viewport: { width: 1365, height: 900 }
  });
  const page = await context.newPage();

  const session = {
    contaId,
    login,
    senha,
    browser,
    context,
    page,
    refreshTimer: null,
    syncPromise: null,
    actionPromise: null,
    lastTimerTickAt: Date.now()
  };

  liveSessions.set(contaId, session);
  return session;
};

const destroyLiveSession = async (contaId) => {
  const session = liveSessions.get(contaId);
  if (!session) {
    return;
  }

  if (session.refreshTimer) {
    clearInterval(session.refreshTimer);
  }

  try {
    await session.page?.close();
  } catch {}

  try {
    await session.context?.close();
  } catch {}

  try {
    await session.browser?.close();
  } catch {}

  liveSessions.delete(contaId);
};

const syncLiveSession = async (contaId, options = {}) => {
  const session = liveSessions.get(contaId);
  if (!session) {
    throw new Error('Sessão do navegador não inicializada para esta conta.');
  }

  if (session.actionPromise) {
    await session.actionPromise;
  }

  if (session.syncPromise) {
    return session.syncPromise;
  }

  session.syncPromise = (async () => {
    const currentConta = await loadContaById(contaId);
    const bodyText = options.forceLogin
      ? await loginToZenQuant(session.page, session.login, session.senha)
      : await ensureTradePageReady(session.page);

    const snapshot = parseTradeSnapshot(bodyText, Number(currentConta.trade_limit) || 300);
    await updateContaFromSnapshot(contaId, snapshot, currentConta);
    return loadContaById(contaId);
  })().finally(() => {
    session.syncPromise = null;
  });

  return session.syncPromise;
};

const startLiveRefresh = (contaId) => {
  const session = liveSessions.get(contaId);
  if (!session || session.refreshTimer) {
    return;
  }

  session.refreshTimer = setInterval(async () => {
    try {
      await syncLiveSession(contaId);
    } catch (error) {
      console.error(`Falha no refresh ao vivo da conta ${contaId}:`, error.message);
      await supabaseAdmin
        .from('contas')
        .update({ connection_state: 'desconectada' })
        .eq('id', contaId);
      await destroyLiveSession(contaId);
    }
  }, LIVE_REFRESH_MS);
};

const tickConnectedAccountTimer = async (contaId) => {
  const session = liveSessions.get(contaId);
  if (!session) {
    return;
  }

  if (session.actionPromise || session.syncPromise) {
    session.lastTimerTickAt = Date.now();
    return;
  }

  const now = Date.now();
  if (!session.lastTimerTickAt) {
    session.lastTimerTickAt = now;
    return;
  }

  const elapsedSeconds = Math.floor((now - session.lastTimerTickAt) / 1000);
  if (elapsedSeconds < 1) {
    return;
  }

  session.lastTimerTickAt += elapsedSeconds * 1000;

  const conta = await loadContaById(contaId);
  if (conta.connection_state !== 'conectada') {
    return;
  }

  const currentTimer = Math.max(Number(conta.timer) || 0, 0);
  if (currentTimer <= 0) {
    if (conta.status !== 'Resgatando') {
      await supabaseAdmin.from('contas').update({ timer: 0, status: 'Resgatando' }).eq('id', contaId);
    }

    await executeRescueCycle(contaId);
    return;
  }

  const nextTimer = Math.max(currentTimer - elapsedSeconds, 0);

  if (nextTimer === 0) {
    await supabaseAdmin.from('contas').update({ timer: 0, status: 'Resgatando' }).eq('id', contaId);
    await executeRescueCycle(contaId);
    return;
  }

  await supabaseAdmin.from('contas').update({ timer: nextTimer, status: 'Executando' }).eq('id', contaId);
};

const startTimerWorker = () => {
  if (timerWorkerHandle) {
    return;
  }

  timerWorkerHandle = setInterval(async () => {
    if (timerWorkerRunning) {
      return;
    }

    timerWorkerRunning = true;

    try {
      for (const contaId of liveSessions.keys()) {
        await tickConnectedAccountTimer(contaId);
      }
    } catch (error) {
      console.error('Falha no worker interno do timer:', error.message);
    } finally {
      timerWorkerRunning = false;
    }
  }, TIMER_WORKER_MS);
};

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  const { error } = await supabaseAdmin.from('contas').select('id').limit(1);

  if (error) {
    res.status(500).json({ ok: false, error: error.message });
    return;
  }

  let browserReady = false;
  try {
    browserReady = Boolean(resolveBrowserExecutablePath());
  } catch {
    browserReady = false;
  }

  let workerReady = false;
  let activeSessions = 0;
  try {
    const workerHealth = await callWorker('/internal/health');
    workerReady = Boolean(workerHealth?.ok);
    activeSessions = Number(workerHealth?.active_sessions) || 0;
  } catch {
    workerReady = false;
  }

  res.json({ ok: true, browser_ready: browserReady, worker_ready: workerReady, active_sessions: activeSessions });
});

app.get('/api/contas', async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('contas').select('*').order('id', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json((data || []).map(toClientAccount));
});

app.post('/api/contas', async (req, res) => {
  const apelido = req.body?.apelido?.toString().trim();
  const login = req.body?.login?.toString().trim();
  const senha = req.body?.senha?.toString().trim();

  if (!apelido || !login || !senha) {
    res.status(400).json({ error: 'apelido, login e senha são obrigatórios.' });
    return;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('contas')
    .insert([
      {
        apelido,
        login,
        status: 'Executando',
        allocated_360days: 0,
        allocated_plus: 0,
        allocated_3hours: 0,
        timer: 10800,
        balance: 10,
        trade_limit: 300,
        live_synced_at: null,
        credencial_configurada: true,
        connection_state: 'desconectada',
        last_connected_at: null
      }
    ])
    .select('*')
    .single();

  if (insertError) {
    res.status(500).json({ error: insertError.message });
    return;
  }

  const { error: secretError } = await supabaseAdmin
    .from('conta_secrets')
    .upsert([{ conta_id: inserted.id, senha }], { onConflict: 'conta_id' });

  if (secretError) {
    await supabaseAdmin.from('contas').delete().eq('id', inserted.id);
    res.status(500).json({ error: secretError.message });
    return;
  }

  res.status(201).json(toClientAccount(inserted));
});

app.patch('/api/contas/:id', async (req, res) => {
  const contaId = Number(req.params.id);

  if (!Number.isInteger(contaId) || contaId <= 0) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }

  const updatePayload = {};
  const allowedFields = [
    'apelido',
    'login',
    'status',
    'allocated_360days',
    'allocated_plus',
    'allocated_3hours',
    'timer',
    'balance',
    'trade_limit',
    'live_synced_at',
    'connection_state',
    'last_connected_at'
  ];

  for (const field of allowedFields) {
    if (req.body?.[field] !== undefined) {
      updatePayload[field] = req.body[field];
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error: updateError } = await supabaseAdmin.from('contas').update(updatePayload).eq('id', contaId);

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }
  }

  const senha = req.body?.senha;
  if (typeof senha === 'string' && senha.trim()) {
    const { error: secretError } = await supabaseAdmin
      .from('conta_secrets')
      .upsert([{ conta_id: contaId, senha: senha.trim() }], { onConflict: 'conta_id' });

    if (secretError) {
      res.status(500).json({ error: secretError.message });
      return;
    }

    await supabaseAdmin.from('contas').update({ credencial_configurada: true }).eq('id', contaId);
  }

  try {
    const conta = await loadContaById(contaId);
    res.json(toClientAccount(conta));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contas/:id/connect', async (req, res) => {
  const contaId = Number(req.params.id);

  if (!Number.isInteger(contaId) || contaId <= 0) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }

  try {
    await supabaseAdmin.from('contas').update({ connection_state: 'conectando' }).eq('id', contaId);
    callWorker(`/internal/accounts/${contaId}/connect`, { method: 'POST' }).catch(() => {});
    res.status(202).json({ ok: true, status: 'conectando' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contas/:id/disconnect', async (req, res) => {
  const contaId = Number(req.params.id);

  if (!Number.isInteger(contaId) || contaId <= 0) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }

  try {
    const conta = await callWorker(`/internal/accounts/${contaId}/disconnect`, { method: 'POST' });
    res.json(toClientAccount(conta));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contas/:id/rescue-cycle', async (req, res) => {
  const contaId = Number(req.params.id);

  if (!Number.isInteger(contaId) || contaId <= 0) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }

  try {
    const result = await callWorker(`/internal/accounts/${contaId}/rescue-cycle`, { method: 'POST' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/automation/contas', requireAutomationToken, async (_req, res) => {
  const { data: contas, error: contasError } = await supabaseAdmin
    .from('contas')
    .select('*')
    .order('id', { ascending: true });

  if (contasError) {
    res.status(500).json({ error: contasError.message });
    return;
  }

  const { data: secrets, error: secretsError } = await supabaseAdmin
    .from('conta_secrets')
    .select('conta_id, senha');

  if (secretsError) {
    res.status(500).json({ error: secretsError.message });
    return;
  }

  const secretsByContaId = new Map((secrets || []).map((secret) => [secret.conta_id, secret.senha]));

  res.json(
    (contas || []).map((conta) => ({
      ...toClientAccount(conta),
      senha: secretsByContaId.get(conta.id) || null
    }))
  );
});

app.listen(Number(API_PORT), () => {
  console.log(`API segura do ZenQuant em http://127.0.0.1:${API_PORT}/api`);
});
