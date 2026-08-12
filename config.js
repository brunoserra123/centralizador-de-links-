// Configuração do Robozinho 🤖
window.ROBOT_CONFIG = {
    // Token do GitHub armazenado em Base64
    TOKEN_B64: "", 
    OWNER: "brunoserra123",
    REPO: "centralizador-de-links-",

    // Retorna o token configurado no arquivo ou do localStorage
    getToken: function() {
        if (this.TOKEN_B64 && this.TOKEN_B64.trim()) {
            try {
                return atob(this.TOKEN_B64.trim());
            } catch (e) {
                return this.TOKEN_B64.trim();
            }
        }
        return localStorage.getItem('gh_token') || "";
    }
};
