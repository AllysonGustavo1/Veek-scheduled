# Veek Scheduled Check-in

Script automatizado para realizar check-in e resgatar recompensas/bônus na operadora Veek a cada 30 minutos via **GitHub Actions** ou localmente.

---

## 🚀 Como configurar no GitHub Actions

### 1. Criar o Secret no Repositório
1. Vá até o seu repositório no GitHub.
2. Acesse **Settings** > **Secrets and variables** > **Actions**.
3. Clique em **New repository secret**.
4. Em **Name**, digite: `accounts` (ou `ACCOUNTS`).
5. Em **Secret**, cole as suas contas no formato `nome:cpf:senha:ncheckins`:
   ```text
   nome:cpf:senha:ncheckins
   Eu:00000000000:MinhaSenha123:0
   OutroUsuario:12345678900:OutraSenha:0
   ```
   > **Nota:** O cabeçalho `nome:cpf:senha:ncheckins` na primeira linha é opcional.

6. Clique em **Add secret**.

---

## ⏱️ Execução Automática

- O workflow (`.github/workflows/schedule.yml`) está configurado com `cron: '*/30 * * * *'` para executar a cada 30 minutos.
- Você também pode disparar a execução manualmente a qualquer momento pela aba **Actions** > **Veek Scheduled Check-in** > **Run workflow**.

---

## 💻 Execução Local

Caso queira rodar na sua máquina:

1. Crie um arquivo `accounts.txt` com suas credenciais (veja o modelo em `accounts.example.txt`):
   ```text
   nome:cpf:senha:ncheckins
   MinhaConta:12345678901:MinhaSenha:0
   ```
2. Execute o script:
   ```bash
   node index.js
   ```
   ou para rodar com agendamento contínuo em segundo plano:
   ```bash
   node scheduled.js
   ```