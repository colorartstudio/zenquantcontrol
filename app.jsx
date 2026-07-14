import React, { useEffect, useRef, useState } from 'react';
import { Home, FileText, Settings, BarChart2, Zap, Cloud, CloudOff, Activity, AlertTriangle, CheckCircle, Database, Power, FastForward, Play } from 'lucide-react';

// Chave identificadora do aplicativo no ecossistema
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'zen-quant-auto';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4174/api';
const DEFAULT_LIMIT = 300;
const FIXED_PLUS_ALLOCATION = 50;

const roundCurrency = (value, decimals = 4) => Number((Number(value) || 0).toFixed(decimals));

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const calculateRescueReinvestment = (availableAmount) => {
  const totalAvailable = Math.max(Number(availableAmount) || 0, 0);
  const plusAllocation = totalAvailable >= FIXED_PLUS_ALLOCATION
    ? FIXED_PLUS_ALLOCATION
    : Math.floor(totalAvailable);
  const remainingAfterPlus = Math.max(totalAvailable - plusAllocation, 0);
  const hours3Allocation = Math.floor(remainingAfterPlus);
  const residualBalance = roundCurrency(totalAvailable - plusAllocation - hours3Allocation, 4);

  return {
    plusAllocation,
    hours3Allocation,
    residualBalance,
    totalAvailable: roundCurrency(totalAvailable, 6)
  };
};

const formatDateTime = (dateInput = new Date()) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    return 'Hoje';
  }

  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const createLocalAccount = (overrides = {}) => ({
  id: Date.now(),
  name: 'Conta sem apelido',
  login: '',
  balance: 0,
  limit: DEFAULT_LIMIT,
  allocated360Days: 0,
  allocatedPlus: 0,
  allocated3Hours: 0,
  timer: 10800,
  status: 'Executando',
  lastExecution: 'Hoje',
  earningsHistory: [],
  credentialConfigured: false,
  connectionState: 'desconectada',
  lastConnectedAt: null,
  plusCountdownLabel: null,
  plusCountdownSeconds: null,
  hours3CountdownLabel: null,
  hours3CountdownSeconds: null,
  days360CountdownLabel: null,
  days360CountdownSeconds: null,
  ...overrides
});

const FALLBACK_ACCOUNTS = [
  createLocalAccount({
    id: 1,
    name: 'Conta Principal (+950)',
    login: '+5582988048950',
    balance: 61.477198,
    limit: 463,
    allocated360Days: 100.0,
    allocatedPlus: 50.0,
    allocated3Hours: 11.0,
    timer: 10800,
    status: 'Executando',
    lastExecution: '14/07 12:00',
    earningsHistory: [
      { date: '14/07 03:00', amount: 0.22 },
      { date: '14/07 06:00', amount: 0.25 },
      { date: '14/07 09:00', amount: 0.21 }
    ],
    credentialConfigured: true
  }),
  createLocalAccount({
    id: 2,
    name: 'Conta Secundária (+951)',
    login: '+5582988048951',
    balance: 15.221034,
    limit: DEFAULT_LIMIT,
    allocatedPlus: 32.0,
    timer: 5400,
    status: 'Executando',
    lastExecution: '14/07 11:30',
    earningsHistory: [
      { date: '14/07 06:00', amount: 0.12 },
      { date: '14/07 09:00', amount: 0.15 }
    ],
    credentialConfigured: true
  }),
  createLocalAccount({
    id: 3,
    name: 'Conta Auxiliar (+952)',
    login: '+5582988048952',
    balance: 0.125199,
    limit: 200,
    allocated360Days: 50.0,
    allocatedPlus: 50.0,
    allocated3Hours: 24.0,
    timer: 10,
    status: 'Executando',
    lastExecution: '14/07 10:00',
    earningsHistory: [{ date: '14/07 09:00', amount: 0.31 }],
    credentialConfigured: true
  }),
  createLocalAccount({
    id: 4,
    name: 'Conta Poupança (+953)',
    login: '+5582988048953',
    balance: 112.553941,
    limit: 800,
    allocated360Days: 200.0,
    allocatedPlus: 10.0,
    allocated3Hours: 5.0,
    timer: 8200,
    status: 'Executando',
    lastExecution: '14/07 09:45',
    earningsHistory: [{ date: '14/07 09:00', amount: 0.45 }],
    credentialConfigured: true
  })
];

const mapContaRowToAccount = (item) =>
  createLocalAccount({
    id: item.id,
    name: item.apelido,
    login: item.login,
    balance: Number(item.balance) || 0,
    limit: Number(item.trade_limit) || DEFAULT_LIMIT,
    allocated360Days: Number(item.allocated_360days) || 0,
    allocatedPlus: Number(item.allocated_plus) || 0,
    allocated3Hours: Number(item.allocated_3hours) || 0,
    timer: Number(item.timer) || 10800,
    plusCountdownLabel: item.plus_countdown_label || null,
    plusCountdownSeconds: isFiniteNumber(item.plus_countdown_seconds) ? Number(item.plus_countdown_seconds) : null,
    hours3CountdownLabel: item.hours3_countdown_label || null,
    hours3CountdownSeconds: isFiniteNumber(item.hours3_countdown_seconds) ? Number(item.hours3_countdown_seconds) : null,
    days360CountdownLabel: item.days360_countdown_label || null,
    days360CountdownSeconds: isFiniteNumber(item.days360_countdown_seconds) ? Number(item.days360_countdown_seconds) : null,
    status: item.status || 'Executando',
    lastExecution: item.live_synced_at
      ? formatDateTime(item.live_synced_at)
      : item.created_at
        ? formatDateTime(item.created_at)
        : 'Sincronizado',
    credentialConfigured: Boolean(item.credencial_configurada),
    connectionState: item.connection_state || 'desconectada',
    lastConnectedAt: item.last_connected_at ? formatDateTime(item.last_connected_at) : null
  });

const mapAccountToContaRow = (account) => ({
  apelido: account.name,
  login: account.login,
  status: account.status,
  allocated_plus: account.allocatedPlus,
  allocated_3hours: account.allocated3Hours,
  timer: account.timer,
  balance: account.balance
});

export default function App() {
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'logs' | 'reports' | 'config'
  const [isAutoActive, setIsAutoActive] = useState(false);
  const [isSimulationSpeed, setIsSimulationSpeed] = useState(false); // Modo acelerado para testes rápidos
  const [activeAccountId, setActiveAccountId] = useState(1);
  const [toastMessage, setToastMessage] = useState(null);
  const [connectionLoadingId, setConnectionLoadingId] = useState(null);
  const [cycleLoadingId, setCycleLoadingId] = useState(null);
  const cycleInFlightRef = useRef(new Set());

  // Estados da integração segura
  const [apiBaseUrl, setApiBaseUrl] = useState(API_BASE_URL);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const [logs, setLogs] = useState([
    { id: 1, timestamp: '12:53:10', type: 'info', text: 'Painel ZenQuant Inicializado.', account: 'Geral' },
    { id: 2, timestamp: '12:53:18', type: 'success', text: 'Pronto para conexões locais ou via Supabase cloud.', account: 'Sistema' }
  ]);

  const addLog = (text, type = 'info', accountName = 'Sistema') => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setLogs(prev => [
      { id: Date.now(), timestamp: timeStr, type, text, account: accountName },
      ...prev.slice(0, 99)
    ]);
  };

  const [accounts, setAccounts] = useState(FALLBACK_ACCOUNTS);

  const apiFetch = async (path, options = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    if (!response.ok) {
      let message = 'Falha na API segura.';

      try {
        const errorPayload = await response.json();
        message = errorPayload.error || message;
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

  const persistAccountUpdate = async (accountId, partialData) => {
    await apiFetch(`/contas/${accountId}`, {
      method: 'PATCH',
      body: JSON.stringify(partialData)
    });
  };

  const replaceAccountFromApi = (apiAccount) => {
    const mapped = mapContaRowToAccount(apiAccount);
    setAccounts((prev) => prev.map((account) => (account.id === mapped.id ? { ...account, ...mapped } : account)));
    return mapped;
  };

  const loadAccounts = async ({ silent = false } = {}) => {
    if (!apiBaseUrl) {
      if (!silent) {
        addLog('Configure VITE_API_BASE_URL no arquivo .env para usar a API segura.', 'warning', 'Backend');
      }
      return [];
    }

    const data = await apiFetch('/contas');
    const formatted = (data || []).map(mapContaRowToAccount);
    setAccounts(formatted.length > 0 ? formatted : []);
    setActiveAccountId((currentId) => {
      if (formatted.length === 0) {
        return currentId;
      }

      return formatted.some((account) => account.id === currentId) ? currentId : formatted[0].id;
    });

    return formatted;
  };

  const initializeSupabase = async () => {
    if (!apiBaseUrl) {
      addLog('Configure VITE_API_BASE_URL no arquivo .env para usar a API segura.', 'warning', 'Backend');
      return;
    }

    try {
      await apiFetch('/health');
      await loadAccounts({ silent: true });
      setIsSupabaseConnected(true);
      addLog('API segura conectada. A conexão da conta agora valida login real e sincroniza a tela de negociação.', 'success', 'Backend');
      showToast('Backend seguro conectado!');
    } catch (err) {
      addLog(`Falha ao conectar com a API segura: ${err.message}`, 'danger', 'Backend');
      setIsSupabaseConnected(false);
    }
  };

  useEffect(() => {
    if (apiBaseUrl) {
      initializeSupabase();
      return;
    }

    addLog('Modo local ativo. Defina VITE_API_BASE_URL no .env e suba o backend para persistir as contas com segurança.', 'warning', 'Backend');
  }, []);

  useEffect(() => {
    if (!isSupabaseConnected) {
      return undefined;
    }

    const interval = setInterval(() => {
      loadAccounts({ silent: true }).catch(() => {});
    }, 2000);

    return () => clearInterval(interval);
  }, [isSupabaseConnected, apiBaseUrl]);

  const handleConnectSupabase = async () => {
    if (!apiBaseUrl) {
      addLog('Informe a URL base da API segura para conectar.', 'warning');
      return;
    }

    await initializeSupabase();
  };

  const handleDisconnectSupabase = () => {
    setIsSupabaseConnected(false);
    setAccounts(FALLBACK_ACCOUNTS);
    setActiveAccountId(FALLBACK_ACCOUNTS[0]?.id || 1);
    addLog('API segura desconectada nesta sessão. Rodando em modo simulação local.', 'info', 'Backend');
    showToast('Backend seguro desconectado nesta sessão.', 'info');
  };

  const handleToggleAccountConnection = async (account) => {
    if (!account) return;

    if (!account.credentialConfigured) {
      addLog(`A conta ${account.name} ainda não possui credencial protegida para conexão.`, 'warning', account.name);
      showToast('Salve a credencial da conta primeiro.', 'warning');
      return;
    }

    setConnectionLoadingId(account.id);

    try {
      const endpoint = account.connectionState === 'conectada'
        ? `/contas/${account.id}/disconnect`
        : `/contas/${account.id}/connect`;

      const data = await apiFetch(endpoint, { method: 'POST' });
      const updatedAccount = replaceAccountFromApi(data);

      if (updatedAccount.connectionState === 'conectada') {
        addLog(`Conta ${updatedAccount.name} validada no navegador do ZenQuant e sincronizada com valores reais.`, 'success', updatedAccount.name);
        showToast(`${updatedAccount.name} sincronizada com o ZenQuant!`);
      } else {
        addLog(`Conta ${updatedAccount.name} desconectada da sessão segura.`, 'info', updatedAccount.name);
        showToast(`${updatedAccount.name} desconectada.`, 'info');
      }
    } catch (error) {
      addLog(`Falha ao alternar conexão da conta ${account.name}: ${error.message}`, 'warning', account.name);
      showToast('Não foi possível validar o login real da conta.', 'warning');
    } finally {
      setConnectionLoadingId(null);
    }
  };

  const runRealRescueCycle = async (account, trigger = 'manual') => {
    if (!account || cycleInFlightRef.current.has(account.id)) {
      return false;
    }

    cycleInFlightRef.current.add(account.id);
    setCycleLoadingId(account.id);

    const triggerLabel = trigger === 'automatic' ? 'automático' : 'manual';
    addLog(`Executando ciclo real ${triggerLabel} no ZenQuant para ${account.name}: Claimable -> Confirm -> reaplicação.`, 'info', account.name);

    if (trigger === 'manual') {
      showToast('Executando resgate real...');
    }

    try {
      const data = await apiFetch(`/contas/${account.id}/rescue-cycle`, { method: 'POST' });
      const updatedAccount = replaceAccountFromApi(data.conta || data);

      for (const claim of data?.cycle?.claimed || []) {
        addLog(
          `Resgate real confirmado. Ordem: $${Number(claim.orderAmount || 0).toFixed(2)} USD, renda líquida: $${Number(claim.netIncome || 0).toFixed(6)} USD.`,
          'success',
          updatedAccount.name
        );
      }

      for (const injection of data?.cycle?.injections || []) {
        addLog(
          `Reaplicação real concluída em ${injection.strategy}: $${Number(injection.amount || 0).toFixed(2)} USD.`,
          'success',
          updatedAccount.name
        );
      }

      if ((data?.cycle?.claimed || []).length === 0 && (data?.cycle?.injections || []).length === 0) {
        addLog(`Ciclo real concluído sem resgates pendentes para ${updatedAccount.name}.`, 'info', updatedAccount.name);
      }

      if (trigger === 'manual') {
        showToast(`${updatedAccount.name} sincronizada após o resgate real!`);
      }

      return true;
    } catch (error) {
      addLog(`Falha no resgate real da conta ${account.name}: ${error.message}`, 'warning', account.name);

      if (trigger === 'manual') {
        showToast('Falha ao executar o resgate real.', 'warning');
      }

      return false;
    } finally {
      cycleInFlightRef.current.delete(account.id);
      setCycleLoadingId((currentId) => (currentId === account.id ? null : currentId));
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setAccounts(prevAccounts => {
        return prevAccounts.map(acc => {
          if (!isAutoActive) return acc;
          if (isSupabaseConnected && acc.connectionState === 'conectada') return acc;

          let newTimer = acc.timer - (isSimulationSpeed ? 120 : 1);
          let newStatus = acc.status;

          if (newTimer <= 0) {
            newTimer = 0;
            if (acc.status === 'Executando') {
              addLog(`Temporizador esgotado para ${acc.name}. Iniciando ciclo de resgate automático...`, 'warning', acc.name);

              if (isSupabaseConnected && acc.connectionState === 'conectada') {
                newStatus = 'Resgatando';
                persistAccountUpdate(acc.id, { timer: 0, status: 'Resgatando' }).catch(() => {});
                runRealRescueCycle({ ...acc, timer: 0, status: 'Resgatando' }, 'automatic').catch(() => {});
              } else {
                newStatus = 'Pronto para Resgatar';
              }
            }
          }

          if (newStatus === 'Pronto para Resgatar') {
            newStatus = 'Resgatando';
            
            setTimeout(() => {
              const yieldPlus = acc.allocatedPlus * 0.005; 
              const yield3h = acc.allocated3Hours * 0.0024; 
              const totalYield = yieldPlus + yield3h;
              const comissao = totalYield * 0.20; 
              const rendaLiquida = totalYield - comissao;

              addLog(`Resgate processado. Rendimento: $${rendaLiquida.toFixed(4)} USD. Taxa (20%): $${comissao.toFixed(4)} USD`, 'success', acc.name);

              setAccounts(currentAccs => {
                const updatedAccs = currentAccs.map(innerAcc => {
                  if (innerAcc.id === acc.id) {
                    const novoSaldoDisponivel = innerAcc.balance + rendaLiquida + innerAcc.allocatedPlus + innerAcc.allocated3Hours;
                    const reinvestment = calculateRescueReinvestment(novoSaldoDisponivel);

                    addLog(
                      `Reaplicado conforme regra operacional: $${reinvestment.plusAllocation.toFixed(2)} USD no "Plus", $${reinvestment.hours3Allocation.toFixed(2)} USD no "3Hours" e $${reinvestment.residualBalance.toFixed(4)} USD mantidos disponíveis.`,
                      'success',
                      innerAcc.name
                    );

                    const dateNow = new Date();
                    const formattedDate = `${dateNow.getDate().toString().padStart(2, '0')}/${(dateNow.getMonth() + 1).toString().padStart(2, '0')} ${dateNow.getHours().toString().padStart(2, '0')}:${dateNow.getMinutes().toString().padStart(2, '0')}`;
                    
                    const novoHistorico = [
                      ...innerAcc.earningsHistory,
                      { date: formattedDate, amount: parseFloat(rendaLiquida.toFixed(4)) }
                    ].slice(-6);

                    const updatedAccount = {
                      ...innerAcc,
                      balance: reinvestment.residualBalance,
                      allocatedPlus: reinvestment.plusAllocation,
                      allocated3Hours: reinvestment.hours3Allocation,
                      timer: 10800, // Reinicia o cronômetro para 3 horas
                      status: 'Executando',
                      lastExecution: formattedDate,
                      earningsHistory: novoHistorico
                    };

                    if (isSupabaseConnected) {
                      persistAccountUpdate(updatedAccount.id, {
                        balance: updatedAccount.balance,
                        allocated_plus: updatedAccount.allocatedPlus,
                        allocated_3hours: updatedAccount.allocated3Hours,
                        timer: updatedAccount.timer,
                        status: updatedAccount.status
                      }).catch((error) => {
                        console.error('Erro de sincronização:', error.message);
                      });
                    }

                    return updatedAccount;
                  }
                  return innerAcc;
                });
                return updatedAccs;
              });
            }, 3000);
          }

          const updatedAccount = {
            ...acc,
            timer: newTimer,
            status: newStatus
          };

          if (isSupabaseConnected && (newTimer % 60 === 0 || isSimulationSpeed)) {
            persistAccountUpdate(acc.id, { timer: newTimer, status: newStatus }).catch(() => {});
          }

          return updatedAccount;
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isAutoActive, isSimulationSpeed, isSupabaseConnected]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}h ${m}m ${s}s`;
  };

  const formatStrategyCountdown = (label, seconds, amount = 0) => {
    if ((Number(amount) || 0) <= 0) {
      return 'Sem posição';
    }

    if (label) {
      return label;
    }

    if (isFiniteNumber(seconds)) {
      return Number(seconds) === 0 ? 'Claimable' : formatTime(Number(seconds));
    }

    return 'Sem posição';
  };

  const getNextStrategyTrigger = (account) => {
    if (!account) {
      return null;
    }

    const candidates = [
      { key: 'Plus', label: account.plusCountdownLabel, seconds: account.plusCountdownSeconds, amount: account.allocatedPlus },
      { key: '3Hours', label: account.hours3CountdownLabel, seconds: account.hours3CountdownSeconds, amount: account.allocated3Hours },
      { key: '360Days', label: account.days360CountdownLabel, seconds: account.days360CountdownSeconds, amount: account.allocated360Days }
    ].filter((item) => (Number(item.amount) || 0) > 0 && isFiniteNumber(item.seconds));

    if (candidates.length === 0) {
      return null;
    }

    return candidates.sort((a, b) => a.seconds - b.seconds)[0];
  };

  const getStrategyCardClasses = (strategyKey, baseClasses, highlightedClasses) => {
    const isNextTrigger = nextTrigger?.key === strategyKey;
    return `${baseClasses} ${isNextTrigger ? highlightedClasses : ''}`.trim();
  };

  const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0];
  const nextTrigger = getNextStrategyTrigger(activeAccount);

  const handleManualAction = async (account) => {
    if (!account) {
      return;
    }

    if (isSupabaseConnected && account.connectionState === 'conectada') {
      await runRealRescueCycle(account, 'manual');
      return;
    }

    addLog(`Ação manual de Resgate e Aplicação acionada pelo usuário para a conta ID: ${account.id}`, 'info', 'Manual');
    showToast('Processando resgate manual...');
    setAccounts(prev => prev.map(acc => {
      if (acc.id === account.id) {
        return { ...acc, timer: 0, status: 'Pronto para Resgatar' };
      }
      return acc;
    }));
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('apelido')?.toString().trim();
    const login = formData.get('login')?.toString().trim();
    const password = formData.get('senha')?.toString().trim();

    if (!name || !login || !password) {
      addLog('Por favor, preencha todos os campos.', 'warning');
      showToast('Preencha todos os campos!', 'warning');
      return;
    }

    const newAcc = createLocalAccount({
      id: Date.now(),
      name,
      login,
      balance: 10.00,
      limit: DEFAULT_LIMIT,
      timer: 10800,
      status: 'Executando',
      lastExecution: formatDateTime(),
      earningsHistory: [],
      credentialConfigured: true
    });

    if (isSupabaseConnected) {
      try {
        const data = await apiFetch('/contas', {
          method: 'POST',
          body: JSON.stringify({
            apelido: name,
            login,
            senha: password
          })
        });

        const persistedAccount = mapContaRowToAccount(data);
        setAccounts(prev => [...prev, persistedAccount]);
        setActiveAccountId(persistedAccount.id);
        addLog(`Conta ${name} salva com credencial protegida no backend!`, 'success', 'Config');
        showToast('Conta cadastrada com segurança!');
      } catch (error) {
        addLog(`Erro ao cadastrar conta na API segura: ${error.message}`, 'danger');
        showToast('Erro ao salvar no backend!', 'danger');
      }
    } else {
      setAccounts(prev => [...prev, { ...newAcc, id: Date.now(), credentialConfigured: false }]);
      addLog(`Conta ${name} adicionada temporariamente ao modo local.`, 'success', 'Config');
      showToast('Conta adicionada localmente!');
    }
    e.target.reset();
  };

  const totalAtivosGeral = accounts.reduce((acc, curr) => acc + curr.allocated360Days + curr.allocatedPlus + curr.allocated3Hours, 0);
  const connectedAccountsCount = accounts.filter((account) => account.connectionState === 'conectada').length;

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center items-start md:py-8 font-sans">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-xs font-bold animate-bounce flex items-center space-x-2 ${
          toastMessage.type === 'success' ? 'bg-green-600 text-white border-green-500' :
          toastMessage.type === 'warning' ? 'bg-yellow-400 text-gray-900 border-yellow-300' :
          'bg-slate-950 text-white border-slate-800'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle size={16} />}
          {toastMessage.type === 'warning' && <AlertTriangle size={16} />}
          {toastMessage.type === 'info' && <Activity size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main viewport frame mimicking phone/tablet/responsive screen */}
      <div className="w-full max-w-xl bg-white min-h-screen md:min-h-[850px] md:rounded-3xl md:shadow-2xl overflow-hidden flex flex-col border border-gray-200 relative">
        
        {/* HEADER DA PLATAFORMA (Brazil Colors Theme: Green Background with Gold/Yellow Accents) */}
        <header className="bg-gradient-to-r from-emerald-800 via-green-700 to-emerald-800 text-white p-4 shadow-md sticky top-0 z-40">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400 animate-ping"></div>
              <h1 className="font-extrabold text-xl tracking-wider">ZEN<span className="text-yellow-400">QUANT</span></h1>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold border flex items-center space-x-1 ${isSupabaseConnected ? 'bg-blue-900 border-blue-400 text-blue-200' : 'bg-emerald-900 border-emerald-500 text-yellow-300'}`}>
                {isSupabaseConnected ? <Cloud size={10} /> : <Database size={10} />}
                <span>{isSupabaseConnected ? 'SUPABASE NUVEM' : 'SIMULAÇÃO LOCAL'}</span>
              </span>
            </div>
            
            <div className="flex items-center space-x-1.5">
              <button 
                onClick={() => {
                  setIsSimulationSpeed(!isSimulationSpeed);
                  addLog(`Velocidade de simulação: ${!isSimulationSpeed ? 'Acelerada 120x' : 'Tempo real'}`, 'info');
                  showToast(!isSimulationSpeed ? 'Simulador Acelerado (120x)' : 'Tempo Real Restabelecido', 'info');
                }}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-all flex items-center space-x-1 ${isSimulationSpeed ? 'bg-yellow-400 text-green-950 scale-105 animate-pulse' : 'bg-green-800 text-green-200'}`}
              >
                {isSimulationSpeed ? <FastForward size={12} /> : <Play size={12} />}
                <span>{isSimulationSpeed ? '120x ACELERADO' : 'REALTIME'}</span>
              </button>
            </div>
          </div>
          
          <div className="mt-3 bg-emerald-900/40 p-3 rounded-xl flex justify-between items-center text-xs border border-white/10">
            <div>
              <span className="text-emerald-100 block text-[9px] uppercase tracking-wider font-semibold">Total Ativo Multi-Contas</span>
              <span className="font-extrabold text-lg text-yellow-300">${totalAtivosGeral.toFixed(2)} USD</span>
            </div>
            <div className="text-right">
              <span className="text-emerald-100 block text-[9px] uppercase tracking-wider font-semibold">Status de Execução</span>
              <span className="font-extrabold text-xs bg-yellow-400 text-green-950 px-2 py-0.5 rounded-md inline-block">
                {connectedAccountsCount} Conectadas / {accounts.length} Prontas
              </span>
            </div>
          </div>
        </header>

        {/* */}
        {currentView === 'home' && (
          <div className="bg-emerald-50 border-b border-gray-200 px-3 py-2.5 flex space-x-2 overflow-x-auto scrollbar-none">
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => setActiveAccountId(acc.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  activeAccountId === acc.id
                    ? 'bg-green-700 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${acc.connectionState === 'conectada' ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                <span>{acc.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* CONTAINER DINÂMICO DE CONTEÚDO */}
        <div className="flex-1 p-4 pb-28 overflow-y-auto bg-white">
          
          {/* */}
          {currentView === 'home' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* CARTÃO DA CONTA ATIVA */}
              <div className="bg-gradient-to-br from-white to-slate-50 p-4 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2.5 h-full bg-green-600"></div>
                <div className="flex justify-between items-start pl-2">
                  <div>
                    <h2 className="text-base font-bold text-gray-800">{activeAccount?.name}</h2>
                    <span className="text-[11px] font-mono text-gray-400 block">Celular: {activeAccount?.login}</span>
                    <span className="text-[10px] text-gray-500 block mt-1">Última Operação: <strong className="text-gray-700">{activeAccount?.lastExecution}</strong></span>
                    <span className="text-[10px] text-gray-500 block mt-1">
                      Sessão: <strong className={activeAccount?.connectionState === 'conectada' ? 'text-emerald-700' : 'text-slate-600'}>
                        {activeAccount?.connectionState === 'conectada' ? 'Conectada' : 'Desconectada'}
                      </strong>
                      {activeAccount?.lastConnectedAt ? ` em ${activeAccount.lastConnectedAt}` : ''}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold block ${
                      activeAccount?.status === 'Executando' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800 animate-pulse'
                    }`}>
                      {activeAccount?.status}
                    </span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold inline-flex items-center space-x-1 mt-2 ${
                      activeAccount?.connectionState === 'conectada' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {activeAccount?.connectionState === 'conectada' ? <Cloud size={10} /> : <CloudOff size={10} />}
                      <span>{activeAccount?.connectionState === 'conectada' ? 'Conta Conectada' : 'Conta Desconectada'}</span>
                    </span>
                    <span className="text-[11px] text-gray-400 block mt-2">Disponível: <strong className="text-gray-700">${activeAccount?.balance?.toFixed(4)}</strong></span>
                  </div>
                </div>
              </div>

              {/* */}
              {/* POSIÇÕES DO PORTFÓLIO (Reproducing exact visual representations from aplicação.jpg and RESGATE.jpg) */}
              <div>
                <div className="flex justify-between items-center mb-2 px-1">
                  <h3 className="font-extrabold text-gray-800 text-xs tracking-wider uppercase flex items-center space-x-1">
                    <span className="text-green-600">●</span>
                    <span>Posições em Andamento</span>
                  </h3>
                  <span className="text-xs text-gray-500 font-bold">
                    Total: <strong className="text-green-700">${((activeAccount?.allocated360Days || 0) + (activeAccount?.allocatedPlus || 0) + (activeAccount?.allocated3Hours || 0)).toFixed(2)} USD</strong>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Card 360Days */}
                  <div className={getStrategyCardClasses(
                    '360Days',
                    'bg-slate-950 text-white p-3 rounded-xl flex flex-col justify-between border border-slate-800 h-28 relative overflow-hidden transition-all duration-300',
                    'ring-2 ring-emerald-400 border-emerald-400 shadow-[0_0_0_2px_rgba(52,211,153,0.25)] animate-pulse'
                  )}>
                    <div>
                      <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                        <span>360Days</span>
                        <span className="text-emerald-400">2.7%</span>
                      </div>
                      <div className="text-sm font-black mt-1">${activeAccount?.allocated360Days?.toFixed(0)} <span className="text-[9px] text-slate-400">USD</span></div>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block">Rendimento</span>
                      <span className="text-[11px] text-emerald-400 font-bold">13.5</span>
                    </div>
                    <div className="absolute bottom-1 right-1 bg-slate-900 px-1 py-0.5 rounded text-[7px] text-slate-300 font-mono">
                      {formatStrategyCountdown(activeAccount?.days360CountdownLabel, activeAccount?.days360CountdownSeconds, activeAccount?.allocated360Days)}
                    </div>
                  </div>

                  {/* Card Plus (Limit $50) */}
                  <div className={getStrategyCardClasses(
                    'Plus',
                    'bg-slate-950 text-white p-3 rounded-xl flex flex-col justify-between border-2 border-yellow-400 h-28 relative overflow-hidden transition-all duration-300',
                    'ring-2 ring-yellow-300 shadow-[0_0_0_2px_rgba(253,224,71,0.35)] animate-pulse'
                  )}>
                    <div className="absolute top-0 right-0 bg-yellow-400 text-black text-[7px] font-black px-1.5 py-0.2 rounded-bl">
                      MAX 50$
                    </div>
                    <div>
                      <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                        <span>Plus</span>
                        <span className="text-emerald-400">0.5%</span>
                      </div>
                      <div className="text-sm font-black mt-1">${activeAccount?.allocatedPlus?.toFixed(2)} <span className="text-[9px] text-slate-400">USD</span></div>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block">Rendimento Est.</span>
                      <span className="text-[11px] text-emerald-400 font-bold">
                        ${((activeAccount?.allocatedPlus || 0) * 0.005).toFixed(3)}
                      </span>
                    </div>
                    <div className="absolute bottom-1 right-1 bg-yellow-400/20 text-yellow-400 px-1 py-0.5 rounded text-[7px] font-bold font-mono">
                      {formatStrategyCountdown(activeAccount?.plusCountdownLabel, activeAccount?.plusCountdownSeconds, activeAccount?.allocatedPlus)}
                    </div>
                  </div>

                  {/* Card 3Hours */}
                  <div className={getStrategyCardClasses(
                    '3Hours',
                    'bg-slate-950 text-white p-3 rounded-xl flex flex-col justify-between border border-slate-800 h-28 relative overflow-hidden transition-all duration-300',
                    'ring-2 ring-cyan-400 border-cyan-400 shadow-[0_0_0_2px_rgba(34,211,238,0.25)] animate-pulse'
                  )}>
                    <div>
                      <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                        <span>3Hours</span>
                        <span className="text-emerald-400">0.24%</span>
                      </div>
                      <div className="text-sm font-black mt-1">${activeAccount?.allocated3Hours?.toFixed(2)} <span className="text-[9px] text-slate-400">USD</span></div>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block">Rendimento Est.</span>
                      <span className="text-[11px] text-emerald-400 font-bold">
                        ${((activeAccount?.allocated3Hours || 0) * 0.0024).toFixed(3)}
                      </span>
                    </div>
                    <div className="absolute bottom-1 right-1 bg-slate-900 px-1 py-0.5 rounded text-[7px] text-slate-300 font-mono">
                      {formatStrategyCountdown(activeAccount?.hours3CountdownLabel, activeAccount?.hours3CountdownSeconds, activeAccount?.allocated3Hours)}
                    </div>
                  </div>
                </div>
              </div>

              {/* */}
              {/* PROGRESSO DO LIMITE */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-gray-500 font-semibold">Limite de negociação da cota</span>
                  <span className="text-gray-800 font-black">${(activeAccount?.limit || 300) - ((activeAccount?.allocated360Days || 0) + (activeAccount?.allocatedPlus || 0) + (activeAccount?.allocated3Hours || 0))} / {activeAccount?.limit} USD</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-gray-200">
                  <div 
                    className="bg-green-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${(((activeAccount?.limit || 300) - ((activeAccount?.allocated360Days || 0) + (activeAccount?.allocatedPlus || 0) + (activeAccount?.allocated3Hours || 0))) / (activeAccount?.limit || 300)) * 100}%` }}
                  />
                </div>
              </div>

              {/* TEMPORIZADORES E CONTROLES */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black block">Temporizador do Ciclo</span>
                    <span className={`text-xl font-mono font-black ${activeAccount?.timer === 0 ? 'text-yellow-500' : 'text-slate-800'}`}>
                      {activeAccount?.timer === 0 ? 'Resgate Automático Pendente' : formatTime(activeAccount?.timer || 0)}
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-500 font-semibold">
                      {nextTrigger
                        ? `Próximo disparo: ${nextTrigger.key} em ${formatStrategyCountdown(nextTrigger.label, nextTrigger.seconds, nextTrigger.amount)}`
                        : 'Sem posição ativa com cronômetro no momento'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleManualAction(activeAccount)}
                    disabled={!activeAccount || activeAccount?.status !== 'Executando' || cycleLoadingId === activeAccount?.id}
                    className={`px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase shadow-sm transition-all ${
                      activeAccount?.timer === 0 
                        ? 'bg-yellow-400 text-green-950 animate-bounce hover:bg-yellow-500' 
                        : 'bg-green-700 hover:bg-green-800 text-white'
                    }`}
                  >
                    {cycleLoadingId === activeAccount?.id
                      ? 'Executando...'
                      : activeAccount?.timer === 0
                        ? 'Resgatar e Aplicar'
                        : 'Forçar Ciclo (Manual)'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <span className="block text-[10px] font-black uppercase text-slate-500">Plus</span>
                    <span className="mt-1 block text-sm font-mono font-bold text-slate-800">
                      {formatStrategyCountdown(activeAccount?.plusCountdownLabel, activeAccount?.plusCountdownSeconds, activeAccount?.allocatedPlus)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <span className="block text-[10px] font-black uppercase text-slate-500">3Hours</span>
                    <span className="mt-1 block text-sm font-mono font-bold text-slate-800">
                      {formatStrategyCountdown(activeAccount?.hours3CountdownLabel, activeAccount?.hours3CountdownSeconds, activeAccount?.allocated3Hours)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <span className="block text-[10px] font-black uppercase text-slate-500">360Days</span>
                    <span className="mt-1 block text-sm font-mono font-bold text-slate-800">
                      {formatStrategyCountdown(activeAccount?.days360CountdownLabel, activeAccount?.days360CountdownSeconds, activeAccount?.allocated360Days)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black block">Conexão da Conta</span>
                    <span className="text-xs font-bold text-slate-700">
                      {activeAccount?.credentialConfigured
                        ? activeAccount?.connectionState === 'conectada'
                          ? 'Sessão pronta para uso'
                          : 'Credencial protegida salva'
                        : 'Conta ainda não vinculada ao backend'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleAccountConnection(activeAccount)}
                    disabled={!activeAccount || connectionLoadingId === activeAccount?.id || !activeAccount?.credentialConfigured}
                    className={`px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase shadow-sm transition-all ${
                      activeAccount?.connectionState === 'conectada'
                        ? 'bg-slate-800 hover:bg-slate-900 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {connectionLoadingId === activeAccount?.id
                      ? 'Conectando...'
                      : activeAccount?.connectionState === 'conectada'
                        ? 'Desconectar Conta'
                        : 'Conectar e Sincronizar'}
                  </button>
                </div>
              </div>

              {/* CARD DE INFORMAÇÕES DO SCRIPT AUTOMÁTICO */}
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200 p-4 rounded-2xl flex items-start space-x-3">
                <div className="text-green-600 mt-1"><Zap size={20} /></div>
                <div className="text-xs text-green-900 space-y-1">
                  <strong className="block font-bold">Automação Inteligente Ativa:</strong>
                  <p className="leading-relaxed text-green-800">
                    O bot monitora o cronômetro. Ao zerar, resgata a operação, calcula a taxa de 20%, e imediatamente injeta de volta <strong>$50.00 USD fixos no Plus</strong>. O restante disponível vai para o <strong>3Hours apenas em dólares inteiros</strong>, enquanto os centavos ficam livres no saldo.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* */}
          {/* VIEW: LOGS */}
          {currentView === 'logs' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex justify-between items-center px-1">
                <h2 className="font-extrabold text-gray-800 text-base uppercase tracking-wider">Histórico do Console do Bot</h2>
                <button 
                  onClick={() => setLogs([])}
                  className="text-xs text-red-600 font-bold border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-all"
                >
                  Limpar Logs
                </button>
              </div>

              <div className="bg-slate-950 text-slate-100 p-4 rounded-2xl font-mono text-xs h-[450px] overflow-y-auto space-y-2 border border-slate-800 shadow-inner">
                {logs.length === 0 ? (
                  <span className="text-slate-600 block text-center py-8">Nenhum log no momento.</span>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="border-b border-slate-900 pb-1.5 flex items-start space-x-2">
                      <span className="text-slate-500 font-bold shrink-0">[{log.timestamp}]</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                        log.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {log.account}
                      </span>
                      <span className="text-slate-300 leading-normal">{log.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* */}
          {/* VIEW: REPORTS */}
          {currentView === 'reports' && (
            <div className="space-y-4 animate-fadeIn">
              <h2 className="font-extrabold text-gray-800 text-base uppercase tracking-wider px-1">Relatórios de Lucro Líquido</h2>
              
              <div className="bg-gradient-to-br from-green-700 to-emerald-800 text-white p-4 rounded-2xl shadow-sm">
                <span className="text-[10px] text-emerald-200 uppercase font-bold block">Rendimento Acumulado Geral</span>
                <span className="text-3xl font-black text-yellow-300">$3.44 USD</span>
                <span className="text-xs text-emerald-100 block mt-1">≈ R$ 17.71 BRL de renda gerada</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-800 text-xs uppercase mb-3">Histórico de Performance Recente (6 Ciclos)</h3>
                
                <div className="relative h-40 w-full border-b border-l border-slate-200 pt-4 px-2 flex items-end">
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[8px] text-gray-400 select-none pb-2 pl-1">
                    <div className="border-b border-slate-100 w-full text-right">$0.50</div>
                    <div className="border-b border-slate-100 w-full text-right">$0.25</div>
                    <div className="border-b border-slate-100 w-full text-right">$0.00</div>
                  </div>
                  
                  {/* Gráfico de Barras Responsivo */}
                  <div className="w-full h-full flex justify-around items-end z-10">
                    <div className="flex flex-col items-center w-8">
                      <div className="bg-emerald-600 w-4 rounded-t-sm" style={{ height: '40%' }}></div>
                      <span className="text-[8px] text-gray-400 mt-1">C1</span>
                    </div>
                    <div className="flex flex-col items-center w-8">
                      <div className="bg-emerald-600 w-4 rounded-t-sm" style={{ height: '55%' }}></div>
                      <span className="text-[8px] text-gray-400 mt-1">C2</span>
                    </div>
                    <div className="flex flex-col items-center w-8">
                      <div className="bg-emerald-600 w-4 rounded-t-sm" style={{ height: '35%' }}></div>
                      <span className="text-[8px] text-gray-400 mt-1">C3</span>
                    </div>
                    <div className="flex flex-col items-center w-8">
                      <div className="bg-emerald-600 w-4 rounded-t-sm" style={{ height: '70%' }}></div>
                      <span className="text-[8px] text-gray-400 mt-1">C4</span>
                    </div>
                    <div className="flex flex-col items-center w-8">
                      <div className="bg-emerald-600 w-4 rounded-t-sm" style={{ height: '85%' }}></div>
                      <span className="text-[8px] text-gray-400 mt-1">C5</span>
                    </div>
                    <div className="flex flex-col items-center w-8">
                      <div className="bg-yellow-400 w-4 rounded-t-sm animate-pulse" style={{ height: '90%' }}></div>
                      <span className="text-[8px] text-emerald-700 font-bold mt-1">Agora</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabela de Transações Recentes */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-800 text-xs uppercase mb-3">Rendimentos Consolidados por Conta</h3>
                <div className="space-y-2">
                  {accounts.map(acc => (
                    <div key={acc.id} className="flex justify-between items-center text-xs py-2 border-b border-slate-100 last:border-none">
                      <div>
                        <span className="font-bold text-slate-800 block">{acc.name}</span>
                        <span className="text-[10px] text-slate-400 block">Celular: {acc.login}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-green-700 font-extrabold block">+${acc.earningsHistory.reduce((s, x) => s + x.amount, 0).toFixed(4)} USD</span>
                        <span className="text-[9px] text-gray-400">Total do dia</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* */}
          {/* VIEW: CONFIG */}
          {currentView === 'config' && (
            <div className="space-y-4 animate-fadeIn">
              <h2 className="font-extrabold text-gray-800 text-base uppercase tracking-wider px-1">Gerenciar Contas & Backend Seguro</h2>

              {/* CONEXÃO COM O BACKEND */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-800 text-xs uppercase flex items-center space-x-1.5">
                  <Cloud className="text-blue-500" size={16} />
                  <span>API Protegida Local</span>
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  O frontend agora fala com uma API local protegida por <strong>service_role</strong>. A senha fica fora da tabela pública e nunca volta para o navegador.
                </p>

                <div className="space-y-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Supabase Project URL</label>
                    <input 
                      type="text" 
                      value={SUPABASE_URL}
                      readOnly
                      className="w-full text-xs p-2.5 border rounded-lg focus:ring-1 focus:ring-green-600 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Base URL da API segura</label>
                    <input 
                      type="text"
                      value={apiBaseUrl}
                      onChange={(e) => setApiBaseUrl(e.target.value)}
                      placeholder="http://127.0.0.1:4174/api"
                      className="w-full text-xs p-2.5 border rounded-lg focus:ring-1 focus:ring-green-600 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex space-x-2 pt-1">
                  <button 
                    onClick={handleConnectSupabase}
                    className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold text-xs py-2.5 rounded-lg transition-all shadow-sm"
                  >
                    Sincronizar API
                  </button>
                  {isSupabaseConnected && (
                    <button 
                      onClick={handleDisconnectSupabase}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all"
                    >
                      Desconectar
                    </button>
                  )}
                </div>
              </div>

              {/* FORMULÁRIO DE CADASTRO DE CONTAS */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-800 text-xs uppercase">Cadastrar Nova Conta</h3>
                <form onSubmit={handleAddAccount} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      name="apelido"
                      placeholder="Ex: Conta Secundária 2" 
                      className="w-full text-xs p-2.5 border rounded-lg focus:ring-1 focus:ring-green-600 outline-none"
                    />
                    <input 
                      type="text" 
                      name="login"
                      placeholder="Ex: +5582988..." 
                      className="w-full text-xs p-2.5 border rounded-lg focus:ring-1 focus:ring-green-600 outline-none"
                    />
                  </div>
                  <input 
                    type="password" 
                    name="senha"
                    placeholder="Senha protegida no backend"
                    className="w-full text-xs p-2.5 border rounded-lg focus:ring-1 focus:ring-green-600 outline-none"
                  />
                  <button 
                    type="submit"
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-green-950 font-extrabold text-xs uppercase p-2.5 rounded-lg tracking-wider transition-all shadow-sm"
                  >
                    Salvar Conta
                  </button>
                </form>
              </div>

              {/* SQL EDITOR HELPER FOR SUPABASE */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-xs space-y-2">
                <h4 className="font-bold text-yellow-400 flex items-center space-x-1.5">
                  <span>🛠️</span>
                  <span>Estrutura Segura no Supabase</span>
                </h4>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Agora o banco separa metadados públicos de credenciais privadas. A migration principal faz isso:
                </p>
                <pre className="bg-slate-950 p-2.5 rounded-lg font-mono text-[9px] text-slate-300 overflow-x-auto whitespace-pre">
{`ALTER TABLE public.contas
ADD COLUMN credencial_configurada boolean DEFAULT false NOT NULL;

CREATE TABLE public.conta_secrets (
  conta_id bigint PRIMARY KEY REFERENCES public.contas(id) ON DELETE CASCADE,
  senha text NOT NULL
);

INSERT INTO public.conta_secrets (conta_id, senha)
SELECT id, senha FROM public.contas;

ALTER TABLE public.contas DROP COLUMN senha;

REVOKE ALL ON public.contas FROM anon, authenticated, public;
REVOKE ALL ON public.conta_secrets FROM anon, authenticated, public;`}
                </pre>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-800 text-xs uppercase">Estado das Credenciais</h3>
                <div className="space-y-2">
                  {accounts.map((acc) => (
                    <div key={acc.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">{acc.name}</span>
                        <span className="text-[10px] text-slate-400 block">{acc.login}</span>
                      </div>
                      <span className={`px-2 py-1 rounded-full font-bold ${acc.credentialConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {acc.credentialConfigured ? 'Protegida no backend' : 'Somente local'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* */}
              {/* SCRIPT PYTHON AUTOMATION GENERATOR */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs space-y-2">
                <h4 className="font-bold text-green-400 flex items-center space-x-1.5">
                  <span>🐍</span>
                  <span>Worker Python com Token Interno</span>
                </h4>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  O worker operacional deve falar com o backend interno, que injeta as senhas só no servidor:
                </p>
                <div className="relative">
                  <pre className="bg-slate-900 p-3 rounded-lg font-mono text-[9px] text-slate-300 overflow-x-auto max-h-60 overflow-y-auto">
{`import requests
from playwright.sync_api import sync_playwright

API_BASE_URL = "${apiBaseUrl || 'http://127.0.0.1:4174/api'}"
AUTOMATION_TOKEN = "defina-no-ambiente-do-worker"

def get_active_accounts():
    headers = {"x-automation-token": AUTOMATION_TOKEN}
    r = requests.get(f"{API_BASE_URL}/automation/contas", headers=headers, timeout=30)
    return r.json() if r.status_code == 200 else []

def run_automation():
    accounts = get_active_accounts()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for acc in accounts:
            if acc['timer'] > 0:
                continue
                
            page = browser.new_page()
            try:
                page.goto("https://www.zenquantai.com/#/pages/login/login")
                page.fill('input[placeholder*="telefone"]', acc['login'])
                page.fill('input[placeholder*="senha"]', acc['senha'])
                page.click('button:has-text("Login")')
            finally:
                page.close()
        browser.close()

if __name__ == "__main__":
    run_automation()`}
                  </pre>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* */}
        {/* BOTTOM NAV BAR (Brasil Colors: Green themes, Center AUTO button highlighted) */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-xl mx-auto bg-white border-t border-slate-200 flex justify-around items-center py-2.5 px-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] z-50 md:absolute md:bottom-0 md:rounded-b-3xl">
          
          {/* HOME (Left corner) */}
          <button 
            onClick={() => setCurrentView('home')} 
            className={`flex flex-col items-center transition-all ${currentView === 'home' ? 'text-green-700 scale-105 font-bold' : 'text-slate-400'}`}
          >
            <Home size={22} className="mb-1" />
            <span className="text-[9px] font-bold">Painel</span>
          </button>

          {/* LOGS (Left-middle) */}
          <button 
            onClick={() => setCurrentView('logs')} 
            className={`flex flex-col items-center transition-all ${currentView === 'logs' ? 'text-green-700 scale-105 font-bold' : 'text-slate-400'}`}
          >
            <FileText size={22} className="mb-1" />
            <span className="text-[9px] font-bold">Logs</span>
          </button>

          {/* CENTRAL AUTO BUTTON (Brazil Color Highlighting) */}
          <button 
            onClick={() => {
              setIsAutoActive(!isAutoActive);
              addLog(`Automação geral alterada para: ${!isAutoActive ? 'LIGADA' : 'DESLIGADA'}.`, !isAutoActive ? 'success' : 'warning');
              showToast(!isAutoActive ? 'Automação Ativada!' : 'Automação Pausada.', !isAutoActive ? 'success' : 'warning');
            }}
            className={`relative -top-5 p-4 rounded-full shadow-lg transition-all border-4 border-white ${
              isAutoActive 
                ? 'bg-green-700 text-white scale-110 shadow-green-600/30 ring-4 ring-yellow-400/50' 
                : 'bg-yellow-400 text-green-950 shadow-yellow-400/30 hover:scale-105'
            }`}
          >
            <div className="flex flex-col items-center justify-center w-8 h-8">
              <span className="text-[9px] font-black tracking-tighter leading-none">{isAutoActive ? 'ATIVO' : 'LIGAR'}</span>
              <Power size={18} className="mt-0.5" />
            </div>
          </button>

          {/* REPORTS (Right-middle) */}
          <button 
            onClick={() => setCurrentView('reports')} 
            className={`flex flex-col items-center transition-all ${currentView === 'reports' ? 'text-green-700 scale-105 font-bold' : 'text-slate-400'}`}
          >
            <BarChart2 size={22} className="mb-1" />
            <span className="text-[9px] font-bold">Relatórios</span>
          </button>

          {/* CONFIG (Right corner) */}
          <button 
            onClick={() => setCurrentView('config')} 
            className={`flex flex-col items-center transition-all ${currentView === 'config' ? 'text-green-700 scale-105 font-bold' : 'text-slate-400'}`}
          >
            <Settings size={22} className="mb-1" />
            <span className="text-[9px] font-bold">Ajustes</span>
          </button>
        </nav>

      </div>
    </div>
  );
}
