#!/usr/bin/env bash
# ==============================================================================
# GIO Os - Testar Sistema Operacional no Emulador QEMU
# ==============================================================================

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ISO="${DIR}/dist/gio-os-1.0-amd64.iso"

# Elevar para root se necessário
if [ "$EUID" -ne 0 ]; then
  exec sudo "$0" "$@"
fi

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
fi

# 3. Criar disco rígido virtual de teste para o instalador
DISK_IMG="${DIR}/dist/gio-test-disk.qcow2"
if [ ! -f "$DISK_IMG" ]; then
  echo "📦 Criando disco rígido virtual de teste (20 GB) para o Instalador..."
  qemu-img create -f qcow2 "$DISK_IMG" 20G
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

REAL_USER="${SUDO_USER:-$USER}"
echo "🖥️ Abrindo janela gráfica do QEMU para o usuário ${REAL_USER}..."

sudo -u "$REAL_USER" \
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
