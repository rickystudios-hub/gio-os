# 🪐 Changelog do GIO Os

Todas as mudanças relevantes no projeto serão documentadas neste arquivo.
O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.0.0] - "Aether" - 2026-10-23

### 🚀 Lançamento Inicial

#### Interface & Desktop (GIO Shell)
- **Design System Aether:** Estilo translúcido Glassmorphism com desfoque de fundo dinâmico (`backdrop-filter: blur(28px)`), micro-interações fluidas e tipografia moderna.
- **TopBar & Dock Flutuante:** Barra superior com workspaces virtuais independentes, relógio/calendário, status de rede/bateria/áudio e Central de Controle integrada.
- **Launchpad em Tela Cheia:** Grade completa de aplicativos com barra de pesquisa instantânea e atalho global Super (Windows Key).
- **Tela de Bloqueio (Lock Screen):** Proteção visual com exibição de data/hora e desbloqueio animado.

#### Aplicativos Integrados
- **Terminal GIO:** Conexão IPC direta ao bash Linux com execução em tempo real, histórico de comandos e banner Neofetch.
- **Arquivos GIO (File Manager):** Navegação real de pastas, criação de diretórios, leitura e exclusão de arquivos com integração ao VFS e ao disco físico.
- **Navegador Web:** Navegação completa na internet com proxy local e atalho para abrir páginas no Chromium do sistema.
- **Monitor do Sistema:** Métricas em tempo real de CPU (%), consumo de RAM (GB/%) e gerenciador de processos com encerramento de tarefas (`kill`).
- **GIO Studio:** Editor de código-fonte com realce de sintaxe e persistência direta no disco.
- **Calculadora:** Interface moderna para operações matemáticas rápidas.
- **Galeria & Música:** Visualizador de papéis de parede e reprodutor de áudio com sintetizador Web Audio.

#### Instalador do Sistema Operacional
- **Assistente de Instalação Passo a Passo:** Tela intuitiva com opções para **Experimentar (Live)** ou **Instalar no Disco**.
- **Particionamento Automático GPT/UEFI:** Formatação automática com partição ESP FAT32 de 512MB e partição raiz EXT4.
- **Logs e Progresso em Tempo Real:** Barra de progresso visual com monitoramento via streaming de endpoints da API nativa.

#### Infraestrutura & Compilação de ISO
- **Base Debian GNU/Linux 12 (Bookworm):** Kernel Linux estável (`linux-image-amd64`) com suporte a hardware moderno.
- **Inicialização Gráfica Direta:** Serviço dedicado `systemd` (`gio-desktop.service`) inicializando diretamente no display gráfico sem flashes de terminal de texto.
- **Bootloader Híbrido:** Suporte a inicialização tanto em computadores modernos com UEFI quanto em computadores legados com BIOS.
- **Ambiente de Teste QEMU:** Script automatizado `test-qemu.sh` com aceleração de hardware KVM e criação de disco rígido virtual de 20 GB.
