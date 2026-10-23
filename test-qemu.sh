#!/usr/bin/env bash
# ==============================================================================
# GIO Os - Testar Sistema Operacional no Emulador QEMU
# ==============================================================================

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ISO="${DIR}/dist/gio-os-1.0-amd64.iso"
DISK_IMG="${DIR}/dist/gio-test-disk.qcow2"

REAL_USER="${SUDO_USER:-$USER}"
REAL_GROUP="$(id -gn "$REAL_USER" 2>/dev/null || echo "$REAL_USER")"

echo "🪐 Preparando teste do GIO Os no QEMU..."

# 1. Verificar se o QEMU está instalado
if ! which qemu-system-x86_64 >/dev/null 2>&1; then
  echo "⚠️ QEMU não encontrado. Instalando dependências necessárias..."
  sudo apt update && sudo apt install -y qemu-system-x86 qemu-utils ovmf
fi

# 2. Verificar se a ISO já foi compilada ou se rebuild foi solicitado
REBUILD=0
if [ "${1:-}" = "--build" ] || [ "${1:-}" = "-b" ] || [ "${1:-}" = "rebuild" ]; then
  REBUILD=1
fi

if [ ! -f "$ISO" ] || [ "$REBUILD" -eq 1 ]; then
  echo "💿 Compilando imagem ISO atualizada com o build/build-iso.sh..."
  sudo "${DIR}/build/build-iso.sh"
  sudo chown -R "$REAL_USER:$REAL_GROUP" "${DIR}/dist" 2>/dev/null || true
fi

# 3. Garantir diretório dist e permissões do disco rígido virtual de teste
mkdir -p "${DIR}/dist"

# Se o disco virtual de teste já existe mas não é gravável pelo usuário
if [ -f "$DISK_IMG" ] && [ ! -w "$DISK_IMG" ]; then
  echo "🔑 Ajustando permissões de escrita do disco de teste..."
  if [ "$EUID" -eq 0 ]; then
    chown "$REAL_USER:$REAL_GROUP" "$DISK_IMG" 2>/dev/null || true
    chmod 666 "$DISK_IMG" 2>/dev/null || true
  else
    sudo chown "$REAL_USER:$REAL_GROUP" "$DISK_IMG" 2>/dev/null || true
    sudo chmod 666 "$DISK_IMG" 2>/dev/null || true
  fi
fi

if [ ! -f "$DISK_IMG" ]; then
  echo "📦 Criando disco rígido virtual de teste (20 GB) para o Instalador..."
  qemu-img create -f qcow2 "$DISK_IMG" 20G
  chmod 666 "$DISK_IMG" 2>/dev/null || true
  if [ "$EUID" -eq 0 ]; then
    chown "$REAL_USER:$REAL_GROUP" "$DISK_IMG" 2>/dev/null || true
  fi
fi

# Garantir permissões globais na pasta dist para evitar Permission Denied
if [ "$EUID" -eq 0 ]; then
  chown -R "$REAL_USER:$REAL_GROUP" "${DIR}/dist" 2>/dev/null || true
  chmod 775 "${DIR}/dist" 2>/dev/null || true
  chmod 666 "$DISK_IMG" 2>/dev/null || true
fi

echo "🚀 Iniciando Máquina Virtual QEMU..."
echo "  - ISO: $ISO"
echo "  - Disco Alvo (Instalador): $DISK_IMG (20 GB)"
echo "  - Memória: 3072 MB"
echo "  - Cores: 2"

# Detectar suporte KVM para aceleração por hardware
KVM_ARGS=""
if [ -w /dev/kvm ]; then
  echo "⚡ Aceleração por hardware KVM ativada!"
  KVM_ARGS="-enable-kvm -cpu host"
else
  echo "ℹ️ Executando sem KVM (emulação padrão de CPU)."
  KVM_ARGS="-cpu max"
fi

# Executar QEMU como o usuário normal para acesso correto a vídeo e áudio
if [ "$EUID" -eq 0 ]; then
  echo "🖥️ Abrindo janela gráfica do QEMU para o usuário ${REAL_USER}..."
  exec sudo -u "$REAL_USER" \
    DISPLAY="${DISPLAY:-:0}" \
    WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-}" \
    XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u "$REAL_USER")}" \
    qemu-system-x86_64 \
    $KVM_ARGS \
    -m 3072 \
    -smp 2 \
    -cdrom "$ISO" \
    -drive file="$DISK_IMG",format=qcow2,if=virtio \
    -boot d \
    -vga virtio \
    -display default \
    -device intel-hda \
    -device hda-duplex \
    -net nic -net user
else
  exec qemu-system-x86_64 \
    $KVM_ARGS \
    -m 3072 \
    -smp 2 \
    -cdrom "$ISO" \
    -drive file="$DISK_IMG",format=qcow2,if=virtio \
    -boot d \
    -vga virtio \
    -display default \
    -device intel-hda \
    -device hda-duplex \
    -net nic -net user
fi
