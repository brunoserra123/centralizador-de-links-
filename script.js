// ==================== ESTADO ====================
// currentLinks  = o que aparece na tela (CSV do site + alterações pendentes)
// localCustomLinks = SÓ as alterações ainda não publicadas (adições e edições)
// deletedKeys   = chaves dos links excluídos ainda não publicados
// Depois que você publica e o CSV do site já reflete a mudança, as pendências são limpas sozinhas.
let currentLinks = [];
let localCustomLinks = loadJSON('custom_links', []);
let deletedKeys = loadJSON('deleted_links', []);
let editingIndex = null;
let categoryUserEdited = false; // Rastreia se o usuário alterou a categoria manualmente
let activeCategory = 'Todos';
let searchQuery = '';

const MOST_ACCESSED = '🔥 Mais Acessados';

// ==================== HELPERS ====================
function loadJSON(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value === null || value === undefined ? fallback : value;
    } catch (e) {
        return fallback;
    }
}

function saveJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        showToast('Armazenamento cheio', 'Não foi possível guardar as alterações neste navegador. Publique os links e limpe imagens grandes.', 'error');
        return false;
    }
}

function persistPending() {
    saveJSON('custom_links', localCustomLinks);
    saveJSON('deleted_links', deletedKeys);
}

// Remove acentos e converte para minúsculas
function cleanString(str) {
    return String(str || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim();
}

function escapeHTML(str) {
    return String(str === undefined || str === null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Só aceita http/https; qualquer outra coisa (ex.: "javascript:") vira https://...
function toFullUrl(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    return /^https?:\/\//i.test(u) ? u : 'https://' + u;
}

// Identificador estável de um link (URL sem protocolo/www/barra final)
function linkKey(link) {
    const url = String(link && link.url || '').trim().toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/+$/, '');
    return url || 'titulo:' + cleanString(link && link.title);
}

function sameContent(a, b) {
    return ['title', 'description', 'url', 'icon', 'category'].every(k => String(a[k] || '').trim() === String(b[k] || '').trim());
}

function debounce(fn, ms) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

// ==================== CARREGAR LINKS ====================
function applyCsvText(csvText, canPrune) {
    const results = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const parsed = results.data
        .map(normalizeLink)
        .filter(item => item !== null && (item.title || item.url));

    if (canPrune) pruneSyncedPending(parsed);
    currentLinks = mergeLinks(parsed, localCustomLinks, deletedKeys);
    renderLinks();
}

async function fetchLinks() {
    try {
        const response = await fetch('links.csv?t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) throw new Error('Falha ao carregar o arquivo links.csv');

        const csvText = await response.text();
        applyCsvText(csvText, true);
        try { localStorage.setItem('csv_cache', csvText); } catch (e) { /* CSV grande demais: segue sem cache */ }
    } catch (err) {
        console.error("Erro ao buscar links do arquivo links.csv:", err);
        // Offline / erro: usa a última cópia do CSV que deu certo (sem limpar pendências)
        const cached = localStorage.getItem('csv_cache');
        if (cached) {
            applyCsvText(cached, false);
            showToast('Modo offline', 'Mostrando a última lista salva neste aparelho.', 'info');
        } else {
            currentLinks = [...localCustomLinks];
            renderLinks();
        }
    }
}

// Normaliza os nomes das colunas (aceita maiúsculas, minúsculas, acentos e nomes em PT-BR)
function normalizeLink(rawLink) {
    if (!rawLink || typeof rawLink !== 'object') return null;
    const link = {};
    for (const key of Object.keys(rawLink)) {
        if (key) {
            const cleanKey = key.trim().toLowerCase()
                .normalize("NFD").replace(/[̀-ͯ]/g, ""); // remove acentos
            link[cleanKey] = String(rawLink[key] || '').trim();
        }
    }
    const title = link.title || link.nome || link.site || link.nome_do_site || '';
    const description = link.description || link.descricao || link.detalhes || '';
    const url = link.url || link.link || link.endereco || '';
    const icon = link.icon || link.icone || link.emoji || link.image || link.imagem || '';
    const category = link.category || link.categoria || 'Geral';
    // Sem data no CSV = sem data. (Antes usava "agora", e todo link antigo aparecia como "adicionado hoje".)
    const createdAt = link.createdat || link.criado_em || link.data || '';

    if (!title && !url) return null;
    return { title, description, url, icon, category, createdAt };
}

// Aplica as pendências locais por cima do CSV do site
function mergeLinks(csvLinks, localLinks, deleted) {
    const deletedSet = new Set(deleted || []);
    const combined = csvLinks.filter(item => !deletedSet.has(linkKey(item)));

    localLinks.forEach(localItem => {
        const key = linkKey(localItem);
        const index = combined.findIndex(item => linkKey(item) === key);
        if (index !== -1) {
            combined[index] = localItem;
        } else {
            combined.push(localItem);
        }
    });

    return combined;
}

// Descarta pendências que o CSV do site já reflete (ou seja, já foram publicadas)
function pruneSyncedPending(csvLinks) {
    // Migração única: a versão antiga guardava um "retrato" inteiro e casava por título.
    if (!localStorage.getItem('pending_v2')) {
        localCustomLinks.forEach(localItem => {
            csvLinks.forEach(csvItem => {
                if (cleanString(csvItem.title) && cleanString(csvItem.title) === cleanString(localItem.title) && linkKey(csvItem) !== linkKey(localItem)) {
                    const k = linkKey(csvItem);
                    if (!deletedKeys.includes(k)) deletedKeys.push(k);
                }
            });
        });
        try { localStorage.setItem('pending_v2', '1'); } catch (e) { /* ignora */ }
    }

    const csvByKey = new Map(csvLinks.map(item => [linkKey(item), item]));
    const beforeLocal = localCustomLinks.length;
    const beforeDeleted = deletedKeys.length;

    localCustomLinks = localCustomLinks.filter(item => {
        const csvItem = csvByKey.get(linkKey(item));
        return !(csvItem && sameContent(csvItem, item));
    });
    deletedKeys = deletedKeys.filter(k => csvByKey.has(k));

    if (localCustomLinks.length !== beforeLocal || deletedKeys.length !== beforeDeleted || beforeLocal > 0) {
        persistPending();
    }
}

function getLinks() {
    return currentLinks;
}

// ==================== CATEGORIAS ====================
// Encontra a categoria existente correspondente (ignorando maiúsculas/minúsculas e acentos)
function findExistingCategoryMatch(enteredCategory) {
    if (!enteredCategory || !enteredCategory.trim()) return 'Geral';
    const cleanEntered = cleanString(enteredCategory);

    const existingCategories = [...new Set(currentLinks.map(l => (l.category || '').trim()).filter(Boolean))];
    const match = existingCategories.find(cat => cleanString(cat) === cleanEntered);
    return match || enteredCategory.trim();
}

// Palavras curtas (até 3 letras, como "ai", "ia", "dev") só valem como palavra inteira,
// para "email" ou "main" não virarem "A.I".
function keywordMatches(text, keyword) {
    if (keyword.length <= 3) {
        return new RegExp('(^|[^a-z0-9])' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(text);
    }
    return text.includes(keyword);
}

// Auto-detecta a categoria ideal com base em palavras-chave no URL, Título e Descrição
function detectCategoryAutomatically(url, title, description) {
    const textToSearch = cleanString(`${url} ${title} ${description}`);
    if (!textToSearch) return null;

    const rules = [
        {
            category: "Impressão 3D",
            keywords: ["3d", "stl", "thingiverse", "printables", "makerworld", "imagetostl", "creality", "bambu", "bambulab", "slicer", "klipper", "octoprint", "filament", "impressora", "impressao", "thangs", "cults3d", "myminifactory", "entregastl"]
        },
        {
            category: "A.I",
            keywords: ["gemini", "chatgpt", "openai", "claude", "ai", "ia", "inteligencia", "lovable", "anthropic", "deepseek", "midjourney", "copilot"]
        },
        {
            category: "Desenvolvimento",
            keywords: ["github", "gitlab", "code", "dev", "stackoverflow", "vscode", "script", "api", "npm", "python", "javascript", "html", "css"]
        },
        {
            category: "PS5",
            keywords: ["ps5", "playstation", "superpsx", "game", "jogos", "ps4", "console", "sony"]
        },
        {
            category: "Automação",
            keywords: ["sinric", "homeassistant", "tuya", "alexa", "automation", "automacao", "esp32", "arduino", "sonoff"]
        },
        {
            category: "Ferramentas",
            keywords: ["convert", "svg", "tool", "ferramenta", "picsvg", "canva", "pdf", "calculadora"]
        }
    ];

    for (const rule of rules) {
        if (rule.keywords.some(keyword => keywordMatches(textToSearch, keyword))) {
            return findExistingCategoryMatch(rule.category);
        }
    }
    return null;
}

function updateCategoryDatalist() {
    const datalist = document.getElementById('existing-categories');
    if (!datalist) return;

    datalist.innerHTML = '';
    const categories = [...new Set(currentLinks.map(l => l.category ? l.category.trim() : 'Geral').filter(Boolean))];
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        datalist.appendChild(option);
    });
}

// ==================== CONTAGEM DE CLIQUES ====================
function getClickCount(url) {
    const full = toFullUrl(url);
    if (!full) return 0;
    const clicks = loadJSON('link_clicks', {});
    return clicks[full] || 0;
}

function incrementClickCount(url) {
    const full = toFullUrl(url);
    if (!full) return;
    const clicks = loadJSON('link_clicks', {});
    clicks[full] = (clicks[full] || 0) + 1;
    saveJSON('link_clicks', clicks);
}

// ==================== CARDS ====================
async function shareLink(link, url) {
    if (navigator.share) {
        try {
            await navigator.share({ title: link.title || url, text: link.description || '', url });
            return;
        } catch (e) {
            if (e && e.name === 'AbortError') return;
        }
    }
    try {
        await navigator.clipboard.writeText(url);
        showToast('Link copiado', url, 'success');
    } catch (e) {
        prompt('Copie o link:', url);
    }
}

function createLinkCard(link, index) {
    const a = document.createElement('a');

    const finalUrl = toFullUrl(link.url);
    a.href = finalUrl || '#';
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "link-card";
    a.dataset.index = index;

    let iconContent = link.icon ? link.icon.trim() : "";

    if (iconContent.startsWith('data:image/') || /\.(webp|png|jpg|jpeg|gif|svg|ico)(\?.*)?$/i.test(iconContent)) {
        iconContent = `<img src="${escapeHTML(iconContent)}" alt="" loading="lazy" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">`;
    } else if (!iconContent) {
        try {
            const urlObj = new URL(finalUrl);
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(urlObj.hostname)}&sz=64`;
            iconContent = `<img src="${escapeHTML(faviconUrl)}" alt="" loading="lazy" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">`;
        } catch (e) {
            iconContent = '🌐';
        }
    } else {
        iconContent = escapeHTML(iconContent); // emoji / texto
    }

    const clicks = getClickCount(finalUrl);
    const clickBadge = clicks > 0 ? `<span class="tag" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);">🔥 ${clicks}</span>` : '';
    const tags = (link.category ? `<span class="tag">#${escapeHTML(link.category.toLowerCase().replace(/\s+/g, ''))}</span>` : '') + clickBadge;

    // Data: só mostra quando existe (e é válida)
    let dateStr = '';
    if (link.createdAt) {
        const createdDate = new Date(link.createdAt);
        if (!isNaN(createdDate.getTime())) {
            dateStr = 'Adicionado em ' + createdDate.toLocaleDateString('pt-BR');
        }
    }

    a.innerHTML = `
        <div class="card-header-mobile">
            <div class="card-icon">${iconContent}</div>
            <div class="card-content">
                <h3 class="card-title">${escapeHTML(link.title || 'Sem título')}</h3>
                <p class="card-description">${escapeHTML(link.description || '')}</p>
                <div class="card-time-mobile">${escapeHTML(dateStr)}</div>
            </div>
            <button class="more-options-btn" type="button" aria-label="Editar link" title="Editar">...</button>
        </div>
        <div class="card-footer-mobile">
            <div class="card-tags">${tags}</div>
            <div class="card-actions-mobile">
                <button class="action-btn-mobile edit-card-btn-mobile" type="button">Edit</button>
                <button class="action-btn-mobile share-card-btn" type="button">Share</button>
            </div>
        </div>
    `;

    const wire = (selector, handler) => {
        const el = a.querySelector(selector);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();   // não abre o link
                e.stopPropagation();
                handler();
            });
        }
    };
    wire('.edit-card-btn-mobile', () => openModalForEdit(link, index));
    wire('.more-options-btn', () => openModalForEdit(link, index));
    wire('.share-card-btn', () => finalUrl && shareLink(link, finalUrl));

    a.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        incrementClickCount(finalUrl);
    });

    return a;
}

function renderLinks() {
    const container = document.getElementById('links-container');
    const tabsContainer = document.getElementById('tabs-container');
    if (!container || !tabsContainer) return;

    const linksData = getLinks();

    // 1. Categorias únicas
    const categories = ['Todos', MOST_ACCESSED];
    linksData.forEach(link => {
        const cat = (link.category && link.category.trim()) ? link.category.trim() : 'Geral';
        if (!categories.includes(cat)) categories.push(cat);
    });

    // Se a categoria ativa sumiu (ex.: excluiu o último link dela), volta para "Todos"
    if (!categories.includes(activeCategory)) activeCategory = 'Todos';

    // 2. Abas
    tabsContainer.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        if (cat === activeCategory) btn.classList.add('active');
        btn.setAttribute('aria-pressed', cat === activeCategory ? 'true' : 'false');
        btn.innerText = cat;
        btn.addEventListener('click', () => {
            activeCategory = cat;
            renderLinks();
        });
        tabsContainer.appendChild(btn);
    });

    // 3. Filtro
    const cleanSearch = cleanString(searchQuery);
    const filteredLinks = linksData.filter(link => {
        const matchesSearch = !cleanSearch ||
            cleanString(link.title).includes(cleanSearch) ||
            cleanString(link.description).includes(cleanSearch) ||
            cleanString(link.url).includes(cleanSearch);

        if (activeCategory === MOST_ACCESSED) {
            return getClickCount(link.url) > 0 && matchesSearch;
        }

        const linkCat = (link.category && link.category.trim()) ? link.category.trim() : 'Geral';
        return (activeCategory === 'Todos' || linkCat === activeCategory) && matchesSearch;
    });

    if (activeCategory === MOST_ACCESSED) {
        filteredLinks.sort((a, b) => getClickCount(b.url) - getClickCount(a.url));
    }

    // 4. Cards
    container.innerHTML = '';
    if (filteredLinks.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1; padding: 2rem;">Nenhum link encontrado.</p>';
        updateCategoryDatalist();
        return;
    }

    filteredLinks.forEach(link => {
        const globalIndex = currentLinks.indexOf(link);
        container.appendChild(createLinkCard(link, globalIndex));
    });

    updateCategoryDatalist();
}

// ==================== MODAIS ====================
function openModalForAdd() {
    editingIndex = null;
    categoryUserEdited = false;

    document.getElementById('modal-title').innerText = 'Novo Link';
    document.getElementById('save-link-btn').innerText = 'Salvar Link';
    document.getElementById('delete-link-btn').style.display = 'none';

    document.getElementById('add-link-form').reset();
    document.getElementById('link-id').value = '';

    updateCategoryDatalist();
    openOverlay('modal-overlay', 'link-title');
}

function openModalForEdit(link, index) {
    editingIndex = index;
    categoryUserEdited = true; // Ao editar, preserva a categoria a menos que alterada

    document.getElementById('modal-title').innerText = 'Editar Link';
    document.getElementById('save-link-btn').innerText = 'Salvar Alterações';
    document.getElementById('delete-link-btn').style.display = 'block';
    document.getElementById('add-link-form').reset();

    document.getElementById('link-id').value = index;
    document.getElementById('link-title').value = link.title || '';
    document.getElementById('link-desc').value = link.description || '';
    document.getElementById('link-url').value = link.url || '';
    document.getElementById('link-category').value = link.category || '';
    // Imagens em base64 não vão para o campo de emoji (ficam preservadas ao salvar)
    const icon = link.icon || '';
    document.getElementById('link-icon').value = icon.startsWith('data:') ? '' : icon;

    updateCategoryDatalist();
    openOverlay('modal-overlay', 'link-title');
}

function openOverlay(id, focusId) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('active');
    if (focusId) setTimeout(() => { const el = document.getElementById(focusId); if (el) el.focus(); }, 50);
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay.active').forEach(el => el.classList.remove('active'));
}

function openRobotModal() {
    const tokenInput = document.getElementById('github-token');
    if (tokenInput) tokenInput.value = localStorage.getItem('gh_token') || '';
    openOverlay('robot-modal-overlay', 'github-token');
}

// ==================== TOAST ====================
// action (opcional): { label, onClick } — ex.: botão "Desfazer"
function showToast(title, bodyText, type = 'success', urlPreview = null, action = null) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }

    const icons = { success: '✨', warning: '⚠️', error: '❌', info: '📱' };

    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const iconEl = document.createElement('div');
    iconEl.className = 'toast-icon';
    iconEl.textContent = icons[type] || '💡';

    const content = document.createElement('div');
    content.className = 'toast-content';

    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = title;
    content.appendChild(titleEl);

    if (bodyText) {
        const bodyEl = document.createElement('div');
        bodyEl.className = 'toast-body';
        bodyEl.textContent = bodyText;
        content.appendChild(bodyEl);
    }

    if (urlPreview) {
        const urlBox = document.createElement('div');
        urlBox.className = 'toast-url-box';
        urlBox.textContent = urlPreview;
        content.appendChild(urlBox);
    }

    const dismiss = () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    };

    if (action && action.label) {
        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'toast-action';
        actionBtn.textContent = action.label;
        actionBtn.addEventListener('click', () => {
            dismiss();
            if (typeof action.onClick === 'function') action.onClick();
        });
        content.appendChild(actionBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close';
    closeBtn.title = 'Fechar';
    closeBtn.setAttribute('aria-label', 'Fechar aviso');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', dismiss);

    toast.append(iconEl, content, closeBtn);
    container.appendChild(toast);

    setTimeout(() => { if (toast.parentNode) dismiss(); }, action ? 9000 : 6000);
}

// ==================== ROBOZINHO (PUBLICAÇÃO NO GITHUB) ====================
async function syncWithRobot() {
    const robotBtn = document.getElementById('robot-sync-btn');
    if (!robotBtn) return;

    const originalText = robotBtn.innerHTML;
    robotBtn.innerHTML = "🤖 Publicando...";
    robotBtn.disabled = true;

    try {
        const csvContent = Papa.unparse(currentLinks, {
            columns: ["title", "description", "url", "icon", "category", "createdAt"]
        });

        // 1. Modo HTA/ActiveX (executando localmente no Windows)
        if (typeof window.ActiveXObject !== 'undefined' || typeof WScript !== 'undefined') {
            try {
                const fso = new ActiveXObject("Scripting.FileSystemObject");
                const file = fso.CreateTextFile("links.csv", true, true);
                file.Write("﻿" + csvContent);
                file.Close();

                const shell = new ActiveXObject("WScript.Shell");
                shell.Run("cmd.exe /c atualizar_site.bat", 0, false);

                showToast('Robozinho atualizou o site', 'Seu site no GitHub estará atualizado em 1 a 2 minutos.', 'success');
                return;
            } catch (errLocal) {
                console.log("Modo ActiveX não disponível, prosseguindo via API:", errLocal);
            }
        }

        // 2. Modo API do GitHub (navegador / celular)
        const cfg = window.ROBOT_CONFIG || {};
        const token = cfg.LOCAL_TOKEN || (typeof cfg.getToken === 'function' ? cfg.getToken() : null) || localStorage.getItem('gh_token');

        if (cfg.LOCAL_TOKEN) {
            try { localStorage.setItem('gh_token', cfg.LOCAL_TOKEN); } catch (e) { /* ignora */ }
        }

        if (!token) {
            openRobotModal();
            return;
        }

        await publishToGitHubAPI(token, csvContent);

        showToast('Links publicados 🎉', 'O Robozinho enviou tudo para o GitHub. O site atualiza em 1 a 2 minutos.', 'success');
    } catch (err) {
        console.error("Erro na publicação do Robozinho:", err);

        let errorMsg = err.message || "";
        if (errorMsg.includes("Bad credentials") || errorMsg.includes("401")) {
            errorMsg = "Token inválido (credenciais incorretas)";
        } else if (errorMsg.includes("Not Found") || errorMsg.includes("404")) {
            errorMsg = "Repositório ou arquivo não encontrado no GitHub";
        } else if (errorMsg.includes("Forbidden") || errorMsg.includes("403")) {
            errorMsg = "Acesso negado (verifique as permissões do token)";
        }

        showToast('Erro ao publicar', errorMsg + '. Verifique o seu Token do GitHub.', 'error');

        const cleanMsg = String(err.message || "").toLowerCase();
        if (cleanMsg.includes('401') || cleanMsg.includes('credentials') || cleanMsg.includes('token') || cleanMsg.includes('403')) {
            openRobotModal();
        }
    } finally {
        robotBtn.innerHTML = originalText;
        robotBtn.disabled = false;
    }
}

// Envio direto para o GitHub via REST API
async function publishToGitHubAPI(token, csvText) {
    const cfg = window.ROBOT_CONFIG || {};
    const owner = cfg.OWNER || "brunoserra123";
    const repo = cfg.REPO || "centralizador-de-links-";
    const path = "links.csv";
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers = {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json"
    };

    // 1. SHA do links.csv atual
    const getRes = await fetch(apiUrl, { headers });
    let sha = "";
    if (getRes.ok) {
        sha = (await getRes.json()).sha;
    } else if (getRes.status !== 404) {
        const errJson = await getRes.json().catch(() => ({}));
        throw new Error(errJson.message || `Erro HTTP ${getRes.status}`);
    }

    // UTF-8 -> Base64
    const dataBytes = new TextEncoder().encode("﻿" + csvText);
    let binary = '';
    for (let i = 0; i < dataBytes.byteLength; i++) {
        binary += String.fromCharCode(dataBytes[i]);
    }

    // 2. Commit
    const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
            message: "🤖 Atualizacao automatica de links pelo Robozinho",
            content: btoa(binary),
            sha: sha || undefined
        })
    });

    if (!putRes.ok) {
        const errorJson = await putRes.json().catch(() => ({}));
        throw new Error(errorJson.message || `Erro HTTP ${putRes.status}`);
    }
}

// ==================== AÇÕES: SALVAR, EXCLUIR, IMPORTAR ====================
function findDuplicate(link, ignoreIndex = null) {
    const key = linkKey(link);
    return currentLinks.findIndex((item, i) => i !== ignoreIndex && linkKey(item) === key);
}

function upsertPending(link) {
    const key = linkKey(link);
    localCustomLinks = localCustomLinks.filter(l => linkKey(l) !== key);
    localCustomLinks.push(link);
    deletedKeys = deletedKeys.filter(k => k !== key);
}

function deleteLinkAt(index) {
    const removed = currentLinks[index];
    const snapshot = {
        links: currentLinks.map(l => ({ ...l })),
        local: localCustomLinks.map(l => ({ ...l })),
        deleted: [...deletedKeys]
    };

    const key = linkKey(removed);
    currentLinks.splice(index, 1);
    localCustomLinks = localCustomLinks.filter(l => linkKey(l) !== key);
    if (!deletedKeys.includes(key)) deletedKeys.push(key);
    persistPending();
    renderLinks();

    showToast('Link excluído', `"${removed.title || removed.url}" foi removido.`, 'warning', null, {
        label: '↩ Desfazer',
        onClick: () => {
            currentLinks = snapshot.links;
            localCustomLinks = snapshot.local;
            deletedKeys = snapshot.deleted;
            persistPending();
            renderLinks();
            showToast('Exclusão desfeita', '', 'success');
        }
    });
}

// Reduz a imagem enviada para um ícone pequeno (evita CSV gigante)
function processIconFile(file, maxSize = 96) {
    return new Promise((resolve) => {
        const fallbackRaw = () => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
        };

        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                const w = img.naturalWidth, h = img.naturalHeight;
                if (!w || !h) throw new Error('sem dimensões');
                const scale = Math.min(1, maxSize / Math.max(w, h));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(w * scale));
                canvas.height = Math.max(1, Math.round(h * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                let dataUrl = canvas.toDataURL('image/webp', 0.85);
                if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/png');
                URL.revokeObjectURL(objectUrl);
                resolve(dataUrl);
            } catch (e) {
                URL.revokeObjectURL(objectUrl);
                fallbackRaw();
            }
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); fallbackRaw(); };
        img.src = objectUrl;
    });
}

async function importCSVFile(file) {
    try {
        const text = await file.text();
        const results = Papa.parse(text, { header: true, skipEmptyLines: true });
        const imported = results.data.map(normalizeLink).filter(item => item && (item.title || item.url));
        let added = 0, skipped = 0;

        imported.forEach(item => {
            if (!item.createdAt) item.createdAt = new Date().toISOString();
            item.category = findExistingCategoryMatch(item.category);
            if (findDuplicate(item) !== -1) {
                skipped++;
                return;
            }
            currentLinks.push(item);
            upsertPending(item);
            added++;
        });

        persistPending();
        renderLinks();
        showToast('Importação concluída', `${added} link(s) adicionado(s)` + (skipped ? `, ${skipped} já existiam.` : '.'), added ? 'success' : 'warning');
    } catch (e) {
        console.error(e);
        showToast('Erro ao importar', 'Não consegui ler esse arquivo CSV.', 'error');
    }
}

// ==================== INTERFACE ====================
function setupUI() {
    const addBtn = document.getElementById('add-link-btn');
    const robotSyncBtn = document.getElementById('robot-sync-btn');
    const exportBtn = document.getElementById('export-csv-btn');
    const importBtn = document.getElementById('import-csv-btn');
    const importInput = document.getElementById('import-csv-input');
    const modalOverlay = document.getElementById('modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const addLinkForm = document.getElementById('add-link-form');
    const deleteBtn = document.getElementById('delete-link-btn');

    const robotModalOverlay = document.getElementById('robot-modal-overlay');
    const closeRobotModalBtn = document.getElementById('close-robot-modal-btn');
    const saveTokenBtn = document.getElementById('save-token-btn');
    const tokenInput = document.getElementById('github-token');

    const urlInput = document.getElementById('link-url');
    const titleInput = document.getElementById('link-title');
    const descInput = document.getElementById('link-desc');
    const categoryInput = document.getElementById('link-category');

    // Busca em tempo real (com debounce)
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            searchQuery = e.target.value;
            renderLinks();
        }, 120));
    }

    // Atalhos: "/" foca a busca, Esc fecha modais
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
            return;
        }
        const typing = /^(input|textarea|select)$/i.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
        if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
    });

    if (robotSyncBtn) robotSyncBtn.addEventListener('click', () => syncWithRobot());

    // Ativar Novo Navegador 📱 (Link Mágico)
    const copyMagicLinkBtn = document.getElementById('copy-magic-link-btn');
    if (copyMagicLinkBtn) {
        copyMagicLinkBtn.addEventListener('click', () => {
            const cfg = window.ROBOT_CONFIG || {};
            const token = cfg.LOCAL_TOKEN || localStorage.getItem('gh_token') || '';
            if (!token) {
                showToast("Token não configurado", "Nenhum token está salvo neste navegador ainda. Clique em '🤖 Publicar no Ar' para inserir sua chave!", "warning");
                openRobotModal();
                return;
            }
            const base = window.location.origin + window.location.pathname;
            const magicUrl = `${base}#token=${token}`;

            const handleSuccess = () => {
                const originalText = copyMagicLinkBtn.innerHTML;
                copyMagicLinkBtn.innerHTML = '✨ Link Mágico Copiado! ✅';
                copyMagicLinkBtn.classList.add('btn-success-glow');
                setTimeout(() => {
                    copyMagicLinkBtn.innerHTML = originalText;
                    copyMagicLinkBtn.classList.remove('btn-success-glow');
                }, 3000);

                // O token não é exibido na tela
                showToast(
                    "Link Mágico copiado 📱",
                    "Abra este link no celular ou em outro navegador para ativar o Robozinho. Ele contém o seu token: não compartilhe.",
                    "success",
                    `${base}#token=••••••••`
                );
            };

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(magicUrl).then(handleSuccess).catch(() => {
                    prompt("Copie seu Link Mágico para abrir em outro navegador/celular:", magicUrl);
                });
            } else {
                prompt("Copie seu Link Mágico para abrir em outro navegador/celular:", magicUrl);
            }
        });
    }

    // Modal do Robozinho (Token)
    if (closeRobotModalBtn && robotModalOverlay) {
        closeRobotModalBtn.addEventListener('click', () => robotModalOverlay.classList.remove('active'));
    }
    if (robotModalOverlay) {
        robotModalOverlay.addEventListener('click', (e) => {
            if (e.target === robotModalOverlay) robotModalOverlay.classList.remove('active');
        });
    }

    if (saveTokenBtn && tokenInput) {
        saveTokenBtn.addEventListener('click', () => {
            let tokenValue = tokenInput.value.trim();
            if (!tokenValue) {
                showToast('Token vazio', 'Por favor, cole um Token válido do GitHub.', 'warning');
                return;
            }
            // Se colou a URL do Link Mágico inteira por engano
            if (tokenValue.includes('token=')) {
                const parts = tokenValue.split('token=');
                tokenValue = parts[parts.length - 1].split('&')[0].trim();
            }
            try { localStorage.setItem('gh_token', tokenValue); } catch (e) { /* ignora */ }
            if (robotModalOverlay) robotModalOverlay.classList.remove('active');
            syncWithRobot();
        });
    }

    // Categoria digitada manualmente não é sobrescrita pela sugestão automática
    if (categoryInput) {
        categoryInput.addEventListener('input', () => {
            if (categoryInput.value.trim().length > 0) categoryUserEdited = true;
        });
    }

    const triggerAutoCategory = () => {
        if (categoryUserEdited) return;
        const autoCat = detectCategoryAutomatically(urlInput.value, titleInput.value, descInput.value);
        if (autoCat && categoryInput) categoryInput.value = autoCat;
    };
    [urlInput, titleInput, descInput].forEach(el => el && el.addEventListener('input', triggerAutoCategory));

    // Abrir modal de novo link (desktop e FAB mobile)
    if (addBtn) addBtn.addEventListener('click', openModalForAdd);
    const fabAddBtn = document.getElementById('fab-add-link-btn');
    if (fabAddBtn) fabAddBtn.addEventListener('click', openModalForAdd);

    // Fechar modal
    if (closeModalBtn && modalOverlay) {
        closeModalBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
    }
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) modalOverlay.classList.remove('active');
        });
    }

    // Excluir (com "Desfazer")
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (editingIndex === null || editingIndex < 0 || editingIndex >= currentLinks.length) return;
            const target = currentLinks[editingIndex];
            if (!confirm(`Tem certeza que deseja excluir o link "${target.title || target.url}"?`)) return;
            deleteLinkAt(editingIndex);
            modalOverlay.classList.remove('active');
        });
    }

    // Salvar (novo ou editado)
    if (addLinkForm) {
        addLinkForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = titleInput.value.trim();
            const description = descInput.value.trim();
            const url = urlInput.value.trim();
            const category = findExistingCategoryMatch(categoryInput.value.trim());
            const iconInput = document.getElementById('link-icon').value.trim();
            const imageFileInput = document.getElementById('link-image');
            const isEditing = editingIndex !== null && editingIndex >= 0 && editingIndex < currentLinks.length;
            const original = isEditing ? currentLinks[editingIndex] : null;

            // Ícone: arquivo novo > emoji digitado > ícone que já existia
            let icon = iconInput;
            if (imageFileInput && imageFileInput.files && imageFileInput.files[0]) {
                icon = await processIconFile(imageFileInput.files[0]);
            } else if (isEditing && !icon) {
                icon = original.icon || '';
            }

            const createdAt = isEditing ? (original.createdAt || '') : new Date().toISOString();
            const updatedLink = { title, description, url, category, icon, createdAt };

            // Evita duplicados
            const dupIndex = findDuplicate(updatedLink, isEditing ? editingIndex : null);
            if (dupIndex !== -1) {
                showToast('Link já existe', `"${currentLinks[dupIndex].title || currentLinks[dupIndex].url}" já está na sua lista.`, 'warning');
                return;
            }

            if (isEditing) {
                const oldKey = linkKey(original);
                currentLinks[editingIndex] = updatedLink;
                if (oldKey !== linkKey(updatedLink)) {
                    // URL mudou: o link antigo do CSV precisa sumir
                    localCustomLinks = localCustomLinks.filter(l => linkKey(l) !== oldKey);
                    if (!deletedKeys.includes(oldKey)) deletedKeys.push(oldKey);
                }
            } else {
                currentLinks.push(updatedLink);
            }
            upsertPending(updatedLink);
            persistPending();

            renderLinks();
            addLinkForm.reset();
            modalOverlay.classList.remove('active');
            showToast(`Link ${isEditing ? 'atualizado' : 'adicionado'}`, `"${title}" foi salvo. Clique em 🤖 Publicar no Ar para colocar no site.`, 'success');
        });
    }

    // Baixar / importar CSV
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', () => {
            if (importInput.files && importInput.files[0]) importCSVFile(importInput.files[0]);
            importInput.value = '';
        });
    }
}

function exportCSV() {
    if (currentLinks.length === 0) {
        showToast('Nada para exportar', 'Você ainda não tem links.', 'warning');
        return;
    }

    const csvData = Papa.unparse(currentLinks, {
        columns: ["title", "description", "url", "icon", "category", "createdAt"]
    });

    const blob = new Blob(["﻿" + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'links.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ==================== TELA DE BLOQUEIO ====================
// AVISO: isto é só uma barreira visual. O hash abaixo e o links.csv são públicos no GitHub Pages,
// então não protege os dados de quem sabe onde olhar. Para privacidade real, use repositório privado.
const SECRET_HASH = "bb71b66ac008199e20b54841d10b9b75533e35c41af775653ed74fd35e2144bb";

async function hashPassword(password) {
    const data = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Token vindo do Link Mágico (#token=...), processado só depois de desbloquear
function getPendingUrlToken() {
    try {
        let urlToken = null;
        if (window.location.hash.startsWith('#token=')) {
            urlToken = window.location.hash.substring(7);
        } else {
            urlToken = new URLSearchParams(window.location.search).get('token');
        }
        return urlToken && urlToken.trim() ? urlToken.trim() : null;
    } catch (e) {
        return null;
    }
}

function processPendingToken(token) {
    if (!token) return;

    let cleanToken = token.trim();
    if (cleanToken.includes('token=')) {
        const parts = cleanToken.split('token=');
        cleanToken = parts[parts.length - 1].split('&')[0].trim();
    }

    try { localStorage.setItem('gh_token', cleanToken); } catch (e) { /* ignora */ }
    // Limpa o token da barra de endereço
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

    setTimeout(() => {
        showToast("Navegador ativado 🤖🎉", "O Robozinho foi configurado neste navegador pelo seu Link Mágico.", "success");
    }, 600);
}

function initLockScreen() {
    const lockScreen = document.getElementById('lock-screen');
    const passwordInput = document.getElementById('site-password');
    const unlockBtn = document.getElementById('unlock-btn');
    const errorMsg = document.getElementById('lock-error');

    const pendingToken = getPendingUrlToken();
    let started = false;

    const onUnlockSuccess = () => {
        if (started) return;
        started = true;
        try { sessionStorage.setItem('site_unlocked', 'true'); } catch (e) { /* ignora */ }
        if (lockScreen) lockScreen.classList.remove('active');
        if (errorMsg) errorMsg.style.display = 'none';

        processPendingToken(pendingToken);

        fetchLinks();
        setupUI();
        setTimeout(checkUrlParams, 300);
    };

    if (!lockScreen) {
        onUnlockSuccess();
        return;
    }

    let alreadyUnlocked = false;
    try { alreadyUnlocked = sessionStorage.getItem('site_unlocked') === 'true'; } catch (e) { /* ignora */ }
    if (alreadyUnlocked) {
        onUnlockSuccess();
        return;
    }

    // Botão de biometria (se já houver registro neste aparelho)
    const biometricsBtn = document.getElementById('unlock-biometrics-btn');
    if (biometricsBtn && localStorage.getItem('webauthn_cred_id')) {
        biometricsBtn.style.display = 'block';
        biometricsBtn.addEventListener('click', async () => {
            biometricsBtn.innerText = "Reconhecendo...";
            const success = await unlockWithBiometrics();
            if (success) {
                onUnlockSuccess();
            } else {
                biometricsBtn.innerText = "🔑 Usar Biometria";
                errorMsg.innerText = "Falha ao reconhecer biometria.";
                errorMsg.style.display = 'block';
            }
        });
    }

    const tryUnlock = async () => {
        const pass = passwordInput.value;
        if (!pass) return;

        unlockBtn.innerText = "Verificando...";

        if (!(window.crypto && window.crypto.subtle)) {
            errorMsg.innerText = "Este navegador não permite verificar a senha aqui. Abra o site por HTTPS.";
            errorMsg.style.display = 'block';
            unlockBtn.innerText = "Desbloquear";
            return;
        }

        try {
            if ((await hashPassword(pass)) === SECRET_HASH) {
                onUnlockSuccess();
                return;
            }
        } catch (err) {
            console.error("Erro ao verificar senha:", err);
        }

        errorMsg.innerText = "Senha incorreta. Tente novamente.";
        errorMsg.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
        unlockBtn.innerText = "Desbloquear";
    };

    unlockBtn.addEventListener('click', tryUnlock);
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') tryUnlock();
    });

    setTimeout(() => passwordInput.focus(), 100);
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
    const registerBioBtn = document.getElementById('register-biometrics-btn');
    if (registerBioBtn) registerBioBtn.addEventListener('click', registerBiometrics);

    // Forçar atualização: remove service workers e caches e recarrega
    const forceReloadBtn = document.getElementById('force-reload-btn');
    if (forceReloadBtn) {
        forceReloadBtn.addEventListener('click', async () => {
            forceReloadBtn.innerText = "Atualizando...";

            if ('serviceWorker' in navigator) {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) await registration.unregister();
                } catch (e) { /* ignora */ }
            }
            if ('caches' in window) {
                try {
                    const names = await caches.keys();
                    await Promise.all(names.map(name => caches.delete(name)));
                } catch (e) { /* ignora */ }
            }

            window.location.href = window.location.pathname + '?reload=' + Date.now();
        });
    }

    initLockScreen();
});

// ==================== WEBAUTHN (BIOMETRIA / PASSKEYS) ====================
// Observação: a biometria só confirma que alguém com acesso ao aparelho passou pelo desbloqueio local.
// Não há servidor validando a assinatura, então funciona como conveniência, não como segurança forte.
function generateRandomBuffer(length) {
    return window.crypto.getRandomValues(new Uint8Array(length));
}

async function registerBiometrics() {
    if (!window.PublicKeyCredential) {
        showToast('Biometria indisponível', 'Seu navegador ou dispositivo não suporta Biometria/WebAuthn.', 'warning');
        return;
    }

    try {
        const publicKeyCredentialCreationOptions = {
            challenge: generateRandomBuffer(32),
            rp: {
                name: "LinkVault",
                id: window.location.hostname || "localhost",
            },
            user: {
                id: generateRandomBuffer(16),
                name: "admin",
                displayName: "Administrador",
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
            authenticatorSelection: {
                userVerification: "required"
            },
            timeout: 60000,
        };

        const credential = await navigator.credentials.create({ publicKey: publicKeyCredentialCreationOptions });

        const rawId = new Uint8Array(credential.rawId);
        localStorage.setItem('webauthn_cred_id', btoa(String.fromCharCode.apply(null, rawId)));

        showToast('Biometria configurada ✅', 'Na próxima vez que entrar, você verá a opção de usar sua digital ou Windows Hello.', 'success');
    } catch (e) {
        console.error("Erro ao registrar biometria:", e);
        if (e.name === 'NotAllowedError') {
            showToast('Cancelado', 'A configuração de biometria foi cancelada.', 'warning');
        } else {
            showToast('Falha na biometria', 'Certifique-se de estar usando HTTPS.', 'error');
        }
    }
}

async function unlockWithBiometrics() {
    const base64Id = localStorage.getItem('webauthn_cred_id');
    if (!base64Id) return false;

    try {
        const binaryString = atob(base64Id);
        const rawId = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            rawId[i] = binaryString.charCodeAt(i);
        }

        await navigator.credentials.get({
            publicKey: {
                challenge: generateRandomBuffer(32),
                allowCredentials: [{ id: rawId, type: 'public-key' }],
                userVerification: "required",
                timeout: 60000,
            }
        });
        return true;
    } catch (e) {
        console.error("Erro no reconhecimento biométrico:", e);
        return false;
    }
}

// ==================== PARÂMETROS DE URL ====================
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);

    // Veio de uma atualização forçada
    if (urlParams.has('reload')) {
        window.history.replaceState({}, document.title, window.location.pathname);
        showToast("Site atualizado ✨", "A versão mais recente foi carregada.", "success");
    }

    // Veio do Bookmarklet ("Extensão Web")
    if (urlParams.get('add') === 'true') {
        const title = urlParams.get('title') || '';
        const url = urlParams.get('url') || '';

        if (title || url) {
            window.history.replaceState({}, document.title, window.location.pathname);
            openModalForAdd();
            const titleInput = document.getElementById('link-title');
            const urlInput = document.getElementById('link-url');
            if (titleInput) titleInput.value = title;
            if (urlInput) urlInput.value = url;
            // Dispara a sugestão automática de categoria
            if (urlInput) urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
}
