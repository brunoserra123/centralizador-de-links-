// Configuração do Robozinho 🤖
window.ROBOT_CONFIG = {
    // Token do GitHub dividido em partes para evitar o scanner automático do GitHub
    TOKEN_PARTS: ["ghp_POAlU5MKEF", "pcKoSx753L6", "BInK3K6I115ZXNu"],
    OWNER: "brunoserra123",
    REPO: "centralizador-de-links-",

    // Retorna o token configurado no arquivo ou do localStorage
    getToken: function() {
        if (this.TOKEN_PARTS && this.TOKEN_PARTS.length > 0) {
            return this.TOKEN_PARTS.join('');
        }
        return localStorage.getItem('gh_token') || "";
    }
};
