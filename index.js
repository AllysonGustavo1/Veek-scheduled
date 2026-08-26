import { promises as fs } from 'fs';

const baseUrl = 'https://services.live.veek.com.br';

const parseAccountsData = (data) => {
  const lines = data
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    return { header: null, accounts: [] };
  }

  let startIndex = 0;
  let header = null;

  // Verifica se a primeira linha é um cabeçalho (ex: nome:cpf:senha:ncheckins ou Conta:senha)
  if (/^(nome|conta|cpf|usuario|username|name):.*(senha|password|ncheckins|checkin)/i.test(lines[0])) {
    header = lines[0];
    startIndex = 1;
  }

  const accounts = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(':');
    if (parts.length < 2) continue;

    if (parts.length === 2) {
      // Formato: Conta:senha (ou CPF:senha)
      const [cpf, password] = parts;
      accounts.push({
        name: cpf,
        cpf: cpf.trim(),
        password: password.trim(),
        checkIns: 0,
      });
    } else if (parts.length === 3) {
      // Formato: CPF:senha:NCheckins OU Nome:CPF:senha
      if (/^\d+$/.test(parts[2].trim())) {
        const [cpf, password, nCheckins] = parts;
        accounts.push({
          name: cpf.trim(),
          cpf: cpf.trim(),
          password: password.trim(),
          checkIns: parseInt(nCheckins.trim(), 10) || 0,
        });
      } else {
        const [name, cpf, password] = parts;
        accounts.push({
          name: name.trim(),
          cpf: cpf.trim(),
          password: password.trim(),
          checkIns: 0,
        });
      }
    } else {
      // Formato: Nome:CPF:senha:NCheckins (ou senha com múltiplos ':')
      const lastPart = parts[parts.length - 1].trim();
      if (/^\d+$/.test(lastPart)) {
        const name = parts[0].trim();
        const cpf = parts[1].trim();
        const password = parts.slice(2, -1).join(':').trim();
        const checkIns = parseInt(lastPart, 10) || 0;
        accounts.push({ name, cpf, password, checkIns });
      } else {
        const name = parts[0].trim();
        const cpf = parts[1].trim();
        const password = parts.slice(2).join(':').trim();
        accounts.push({ name, cpf, password, checkIns: 0 });
      }
    }
  }

  return { header, accounts };
};

const getAccounts = async () => {
  const envAccounts = process.env.ACCOUNTS || process.env.accounts;
  if (envAccounts) {
    const { header, accounts } = parseAccountsData(envAccounts);
    return { header, accounts, fromFile: false };
  }

  try {
    const data = await fs.readFile('accounts.txt', 'utf8');
    const { header, accounts } = parseAccountsData(data);
    return { header: header || 'nome:cpf:senha:NCheckins', accounts, fromFile: true };
  } catch (error) {
    console.warn('Arquivo accounts.txt não encontrado e variável de ambiente ACCOUNTS não configurada.');
    return { header: null, accounts: [], fromFile: false };
  }
};

const saveAccounts = async (header, accounts) => {
  const fileHeader = header || 'nome:cpf:senha:NCheckins';
  const data = [
    fileHeader,
    ...accounts.map(({ name, cpf, password, checkIns }) => `${name}:${cpf}:${password}:${checkIns}`),
  ].join('\n');
  await fs.writeFile('accounts.txt', data, 'utf8');
};

const getToken = async ({ username, password }) => {
  const url = `${baseUrl}/authenticator/oauth2/token`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
      grantType: 'password',
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.accessToken) {
    const errorMsg = data.message || data.error_description || data.error || `HTTP ${response.status}`;
    throw new Error(`Falha na autenticação (${errorMsg})`);
  }

  return data;
};

const checkin = async (accessToken) => {
  const url = `${baseUrl}/telecom/lines/checkin`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.message || data.error || `HTTP ${response.status}`;
    throw new Error(`Falha no check-in (${errorMsg})`);
  }

  return data;
};

const rewards = async (accessToken) => {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const linesRes = await fetch(`${baseUrl}/telecom/lines`, { headers }).then(r => r.json()).catch(() => null);
  if (!linesRes) return;

  const line = Array.isArray(linesRes) ? linesRes[0] : linesRes;
  if (!line || !line.id) return;

  const [bonus, checkins] = await Promise.all([
    fetch(`${baseUrl}/telecom/lines/${line.id}/bonus`, { headers })
      .then(r => r.json())
      .catch(() => ({})),
    fetch(`${baseUrl}/telecom/checkins?lineId=${line.id}`, { headers })
      .then(r => r.json())
      .catch(() => ({})),
  ]);

  if (bonus?.available) {
    await fetch(`${baseUrl}/telecom/lines/${line.id}/claim`, {
      headers,
      method: 'POST',
    }).catch(err => console.log(`Erro ao resgatar bônus da linha ${line.id}:`, err.message));
    console.log(`Bônus resgatado para a linha ${line.id}.`);
  }

  if (checkins?.available) {
    await fetch(`${baseUrl}/telecom/checkins/claim`, {
      headers,
      method: 'POST',
      body: JSON.stringify({
        params: {
          lineId: line.id,
        },
      }),
    }).catch(err => console.log(`Erro ao resgatar checkins claim da linha ${line.id}:`, err.message));
    console.log(`Recompensas de check-in resgatadas para a linha ${line.id}.`);
  }
};

const main = async () => {
  console.log(`[${new Date().toISOString()}] Iniciando verificação Veek...`);
  const { header, accounts, fromFile } = await getAccounts();

  if (accounts.length === 0) {
    console.log('Nenhuma conta válida para processar.');
    return;
  }

  console.log(`Encontrada(s) ${accounts.length} conta(s) para processar.`);

  for (const account of accounts) {
    const accountLabel = account.name && account.name !== account.cpf
      ? `${account.name} (${account.cpf.slice(0, 3)}***)`
      : `${account.cpf.slice(0, 3)}***`;

    try {
      const { accessToken } = await getToken({ username: account.cpf, password: account.password });

      await checkin(accessToken);
      account.checkIns = (account.checkIns || 0) + 1;
      console.log(`Check-in em ${accountLabel} [N°${account.checkIns}] realizado com sucesso.`);

      await rewards(accessToken);
    } catch (error) {
      console.log(`Erro no processamento de ${accountLabel}:`, error.message || error);
    }
  }

  if (fromFile) {
    try {
      await saveAccounts(header, accounts);
    } catch (err) {
      console.warn('Aviso: Não foi possível salvar em accounts.txt:', err.message);
    }
  }

  console.log(`[${new Date().toISOString()}] Processamento concluído.`);
};

main().catch(console.error);
