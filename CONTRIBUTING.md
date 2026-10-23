# 🪐 Diretrizes de Contribuição para o GIO Os

Obrigado pelo seu interesse em contribuir para o **GIO Os**! Este projeto é construído pela comunidade para transformar a experiência desktop no ecossistema Linux através de tecnologias web modernas, desempenho nativo e design refinado.

---

## 📋 Como Contribuir

1. **Abra uma Issue** antes de iniciar uma grande funcionalidade para discutir o design e a arquitetura.
2. **Faça um Fork** do repositório no GitHub.
3. Crie uma branch com nome descritivo:
   ```bash
   git checkout -b feature/nova-interface-configuracoes
   ```
4. Faça seus commits com mensagens claras e semânticas (`feat:`, `fix:`, `docs:`, `perf:`).
5. Envie um Pull Request detalhando as mudanças e anexando capturas de tela/vídeo quando aplicável.

---

## 🛠️ Ambiente de Desenvolvimento Local

O GIO Os foi projetado para permitir desenvolvimento rápido sem a necessidade de recompilar a imagem ISO a cada mudança:

### Testar a Interface Gráfica e Backend:
```bash
./run-gio-os.sh
```
Acesse `http://localhost:4567` no navegador para debugar com as Ferramentas do Desenvolvedor (DevTools).

### Testar a ISO no Emulador QEMU:
```bash
./test-qemu.sh --build
```

---

## 🎨 Padrões de Design e Código

- **Frontend:** HTML5 semântico, JavaScript ES6+ modular, CSS moderno com variáveis nativas e backdrop-filter.
- **Backend:** Node.js puro utilizando bibliotecas nativas (`http`, `fs`, `path`, `os`, `child_process`) para manter a imagem leve e sem dependência de `node_modules`.
- **Ícones:** Sempre utilize SVGs vetoriais puros registrados em `shell/src/icons.js`.
