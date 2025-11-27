---
description: Commit e push automático para GitHub
---

# Workflow: Git Commit e Push Automático

Este workflow automatiza o processo de commit e push das alterações para o GitHub.

## Pré-requisitos

- Repositório Git inicializado
- Remote configurado (origin)
- Credenciais Git configuradas

## Passos

### 1. Verificar status do repositório
```bash
git status
```

### 2. Adicionar todas as alterações
// turbo
```bash
git add .
```

### 3. Criar commit com mensagem descritiva
```bash
git commit -m "feat: [DESCRIÇÃO_DA_MUDANÇA]"
```

**Nota:** Substitua `[DESCRIÇÃO_DA_MUDANÇA]` por uma descrição clara e concisa das alterações realizadas. Use os prefixos convencionais:
- `feat:` para novas funcionalidades
- `fix:` para correções de bugs
- `refactor:` para refatorações
- `docs:` para documentação
- `style:` para formatação
- `test:` para testes
- `chore:` para tarefas de manutenção

### 4. Fazer push para o repositório remoto
// turbo
```bash
git push origin main
```

**Nota:** Se sua branch principal for `master` em vez de `main`, ajuste o comando para `git push origin master`.

### 5. Verificar se o push foi bem-sucedido
```bash
git log -1
```

## Variações

### Push para branch específica
Se você estiver trabalhando em uma branch diferente:
```bash
git push origin [NOME_DA_BRANCH]
```

### Push forçado (use com cuidado!)
Se precisar sobrescrever o histórico remoto:
```bash
git push origin main --force
```

### Criar e fazer push de uma nova branch
```bash
git checkout -b [NOME_DA_BRANCH]
git push -u origin [NOME_DA_BRANCH]
```

## Solução de Problemas

### Se o remote não estiver configurado
```bash
git remote add origin [URL_DO_REPOSITORIO]
```

### Se houver conflitos
```bash
git pull origin main --rebase
# Resolva os conflitos manualmente
git add .
git rebase --continue
git push origin main
```

### Verificar configuração do remote
```bash
git remote -v
```
