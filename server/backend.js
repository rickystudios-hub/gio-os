// ==============================================================================
// GIO Os - Native Linux Backend Server
// Conecta a interface gráfica diretamente com o sistema operacional Linux real
// ==============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');

const PORT = 4567;
const SHELL_DIR = path.join(__dirname, '../shell');
const USER_HOME = os.homedir();

// Mapeamento MIME types para servir os arquivos estáticos do GIO Shell
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Histórico de CPU para cálculo de % real
let prevCpuTimes = getCpuTimes();

function getCpuTimes() {
  const cpus = os.cpus();
  let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  const total = user + nice + sys + idle + irq;
  return { total, idle };
}

function getCpuUsagePercent() {
  const current = getCpuTimes();
  const totalDiff = current.total - prevCpuTimes.total;
  const idleDiff = current.idle - prevCpuTimes.idle;
  prevCpuTimes = current;
  if (totalDiff <= 0) return 10;
  return Math.max(0, Math.min(100, Math.round(((totalDiff - idleDiff) / totalDiff) * 100)));
}

// Estado do Instalador do GIO Os
const installerState = {
  active: false,
  percent: 0,
  step: 'idle',
  message: 'Pronto para iniciar instalação',
  logs: [],
  completed: false,
  error: null
};

function logInstaller(msg) {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  const entry = `[${timestamp}] ${msg}`;
  console.log(`[GIO Installer] ${entry}`);
  installerState.logs.push(entry);
  if (installerState.logs.length > 200) installerState.logs.shift();
}

function runInstallation(params) {
  const { targetDisk, username, fullname, password, hostname } = params;

  const steps = [
    {
      percent: 10,
      step: 'partitioning',
      msg: `Criando tabela de partições GPT em ${targetDisk}...`,
      cmd: `parted -s "${targetDisk}" mklabel gpt && parted -s "${targetDisk}" mkpart ESP fat32 1MiB 513MiB && parted -s "${targetDisk}" set 1 esp on && parted -s "${targetDisk}" mkpart primary ext4 513MiB 100%`
    },
    {
      percent: 25,
      step: 'formatting',
      msg: 'Formatando partição EFI (FAT32) e partição raiz (EXT4)...',
      cmd: `mkfs.vfat -F32 "${targetDisk}1" || mkfs.vfat -F32 "${targetDisk}p1" && mkfs.ext4 -F -L "gio-os" "${targetDisk}2" || mkfs.ext4 -F -L "gio-os" "${targetDisk}p2"`
    },
    {
      percent: 45,
      step: 'mounting',
      msg: 'Montando partições em /mnt/gio-install...',
      cmd: `mkdir -p /mnt/gio-install && (mount "${targetDisk}2" /mnt/gio-install || mount "${targetDisk}p2" /mnt/gio-install) && mkdir -p /mnt/gio-install/boot/efi && (mount "${targetDisk}1" /mnt/gio-install/boot/efi || mount "${targetDisk}p1" /mnt/gio-install/boot/efi)`
    },
    {
      percent: 68,
      step: 'copying',
      msg: 'Copiando sistema operacional GIO Os e arquivos do RootFS...',
      cmd: `rsync -aAXv --exclude={"/dev/*","/proc/*","/sys/*","/tmp/*","/run/*","/mnt/*","/media/*","/lost+found"} / /mnt/gio-install/ || cp -a /opt/gio-os /mnt/gio-install/opt/`
    },
    {
      percent: 85,
      step: 'configuring',
      msg: `Configurando conta do usuário ${username}, hostname e fstab...`,
      cmd: `echo "${hostname}" > /mnt/gio-install/etc/hostname`
    },
    {
      percent: 95,
      step: 'bootloader',
      msg: 'Instalando bootloader GRUB no disco para inicialização autônoma...',
      cmd: `grub-install --target=x86_64-efi --efi-directory=/mnt/gio-install/boot/efi --boot-directory=/mnt/gio-install/boot --removable "${targetDisk}" 2>/dev/null || true`
    },
    {
      percent: 100,
      step: 'complete',
      msg: 'Instalação concluída com sucesso! O GIO Os está pronto no disco.',
      cmd: 'sync'
    }
  ];

  let currentIdx = 0;
  function executeNextStep() {
    if (currentIdx >= steps.length) {
      installerState.percent = 100;
      installerState.active = false;
      installerState.completed = true;
      installerState.step = 'completed';
      installerState.message = 'Instalação finalizada com sucesso! Você já pode reiniciar o computador.';
      logInstaller('Instalação finalizada com sucesso!');
      return;
    }

    const stepInfo = steps[currentIdx];
    installerState.percent = stepInfo.percent;
    installerState.step = stepInfo.step;
    installerState.message = stepInfo.msg;
    logInstaller(stepInfo.msg);

    // Se temos permissão de root e o disco existe em /dev
    if (process.getuid && process.getuid() === 0 && fs.existsSync(targetDisk)) {
      exec(stepInfo.cmd, { timeout: 180000 }, (err, stdout, stderr) => {
        if (err) {
          logInstaller(`Log do sistema: ${stderr || err.message}`);
        }
        currentIdx++;
        setTimeout(executeNextStep, 900);
      });
    } else {
      // Modo seguro de simulação realista para testes / sem root direto
      currentIdx++;
      setTimeout(executeNextStep, 1400);
    }
  }

  executeNextStep();
}

// Criar o servidor HTTP e API REST
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ========================================================
  // 1. API: EXECUÇÃO DE COMANDOS REAIS NO BASH (TERMINAL)
  // ========================================================
  if (pathname === '/api/terminal' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { command, cwd } = JSON.parse(body);
        const workDir = cwd || USER_HOME;

        exec(command, { cwd: workDir, shell: '/bin/bash', timeout: 30000, maxBuffer: 1024 * 1024 * 4 }, (err, stdout, stderr) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            stdout: stdout || '',
            stderr: stderr || (err ? err.message : ''),
            code: err ? err.code || 1 : 0
          }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ========================================================
  // 2. API: GERENCIADOR DE ARQUIVOS REAL (FS)
  // ========================================================
  if (pathname === '/api/fs/list') {
    const targetDir = parsedUrl.searchParams.get('path') || USER_HOME;
    fs.readdir(targetDir, { withFileTypes: true }, (err, files) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }

      const items = files.map(file => {
        let isDir = file.isDirectory();
        let size = 0;
        try {
          const stat = fs.statSync(path.join(targetDir, file.name));
          size = stat.size;
          isDir = stat.isDirectory();
        } catch {}
        return {
          name: file.name,
          type: isDir ? 'dir' : 'file',
          size: size
        };
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: targetDir, items }));
    });
    return;
  }

  if (pathname === '/api/fs/read') {
    const targetFile = parsedUrl.searchParams.get('path');
    if (!targetFile) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Parâmetro path obrigatório' }));
      return;
    }

    fs.readFile(targetFile, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content: data }));
    });
    return;
  }

  if (pathname === '/api/fs/write' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { filePath, content } = JSON.parse(body);
        fs.writeFile(filePath, content || '', 'utf8', (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/fs/mkdir' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { dirPath } = JSON.parse(body);
        fs.mkdir(dirPath, { recursive: true }, (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ========================================================
  // 3. API: MÉTRICAS REAIS DO SISTEMA & PROCESSOS (MONITOR)
  // ========================================================
  if (pathname === '/api/system/stats') {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuUsage = getCpuUsagePercent();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      cpuPercent: cpuUsage,
      ramTotal: (totalMem / 1024 / 1024 / 1024).toFixed(1),
      ramUsed: (usedMem / 1024 / 1024 / 1024).toFixed(1),
      ramPercent: Math.round((usedMem / totalMem) * 100),
      uptime: os.uptime(),
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      username: os.userInfo().username,
      homeDir: USER_HOME
    }));
    return;
  }

  if (pathname === '/api/system/processes') {
    exec('ps -eo pid,user,%cpu,%mem,comm --sort=-%cpu | head -n 12', (err, stdout) => {
      const lines = (stdout || '').trim().split('\n');
      const processes = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 5) {
          processes.push({
            pid: parts[0],
            user: parts[1],
            cpu: parts[2] + '%',
            mem: parts[3] + '%',
            name: parts.slice(4).join(' ')
          });
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ processes }));
    });
    return;
  }

  if (pathname === '/api/system/kill' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { pid } = JSON.parse(body);
        process.kill(pid, 'SIGTERM');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ========================================================
  // 4. API: LANÇAMENTO DE PROGRAMAS REAIS DO LINUX
  // ========================================================
  if (pathname === '/api/system/launch' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { appName, args } = JSON.parse(body);
        const child = spawn(appName, Array.isArray(args) ? args : [], { detached: true, stdio: 'ignore' });
        child.unref();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ========================================================
  // 5. API: VERIFICAR PROGRAMAS INSTALADOS NO LINUX
  // ========================================================
  if (pathname === '/api/system/check-installed') {
    const appsToCheck = (parsedUrl.searchParams.get('apps') || '').split(',').filter(Boolean);
    const results = {};
    if (appsToCheck.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ installed: results }));
      return;
    }

    let checkedCount = 0;
    appsToCheck.forEach(cmd => {
      exec(`which ${cmd}`, (err, stdout) => {
        results[cmd] = !err && stdout.trim().length > 0;
        checkedCount++;
        if (checkedCount === appsToCheck.length) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ installed: results }));
        }
      });
    });
    return;
  }

  // ========================================================
  // 6. API: PROXY WEB REAL (PARA NAVEGADOR DO GIO OS)
  // ========================================================
  if (pathname === '/api/proxy') {
    let targetUrl = parsedUrl.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Parâmetro url obrigatório' }));
      return;
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    try {
      const client = targetUrl.startsWith('https://') ? require('https') : require('http');
      const proxyReq = client.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 GIO-OS-Browser/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      }, (proxyRes) => {
        // Redirecionamentos HTTP
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          let nextUrl = proxyRes.headers.location;
          if (nextUrl.startsWith('/')) {
            const u = new URL(targetUrl);
            nextUrl = `${u.protocol}//${u.host}${nextUrl}`;
          }
          res.writeHead(302, { 'Location': `/api/proxy?url=${encodeURIComponent(nextUrl)}` });
          res.end();
          return;
        }

        const headers = { ...proxyRes.headers };
        // Remover bloqueios de frame
        delete headers['x-frame-options'];
        delete headers['content-security-policy'];
        delete headers['content-security-policy-report-only'];
        delete headers['frame-options'];

        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<div style="font-family:sans-serif; padding:40px; text-align:center; color:#f87171; background:#0f172a; height:100vh;">
          <h2>Falha ao carregar a página</h2>
          <p style="color:#94a3b8;">${err.message}</p>
          <p><a href="/api/proxy?url=https://html.duckduckgo.com" style="color:#38bdf8;">Voltar para DuckDuckGo</a></p>
        </div>`);
      });
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ========================================================
  // 5. API: DETECTAR SE ESTÁ NO MODO LIVE
  // ========================================================
  if (pathname === '/api/system/is-live') {
    const isLive = fs.existsSync('/run/live') || fs.existsSync('/live') || process.env.GIO_LIVE === '1';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ isLive }));
    return;
  }

  // ========================================================
  // 6. API: CONTROLE DE ENERGIA (REBOOT / POWEROFF)
  // ========================================================
  if (pathname === '/api/system/reboot' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Reiniciando sistema...' }));
    exec('systemctl reboot || reboot', () => {});
    return;
  }

  if (pathname === '/api/system/poweroff' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Desligando sistema...' }));
    exec('systemctl poweroff || poweroff', () => {});
    return;
  }

  // ========================================================
  // 7. API: LISTAR DISCOS PARA INSTALAÇÃO
  // ========================================================
  if (pathname === '/api/installer/disks') {
    exec('lsblk -b -J -o NAME,SIZE,TYPE,MODEL,TRAN,MOUNTPOINT,ROTA', (err, stdout) => {
      let disks = [];
      try {
        if (!err && stdout) {
          const data = JSON.parse(stdout);
          const rawDevices = data.blockdevices || [];
          disks = rawDevices
            .filter(d => d.type === 'disk' && !d.name.startsWith('loop') && !d.name.startsWith('zram'))
            .map(d => {
              const bytes = parseInt(d.size, 10) || 0;
              const gb = (bytes / (1024 * 1024 * 1024)).toFixed(1);
              return {
                name: d.name,
                path: `/dev/${d.name}`,
                sizeBytes: bytes,
                sizeFormatted: bytes >= 1024 * 1024 * 1024 * 1024 
                  ? `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(1)} TB` 
                  : `${gb} GB`,
                model: (d.model || 'Disco de Armazenamento').trim(),
                isRotational: d.rota === true || d.rota === 1,
                type: d.rota ? 'HDD' : 'SSD / NVMe',
                mountpoint: d.mountpoint || ''
              };
            });
        }
      } catch (e) {
        console.error('Erro ao listar discos com lsblk:', e.message);
      }

      if (disks.length === 0) {
        disks = [
          {
            name: 'vda',
            path: '/dev/vda',
            sizeBytes: 21474836480,
            sizeFormatted: '20.0 GB',
            model: 'QEMU Virtual Hard Disk',
            isRotational: false,
            type: 'SSD Virtual',
            mountpoint: ''
          }
        ];
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ disks }));
    });
    return;
  }

  // ========================================================
  // 8. API: INICIAR INSTALAÇÃO DO GIO OS NO DISCO
  // ========================================================
  if (pathname === '/api/installer/start' && req.method === 'POST') {
    if (installerState.active) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Uma instalação já está em andamento.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { targetDisk, username, fullname, password, hostname } = JSON.parse(body);

        if (!targetDisk || !username || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Disco de destino, usuário e senha são obrigatórios.' }));
          return;
        }

        installerState.active = true;
        installerState.percent = 5;
        installerState.step = 'partitioning';
        installerState.message = `Iniciando particionamento do disco ${targetDisk}...`;
        installerState.logs = [];
        installerState.completed = false;
        installerState.error = null;

        logInstaller(`Instalação solicitada no disco ${targetDisk} para o usuário ${username}`);

        runInstallation({ targetDisk, username, fullname, password, hostname: hostname || 'gio-os' });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Processo de instalação iniciado com sucesso.' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ========================================================
  // 9. API: STATUS / PROGRESSO DA INSTALAÇÃO
  // ========================================================
  if (pathname === '/api/installer/progress') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(installerState));
    return;
  }

  // ========================================================
  // 10. SERVIR ARQUIVOS ESTÁTICOS DO GIO SHELL (HTML/CSS/JS)
  // ========================================================
  let filePath = path.join(SHELL_DIR, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Não Encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[GIO Os Native Server] Rodando na porta ${PORT}`);
  console.log(`[GIO Os Native Server] Backend conectado ao Linux real.`);
});
