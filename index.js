import { promises as fs } from 'fs';

const baseUrl = 'https://services.live.veek.com.br';

const getAccounts = async () => {
  const data = await fs.readFile('accounts.txt', 'utf8');
  const lines = data.trim().split('\n');
  const header = lines[0];
  const accounts = lines.slice(1).map(line => {
    const [name, cpf, password, NCheckins] = line.split(':');
    return { name, cpf, password, checkIns: parseInt(NCheckins, 10) };
  });
  return { header, accounts };
};

const saveAccounts = async (header, accounts) => {
  const data = [header, ...accounts.map(({ name, cpf, password, checkIns }) => `${name}:${cpf}:${password}:${checkIns}`)].join('\n');
  await fs.writeFile('accounts.txt', data, 'utf8');
};

const getToken = async ({ username, password }) => {
  const url = `${baseUrl}/authenticator/oauth2/token`;
  const init = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
      grantType: 'password',
    }),
  };
  return fetch(url, init).then(response => response.json());
};

const checkin = accessToken => {
  const url = `${baseUrl}/telecom/lines/checkin`;
  const init = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };
  return fetch(url, init).then(response => response.json());
};

const rewards = async accessToken => {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${baseUrl}/telecom/lines`, {
    headers,
  }).then(response => response.json());

  const line = Array.isArray(response) ? response[0] : response;

  const [bonus, checkins] = await Promise.all([
    fetch(`${baseUrl}/telecom/lines/${line.id}/bonus`, {
      headers,
    }).then(response => response.json()),
    fetch(`${baseUrl}/telecom/checkins?lineId=${line.id}`, {
      headers,
    }).then(response => response.json()),
  ]);

  if (bonus.available) {
    await fetch(`${baseUrl}/telecom/lines/${line.id}/claim`, {
      headers,
      method: 'POST',
    });
  }

  if (checkins.available) {
    await fetch(`${baseUrl}/telecom/checkins/claim`, {
      headers,
      method: 'POST',
      body: JSON.stringify({
        params: {
          lineId: line.id,
        },
      }),
    });
  }
};

const main = async () => {
  const { header, accounts } = await getAccounts();

  for (const account of accounts) {
    try {
      const { accessToken } = await getToken({ username: account.cpf, password: account.password });
      
      await checkin(accessToken).then(() => {
        console.log(`Checkin em ${account.name} N°${account.checkIns + 1} realizado com sucesso`);
      }).catch(console.log);

      await rewards(accessToken).catch(console.log);

      account.checkIns += 1;

    } catch (error) {
      console.log(`Erro no processamento da conta ${account.cpf}:`, error);
    }
  }

  await saveAccounts(header, accounts);
};

main().catch(console.error);
