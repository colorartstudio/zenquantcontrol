# Pacote Worker Windows

Este pacote prepara uma maquina Windows para rodar o backend do ZenQuant em segundo plano, sem precisar deixar o Trae aberto.

## O que roda na maquina worker

- `server/index.js`
- `worker/index.js`
- PM2 para manter os processos vivos
- Cloudflare Tunnel para publicar a API

## O que NAO vai dentro do ZIP

- `.env` real
- tokens reais do Supabase
- token real do Cloudflare Tunnel
- credenciais da ZenQuant

O ZIP sai com um `.env.example` para voce preencher na maquina de destino.

## Pre-requisitos da maquina

1. Windows 10/11 ou Windows Server
2. Node.js LTS instalado
3. Google Chrome ou Microsoft Edge instalado
4. `cloudflared` instalado
5. Acesso de rede ao `https://www.zenquantai.com`

## Como usar na maquina de destino

1. Descompacte o ZIP em uma pasta, por exemplo:
   `C:\ZenQuantWorker`
2. Copie `.env.example` para `.env`
   - ou use `.env.production.example` se for uma maquina de operacao/produção
3. Preencha as variaveis reais no `.env`
4. Abra PowerShell como usuario normal
5. Rode:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-worker-host.ps1
```

## O que o instalador faz

- valida Node.js
- valida navegador local
- valida `cloudflared`
- roda `npm install`
- sobe API + worker no PM2
- salva o dump do PM2
- registra startup automatico no Windows
- sobe o Cloudflare Tunnel se o token estiver preenchido

## Comandos uteis

Iniciar ou reiniciar a stack:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-worker-host.ps1
```

Parar a stack:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-worker-host.ps1
```

Checar saude local/publica:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-worker-host.ps1
```

Recuperacao em 1 clique no Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\recover-worker-host.ps1
```

Ou por duplo clique:

```text
.\scripts\recover-worker-host.cmd
```

Esse fluxo faz:

- sobe API + worker + tunnel
- espera o health local responder
- dispara a reconexao de todas as contas com credencial salva
- abre o painel automaticamente se `WORKER_PANEL_URL` estiver preenchida no `.env`

## Variaveis mais importantes

- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTOMATION_API_TOKEN`
- `CLOUDFLARE_TUNNEL_NAME`
- `CLOUDFLARE_TUNNEL_HOSTNAME`
- `CLOUDFLARE_TUNNEL_ORIGIN_URL`
- `CLOUDFLARE_TUNNEL_TOKEN`
- `ZENQUANT_HEADLESS=true`
- `WORKER_PANEL_URL` (opcional)

## Modelos de ambiente

- `.env.example`: modelo generico do pacote
- `.env.production.example`: modelo pronto para producao desta stack

## Observacoes operacionais

- Nao precisa deixar o Trae aberto.
- O Windows nao pode suspender, hibernar ou desligar.
- Se quiser operar 24h, o ideal e uma Windows VPS.
- O frontend pode continuar na Vercel apontando para a API publica dessa maquina.
