# 🪐 GIO Os v1.0.0 "Aether" - Release Oficial

Temos o orgulho de apresentar a primeira versão estável do **GIO Os (v1.0.0 "Aether")** — um sistema operacional moderno baseado no ecossistema Linux Debian, projetado para aliar velocidade máxima, aceleração gráfica e design glassmorphism translúcido de alta performance.

---

## ✨ Destaques da Versão 1.0.0

* **🪐 GIO Shell Desktop:** Interface gráfica fluida inspirada em ChromeOS e macOS, construída com aceleração por hardware, transparência em tempo real e desfoque dinâmico.
* **⚡ Conexão Nativa com o Linux (Zero Simulação):** Terminal integrado rodando bash nativo, gerenciador de arquivos acessando seu disco real, e monitor de recursos com finalização real de processos via `SIGTERM`.
* **💿 Instalador Completo Integrado:** Assistente gráfico que permite testar em modo Live sem tocar no disco ou instalar em qualquer HD/SSD com particionamento automático GPT/UEFI.
* **🛡️ Inicialização Sem Flickers:** Boot silencioso que carrega direto no ambiente gráfico (`gio-desktop.service`), compatível com máquinas físicas e ambientes virtuais (QEMU, VirtualBox, VMware).
* **📱 Suíte de Aplicativos:** Terminal, Arquivos, Navegador Web, Monitor de Recursos, GIO Studio (Editor de Código), Calculadora, Galeria de Imagens e Player de Música Sintetizada.

---

## 📥 Imagem ISO Bootável (Download & Verificação)

| Arquivo | Plataforma | Tamanho | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| `gio-os-1.0-amd64.iso` | x86_64 (UEFI / BIOS) | ~490 MB | `82ccaf13ae7b8c67acbe8032a04d9d54b91a29b18c25bd109d5025dddbb9b1f4` |

### Como Verificar a Integridade da Imagem:
```bash
sha256sum gio-os-1.0-amd64.iso
```

---

## ⚡ Como Gravar em Pendrive USB

No Linux:
```bash
sudo dd if=gio-os-1.0-amd64.iso of=/dev/sdX bs=4M status=progress oflag=sync
```
*(Substitua `/dev/sdX` pelo caminho do seu pendrive USB, identificado através de `lsblk`)*

No Windows:
Utilize ferramentas como [Rufus](https://rufus.ie/) ou [BalenaEtcher](https://etcher.balena.io/) no modo de gravação DD/ISO.

---

## 🖥️ Como Testar no QEMU (Linux)

Clone o repositório e execute:
```bash
./test-qemu.sh
```
O script provisiona automaticamente os drivers, a imagem virtual e inicializa a VM com aceleração KVM.
