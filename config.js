// Configuração do Robozinho 🤖
// ATENÇÃO: este arquivo é PÚBLICO (vai para o GitHub Pages). Nunca coloque token aqui.
// O token fica só no navegador (localStorage) ou no config.local.js (ignorado pelo git).
window.ROBOT_CONFIG = {
    OWNER: "brunoserra123",
    REPO: "centralizador-de-links-",

    // Retorna o token salvo neste navegador
    getToken: function() {
        return localStorage.getItem('gh_token') || "";
    }
};
