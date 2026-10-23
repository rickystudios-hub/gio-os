// ========================================================
// GIO Os - Desktop Environment Shell Controller
// Fully functional apps, Linux VFS, Vector Icons, Zero Emojis
// ========================================================

class GioShell {
  constructor() {
    this.activeZIndex = 100;
    this.windows = new Map();
    this.runningApps = new Set();
    this.installedApps = new Set(['terminal', 'files', 'browser', 'monitor', 'settings', 'store', 'code', 'music', 'calc', 'gallery']);
    this.activeWorkspace = 1;
    this.isLocked = false;
    this.currentTheme = 'dark';
    this.commandHistory = [];
    this.historyIndex = -1;
    
    // File Manager & Host State
    this.homeDir = '/home/richard';
    this.username = 'richard';
    this.fileCurrentPath = '/home/richard';
    this.fileHistory = ['/home/richard'];
    this.fileHistoryIndex = 0;

    // Music Player State (Web Audio API Synthesizer)
    this.audioCtx = null;
    this.isPlayingMusic = false;
    this.musicTrackIndex = 0;
    this.musicTimer = null;
    this.musicTracks = [
      { title: 'Nebula Ambient Drift', artist: 'GIO Synthesizer', chords: [220, 261.63, 329.63, 392] },
      { title: 'Cybernetic Wayland Waves', artist: 'Kernel Studio', chords: [174.61, 220, 261.63, 349.23] },
      { title: 'Deep Space Horizon', artist: 'PipeWire Hi-Fi', chords: [196, 246.94, 293.66, 392] }
    ];

    // Calculator State
    this.calcCurrent = '0';
    this.calcPrev = '';
    this.calcOp = null;
    this.installedApps = new Set(['terminal', 'files', 'browser', 'monitor', 'settings', 'store', 'code', 'music', 'calc', 'gallery', 'installer']);
    this.calcResetNext = false;

    this.initElements();
    this.initClock();
    this.initEventListeners();
    this.initSystemStats();
    this.setupVFSListener();

    // Detectar modo Live e inicializar sistema
    fetch('/api/system/is-live')
      .then(res => res.json())
      .then(data => {
        const urlParams = new URLSearchParams(window.location.search);
        const isLive = data.isLive || urlParams.get('live') === '1' || urlParams.get('installer') === '1';
        
        const badge = document.getElementById('live-install-trigger');
        if (badge && isLive) {
          badge.style.display = 'inline-flex';
        }

        setTimeout(() => {
          if (isLive) {
            this.openApp('installer');
          } else {
            this.openApp('terminal');
          }
        }, 400);
      })
      .catch(() => {
        setTimeout(() => {
          this.openApp('terminal');
        }, 400);
      });
  }

  initElements() {
    this.clockEl = document.getElementById('clock-trigger');
    this.dateEl = document.getElementById('lock-date-display');
    this.lockClockEl = document.getElementById('lock-clock-display');
    this.windowsLayer = document.getElementById('windows-layer');
    this.launchpadOverlay = document.getElementById('launchpad-overlay');
    this.controlCenter = document.getElementById('control-center-popover');
    this.lockScreen = document.getElementById('lockscreen-overlay');
    this.desktopViewport = document.getElementById('desktop-viewport');
    this.desktopWallpaper = document.getElementById('desktop-wallpaper');
  }

  // ========================================================
  // CLOCK & CALENDAR
  // ========================================================
  initClock() {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const fullDateStr = now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
      const lockFullDate = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      if (this.clockEl) this.clockEl.textContent = `${fullDateStr}  ${timeStr}`;
      if (this.lockClockEl) this.lockClockEl.textContent = timeStr;
      if (this.dateEl) this.dateEl.textContent = lockFullDate.charAt(0).toUpperCase() + lockFullDate.slice(1);
    };

    updateTime();
    setInterval(updateTime, 1000);
  }

  // ========================================================
  // EVENT LISTENERS
  // ========================================================
  initEventListeners() {
    // Menu / Launchpad Toggle
    document.getElementById('gio-menu-btn')?.addEventListener('click', () => this.toggleLaunchpad());
    document.getElementById('dock-launchpad')?.addEventListener('click', () => this.toggleLaunchpad());

    // Control Center Toggle
    document.getElementById('control-center-trigger')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleControlCenter();
    });

    // Botão de Instalação na Barra Superior (Modo Live)
    document.getElementById('live-install-trigger')?.addEventListener('click', () => {
      this.openApp('installer');
    });

    // Fechar popovers ao clicar no desktop
    document.addEventListener('click', (e) => {
      if (!this.controlCenter?.contains(e.target) && !e.target.closest('#control-center-trigger')) {
        this.controlCenter?.classList.remove('open');
      }
    });

    // Workspaces
    document.querySelectorAll('.ws-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        document.querySelectorAll('.ws-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.activeWorkspace = parseInt(dot.dataset.ws || '1');
      });
    });

    // Dock Items click
    document.querySelectorAll('.dock-item[data-app]').forEach(item => {
      item.addEventListener('click', () => {
        const appId = item.dataset.app;
        if (appId === 'launchpad') {
          this.toggleLaunchpad();
        } else {
          this.openApp(appId);
        }
      });
    });

    // Launchpad Items click
    document.querySelectorAll('.launchpad-item[data-app]').forEach(item => {
      item.addEventListener('click', () => {
        const appId = item.dataset.app;
        this.toggleLaunchpad(false);
        this.openApp(appId);
      });
    });

    // Launchpad Close button & Backdrop click
    document.getElementById('launchpad-close-btn')?.addEventListener('click', () => {
      this.toggleLaunchpad(false);
    });

    this.launchpadOverlay?.addEventListener('click', (e) => {
      if (e.target === this.launchpadOverlay) {
        this.toggleLaunchpad(false);
      }
    });

    // Launchpad search
    const searchInput = document.getElementById('launchpad-search-input');
    searchInput?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.launchpad-item').forEach(item => {
        const label = item.querySelector('.launchpad-label')?.textContent.toLowerCase() || '';
        item.style.display = label.includes(query) ? 'flex' : 'none';
      });
    });

    // Atalhos de teclado globais
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Meta') {
        this.toggleLaunchpad();
      }
      if (e.key === 'Escape') {
        this.toggleLaunchpad(false);
        this.controlCenter?.classList.remove('open');
      }
      if (e.metaKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        this.lockDesktop();
      }
    });

    // Quick Tiles (WiFi, Bluetooth, etc.)
    document.querySelectorAll('.quick-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        tile.classList.toggle('active');
        const sub = tile.querySelector('.quick-tile-sub');
        if (sub) {
          sub.textContent = tile.classList.contains('active') ? 'Ativado' : 'Desativado';
        }
      });
    });

    // Brilho do display slider
    const brightnessSlider = document.getElementById('slider-brightness');
    brightnessSlider?.addEventListener('input', (e) => {
      const val = e.target.value;
      if (this.desktopWallpaper) {
        this.desktopWallpaper.style.filter = `brightness(${val / 100})`;
      }
    });

    // Sliders de Volume (ajusta ganho do Web Audio)
    const volumeSlider = document.getElementById('slider-volume');
    volumeSlider?.addEventListener('input', (e) => {
      if (this.gainNode) {
        this.gainNode.gain.value = (e.target.value / 100) * 0.3;
      }
    });

    // Theme Toggle (Dark / Light)
    document.getElementById('tile-darkmode')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Night Light / Não Perturbe
    document.getElementById('tile-dnd')?.addEventListener('click', () => {
      document.body.classList.toggle('night-light-active');
    });

    // Lockscreen
    document.getElementById('lock-unlock-btn')?.addEventListener('click', () => {
      this.unlockDesktop();
    });

    document.getElementById('lock-btn-trigger')?.addEventListener('click', () => {
      this.lockDesktop();
    });
  }

  setupVFSListener() {
    window.vfs.subscribe(() => {
      // Se a janela de arquivos estiver aberta, atualizar
      this.renderFilesList();
    });
  }

  // ========================================================
  // WINDOW MANAGER
  // ========================================================
  openApp(appId) {
    if (this.windows.has(appId)) {
      const winData = this.windows.get(appId);
      if (winData.minimized) {
        winData.minimized = false;
        winData.element.classList.remove('minimized');
      }
      this.focusWindow(winData.element);
      return;
    }

    const winEl = this.createWindow(appId);
    this.windowsLayer.appendChild(winEl);
    this.windows.set(appId, { element: winEl, minimized: false, maximized: false });
    this.markAppRunning(appId, true);
    this.focusWindow(winEl);
  }

  createWindow(appId) {
    const config = this.getAppConfig(appId);
    const win = document.createElement('div');
    win.className = 'os-window';
    win.id = `win-${appId}`;
    win.style.width = `${config.defaultWidth || 640}px`;
    win.style.height = `${config.defaultHeight || 420}px`;
    
    const offset = (this.windows.size * 26) % 120;
    const initialLeft = Math.max(30, (window.innerWidth - (config.defaultWidth || 640)) / 2 + offset);
    const initialTop = Math.max(50, (window.innerHeight - (config.defaultHeight || 420)) / 2 - 40 + offset);
    
    win.style.left = `${initialLeft}px`;
    win.style.top = `${initialTop}px`;

    win.innerHTML = `
      <div class="window-titlebar">
        <div class="window-controls">
          <button class="win-btn win-btn-close" title="Fechar"></button>
          <button class="win-btn win-btn-min" title="Minimizar"></button>
          <button class="win-btn win-btn-max" title="Maximizar"></button>
        </div>
        <div class="window-title">
          <span style="display:flex;align-items:center;color:#38bdf8;">${config.icon}</span>
          <span>${config.title}</span>
        </div>
        <div style="width: 50px;"></div>
      </div>
      <div class="window-body">
        ${config.content}
      </div>
    `;

    win.querySelector('.win-btn-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeWindow(appId);
    });

    win.querySelector('.win-btn-min').addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimizeWindow(appId);
    });

    win.querySelector('.win-btn-max').addEventListener('click', (e) => {
      e.stopPropagation();
      this.maximizeWindow(appId);
    });

    win.addEventListener('mousedown', () => {
      this.focusWindow(win);
    });

    this.makeDraggable(win);
    config.onInit?.(win);

    return win;
  }

  makeDraggable(win) {
    const titlebar = win.querySelector('.window-titlebar');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.window-controls') || e.target.closest('button')) return;
      if (win.classList.contains('maximized')) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = win.offsetLeft;
      initialTop = win.offsetTop;
      this.focusWindow(win);

      const onMouseMove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        win.style.left = `${Math.max(0, Math.min(window.innerWidth - 100, initialLeft + dx))}px`;
        win.style.top = `${Math.max(0, initialTop + dy)}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  focusWindow(win) {
    this.activeZIndex += 1;
    win.style.zIndex = this.activeZIndex;
    document.querySelectorAll('.os-window').forEach(w => w.classList.remove('active-window'));
    win.classList.add('active-window');
  }

  minimizeWindow(appId) {
    const winData = this.windows.get(appId);
    if (!winData) return;
    winData.minimized = true;
    winData.element.classList.add('minimized');
  }

  maximizeWindow(appId) {
    const winData = this.windows.get(appId);
    if (!winData) return;
    winData.maximized = !winData.maximized;
    winData.element.classList.toggle('maximized', winData.maximized);
  }

  closeWindow(appId) {
    const winData = this.windows.get(appId);
    if (!winData) return;
    winData.element.remove();
    this.windows.delete(appId);
    this.markAppRunning(appId, false);

    // Se for o player de música, parar áudio
    if (appId === 'music' && this.isPlayingMusic) {
      this.stopAmbientMusic();
    }
  }

  markAppRunning(appId, isRunning) {
    const dockItem = document.querySelector(`.dock-item[data-app="${appId}"]`);
    if (dockItem) {
      dockItem.classList.toggle('running', isRunning);
    }
  }

  // ========================================================
  // CONFIGURAÇÃO DOS APLICATIVOS (COM ÍCONES SVG)
  // ========================================================
  getAppConfig(appId) {
    const icon = window.ICONS[appId] ? window.ICONS[appId](18) : window.ICONS.logo(18);

    switch (appId) {
      // 1. TERMINAL
      case 'terminal':
        return {
          title: 'GIO Terminal',
          icon: icon,
          defaultWidth: 700,
          defaultHeight: 440,
          content: `
            <div class="terminal-window" style="height: 100%;">
              <div class="terminal-output" id="term-output">
                <div class="terminal-line"><span class="prompt-host">gio@gio-os</span>:<span class="prompt-path">~</span>$ neofetch</div>
                <div class="neofetch-box">
                  <div class="neofetch-logo">
      _____ _____ ____  
     / ____|_   _/ __ \\ 
    | |  __  | || |  | |
    | | |_ | | || |  | |
    | |__| |_| || |__| |
     \\_____|_____\\____/ 
                  </div>
                  <div class="neofetch-info">
                    <div><span class="neofetch-key">OS:</span> GIO Os v1.0 LTS (x86_64)</div>
                    <div><span class="neofetch-key">Kernel:</span> 6.8.0-45-generic (Debian/Linux)</div>
                    <div><span class="neofetch-key">Shell:</span> gio-sh 5.2.21</div>
                    <div><span class="neofetch-key">Compositor:</span> Wayland / wlroots</div>
                    <div><span class="neofetch-key">Filesystem:</span> GIO Unified VFS (MemFS)</div>
                    <div><span class="neofetch-key">Theme:</span> Neon Nebula Glass [Dark]</div>
                    <div><span class="neofetch-key">Memory:</span> 1.4 GiB / 16.0 GiB (9%)</div>
                  </div>
                </div>
                <div class="terminal-line" style="color: #94a3b8; font-size: 11px;">
                  Digite <span style="color: #38bdf8; font-weight:600;">help</span> para listar os comandos essenciais do shell.
                </div>
              </div>
              <div class="terminal-input-row">
                <span class="prompt-prefix" id="term-prompt-prefix">gio@gio-os:~$&nbsp;</span>
                <input type="text" class="terminal-input" id="term-input" autofocus autocomplete="off" spellcheck="false">
              </div>
            </div>
          `,
          onInit: (win) => this.initTerminalLogic(win)
        };

      // 2. ARQUIVOS (FILE MANAGER)
      case 'files':
        return {
          title: 'Arquivos GIO',
          icon: icon,
          defaultWidth: 720,
          defaultHeight: 460,
          content: `
            <div class="files-layout">
              <div class="files-sidebar">
                <div class="settings-nav-item active" data-nav="home">${window.ICONS.folder(16)} Início</div>
                <div class="settings-nav-item" data-nav="docs">${window.ICONS.fileText(16)} Documentos</div>
                <div class="settings-nav-item" data-nav="proj">${window.ICONS.fileCode(16)} Projetos</div>
                <div class="settings-nav-item" data-nav="down">${window.ICONS.store(16)} Downloads</div>
                <div class="settings-nav-item" data-nav="pics">${window.ICONS.gallery(16)} Imagens</div>
                <div class="settings-nav-item" data-nav="music">${window.ICONS.music(16)} Músicas</div>
                <div class="settings-nav-item" data-nav="etc">${window.ICONS.settings(16)} Sistema (/etc)</div>
                <div class="settings-nav-item" data-nav="root">${window.ICONS.terminal(16)} Raiz (/)</div>
              </div>
              <div style="flex: 1; display: flex; flex-direction: column;">
                <div class="files-toolbar">
                  <div class="files-nav-btns">
                    <button class="btn-file-action" id="files-btn-back" title="Voltar">${window.ICONS.arrowLeft(14)}</button>
                    <button class="btn-file-action" id="files-btn-home" title="Pasta Inicial">${window.ICONS.folder(14)}</button>
                  </div>
                  <div class="files-breadcrumb" id="files-current-breadcrumb">/home/gio</div>
                  <div class="files-actions">
                    <button class="btn-file-action" id="files-btn-new-folder">${window.ICONS.plus(12)} Nova Pasta</button>
                    <button class="btn-file-action" id="files-btn-new-file">${window.ICONS.fileText(12)} Novo Arquivo</button>
                  </div>
                </div>
                <div class="file-folder-grid" id="files-container"></div>
              </div>
            </div>
          `,
          onInit: (win) => this.initFilesLogic(win)
        };

      // 3. MONITOR DO SISTEMA
      case 'monitor':
        return {
          title: 'Monitor de Recursos',
          icon: icon,
          defaultWidth: 740,
          defaultHeight: 480,
          content: `
            <div style="padding: 18px; overflow-y: auto; height: 100%;">
              <div class="sys-monitor-grid" style="padding: 0 0 16px 0;">
                <div class="stat-card">
                  <div class="stat-header"><span>Uso de CPU</span><span id="cpu-percent">14%</span></div>
                  <div class="stat-value" id="cpu-value">1.4 GHz</div>
                  <div class="stat-bar-track"><div class="stat-bar-fill" id="cpu-bar" style="width: 14%;"></div></div>
                </div>
                <div class="stat-card">
                  <div class="stat-header"><span>Memória RAM</span><span id="ram-percent">28%</span></div>
                  <div class="stat-value" id="ram-value">4.5 GB</div>
                  <div class="stat-bar-track"><div class="stat-bar-fill" id="ram-bar" style="width: 28%; background: linear-gradient(135deg, #10b981, #06b6d4);"></div></div>
                </div>
                <div class="stat-card">
                  <div class="stat-header"><span>Armazenamento VFS</span><span>12%</span></div>
                  <div class="stat-value">24 / 200 GB</div>
                  <div class="stat-bar-track"><div class="stat-bar-fill" style="width: 12%; background: linear-gradient(135deg, #f59e0b, #ef4444);"></div></div>
                </div>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; margin: 12px 0 6px 0;">
                <span style="font-weight: 700; font-size: 13px;">Processos Ativos em Execução</span>
                <span style="font-size: 11px; color: var(--text-dim);">Clique em "Finalizar" para fechar a aplicação</span>
              </div>
              <table class="processes-table">
                <thead>
                  <tr><th>Nome</th><th>PID</th><th>CPU</th><th>Memória</th><th>Ação</th></tr>
                </thead>
                <tbody id="processes-table-body"></tbody>
              </table>
            </div>
          `,
          onInit: (win) => this.initMonitorLogic(win)
        };

      // 4. CALCULADORA
      case 'calc':
        return {
          title: 'Calculadora',
          icon: icon,
          defaultWidth: 340,
          defaultHeight: 460,
          content: `
            <div class="calc-container">
              <div class="calc-display">
                <div class="calc-prev-op" id="calc-prev"></div>
                <div class="calc-current-val" id="calc-current">0</div>
              </div>
              <div class="calc-grid">
                <button class="calc-btn calc-btn-clear" data-calc="C">C</button>
                <button class="calc-btn" data-calc="(">(</button>
                <button class="calc-btn" data-calc=")">)</button>
                <button class="calc-btn calc-btn-op" data-calc="/">÷</button>

                <button class="calc-btn" data-calc="7">7</button>
                <button class="calc-btn" data-calc="8">8</button>
                <button class="calc-btn" data-calc="9">9</button>
                <button class="calc-btn calc-btn-op" data-calc="*">×</button>

                <button class="calc-btn" data-calc="4">4</button>
                <button class="calc-btn" data-calc="5">5</button>
                <button class="calc-btn" data-calc="6">6</button>
                <button class="calc-btn calc-btn-op" data-calc="-">-</button>

                <button class="calc-btn" data-calc="1">1</button>
                <button class="calc-btn" data-calc="2">2</button>
                <button class="calc-btn" data-calc="3">3</button>
                <button class="calc-btn calc-btn-op" data-calc="+">+</button>

                <button class="calc-btn" data-calc="0" style="grid-column: span 2;">0</button>
                <button class="calc-btn" data-calc=".">.</button>
                <button class="calc-btn calc-btn-eq" data-calc="=">=</button>
              </div>
            </div>
          `,
          onInit: (win) => this.initCalcLogic(win)
        };

      // 5. MÚSICA & ÁUDIO
      case 'music':
        return {
          title: 'GIO Hi-Fi Áudio',
          icon: icon,
          defaultWidth: 540,
          defaultHeight: 400,
          content: `
            <div class="music-container">
              <div class="music-album-art" id="music-art">
                ${window.ICONS.music(48)}
              </div>
              <div style="text-align: center;">
                <h3 style="font-size: 17px; font-weight: 700;" id="music-title">${this.musicTracks[0].title}</h3>
                <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;" id="music-artist">${this.musicTracks[0].artist}</p>
              </div>

              <!-- Barras de Equalizador Animado -->
              <div class="music-bars-visualizer" id="music-visualizer">
                <div class="music-bar"></div>
                <div class="music-bar"></div>
                <div class="music-bar"></div>
                <div class="music-bar"></div>
                <div class="music-bar"></div>
                <div class="music-bar"></div>
                <div class="music-bar"></div>
              </div>

              <div class="music-controls">
                <button class="music-btn" id="music-btn-prev" title="Anterior">${window.ICONS.skipBack(18)}</button>
                <button class="music-btn music-btn-play" id="music-btn-play" title="Tocar / Pausar">${window.ICONS.play(22)}</button>
                <button class="music-btn" id="music-btn-next" title="Próxima">${window.ICONS.skipForward(18)}</button>
              </div>
            </div>
          `,
          onInit: (win) => this.initMusicLogic(win)
        };

      // 6. EDITOR DE CÓDIGO (GIO STUDIO)
      case 'code':
        return {
          title: 'GIO Studio Code',
          icon: icon,
          defaultWidth: 780,
          defaultHeight: 520,
          content: `
            <div class="code-studio-layout">
              <div class="code-sidebar">
                <div class="code-sidebar-header">EXPLORER: PROJETOS</div>
                <div id="code-file-list"></div>
              </div>
              <div class="code-editor-main">
                <div class="code-tabs-bar">
                  <div class="code-tab-list" id="code-tabs"></div>
                  <button class="btn-file-action" id="code-btn-save" style="margin: 4px;">${window.ICONS.check(12)} Salvar</button>
                </div>
                <textarea class="code-textarea" id="code-text" spellcheck="false"></textarea>
              </div>
            </div>
          `,
          onInit: (win) => this.initCodeStudioLogic(win)
        };

      // 7. CENTRAL DE SOFTWARES (APP STORE)
      case 'store':
        return {
          title: 'Central de Softwares',
          icon: icon,
          defaultWidth: 740,
          defaultHeight: 480,
          content: `
            <div style="padding: 20px; overflow-y: auto; height: 100%;">
              <div style="margin-bottom: 20px;">
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">Gerenciador de Aplicativos</h3>
                <p style="color: var(--text-muted); font-size: 13px;">Instale utilitários adicionais no seu dock e launchpad.</p>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px;" id="store-grid"></div>
            </div>
          `,
          onInit: (win) => this.initStoreLogic(win)
        };

      // 8. CONFIGURAÇÕES
      case 'settings':
        return {
          title: 'Configurações do GIO Os',
          icon: icon,
          defaultWidth: 740,
          defaultHeight: 480,
          content: `
            <div class="settings-layout">
              <div class="settings-sidebar">
                <div class="settings-nav-item active">${window.ICONS.gallery(16)} Aparência</div>
                <div class="settings-nav-item">${window.ICONS.monitor(16)} Tela</div>
                <div class="settings-nav-item">${window.ICONS.wifi(16)} Conexões</div>
                <div class="settings-nav-item">${window.ICONS.volume(16)} Áudio</div>
                <div class="settings-nav-item">${window.ICONS.info(16)} Sistema</div>
              </div>
              <div class="settings-content">
                <h2 class="settings-section-title">Aparência do Desktop</h2>
                <p class="settings-section-desc">Personalize o tema e papel de parede do GIO Os.</p>

                <div class="settings-card">
                  <div style="font-weight: 600; margin-bottom: 8px;">Tema do Sistema</div>
                  <div class="theme-options-grid">
                    <div class="theme-preview-box ${this.currentTheme === 'dark' ? 'selected' : ''}" id="settings-theme-dark">
                      <div style="font-size: 13px; font-weight: 600;">Dark Nebula</div>
                    </div>
                    <div class="theme-preview-box ${this.currentTheme === 'light' ? 'selected' : ''}" id="settings-theme-light">
                      <div style="font-size: 13px; font-weight: 600;">Crystal Light</div>
                    </div>
                  </div>
                </div>

                <div class="settings-card">
                  <div style="font-weight: 600; margin-bottom: 8px;">Especificações da Base</div>
                  <div style="font-size: 12px; color: var(--text-muted); line-height: 1.8;">
                    • Kernel: Linux 6.8.0-45-generic (Debian GNU/Linux 12)<br>
                    • Servidor Gráfico: Wayland Nativo (wlroots / labwc)<br>
                    • Interface: GIO Desktop Shell v1.0<br>
                    • Subsistema de Som: PipeWire 1.0.5 + WirePlumber
                  </div>
                </div>
              </div>
            </div>
          `,
          onInit: (win) => {
            win.querySelector('#settings-theme-dark')?.addEventListener('click', () => {
              this.setTheme('dark');
              win.querySelector('#settings-theme-dark').classList.add('selected');
              win.querySelector('#settings-theme-light').classList.remove('selected');
            });
            win.querySelector('#settings-theme-light')?.addEventListener('click', () => {
              this.setTheme('light');
              win.querySelector('#settings-theme-light').classList.add('selected');
              win.querySelector('#settings-theme-dark').classList.remove('selected');
            });
          }
        };

      // 9. GALERIA DE FOTOS / WALLPAPERS
      case 'gallery':
        return {
          title: 'Galeria & Wallpapers',
          icon: icon,
          defaultWidth: 680,
          defaultHeight: 460,
          content: `
            <div style="padding: 20px; overflow-y: auto; height: 100%;">
              <h3 style="font-size: 17px; font-weight: 700; margin-bottom: 14px;">Papéis de Parede Oficiais</h3>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                <div class="settings-card" style="padding: 10px;">
                  <img src="assets/default.jpg" style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px; display: block; margin-bottom: 10px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; font-weight: 600;">Deep Nebula GIO</span>
                    <button class="btn-file-action" id="gallery-set-default">Definir como Fundo</button>
                  </div>
                </div>
              </div>
            </div>
          `,
          onInit: (win) => {
            win.querySelector('#gallery-set-default')?.addEventListener('click', () => {
              if (this.desktopWallpaper) {
                this.desktopWallpaper.style.backgroundImage = "url('assets/default.jpg')";
              }
            });
          }
        };

      // 10. NAVEGADOR WEB REAL
      case 'browser':
        return {
          title: 'Navegador Web GIO',
          icon: icon,
          defaultWidth: 900,
          defaultHeight: 560,
          content: `
            <div style="display: flex; flex-direction: column; height: 100%; background: #0f172a;">
              <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(15,23,42,0.95); border-bottom: 1px solid var(--glass-border-light);">
                <button class="btn-file-action" id="browser-btn-back" title="Voltar">${window.ICONS.arrowLeft(14)}</button>
                <button class="btn-file-action" id="browser-btn-home" title="Página Inicial">${window.ICONS.folder(14)}</button>
                <button class="btn-file-action" id="browser-btn-refresh" title="Recarregar">${window.ICONS.refresh(14)}</button>
                <input type="text" id="browser-url-input" value="https://pt.wikipedia.org" style="flex: 1; border-radius: 6px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.08); color: #fff; padding: 6px 12px; font-size: 12px; outline: none;">
                <button class="btn-file-action" id="browser-btn-go">${window.ICONS.search(14)} Ir</button>
                <button class="btn-file-action" id="browser-btn-chrome" style="background: rgba(59,130,246,0.2); border-color: #3b82f6; color: #60a5fa;" title="Abrir página no Google Chrome nativo do Linux">
                  ${window.ICONS.browser(14)} Abrir no Chrome
                </button>
              </div>
              <div style="flex: 1; position: relative; overflow: hidden; background: #fff;">
                <iframe id="browser-frame" src="/api/proxy?url=https%3A%2F%2Fpt.wikipedia.org" style="width: 100%; height: 100%; border: none;"></iframe>
              </div>
            </div>
          `,
          onInit: (win) => {
            const input = win.querySelector('#browser-url-input');
            const goBtn = win.querySelector('#browser-btn-go');
            const backBtn = win.querySelector('#browser-btn-back');
            const homeBtn = win.querySelector('#browser-btn-home');
            const refreshBtn = win.querySelector('#browser-btn-refresh');
            const chromeBtn = win.querySelector('#browser-btn-chrome');
            const frame = win.querySelector('#browser-frame');

            const navigate = (urlText) => {
              let url = (urlText || input.value).trim();
              if (!url) return;

              if (!url.startsWith('http://') && !url.startsWith('https://')) {
                if (url.includes('.') && !url.includes(' ')) {
                  url = 'https://' + url;
                } else {
                  url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(url)}`;
                }
              }

              input.value = url;
              frame.src = `/api/proxy?url=${encodeURIComponent(url)}`;
            };

            goBtn?.addEventListener('click', () => navigate());
            input?.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') navigate();
            });

            homeBtn?.addEventListener('click', () => {
              navigate('https://pt.wikipedia.org');
            });

            refreshBtn?.addEventListener('click', () => {
              try { frame.contentWindow.location.reload(); } catch { frame.src = frame.src; }
            });

            backBtn?.addEventListener('click', () => {
              try { frame.contentWindow.history.back(); } catch {}
            });

            chromeBtn?.addEventListener('click', async () => {
              const currentUrl = input.value || 'https://google.com';
              chromeBtn.innerHTML = `Abrindo...`;
              await fetch('/api/system/launch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appName: 'google-chrome', args: [currentUrl] })
              });
              setTimeout(() => {
                chromeBtn.innerHTML = `${window.ICONS.browser(14)} Abrir no Chrome`;
              }, 1200);
            });
          }
        };

      // 11. INSTALADOR DO GIO OS
      case 'installer':
        return {
          title: 'Instalador do GIO Os 1.0',
          icon: window.ICONS.installer ? window.ICONS.installer(18) : window.ICONS.logo(18),
          defaultWidth: 840,
          defaultHeight: 560,
          content: `
            <div class="installer-layout">
              <div class="installer-sidebar">
                <div class="installer-brand">
                  <span class="installer-logo">${window.ICONS.logo(24)}</span>
                  <div>
                    <div class="installer-brand-name">GIO Os</div>
                    <div class="installer-brand-version">Instalador v1.0</div>
                  </div>
                </div>
                
                <div class="installer-steps">
                  <div class="installer-step active" data-step="1">
                    <span class="step-num">1</span>
                    <span class="step-title">Boas-vindas</span>
                  </div>
                  <div class="installer-step" data-step="2">
                    <span class="step-num">2</span>
                    <span class="step-title">Disco Alvo</span>
                  </div>
                  <div class="installer-step" data-step="3">
                    <span class="step-num">3</span>
                    <span class="step-title">Conta & Senha</span>
                  </div>
                  <div class="installer-step" data-step="4">
                    <span class="step-num">4</span>
                    <span class="step-title">Confirmação</span>
                  </div>
                  <div class="installer-step" data-step="5">
                    <span class="step-num">5</span>
                    <span class="step-title">Instalação</span>
                  </div>
                  <div class="installer-step" data-step="6">
                    <span class="step-num">6</span>
                    <span class="step-title">Concluído</span>
                  </div>
                </div>
              </div>

              <div class="installer-content">
                <!-- Passo 1 -->
                <div class="installer-view active" id="installer-step-1">
                  <h2 class="installer-heading">Bem-vindo ao GIO Os</h2>
                  <p class="installer-desc">Sistema operacional Linux moderno com interface gráfica translúcida e arquitetura Wayland/X11 de alta performance.</p>

                  <div class="installer-mode-cards">
                    <div class="installer-card" id="mode-live-card">
                      <div class="card-icon" style="color: #38bdf8;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                      </div>
                      <div class="card-title">Experimentar GIO Os (Live)</div>
                      <div class="card-text">Explore o desktop, terminal e aplicativos na memória RAM sem alterar o disco do seu computador.</div>
                      <button class="installer-btn installer-btn-secondary" id="btn-try-live" style="margin-top: 14px;">Explorar Sistema</button>
                    </div>

                    <div class="installer-card active-mode" id="mode-install-card">
                      <div class="card-icon" style="color: #818cf8;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8"></path><path d="m8 12 4 4 4-4"></path></svg>
                      </div>
                      <div class="card-title">Instalar no Computador</div>
                      <div class="card-text">Instale de forma permanente no seu HD, SSD ou máquina virtual com particionamento automático e bootloader UEFI.</div>
                      <button class="installer-btn installer-btn-primary" id="btn-goto-step-2" style="margin-top: 14px;">Iniciar Instalação →</button>
                    </div>
                  </div>
                </div>

                <!-- Passo 2 -->
                <div class="installer-view" id="installer-step-2">
                  <h2 class="installer-heading">Selecione o Disco de Destino</h2>
                  <p class="installer-desc">O GIO Os será instalado no disco selecionado com tabela de partição GPT (EFI 512MB + Raiz EXT4).</p>

                  <div class="installer-disks-container" id="installer-disks-list">
                    <div style="text-align:center; padding: 30px; color: var(--text-muted);">
                      Detectando discos de armazenamento...
                    </div>
                  </div>

                  <div class="installer-actions">
                    <button class="installer-btn installer-btn-secondary" id="btn-back-1">← Voltar</button>
                    <button class="installer-btn installer-btn-primary" id="btn-goto-step-3">Continuar →</button>
                  </div>
                </div>

                <!-- Passo 3 -->
                <div class="installer-view" id="installer-step-3">
                  <h2 class="installer-heading">Criar Conta de Usuário</h2>
                  <p class="installer-desc">Defina sua conta de acesso e o nome do computador na rede local.</p>

                  <div class="installer-form-grid">
                    <div class="form-group">
                      <label>Seu Nome Completo</label>
                      <input type="text" id="install-fullname" class="installer-input" value="Richard" placeholder="Ex: Richard">
                    </div>
                    <div class="form-group">
                      <label>Nome de Usuário (login)</label>
                      <input type="text" id="install-username" class="installer-input" value="gio" placeholder="Ex: gio">
                    </div>
                    <div class="form-group">
                      <label>Nome do Computador (Hostname)</label>
                      <input type="text" id="install-hostname" class="installer-input" value="gio-os" placeholder="Ex: gio-os">
                    </div>
                    <div class="form-group">
                      <label>Senha de Acesso</label>
                      <input type="password" id="install-password" class="installer-input" value="gio" placeholder="Digite uma senha">
                    </div>
                    <div class="form-group">
                      <label>Confirmar Senha</label>
                      <input type="password" id="install-password-confirm" class="installer-input" value="gio" placeholder="Confirme a senha">
                    </div>
                  </div>

                  <div class="installer-actions">
                    <button class="installer-btn installer-btn-secondary" id="btn-back-2">← Voltar</button>
                    <button class="installer-btn installer-btn-primary" id="btn-goto-step-4">Continuar →</button>
                  </div>
                </div>

                <!-- Passo 4 -->
                <div class="installer-view" id="installer-step-4">
                  <h2 class="installer-heading">Confirmar Instalação</h2>
                  <p class="installer-desc">Revise as informações antes de aplicar as mudanças no disco rígido.</p>

                  <div class="installer-summary-card">
                    <div class="summary-row">
                      <span class="summary-label">Disco Selecionado:</span>
                      <span class="summary-val" id="summary-target-disk">Carregando...</span>
                    </div>
                    <div class="summary-row">
                      <span class="summary-label">Particionamento:</span>
                      <span class="summary-val">Automático GPT (EFI System 512MB + Root EXT4)</span>
                    </div>
                    <div class="summary-row">
                      <span class="summary-label">Usuário Criado:</span>
                      <span class="summary-val" id="summary-username">gio (com sudo sem restrições)</span>
                    </div>
                    <div class="summary-row">
                      <span class="summary-label">Nome da Máquina:</span>
                      <span class="summary-val" id="summary-hostname">gio-os</span>
                    </div>
                  </div>

                  <div class="installer-warning-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <span>Aviso: O disco selecionado será completamente formatado para a instalação do GIO Os.</span>
                  </div>

                  <div class="installer-actions">
                    <button class="installer-btn installer-btn-secondary" id="btn-back-3">← Voltar</button>
                    <button class="installer-btn installer-btn-danger" id="btn-start-installation">Instalar GIO Os Agora 🚀</button>
                  </div>
                </div>

                <!-- Passo 5 -->
                <div class="installer-view" id="installer-step-5">
                  <h2 class="installer-heading">Instalando o GIO Os...</h2>
                  <p class="installer-desc" id="installer-progress-msg">Preparando partições e copiando arquivos do sistema...</p>

                  <div class="progress-bar-container">
                    <div class="progress-bar-fill" id="installer-progress-fill" style="width: 5%;"></div>
                  </div>
                  <div style="display:flex; justify-content: space-between; font-size: 13px; color: var(--text-muted); margin-top: 6px;">
                    <span id="installer-step-indicator">Etapa 1 de 6</span>
                    <span id="installer-percent-label">5%</span>
                  </div>

                  <div class="installer-slides-box">
                    <div style="font-weight: 700; color: #38bdf8; margin-bottom: 4px;">🪐 Interface Aether Glass</div>
                    <div style="font-size: 12px; color: var(--text-muted);">Ambiente gráfico translúcido de baixa latência, aceleração por hardware e terminal nativo integrado.</div>
                  </div>

                  <div class="terminal-logs-box" id="installer-logs-box">
                    <div class="terminal-log-line">[Iniciando rotina de instalação do GIO Os...]</div>
                  </div>
                </div>

                <!-- Passo 6 -->
                <div class="installer-view" id="installer-step-6">
                  <div style="text-align: center; padding: 25px 10px;">
                    <div class="success-badge-glow">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <h2 style="font-size: 24px; font-weight: 800; margin-top: 16px; margin-bottom: 8px;">GIO Os Instalado com Sucesso!</h2>
                    <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 24px; line-height: 1.5;">
                      A instalação foi finalizada. Remova a mídia de instalação (pendrive ou ISO) e reinicie para usufruir do seu novo sistema operacional.
                    </p>

                    <div style="display:flex; gap: 12px; justify-content: center;">
                      <button class="installer-btn installer-btn-secondary" id="btn-finish-stay">Continuar no Modo Live</button>
                      <button class="installer-btn installer-btn-primary" id="btn-finish-reboot">Reiniciar Computador ⚡</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `,
          onInit: (win) => this.initInstallerLogic(win)
        };

      default:
        return {
          title: 'Aplicativo',
          icon: window.ICONS.logo(18),
          content: `<div style="padding: 20px;">Aplicativo ${appId} carregado.</div>`
        };
    }
  }

  // ========================================================
  // LÓGICA DO ASSISTENTE DE INSTALAÇÃO DO GIO OS
  // ========================================================
  initInstallerLogic(win) {
    let currentStep = 1;
    let selectedDisk = '/dev/vda';
    let availableDisks = [];
    let progressInterval = null;

    const setStep = (step) => {
      currentStep = step;
      win.querySelectorAll('.installer-step').forEach(el => {
        const s = parseInt(el.dataset.step, 10);
        el.classList.toggle('active', s === step);
        el.classList.toggle('completed', s < step);
      });

      win.querySelectorAll('.installer-view').forEach(el => el.classList.remove('active'));
      const activePanel = win.querySelector(`#installer-step-${step}`);
      if (activePanel) activePanel.classList.add('active');

      if (step === 2) loadDisks();
      if (step === 4) updateSummary();
    };

    // Passo 1: Modos
    win.querySelector('#btn-try-live')?.addEventListener('click', () => {
      this.closeWindow('installer');
    });

    win.querySelector('#btn-goto-step-2')?.addEventListener('click', () => {
      setStep(2);
    });

    // Passo 2: Discos
    const loadDisks = () => {
      const container = win.querySelector('#installer-disks-list');
      if (!container) return;
      container.innerHTML = `<div style="text-align:center; padding: 25px; color: var(--text-muted);">Detectando unidades de armazenamento...</div>`;

      fetch('/api/installer/disks')
        .then(res => res.json())
        .then(data => {
          availableDisks = data.disks || [];
          if (availableDisks.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 25px; color: #f87171;">Nenhum disco detectado no sistema.</div>`;
            return;
          }

          container.innerHTML = '';
          selectedDisk = availableDisks[0].path;

          availableDisks.forEach((disk, idx) => {
            const diskEl = document.createElement('div');
            diskEl.className = `disk-item ${idx === 0 ? 'selected' : ''}`;
            diskEl.dataset.disk = disk.path;
            diskEl.innerHTML = `
              <div class="disk-info-main">
                <span style="color: #38bdf8;">${window.ICONS.hardDrive ? window.ICONS.hardDrive(20) : window.ICONS.settings(20)}</span>
                <div>
                  <div style="font-weight: 700; font-size: 13px;">${escapeHtml(disk.model || disk.name)} (${escapeHtml(disk.path)})</div>
                  <div style="font-size: 11px; color: var(--text-muted);">${disk.type} • Tamanho: ${disk.sizeFormatted}</div>
                </div>
              </div>
              <span class="disk-badge">${disk.sizeFormatted}</span>
            `;

            diskEl.addEventListener('click', () => {
              win.querySelectorAll('.disk-item').forEach(d => d.classList.remove('selected'));
              diskEl.classList.add('selected');
              selectedDisk = disk.path;
            });

            container.appendChild(diskEl);
          });
        })
        .catch(err => {
          container.innerHTML = `<div style="text-align:center; padding: 20px; color: #f87171;">Erro ao obter discos: ${escapeHtml(err.message)}</div>`;
        });
    };

    win.querySelector('#btn-back-1')?.addEventListener('click', () => setStep(1));
    win.querySelector('#btn-goto-step-3')?.addEventListener('click', () => setStep(3));

    // Passo 3: Dados de usuário
    win.querySelector('#btn-back-2')?.addEventListener('click', () => setStep(2));
    win.querySelector('#btn-goto-step-4')?.addEventListener('click', () => {
      const pass = win.querySelector('#install-password')?.value || '';
      const passConf = win.querySelector('#install-password-confirm')?.value || '';
      if (!pass) {
        alert('Por favor, informe uma senha para o usuário.');
        return;
      }
      if (pass !== passConf) {
        alert('As senhas digitadas não coincidem.');
        return;
      }
      setStep(4);
    });

    // Passo 4: Confirmação e Início
    const updateSummary = () => {
      const diskLabel = win.querySelector('#summary-target-disk');
      const userLabel = win.querySelector('#summary-username');
      const hostLabel = win.querySelector('#summary-hostname');

      const targetDiskObj = availableDisks.find(d => d.path === selectedDisk);
      if (diskLabel) diskLabel.textContent = targetDiskObj ? `${targetDiskObj.path} (${targetDiskObj.model} - ${targetDiskObj.sizeFormatted})` : selectedDisk;
      if (userLabel) userLabel.textContent = `${win.querySelector('#install-username')?.value || 'gio'} (com sudo sem restrições)`;
      if (hostLabel) hostLabel.textContent = win.querySelector('#install-hostname')?.value || 'gio-os';
    };

    win.querySelector('#btn-back-3')?.addEventListener('click', () => setStep(3));

    win.querySelector('#btn-start-installation')?.addEventListener('click', () => {
      const username = win.querySelector('#install-username')?.value.trim() || 'gio';
      const fullname = win.querySelector('#install-fullname')?.value.trim() || 'Richard';
      const password = win.querySelector('#install-password')?.value || 'gio';
      const hostname = win.querySelector('#install-hostname')?.value.trim() || 'gio-os';

      setStep(5);

      fetch('/api/installer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDisk: selectedDisk, username, fullname, password, hostname })
      })
      .then(res => res.json())
      .then(data => {
        progressInterval = setInterval(() => {
          fetch('/api/installer/progress')
            .then(r => r.json())
            .then(p => {
              const fill = win.querySelector('#installer-progress-fill');
              const msg = win.querySelector('#installer-progress-msg');
              const percentLbl = win.querySelector('#installer-percent-label');
              const logsBox = win.querySelector('#installer-logs-box');

              if (fill) fill.style.width = `${p.percent}%`;
              if (percentLbl) percentLbl.textContent = `${p.percent}%`;
              if (msg && p.message) msg.textContent = p.message;

              if (logsBox && Array.isArray(p.logs)) {
                logsBox.innerHTML = p.logs.map(l => `<div class="terminal-log-line">${escapeHtml(l)}</div>`).join('');
                logsBox.scrollTop = logsBox.scrollHeight;
              }

              if (p.completed) {
                clearInterval(progressInterval);
                setTimeout(() => setStep(6), 1000);
              }
            })
            .catch(() => {});
        }, 800);
      })
      .catch(err => {
        alert('Erro ao iniciar instalação: ' + err.message);
        setStep(4);
      });
    });

    // Passo 6: Finalização
    win.querySelector('#btn-finish-stay')?.addEventListener('click', () => {
      this.closeWindow('installer');
    });

    win.querySelector('#btn-finish-reboot')?.addEventListener('click', () => {
      fetch('/api/system/reboot', { method: 'POST' });
      document.body.innerHTML = `
        <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #020617; color: #fff; font-family: sans-serif;">
          <div style="font-size: 32px; font-weight: 800; margin-bottom: 12px; color: #38bdf8;">🪐 GIO Os</div>
          <div style="font-size: 15px; color: #94a3b8;">Reiniciando o computador...</div>
        </div>
      `;
    });
  }

  // ========================================================
  // LÓGICA DO TERMINAL (COMANDOS ESSENCIAIS DO LINUX)
  // ========================================================
  initTerminalLogic(win) {
    const output = win.querySelector('#term-output');
    const input = win.querySelector('#term-input');
    const promptPrefix = win.querySelector('#term-prompt-prefix');

    if (!input || !output) return;

    const updatePrompt = () => {
      const relPath = window.vfs.currentPath === '/home/gio' ? '~' : window.vfs.currentPath;
      if (promptPrefix) promptPrefix.innerHTML = `gio@gio-os:${relPath}$&nbsp;`;
    };

    updatePrompt();

    input.addEventListener('keydown', (e) => {
      // Histórico de comandos (Seta para cima/baixo)
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.commandHistory.length > 0) {
          if (this.historyIndex === -1) this.historyIndex = this.commandHistory.length - 1;
          else if (this.historyIndex > 0) this.historyIndex--;
          input.value = this.commandHistory[this.historyIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIndex !== -1) {
          if (this.historyIndex < this.commandHistory.length - 1) {
            this.historyIndex++;
            input.value = this.commandHistory[this.historyIndex] || '';
          } else {
            this.historyIndex = -1;
            input.value = '';
          }
        }
      } else if (e.key === 'Enter') {
        const cmd = input.value.trim();
        input.value = '';
        if (cmd) {
          this.commandHistory.push(cmd);
          this.historyIndex = -1;
        }
        this.executeTerminalCommand(cmd, output);
        updatePrompt();
        output.scrollTop = output.scrollHeight;
      }
    });

    win.addEventListener('click', () => input.focus());
  }

  async executeTerminalCommand(cmd, output) {
    const cwdDisplay = this.terminalCwd ? this.terminalCwd.replace(/^\/home\/[^/]+/, '~') : '~';
    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.innerHTML = `<span class="prompt-host">gio@gio-os</span>:<span class="prompt-path">${cwdDisplay}</span>$ ${escapeHtml(cmd)}`;
    output.appendChild(line);

    if (!cmd) return;

    const trimmed = cmd.trim();

    // Comandos de interface local
    if (trimmed === 'clear') {
      output.innerHTML = '';
      return;
    }

    if (trimmed.startsWith('theme ')) {
      const t = trimmed.split(' ')[1];
      if (t === 'light' || t === 'dark') {
        this.setTheme(t);
        const res = document.createElement('div');
        res.className = 'terminal-line';
        res.textContent = `Tema alterado para: ${t}`;
        output.appendChild(res);
        return;
      }
    }

    if (trimmed === 'lock') {
      this.lockDesktop();
      return;
    }

    if (trimmed.startsWith('open ')) {
      const targetApp = trimmed.split(' ')[1];
      this.openApp(targetApp);
      const res = document.createElement('div');
      res.className = 'terminal-line';
      res.textContent = `Iniciando ${targetApp}...`;
      output.appendChild(res);
      return;
    }

    // Tratamento especial para cd
    if (trimmed.startsWith('cd ') || trimmed === 'cd') {
      const target = trimmed.slice(3).trim() || '~';
      try {
        const response = await fetch('/api/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: `cd ${target} && pwd`, cwd: this.terminalCwd || '' })
        });
        const data = await response.json();
        if (data.stdout) {
          this.terminalCwd = data.stdout.trim();
          const promptPrefix = document.getElementById('term-prompt-prefix');
          if (promptPrefix) {
            const display = this.terminalCwd.replace(/^\/home\/[^/]+/, '~');
            promptPrefix.innerHTML = `gio@gio-os:${display}$&nbsp;`;
          }
        } else if (data.stderr) {
          const errLine = document.createElement('div');
          errLine.className = 'terminal-line';
          errLine.style.color = '#f87171';
          errLine.textContent = data.stderr;
          output.appendChild(errLine);
        }
      } catch (err) {
        this.printTermError(err.message, output);
      }
      return;
    }

    // Execução REAL de qualquer comando no Linux
    try {
      const response = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: trimmed, cwd: this.terminalCwd || '' })
      });
      const data = await response.json();

      if (data.stdout) {
        const outLine = document.createElement('div');
        outLine.className = 'terminal-line';
        outLine.innerHTML = `<pre style="font-family:var(--font-mono); white-space:pre-wrap; margin:0; line-height:1.45;">${escapeHtml(data.stdout)}</pre>`;
        output.appendChild(outLine);
      }

      if (data.stderr) {
        const errLine = document.createElement('div');
        errLine.className = 'terminal-line';
        errLine.style.color = data.code === 0 ? '#94a3b8' : '#f87171';
        errLine.innerHTML = `<pre style="font-family:var(--font-mono); white-space:pre-wrap; margin:0; line-height:1.45;">${escapeHtml(data.stderr)}</pre>`;
        output.appendChild(errLine);
      }

      // Se instalou programa com apt, atualizar lista de apps
      if (trimmed.startsWith('apt install') || trimmed.startsWith('sudo apt install')) {
        const pkg = trimmed.split(' ').pop();
        this.installedApps.add(pkg);
      }
    } catch (err) {
      this.printTermError(`Erro de comunicação com o sistema Linux: ${err.message}`, output);
    }
  }

  printTermError(msg, output) {
    const res = document.createElement('div');
    res.className = 'terminal-line';
    res.style.color = '#f87171';
    res.textContent = msg;
    output.appendChild(res);
  }

  // ========================================================
  // LÓGICA DO GERENCIADOR DE ARQUIVOS (FILES APP)
  // ========================================================
  initFilesLogic(win) {
    const home = this.homeDir || '/home/richard';

    // Mapear atalhos reais do sistema
    win.querySelectorAll('.settings-nav-item[data-nav]').forEach(item => {
      const nav = item.dataset.nav;
      if (nav === 'home') item.dataset.path = home;
      if (nav === 'docs') item.dataset.path = `${home}/Documentos`;
      if (nav === 'proj') item.dataset.path = `${home}/Documentos/PROJETOS ANTIGRAVITY/GIO Os`;
      if (nav === 'down') item.dataset.path = `${home}/Downloads`;
      if (nav === 'pics') item.dataset.path = `${home}/Imagens`;
      if (nav === 'music') item.dataset.path = `${home}/Música`;
      if (nav === 'etc') item.dataset.path = `/etc`;
      if (nav === 'root') item.dataset.path = `/`;

      item.addEventListener('click', () => {
        win.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        if (item.dataset.path) {
          this.navigateFilesTo(item.dataset.path);
        }
      });
    });

    this.renderFilesList();

    // Botão Voltar
    win.querySelector('#files-btn-back')?.addEventListener('click', () => {
      if (this.fileHistoryIndex > 0) {
        this.fileHistoryIndex--;
        this.fileCurrentPath = this.fileHistory[this.fileHistoryIndex];
        this.renderFilesList();
      }
    });

    // Botão Home
    win.querySelector('#files-btn-home')?.addEventListener('click', () => {
      this.navigateFilesTo(this.homeDir || '/home/richard');
    });

    // Nova Pasta Real no Disco
    win.querySelector('#files-btn-new-folder')?.addEventListener('click', async () => {
      const name = prompt('Nome do novo diretório:', 'Nova_Pasta');
      if (name && name.trim()) {
        const dirPath = this.fileCurrentPath.replace(/\/$/, '') + '/' + name.trim();
        try {
          const res = await fetch('/api/fs/mkdir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dirPath })
          });
          const data = await res.json();
          if (data.error) alert(data.error);
          else this.renderFilesList();
        } catch (e) {
          alert('Erro ao criar pasta: ' + e.message);
        }
      }
    });

    // Novo Arquivo Real no Disco
    win.querySelector('#files-btn-new-file')?.addEventListener('click', async () => {
      const name = prompt('Nome do novo arquivo:', 'documento.txt');
      if (name && name.trim()) {
        const filePath = this.fileCurrentPath.replace(/\/$/, '') + '/' + name.trim();
        try {
          const res = await fetch('/api/fs/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath, content: '' })
          });
          const data = await res.json();
          if (data.error) alert(data.error);
          else this.renderFilesList();
        } catch (e) {
          alert('Erro ao criar arquivo: ' + e.message);
        }
      }
    });
  }

  async navigateFilesTo(targetPath) {
    this.fileCurrentPath = targetPath;
    this.fileHistory = this.fileHistory.slice(0, this.fileHistoryIndex + 1);
    this.fileHistory.push(this.fileCurrentPath);
    this.fileHistoryIndex = this.fileHistory.length - 1;
    await this.renderFilesList();
  }

  async renderFilesList() {
    const container = document.getElementById('files-container');
    const breadcrumb = document.getElementById('files-current-breadcrumb');
    if (!container) return;

    if (breadcrumb) breadcrumb.textContent = this.fileCurrentPath;

    try {
      const response = await fetch('/api/fs/list?path=' + encodeURIComponent(this.fileCurrentPath));
      const data = await response.json();

      if (data.error) {
        container.innerHTML = `<div style="color:#f87171; padding:20px;">${escapeHtml(data.error)}</div>`;
        return;
      }

      const items = data.items || [];
      container.innerHTML = '';

      if (items.length === 0) {
        container.innerHTML = '<div style="color:var(--text-dim); padding:20px; font-size:13px;">Esta pasta está vazia.</div>';
        return;
      }

      items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'folder-item';

        const iconSvg = item.type === 'dir' 
          ? window.ICONS.folder(38) 
          : window.ICONS.fileText(38);

        itemEl.innerHTML = `
          <div style="color: ${item.type === 'dir' ? '#60a5fa' : '#94a3b8'};">${iconSvg}</div>
          <div class="folder-name">${escapeHtml(item.name)}</div>
        `;

        itemEl.addEventListener('dblclick', async () => {
          const fullPath = this.fileCurrentPath.replace(/\/$/, '') + '/' + item.name;
          if (item.type === 'dir') {
            await this.navigateFilesTo(fullPath);
          } else {
            await this.previewFile(fullPath);
          }
        });

        container.appendChild(itemEl);
      });
    } catch (e) {
      container.innerHTML = `<div style="color:#f87171; padding:20px;">${escapeHtml(e.message)}</div>`;
    }
  }

  async previewFile(filePath) {
    const winFiles = document.getElementById('win-files');
    if (!winFiles) return;

    let content = '';
    try {
      const res = await fetch('/api/fs/read?path=' + encodeURIComponent(filePath));
      const data = await res.json();
      content = data.content || '';
    } catch (e) {
      content = `Erro ao ler arquivo: ${e.message}`;
    }

    const overlay = document.createElement('div');
    overlay.className = 'file-preview-overlay';
    overlay.innerHTML = `
      <div class="file-preview-header">
        <span style="font-weight:700; font-size:13px; color:#38bdf8;">${escapeHtml(filePath)}</span>
        <button class="btn-file-action" id="close-preview-btn">${window.ICONS.close(14)} Fechar</button>
      </div>
      <textarea class="file-preview-body" id="preview-textarea" spellcheck="false">${escapeHtml(content)}</textarea>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
        <button class="btn-file-action" id="save-preview-btn">${window.ICONS.check(14)} Salvar Alterações</button>
      </div>
    `;

    overlay.querySelector('#close-preview-btn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#save-preview-btn').addEventListener('click', async () => {
      const val = overlay.querySelector('#preview-textarea').value;
      await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content: val })
      });
      overlay.remove();
    });

    winFiles.querySelector('.window-body').appendChild(overlay);
  }

  // ========================================================
  // LÓGICA DA CALCULADORA (CALCULATOR APP)
  // ========================================================
  initCalcLogic(win) {
    const curEl = win.querySelector('#calc-current');
    const prevEl = win.querySelector('#calc-prev');

    const updateDisplay = () => {
      if (curEl) curEl.textContent = this.calcCurrent;
      if (prevEl) prevEl.textContent = this.calcPrev;
    };

    win.querySelectorAll('.calc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.calc;
        this.handleCalcInput(val);
        updateDisplay();
      });
    });
  }

  handleCalcInput(key) {
    if (key === 'C') {
      this.calcCurrent = '0';
      this.calcPrev = '';
      this.calcOp = null;
    } else if (['+', '-', '*', '/'].includes(key)) {
      this.calcPrev = `${this.calcCurrent} ${key}`;
      this.calcOp = key;
      this.calcResetNext = true;
    } else if (key === '=') {
      if (this.calcOp && this.calcPrev) {
        try {
          const expr = `${this.calcPrev.slice(0, -2)} ${this.calcOp} ${this.calcCurrent}`;
          const res = Function(`'use strict'; return (${expr})`)();
          this.calcPrev = `${expr} =`;
          this.calcCurrent = String(Number(res.toFixed(6)));
          this.calcOp = null;
          this.calcResetNext = true;
        } catch {
          this.calcCurrent = 'Erro';
          this.calcResetNext = true;
        }
      }
    } else {
      if (this.calcCurrent === '0' || this.calcResetNext) {
        this.calcCurrent = key;
        this.calcResetNext = false;
      } else {
        this.calcCurrent += key;
      }
    }
  }

  // ========================================================
  // LÓGICA DO PLAYER DE MÚSICA & SINTETIZADOR DE ÁUDIO
  // ========================================================
  initMusicLogic(win) {
    const playBtn = win.querySelector('#music-btn-play');
    const prevBtn = win.querySelector('#music-btn-prev');
    const nextBtn = win.querySelector('#music-btn-next');
    const art = win.querySelector('#music-art');
    const title = win.querySelector('#music-title');
    const artist = win.querySelector('#music-artist');

    const updateTrackUI = () => {
      const track = this.musicTracks[this.musicTrackIndex];
      if (title) title.textContent = track.title;
      if (artist) artist.textContent = track.artist;
    };

    playBtn?.addEventListener('click', () => {
      if (this.isPlayingMusic) {
        this.stopAmbientMusic();
        playBtn.innerHTML = window.ICONS.play(22);
        art?.classList.remove('playing');
      } else {
        this.startAmbientMusic();
        playBtn.innerHTML = window.ICONS.pause(22);
        art?.classList.add('playing');
      }
    });

    nextBtn?.addEventListener('click', () => {
      this.musicTrackIndex = (this.musicTrackIndex + 1) % this.musicTracks.length;
      updateTrackUI();
      if (this.isPlayingMusic) {
        this.stopAmbientMusic();
        this.startAmbientMusic();
      }
    });

    prevBtn?.addEventListener('click', () => {
      this.musicTrackIndex = (this.musicTrackIndex - 1 + this.musicTracks.length) % this.musicTracks.length;
      updateTrackUI();
      if (this.isPlayingMusic) {
        this.stopAmbientMusic();
        this.startAmbientMusic();
      }
    });
  }

  startAmbientMusic() {
    this.isPlayingMusic = true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 0.15;
      this.gainNode.connect(this.audioCtx.destination);

      let step = 0;
      const track = this.musicTracks[this.musicTrackIndex];

      const playChordNote = () => {
        if (!this.isPlayingMusic || !this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const noteGain = this.audioCtx.createGain();
        
        const freq = track.chords[step % track.chords.length];
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        noteGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        noteGain.gain.linearRampToValueAtTime(0.2, this.audioCtx.currentTime + 0.3);
        noteGain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.8);

        osc.connect(noteGain);
        noteGain.connect(this.gainNode);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 1.9);

        // Animação das barras
        document.querySelectorAll('.music-bar').forEach(bar => {
          bar.style.height = `${Math.floor(6 + Math.random() * 24)}px`;
        });

        step++;
      };

      playChordNote();
      this.musicTimer = setInterval(playChordNote, 700);
    } catch (e) {
      console.warn('Web Audio indisponível:', e);
    }
  }

  stopAmbientMusic() {
    this.isPlayingMusic = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    document.querySelectorAll('.music-bar').forEach(b => b.style.height = '6px');
  }

  // ========================================================
  // LÓGICA DO GIO STUDIO (CODE EDITOR REAL)
  // ========================================================
  async initCodeStudioLogic(win) {
    const fileList = win.querySelector('#code-file-list');
    const tabsList = win.querySelector('#code-tabs');
    const textarea = win.querySelector('#code-text');
    const saveBtn = win.querySelector('#code-btn-save');

    let currentDir = `${this.homeDir || '/home/richard'}/Documentos/PROJETOS ANTIGRAVITY/GIO Os`;
    let currentFilePath = '';
    let currentFileName = '';

    const loadDirectory = async () => {
      fileList.innerHTML = '<div style="padding:10px; font-size:11px; color:var(--text-dim);">Carregando arquivos...</div>';
      try {
        let res = await fetch('/api/fs/list?path=' + encodeURIComponent(currentDir));
        let data = await res.json();
        if (data.error) {
          currentDir = this.homeDir || '/home/richard';
          res = await fetch('/api/fs/list?path=' + encodeURIComponent(currentDir));
          data = await res.json();
        }

        fileList.innerHTML = '';
        const items = (data.items || []).filter(i => i.type === 'file');

        items.forEach(file => {
          const item = document.createElement('div');
          item.className = `code-file-item ${file.name === currentFileName ? 'active' : ''}`;
          item.innerHTML = `${window.ICONS.fileCode(14)} <span>${escapeHtml(file.name)}</span>`;
          item.addEventListener('click', () => {
            loadFile(currentDir.replace(/\/$/, '') + '/' + file.name, file.name);
          });
          fileList.appendChild(item);
        });

        if (items.length > 0 && !currentFilePath) {
          loadFile(currentDir.replace(/\/$/, '') + '/' + items[0].name, items[0].name);
        }
      } catch (e) {
        fileList.innerHTML = `<div style="padding:10px; color:#f87171;">Erro: ${e.message}</div>`;
      }
    };

    const loadFile = async (filePath, fileName) => {
      currentFilePath = filePath;
      currentFileName = fileName;
      tabsList.innerHTML = `
        <div class="code-tab active">
          ${window.ICONS.fileCode(13)}
          <span>${escapeHtml(fileName)}</span>
        </div>
      `;

      win.querySelectorAll('.code-file-item').forEach(el => {
        el.classList.toggle('active', el.textContent.trim() === fileName);
      });

      try {
        textarea.value = 'Carregando arquivo real...';
        const res = await fetch('/api/fs/read?path=' + encodeURIComponent(filePath));
        const data = await res.json();
        textarea.value = data.content !== undefined ? data.content : (data.error || '');
      } catch (e) {
        textarea.value = `Erro ao abrir: ${e.message}`;
      }
    };

    saveBtn.addEventListener('click', async () => {
      if (!currentFilePath) return;
      saveBtn.innerHTML = `Gravando no disco...`;
      try {
        const res = await fetch('/api/fs/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: currentFilePath, content: textarea.value })
        });
        const data = await res.json();
        if (data.success) {
          saveBtn.innerHTML = `${window.ICONS.check(12)} Salvo no Disco!`;
        } else {
          saveBtn.innerHTML = `Erro: ${data.error}`;
        }
      } catch (e) {
        saveBtn.innerHTML = `Erro: ${e.message}`;
      }
      setTimeout(() => {
        saveBtn.innerHTML = `${window.ICONS.check(12)} Salvar`;
      }, 1800);
    });

    await loadDirectory();
  }

  // ========================================================
  // LÓGICA DO MONITOR DE RECURSOS (TASK MANAGER)
  // ========================================================
  initMonitorLogic(win) {
    this.renderProcessesTable(win);
    const interval = setInterval(() => {
      if (!this.windows.has('monitor')) {
        clearInterval(interval);
        return;
      }
      this.renderProcessesTable(win);
    }, 2500);
  }

  async renderProcessesTable(win) {
    const tbody = win.querySelector('#processes-table-body');
    if (!tbody) return;

    try {
      const res = await fetch('/api/system/processes');
      if (res.ok) {
        const data = await res.json();
        tbody.innerHTML = '';

        (data.processes || []).forEach(p => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="font-weight:600; color:#fff; display:flex; align-items:center; gap:8px;">
              ${window.ICONS.terminal(14)}
              <span>${escapeHtml(p.name)}</span>
            </td>
            <td>${escapeHtml(p.pid)}</td>
            <td>${escapeHtml(p.cpu)}</td>
            <td>${escapeHtml(p.mem)}</td>
            <td>
              <button class="btn-file-action" style="color:#f87171;" data-pid="${p.pid}">
                ${window.ICONS.close(12)} Finalizar
              </button>
            </td>
          `;

          tr.querySelector('button')?.addEventListener('click', async () => {
            if (confirm(`Deseja realmente enviar SIGTERM para o processo real ${p.name} (PID: ${p.pid})?`)) {
              await fetch('/api/system/kill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pid: parseInt(p.pid) })
              });
              setTimeout(() => this.renderProcessesTable(win), 400);
            }
          });

          tbody.appendChild(tr);
        });
      }
    } catch (e) {
      console.warn('Erro ao carregar processos reais:', e);
    }
  }

  // ========================================================
  // LÓGICA DA CENTRAL DE SOFTWARES (APP STORE)
  // ========================================================
  // ========================================================
  // LÓGICA DA CENTRAL DE SOFTWARES (LINUX PACKAGES REAL)
  // ========================================================
  async initStoreLogic(win) {
    const grid = win.querySelector('#store-grid');
    if (!grid) return;

    const catalog = [
      { id: 'google-chrome', cmd: 'google-chrome', pkg: 'google-chrome-stable', name: 'Google Chrome', desc: 'Navegador web rápido com sincronização e suporte completo a extensões.', icon: window.ICONS.browser(28) },
      { id: 'code', cmd: 'code', pkg: 'code', name: 'Visual Studio Code', desc: 'Editor de código profissional com IntelliSense e controle Git.', icon: window.ICONS.code(28) },
      { id: 'vlc', cmd: 'vlc', pkg: 'vlc', name: 'VLC Media Player', desc: 'Reprodutor de áudio e vídeo de alta performance com codecs universais.', icon: window.ICONS.music(28) },
      { id: 'gimp', cmd: 'gimp', pkg: 'gimp', name: 'GIMP', desc: 'Editor profissional para criação e manipulação gráfica de imagens.', icon: window.ICONS.gallery(28) },
      { id: 'htop', cmd: 'htop', pkg: 'htop', name: 'Htop Monitor', desc: 'Monitor de processos interativo e colorido para o terminal.', icon: window.ICONS.monitor(28) },
      { id: 'neofetch', cmd: 'neofetch', pkg: 'neofetch', name: 'Neofetch', desc: 'Ferramenta de linha de comando para exibição de métricas do sistema.', icon: window.ICONS.terminal(28) },
      { id: 'git', cmd: 'git', pkg: 'git', name: 'Git', desc: 'Sistema de controle de versão distribuído essencial para desenvolvedores.', icon: window.ICONS.fileCode(28) },
      { id: 'python3', cmd: 'python3', pkg: 'python3', name: 'Python 3', desc: 'Ambiente de execução da linguagem Python para scripts e inteligência artificial.', icon: window.ICONS.fileText(28) }
    ];

    grid.innerHTML = '<div style="padding: 20px; color: var(--text-dim); font-size:13px;">Consultando programas instalados no sistema...</div>';

    // Verificar se estão instalados na máquina do usuário
    let installedMap = {};
    try {
      const appCmds = catalog.map(c => c.cmd).join(',');
      const res = await fetch(`/api/system/check-installed?apps=${appCmds}`);
      const data = await res.json();
      installedMap = data.installed || {};
    } catch (e) {
      console.warn('Erro ao verificar programas instalados:', e);
    }

    const render = () => {
      grid.innerHTML = '';
      catalog.forEach(app => {
        const isInstalled = !!installedMap[app.cmd];
        const card = document.createElement('div');
        card.className = 'settings-card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '8px';
        card.innerHTML = `
          <div style="color: #60a5fa;">${app.icon}</div>
          <div style="font-weight: 700; font-size: 14px;">${escapeHtml(app.name)}</div>
          <div style="font-size: 12px; color: var(--text-muted); flex:1;">${escapeHtml(app.desc)}</div>
          <button class="btn-file-action" id="btn-app-${app.id}" style="justify-content:center; padding: 6px; ${isInstalled ? 'background:rgba(16,185,129,0.2); border-color:#10b981; color:#10b981;' : 'background:var(--accent-gradient);'}">
            ${isInstalled ? `${window.ICONS.check(14)} Abrir no Sistema` : `${window.ICONS.plus(14)} Instalar via APT`}
          </button>
        `;

        const btn = card.querySelector(`#btn-app-${app.id}`);
        btn.addEventListener('click', async () => {
          if (isInstalled) {
            btn.innerHTML = `Iniciando...`;
            await fetch('/api/system/launch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ appName: app.cmd })
            });
            setTimeout(() => {
              btn.innerHTML = `${window.ICONS.check(14)} Abrir no Sistema`;
            }, 1200);
          } else {
            btn.innerHTML = `Instalando via APT...`;
            btn.disabled = true;
            try {
              const res = await fetch('/api/terminal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: `sudo apt update && sudo apt install -y ${app.pkg}` })
              });
              const data = await res.json();
              if (data.code === 0) {
                installedMap[app.cmd] = true;
                btn.disabled = false;
                render();
              } else {
                alert(`Erro ao instalar ${app.name}:\n${data.stderr || data.stdout}`);
                btn.disabled = false;
                btn.innerHTML = `${window.ICONS.plus(14)} Tentar Novamente`;
              }
            } catch (err) {
              alert(`Erro na requisição: ${err.message}`);
              btn.disabled = false;
              btn.innerHTML = `${window.ICONS.plus(14)} Instalar via APT`;
            }
          }
        });

        grid.appendChild(card);
      });
    };

    render();
  }

  // ========================================================
  // SYSTEM STATS EM TEMPO REAL (MONITOR)
  // ========================================================
  initSystemStats() {
    const updateStats = async () => {
      try {
        const res = await fetch('/api/system/stats');
        if (res.ok) {
          const data = await res.json();
          if (data.homeDir && this.homeDir !== data.homeDir) {
            this.homeDir = data.homeDir;
            this.username = data.username;
            if (this.fileCurrentPath === '/home/gio' || !this.fileCurrentPath) {
              this.fileCurrentPath = data.homeDir;
              this.fileHistory = [data.homeDir];
            }
          }

          const cpuVal = document.getElementById('cpu-value');
          const cpuBar = document.getElementById('cpu-bar');
          const cpuPerc = document.getElementById('cpu-percent');

          const ramVal = document.getElementById('ram-value');
          const ramBar = document.getElementById('ram-bar');
          const ramPerc = document.getElementById('ram-percent');

          if (cpuVal) cpuVal.textContent = `${data.cpuPercent}%`;
          if (cpuBar) cpuBar.style.width = `${data.cpuPercent}%`;
          if (cpuPerc) cpuPerc.textContent = `${data.cpuPercent}%`;

          if (ramVal) ramVal.textContent = `${data.ramUsed} / ${data.ramTotal} GB`;
          if (ramBar) ramBar.style.width = `${data.ramPercent}%`;
          if (ramPerc) ramPerc.textContent = `${data.ramPercent}%`;
        }
      } catch (e) {
        // Fallback silencioso se offline
      }
    };

    updateStats();
    setInterval(updateStats, 2000);
  }

  // ========================================================
  // POPOVERS & OVERLAYS
  // ========================================================
  toggleLaunchpad(forceState) {
    const isCurrentlyOpen = this.launchpadOverlay?.classList.contains('open');
    const newState = forceState !== undefined ? forceState : !isCurrentlyOpen;

    if (newState) {
      this.launchpadOverlay?.classList.add('open');
      this.desktopWallpaper?.classList.add('blurred');
      this.windowsLayer?.classList.add('blurred');
      const search = document.getElementById('launchpad-search-input');
      if (search) {
        search.value = '';
        search.focus();
        document.querySelectorAll('.launchpad-item').forEach(i => i.style.display = 'flex');
      }
    } else {
      this.launchpadOverlay?.classList.remove('open');
      this.desktopWallpaper?.classList.remove('blurred');
      this.windowsLayer?.classList.remove('blurred');
    }
  }

  toggleControlCenter() {
    this.controlCenter?.classList.toggle('open');
  }

  setTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
  }

  toggleTheme() {
    const nextTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  lockDesktop() {
    this.isLocked = true;
    this.lockScreen?.classList.add('locked');
    this.controlCenter?.classList.remove('open');
    this.toggleLaunchpad(false);
  }

  unlockDesktop() {
    this.isLocked = false;
    this.lockScreen?.classList.remove('locked');
  }
}

function escapeHtml(text) {
  if (typeof text !== 'string') text = String(text);
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Inicializar GIO Shell ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
  window.gioShell = new GioShell();
});
