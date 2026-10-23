#!/usr/bin/env bash
# ==============================================================================
# GIO Os - Compilador de Imagem ISO Bootável (Debian GNU/Linux 12 + Wayland)
# ==============================================================================

set -euo pipefail

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}       🪐 GIO Os - Construtor de Imagem ISO           ${NC}"
echo -e "${BLUE}======================================================${NC}"

# Verificar permissões de root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Erro: A compilação do sistema operacional requer permissões de root.${NC}"
  echo -e "${YELLOW}Por favor, execute:${NC} sudo $0"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# O debootstrap do Debian possui uma limitação conhecida: ele falha internamente se o caminho contiver espaços.
# Caso a pasta do projeto contenha espaços (ex: "PROJETOS ANTIGRAVITY/GIO Os"), usamos /var/tmp/gio-os-workspace.
DEFAULT_WORK_DIR="${SCRIPT_DIR}/workspace"
if [[ "$DEFAULT_WORK_DIR" =~ [[:space:]] ]]; then
  WORK_DIR="${WORK_DIR:-/var/tmp/gio-os-workspace}"
  echo -e "${YELLOW}ℹ️ Caminho do projeto contém espaços. Usando diretório de compilação compatível:${NC} ${WORK_DIR}"
  
  # Limpar workspace antigo quebrado com espaços se existir
  if [ -d "${DEFAULT_WORK_DIR}" ]; then
    echo -e "${YELLOW}Limpando workspace anterior com caminhos inválidos...${NC}"
    umount -lf "${DEFAULT_WORK_DIR}/chroot/dev" 2>/dev/null || true
    umount -lf "${DEFAULT_WORK_DIR}/chroot/run" 2>/dev/null || true
    umount -lf "${DEFAULT_WORK_DIR}/chroot/proc" 2>/dev/null || true
    umount -lf "${DEFAULT_WORK_DIR}/chroot/sys" 2>/dev/null || true
    rm -rf "${DEFAULT_WORK_DIR}" 2>/dev/null || true
  fi
else
  WORK_DIR="${WORK_DIR:-$DEFAULT_WORK_DIR}"
fi

CHROOT_DIR="${WORK_DIR}/chroot"
IMAGE_DIR="${WORK_DIR}/iso_root"
OUTPUT_DIR="${PROJECT_ROOT}/dist"
ISO_NAME="gio-os-1.0-amd64.iso"


# 1. Dependências do Host
echo -e "${CYAN}[1/6] Verificando ferramentas de compilação...${NC}"
REQUIRED_TOOLS=("debootstrap" "mksquashfs" "xorriso" "grub-mkrescue" "mtools")
MISSING=()

for tool in "${REQUIRED_TOOLS[@]}"; do
  if ! which "$tool" >/dev/null 2>&1; then
    MISSING+=("$tool")
  fi
done

# Garantir que debian-archive-keyring e ferramentas do host estejam presentes
if [ ${#MISSING[@]} -gt 0 ] || [ ! -f /usr/share/keyrings/debian-archive-keyring.gpg ]; then
  echo -e "${YELLOW}Instalando dependências de compilação e keyring do Debian...${NC}"
  apt-get update
  apt-get install -y debootstrap squashfs-tools xorriso grub-pc-bin grub-efi-amd64-bin mtools debian-archive-keyring
fi

# 2. Limpeza e preparação dos diretórios
echo -e "${CYAN}[2/6] Preparando diretórios em ${WORK_DIR}...${NC}"
mkdir -p "${CHROOT_DIR}" "${IMAGE_DIR}/live" "${IMAGE_DIR}/boot/grub" "${OUTPUT_DIR}"

# 3. Debootstrap (Base Debian Bookworm)
if [ ! -f "${CHROOT_DIR}/etc/debian_version" ] || ! chroot "${CHROOT_DIR}" /bin/true 2>/dev/null; then
  echo -e "${YELLOW}Preparando ambiente chroot limpo para Debian 12 (Bookworm)...${NC}"
  umount -lf "${CHROOT_DIR}/dev" 2>/dev/null || true
  umount -lf "${CHROOT_DIR}/run" 2>/dev/null || true
  umount -lf "${CHROOT_DIR}/proc" 2>/dev/null || true
  umount -lf "${CHROOT_DIR}/sys" 2>/dev/null || true
  rm -rf "${CHROOT_DIR}"
  mkdir -p "${CHROOT_DIR}"

  echo -e "${CYAN}[3/6] Criando sistema base Debian 12 via debootstrap...${NC}"
  debootstrap --arch=amd64 --keyring=/usr/share/keyrings/debian-archive-keyring.gpg --include=libc6,libgcc-s1,ca-certificates,locales bookworm "${CHROOT_DIR}" http://deb.debian.org/debian/
else
  echo -e "${GREEN}[3/6] Sistema base Debian 12 verificado e pronto em ${CHROOT_DIR}.${NC}"
fi

# 4. Configuração do Chroot e Instalação de Pacotes
echo -e "${CYAN}[4/6] Configurando o sistema GIO Os dentro do RootFS...${NC}"

# Montar sistemas de arquivos virtuais
mount --bind /dev "${CHROOT_DIR}/dev" || true
mount --bind /run "${CHROOT_DIR}/run" || true
mount -t proc none "${CHROOT_DIR}/proc" || true
mount -t sysfs none "${CHROOT_DIR}/sys" || true

cleanup() {
  echo -e "${YELLOW}Desmontando sistemas de arquivos virtuais...${NC}"
  umount -lf "${CHROOT_DIR}/dev" 2>/dev/null || true
  umount -lf "${CHROOT_DIR}/run" 2>/dev/null || true
  umount -lf "${CHROOT_DIR}/proc" 2>/dev/null || true
  umount -lf "${CHROOT_DIR}/sys" 2>/dev/null || true
}
trap cleanup EXIT

# Hostname e repositórios
echo "gio-os" > "${CHROOT_DIR}/etc/hostname"
cat << 'EOF' > "${CHROOT_DIR}/etc/hosts"
127.0.0.1   localhost
127.0.1.1   gio-os
EOF

cat << 'EOF' > "${CHROOT_DIR}/etc/apt/sources.list"
deb http://deb.debian.org/debian/ bookworm main contrib non-free non-free-firmware
deb http://security.debian.org/debian-security bookworm-security main contrib non-free non-free-firmware
deb http://deb.debian.org/debian/ bookworm-updates main contrib non-free non-free-firmware
EOF

# Configurar e instalar no Chroot
chroot "${CHROOT_DIR}" /bin/bash << 'CHROOT_EOF'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends \
  linux-image-amd64 \
  live-boot \
  systemd-sysv \
  libpam-systemd \
  dbus-user-session \
  network-manager \
  pipewire \
  pipewire-alsa \
  pipewire-pulse \
  wireplumber \
  sudo \
  bash \
  curl \
  wget \
  htop \
  neofetch \
  nodejs \
  chromium \
  xorg \
  xserver-xorg-video-all \
  xserver-xorg-input-all \
  xinit \
  openbox \
  x11-xserver-utils \
  parted \
  dosfstools \
  e2fsprogs \
  rsync \
  mesa-va-drivers \
  mesa-vulkan-drivers \
  libgl1-mesa-dri \
  fonts-dejavu-core

apt-get install -y fonts-inter fonts-jetbrains-mono 2>/dev/null || true

# Criar usuário 'gio' com sudo sem senha
if ! id -u gio >/dev/null 2>&1; then
  useradd -m -s /bin/bash gio
  for grp in sudo audio video input render; do
    if getent group "$grp" >/dev/null 2>&1; then
      usermod -aG "$grp" gio || true
    fi
  done
  echo "gio:gio" | chpasswd
  mkdir -p /etc/sudoers.d
  echo "gio ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/gio
  chmod 0440 /etc/sudoers.d/gio
fi

# Configuração do Openbox para ocultar decorações em tela cheia
mkdir -p /home/gio/.config/openbox
cat << 'OPENBOX_EOF' > /home/gio/.config/openbox/rc.xml
<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <applications>
    <application class="*">
      <decor>no</decor>
      <maximized>yes</maximized>
    </application>
  </applications>
</openbox_config>
OPENBOX_EOF

# Criar script de sessão gráfica principal do GIO Os
cat << 'SESSION_EOF' > /usr/local/bin/gio-session
#!/usr/bin/env bash
# ==============================================================================
# GIO Os - Sessão Gráfica Principal
# ==============================================================================

# Iniciar Openbox (Gerenciador de Janelas sem bordas)
openbox &

# Iniciar servidor backend nativo (Node.js) em segundo plano
node /opt/gio-os/server/backend.js &
BACKEND_PID=$!

# Aguardar backend responder
for i in {1..30}; do
  if curl -s http://127.0.0.1:4567/api/system/stats >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

# Ajustar resolução do display
xrandr -s 1280x800 2>/dev/null || xrandr -s 1024x768 2>/dev/null || true

# Iniciar Chromium em tela cheia / aplicativo nativo do GIO Os
exec chromium \
  --app=http://127.0.0.1:4567 \
  --start-fullscreen \
  --kiosk \
  --no-first-run \
  --no-default-browser-check \
  --disable-translate \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-component-update \
  --check-for-update-interval=31536000 \
  --password-store=basic
SESSION_EOF
chmod +x /usr/local/bin/gio-session

# Serviço Systemd para inicialização gráfica direta (sem telas de texto ou login TTY)
cat << 'SYSTEMD_EOF' > /etc/systemd/system/gio-desktop.service
[Unit]
Description=GIO Os Graphical Desktop Environment
After=network.target sound.target systemd-user-sessions.service
Wants=network.target

[Service]
Type=simple
User=gio
Group=gio
PAMName=login
Environment=HOME=/home/gio
Environment=USER=gio
WorkingDirectory=/home/gio
ExecStart=/usr/bin/xinit /usr/local/bin/gio-session -- /usr/bin/Xorg :0 -s 0 -dpms vt7
Restart=always
RestartSec=2

[Install]
WantedBy=graphical.target
SYSTEMD_EOF

# Habilitar inicialização gráfica direta do GIO Os
systemctl enable gio-desktop.service
systemctl set-default graphical.target

# Permitir que o Xorg execute via usuário local
if [ -f /etc/X11/Xwrapper.config ]; then
  sed -i 's/allowed_users=.*/allowed_users=anybody/' /etc/X11/Xwrapper.config 2>/dev/null || true
else
  mkdir -p /etc/X11
  echo "allowed_users=anybody" > /etc/X11/Xwrapper.config
fi

chown -R gio:gio /home/gio

# Limpeza do cache do apt
apt-get clean
rm -rf /var/lib/apt/lists/*
CHROOT_EOF

# 5. Copiar arquivos do GIO Os para o RootFS
echo -e "${CYAN}[5/6] Instalando código-fonte do GIO Os no sistema operacional...${NC}"
mkdir -p "${CHROOT_DIR}/opt/gio-os"
cp -r "${PROJECT_ROOT}/shell" "${CHROOT_DIR}/opt/gio-os/"
cp -r "${PROJECT_ROOT}/server" "${CHROOT_DIR}/opt/gio-os/"
cp -r "${PROJECT_ROOT}/assets" "${CHROOT_DIR}/opt/gio-os/" 2>/dev/null || true

# Copiar Kernel e Initramfs para a pasta Live
echo -e "${CYAN}Copiando Kernel e Initramfs...${NC}"
VMLINUZ=$(find "${CHROOT_DIR}/boot" -maxdepth 1 -name "vmlinuz*" | head -n 1)
INITRD=$(find "${CHROOT_DIR}/boot" -maxdepth 1 -name "initrd.img*" | head -n 1)

if [ -z "$VMLINUZ" ] || [ -z "$INITRD" ]; then
  echo -e "${RED}Erro: Kernel ou Initrd não foram encontrados em ${CHROOT_DIR}/boot.${NC}"
  exit 1
fi

cp -v -L "$VMLINUZ" "${IMAGE_DIR}/live/vmlinuz"
cp -v -L "$INITRD" "${IMAGE_DIR}/live/initrd"

# Configuração do GRUB Bootloader
cat << 'GRUB_EOF' > "${IMAGE_DIR}/boot/grub/grub.cfg"
set default="0"
set timeout=5

insmod efi_gop
insmod font
if loadfont /boot/grub/unicode.pf2 ; then
  insmod gfxterm
  set gfxmode=auto
  terminal_output gfxterm
fi

menuentry "🪐 Iniciar GIO Os 1.0 (Live)" {
    linux /live/vmlinuz boot=live components quiet splash vt.global_cursor_default=0 systemd.show_status=0
    initrd /live/initrd
}

menuentry "💿 Instalar GIO Os no Disco" {
    linux /live/vmlinuz boot=live components gio.installer=1 quiet splash vt.global_cursor_default=0 systemd.show_status=0
    initrd /live/initrd
}

menuentry "🛡️ GIO Os 1.0 (Modo Seguro / VESA Safe)" {
    linux /live/vmlinuz boot=live components nomodeset vga=normal
    initrd /live/initrd
}
GRUB_EOF


# Desmontar chroot antes de compactar squashfs
cleanup

# Criar SquashFS
echo -e "${CYAN}[6/6] Compactando o sistema de arquivos (SquashFS)...${NC}"
rm -f "${IMAGE_DIR}/live/filesystem.squashfs"
mksquashfs "${CHROOT_DIR}" "${IMAGE_DIR}/live/filesystem.squashfs" -comp xz -e boot

# Gerar ISO híbrida bootável (UEFI + BIOS)
echo -e "${CYAN}Gerando imagem ISO híbrida bootável: ${OUTPUT_DIR}/${ISO_NAME}...${NC}"
grub-mkrescue -o "${OUTPUT_DIR}/${ISO_NAME}" "${IMAGE_DIR}"

echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}  🎉 ISO DO GIO Os COMPILADA COM SUCESSO!              ${NC}"
echo -e "${GREEN}  Arquivo: ${OUTPUT_DIR}/${ISO_NAME}                    ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "${YELLOW}Para gravar em um pendrive USB e dar boot no computador:${NC}"
echo -e "  sudo dd if=\"${OUTPUT_DIR}/${ISO_NAME}\" of=/dev/sdX bs=4M status=progress oflag=sync"
