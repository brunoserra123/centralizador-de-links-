const SITE_BASE_URL = "https://brunoserra123.github.io/centralizador-de-links-/";
const SECRET_HASH = "bb71b66ac008199e20b54841d10b9b75533e35c41af775653ed74fd35e2144bb";

// Elementos DOM
const inputContainer = document.getElementById('input-state-container');
const savedContainer = document.getElementById('saved-state-container');
const passwordInput = document.getElementById('popup-password');
const toggleEyeBtn = document.getElementById('toggle-pass-visibility');
const rememberCheckbox = document.getElementById('remember-password');
const unlockBtn = document.getElementById('unlock-open-btn');
const quickOpenBtn = document.getElementById('quick-open-btn');
const forgetPassBtn = document.getElementById('forget-pass-btn');
const openDirectBtn = document.getElementById('open-direct-btn');
const saveTabBtn = document.getElementById('save-current-tab-btn');
const errorMsg = document.getElementById('error-message');

// Gerar Hash SHA-256
async function hashPassword(password) {
    const data = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Abre uma aba ou foca na existente
async function openOrFocusTab(targetUrl) {
    try {
        const tabs = await chrome.tabs.query({});
        const existingTab = tabs.find(t => t.url && t.url.includes("centralizador-de-links-"));

        if (existingTab && existingTab.id) {
            await chrome.tabs.update(existingTab.id, { active: true, url: targetUrl });
            if (existingTab.windowId) {
                await chrome.windows.update(existingTab.windowId, { focused: true });
            }
        } else {
            await chrome.tabs.create({ url: targetUrl });
        }
    } catch (e) {
        // Fallback caso a API tabs falhe
        window.open(targetUrl, '_blank');
    } finally {
        window.close();
    }
}

// Inicialização: checa se tem senha salva
chrome.storage.local.get(['vault_saved_password'], async (result) => {
    const saved = result.vault_saved_password;
    if (saved) {
        try {
            if ((await hashPassword(saved)) === SECRET_HASH) {
                inputContainer.style.display = 'none';
                savedContainer.style.display = 'block';
                return;
            }
        } catch (e) { /* ignora */ }
    }

    // Se não tem ou é inválida, foca no input de senha
    inputContainer.style.display = 'block';
    savedContainer.style.display = 'none';
    setTimeout(() => passwordInput.focus(), 80);
});

// Desbloquear e Abrir
async function handleUnlock() {
    const pass = passwordInput.value;
    if (!pass) {
        passwordInput.focus();
        return;
    }

    unlockBtn.innerText = "Verificando...";
    unlockBtn.disabled = true;

    try {
        const hashed = await hashPassword(pass);
        if (hashed === SECRET_HASH) {
            if (rememberCheckbox.checked) {
                chrome.storage.local.set({ vault_saved_password: pass });
            }

            const targetUrl = SITE_BASE_URL + "#pass=" + encodeURIComponent(pass);
            await openOrFocusTab(targetUrl);
            return;
        }
    } catch (err) {
        console.error("Erro ao validar senha:", err);
    }

    // Senha Incorreta
    errorMsg.style.display = 'block';
    passwordInput.value = '';
    passwordInput.focus();
    unlockBtn.innerHTML = "<span>🔓 Desbloquear & Abrir</span>";
    unlockBtn.disabled = false;
}

// Eventos dos Botões
unlockBtn.addEventListener('click', handleUnlock);

passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleUnlock();
    } else {
        errorMsg.style.display = 'none';
    }
});

// Alternar visibilidade da senha
toggleEyeBtn.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleEyeBtn.innerText = '🙈';
    } else {
        passwordInput.type = 'password';
        toggleEyeBtn.innerText = '👁️';
    }
});

// Acesso com senha já salva
quickOpenBtn.addEventListener('click', () => {
    chrome.storage.local.get(['vault_saved_password'], async (result) => {
        const saved = result.vault_saved_password || "";
        const targetUrl = SITE_BASE_URL + (saved ? "#pass=" + encodeURIComponent(saved) : "");
        await openOrFocusTab(targetUrl);
    });
});

// Esquecer senha salva
forgetPassBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['vault_saved_password'], () => {
        savedContainer.style.display = 'none';
        inputContainer.style.display = 'block';
        passwordInput.value = '';
        setTimeout(() => passwordInput.focus(), 80);
    });
});

// Abrir Site Diretamente (sem passar senha pela extensão)
openDirectBtn.addEventListener('click', () => {
    openOrFocusTab(SITE_BASE_URL);
});

// Salvar Aba Atual no LinkVault
saveTabBtn.addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const title = tab ? (tab.title || "") : "";
        const url = tab ? (tab.url || "") : "";

        chrome.storage.local.get(['vault_saved_password'], async (result) => {
            const saved = result.vault_saved_password || passwordInput.value || "";
            let targetUrl = SITE_BASE_URL + "?add=true&title=" + encodeURIComponent(title) + "&url=" + encodeURIComponent(url);
            if (saved) {
                targetUrl += "#pass=" + encodeURIComponent(saved);
            }
            await openOrFocusTab(targetUrl);
        });
    } catch (e) {
        openOrFocusTab(SITE_BASE_URL + "?add=true");
    }
});
