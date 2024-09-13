import { exec } from 'child_process';

const runScript = () => {
  exec('node index.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`Erro ao executar o script: ${error}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    console.log(`${stdout}`);
  });
};

// Executa o script a cada 30 minutos (30 * 60 * 1000 ms)
setInterval(runScript, 30 * 60 * 1000);
runScript();
