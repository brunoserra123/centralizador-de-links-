const express = require('express');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve os arquivos estáticos (HTML, CSS, JS, CSV)
app.use(express.static(__dirname));

// Rota para rodar o bat
app.post('/api/atualizar', (req, res) => {
    console.log('Iniciando atualização do site...');
    
    // Executa o arquivo bat
    exec('atualizar_site.bat', (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro: ${error.message}`);
            return res.status(500).json({ success: false, message: 'Erro ao atualizar o site.' });
        }
        if (stderr) {
            console.error(`Stderr: ${stderr}`);
        }
        console.log(`Resultado:\n${stdout}`);
        res.json({ success: true, message: 'Site atualizado com sucesso!' });
    });
});

app.listen(PORT, () => {
    console.log(`====================================`);
    console.log(`🚀 SERVIDOR LOCAL RODANDO`);
    console.log(`Acesse: http://localhost:${PORT}`);
    console.log(`====================================`);
});
