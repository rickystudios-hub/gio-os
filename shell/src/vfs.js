// ========================================================
// GIO Os - Unified Virtual File System (VFS)
// ========================================================

class VirtualFileSystem {
  constructor() {
    this.root = {
      type: 'dir',
      name: '/',
      children: {
        'home': {
          type: 'dir',
          name: 'home',
          children: {
            'gio': {
              type: 'dir',
              name: 'gio',
              children: {
                'Documentos': {
                  type: 'dir',
                  name: 'Documentos',
                  children: {
                    'anotacoes.txt': {
                      type: 'file',
                      name: 'anotacoes.txt',
                      content: 'GIO Os - Sistema Operacional Linux Moderno.\nBase: Debian + Wayland + GIO Shell.\nArquitetura leve e acelerada por hardware.'
                    },
                    'roadmap.md': {
                      type: 'file',
                      name: 'roadmap.md',
                      content: '# Roadmap GIO Os\n- [x] Shell Wayland com Glassmorphism\n- [x] Sistema de Arquivos Integrado\n- [x] Apps Nativos em Execução\n- [ ] Suporte a Temas Dinâmicos e Wayfire 3D'
                    }
                  }
                },
                'Projetos': {
                  type: 'dir',
                  name: 'Projetos',
                  children: {
                    'main.c': {
                      type: 'file',
                      name: 'main.c',
                      content: '#include <stdio.h>\n#include <stdlib.h>\n\nint main(int argc, char *argv[]) {\n    printf("Iniciando GIO Os Core Engine...\\n");\n    printf("Wayland Compositor ativo.\\n");\n    return 0;\n}'
                    },
                    'shell.rs': {
                      type: 'file',
                      name: 'shell.rs',
                      content: '// GIO Shell Rust Bridge\npub fn launch_compositor() {\n    println!("Iniciando sessão do Wayland no GIO Os...");\n}'
                    }
                  }
                },
                'Downloads': {
                  type: 'dir',
                  name: 'Downloads',
                  children: {
                    'linux-kernel-6.8.deb': {
                      type: 'file',
                      name: 'linux-kernel-6.8.deb',
                      content: '[Pacote Binário Debian Linux Kernel 6.8.0-45-generic x86_64]'
                    }
                  }
                },
                'Imagens': {
                  type: 'dir',
                  name: 'Imagens',
                  children: {
                    'default-wallpaper.jpg': {
                      type: 'file',
                      name: 'default-wallpaper.jpg',
                      content: '[Imagem de Papel de Parede Oficial GIO Os 8K]'
                    }
                  }
                },
                'Musicas': {
                  type: 'dir',
                  name: 'Musicas',
                  children: {
                    'nebula-synthwave.mp3': {
                      type: 'file',
                      name: 'nebula-synthwave.mp3',
                      content: '[Áudio Sintetizado PipeWire 24-bit 96kHz]'
                    }
                  }
                },
                'readme.txt': {
                  type: 'file',
                  name: 'readme.txt',
                  content: 'Bem-vindo ao GIO Os!\nDigite "help" no terminal para ver a lista de comandos disponíveis.'
                }
              }
            }
          }
        },
        'etc': {
          type: 'dir',
          name: 'etc',
          children: {
            'os-release': {
              type: 'file',
              name: 'os-release',
              content: 'NAME="GIO Os"\nVERSION="1.0 LTS"\nID=gio-os\nID_LIKE="debian ubuntu"\nPRETTY_NAME="GIO Os 1.0 LTS (Linux 6.8)"\nHOME_URL="https://gio-os.org"\nWAYLAND_COMPOSITOR="wlroots/labwc"'
            },
            'hostname': {
              type: 'file',
              name: 'hostname',
              content: 'gio-workstation\n'
            }
          }
        },
        'usr': {
          type: 'dir',
          name: 'usr',
          children: {
            'bin': {
              type: 'dir',
              name: 'bin',
              children: {
                'bash': { type: 'file', name: 'bash', content: '[ELF Executable]' },
                'apt': { type: 'file', name: 'apt', content: '[ELF Executable]' },
                'systemctl': { type: 'file', name: 'systemctl', content: '[ELF Executable]' }
              }
            }
          }
        }
      }
    };

    this.currentPath = '/home/gio';
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }

  // Resolve um caminho absoluto a partir do diretório atual
  resolvePath(pathStr) {
    if (!pathStr || pathStr === '.') return this.currentPath;
    if (pathStr === '~') return '/home/gio';
    if (pathStr.startsWith('~/')) return '/home/gio/' + pathStr.slice(2);
    
    let parts;
    if (pathStr.startsWith('/')) {
      parts = pathStr.split('/').filter(Boolean);
    } else {
      parts = (this.currentPath + '/' + pathStr).split('/').filter(Boolean);
    }

    const resolvedParts = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        resolvedParts.pop();
      } else {
        resolvedParts.push(part);
      }
    }

    return '/' + resolvedParts.join('/');
  }

  // Retorna o nó (diretório ou arquivo) para um determinado caminho
  getNode(pathStr) {
    const absPath = this.resolvePath(pathStr);
    if (absPath === '/') return this.root;

    const parts = absPath.split('/').filter(Boolean);
    let curr = this.root;

    for (const p of parts) {
      if (!curr.children || !curr.children[p]) {
        return null;
      }
      curr = curr.children[p];
    }
    return curr;
  }

  // Lista itens no diretório
  listDir(pathStr = '.') {
    const node = this.getNode(pathStr);
    if (!node) throw new Error(`Diretório não encontrado: ${pathStr}`);
    if (node.type !== 'dir') throw new Error(`Não é um diretório: ${pathStr}`);
    return Object.values(node.children);
  }

  // Muda de diretório
  changeDir(pathStr) {
    const target = this.resolvePath(pathStr);
    const node = this.getNode(target);
    if (!node) throw new Error(`cd: ${pathStr}: Diretório não encontrado`);
    if (node.type !== 'dir') throw new Error(`cd: ${pathStr}: Não é um diretório`);
    this.currentPath = target;
    this.notify();
    return this.currentPath;
  }

  // Cria um diretório
  makeDir(pathStr) {
    const target = this.resolvePath(pathStr);
    const parts = target.split('/').filter(Boolean);
    const dirName = parts.pop();
    const parentPath = '/' + parts.join('/');
    const parentNode = this.getNode(parentPath);

    if (!parentNode || parentNode.type !== 'dir') {
      throw new Error(`mkdir: impossível criar o diretório '${pathStr}': Caminho pai não existe`);
    }

    if (parentNode.children[dirName]) {
      throw new Error(`mkdir: '${dirName}': Arquivo ou diretório já existe`);
    }

    parentNode.children[dirName] = {
      type: 'dir',
      name: dirName,
      children: {}
    };

    this.notify();
    return true;
  }

  // Cria ou atualiza um arquivo
  writeFile(pathStr, content = '') {
    const target = this.resolvePath(pathStr);
    const parts = target.split('/').filter(Boolean);
    const fileName = parts.pop();
    const parentPath = '/' + parts.join('/');
    const parentNode = this.getNode(parentPath);

    if (!parentNode || parentNode.type !== 'dir') {
      throw new Error(`touch: impossível tocar '${pathStr}': Caminho pai não existe`);
    }

    if (parentNode.children[fileName] && parentNode.children[fileName].type === 'dir') {
      throw new Error(`touch: '${fileName}': É um diretório`);
    }

    parentNode.children[fileName] = {
      type: 'file',
      name: fileName,
      content: content
    };

    this.notify();
    return true;
  }

  // Lê um arquivo
  readFile(pathStr) {
    const node = this.getNode(pathStr);
    if (!node) throw new Error(`cat: ${pathStr}: Arquivo não encontrado`);
    if (node.type === 'dir') throw new Error(`cat: ${pathStr}: É um diretório`);
    return node.content || '';
  }

  // Remove arquivo ou diretório
  remove(pathStr, recursive = false) {
    const target = this.resolvePath(pathStr);
    if (target === '/' || target === '/home' || target === '/home/gio') {
      throw new Error(`rm: recusa remover diretório crítico do sistema: ${target}`);
    }

    const parts = target.split('/').filter(Boolean);
    const name = parts.pop();
    const parentPath = '/' + parts.join('/');
    const parentNode = this.getNode(parentPath);

    if (!parentNode || !parentNode.children[name]) {
      throw new Error(`rm: impossível remover '${pathStr}': Arquivo ou diretório não encontrado`);
    }

    const targetNode = parentNode.children[name];
    if (targetNode.type === 'dir' && !recursive) {
      throw new Error(`rm: impossível remover '${pathStr}': É um diretório (use -r)`);
    }

    delete parentNode.children[name];
    this.notify();
    return true;
  }
}

window.vfs = new VirtualFileSystem();
