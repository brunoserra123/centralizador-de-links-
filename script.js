// Estado global para armazenar os links na memória
let currentLinks = [];
let localCustomLinks = JSON.parse(localStorage.getItem('custom_links') || '[]');
let editingIndex = null;
let categoryUserEdited = false; // Rastreia se o usuário alterou a categoria manualmente

// Função para buscar links do CSV com prevenção de cache (cache busting)
async function fetchLinks() {
    try {
        const cacheBuster = `?t=${Date.now()}`;
        const response = await fetch('links.csv' + cacheBuster, { cache: 'no-store' });
        
        if (!response.ok) {
            throw new Error('Falha ao carregar o arquivo links.csv');
        }

        const csvText = await response.text();
        
        // Usa PapaParse para ler o CSV
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const parsed = results.data
                    .map(normalizeLink)
                    .filter(item => item !== null && (item.title || item.url));
                currentLinks = mergeLinks(parsed, localCustomLinks);
                renderLinks();
            }
        });
    } catch (err) {
        console.error("Erro ao buscar links do arquivo links.csv:", err);
        if (localCustomLinks.length > 0) {
            currentLinks = localCustomLinks;
        }
        renderLinks();
    }
}

// Normaliza os nomes das colunas (aceita maiúsculas, minúsculas, acentos e nomes em PT-BR)
function normalizeLink(rawLink) {
    if (!rawLink || typeof rawLink !== 'object') return null;
    const link = {};
    for (const key of Object.keys(rawLink)) {
        if (key) {
            const cleanKey = key.trim().toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove acentos
            link[cleanKey] = String(rawLink[key] || '').trim();
        }
    }
    const title = link.title || link.nome || link.site || link.nome_do_site || '';
    const description = link.description || link.descricao || link.detalhes || '';
    const url = link.url || link.link || link.endereco || '';
    const icon = link.icon || link.icone || link.emoji || link.image || link.imagem || '';
    const category = link.category || link.categoria || 'Geral';

    if (!title && !url) return null;
    return { title, description, url, icon, category };
}

// Combina os links do CSV com os links salvos no LocalStorage
function mergeLinks(csvLinks, localLinks) {
    const combined = [...csvLinks];
    
    // Substitui ou adiciona links locais
    localLinks.forEach(localItem => {
        const index = combined.findIndex(csvItem => 
            (csvItem.url && localItem.url && csvItem.url.trim().toLowerCase() === localItem.url.trim().toLowerCase()) ||
            (csvItem.title && localItem.title && csvItem.title.trim().toLowerCase() === localItem.title.trim().toLowerCase())
        );
        if (index !== -1) {
            combined[index] = localItem;
        } else {
            combined.push(localItem);
        }
    });
    
    return combined;
}

// Retorna os links atuais da memória
function getLinks() {
    return currentLinks;
}

// Helper para remover acentos e converter para minúsculas
function cleanString(str) {
    return String(str || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

// Encontra a categoria existente correspondente (ignorando maiúsculas/minúsculas e acentos)
function findExistingCategoryMatch(enteredCategory) {
    if (!enteredCategory || !enteredCategory.trim()) return 'Geral';
    const cleanEntered = cleanString(enteredCategory);
    
    // Obter todas as categorias existentes
    const existingCategories = [...new Set(currentLinks.map(l => (l.category || '').trim()).filter(Boolean))];
    
    // Procura por correspondência exata sem acento/case
    const match = existingCategories.find(cat => cleanString(cat) === cleanEntered);
    if (match) {
        return match; // Retorna a categoria formatada como já existe no sistema!
    }
    
    // Caso não exista, retorna a categoria digitada
    return enteredCategory.trim();
}

// Auto-detecta a categoria ideal com base em palavras-chave no URL, Título e Descrição
function detectCategoryAutomatically(url, title, description) {
    const textToSearch = cleanString(`${url} ${title} ${description}`);
    if (!textToSearch) return null;

    const rules = [
        {
            categoryKey: "impressao 3d",
            keywords: ["3d", "stl", "thingiverse", "printables", "makerworld", "imagetostl", "creality", "bambu", "bambulab", "slicer", "klipper", "octoprint", "filament", "impressora", "impressao", "thangs", "cults3d", "myminifactory", "entregastl"]
        },
        {
            categoryKey: "a.i",
            keywords: ["gemini", "chatgpt", "openai", "claude", "ai", "ia", "inteligencia", "lovable", "anthropic", "deepseek", "midjourney", "copilot"]
        },
        {
            categoryKey: "desenvolvimento",
            keywords: ["github", "gitlab", "code", "dev", "stackoverflow", "vscode", "script", "api", "npm", "python", "javascript", "html", "css"]
        },
        {
            categoryKey: "ps5",
            keywords: ["ps5", "playstation", "superpsx", "game", "jogos", "ps4", "console", "sony"]
        },
        {
            categoryKey: "automacao",
            keywords: ["sinric", "homeassistant", "tuya", "alexa", "automation", "automacao", "esp32", "arduino", "sonoff"]
        },
        {
            categoryKey: "ferramentas",
            keywords: ["convert", "svg", "tool", "ferramenta", "picsvg", "canva", "pdf", "calculadora"]
        }
    ];

    for (const rule of rules) {
        for (const keyword of rule.keywords) {
            if (textToSearch.includes(keyword)) {
                return findExistingCategoryMatch(rule.categoryKey);
            }
        }
    }

    return null;
}

// Atualiza o Datalist com as categorias existentes no sistema
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

function createLinkCard(link, index) {
    const a = document.createElement('a');
    
    let finalUrl = link.url ? link.url.trim() : "";
    if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
    }
    a.href = finalUrl;
    a.target = "_blank"; // Abre em nova aba
    a.rel = "noopener noreferrer"; // Segurança
    a.className = "link-card";
    a.dataset.index = index;

    let iconContent = link.icon ? link.icon.trim() : "";
    
    // Se o ícone for um Data URL ou link de imagem
    if (iconContent.startsWith('data:image/') || /\.(webp|png|jpg|jpeg|gif|svg)(\?.*)?$/i.test(iconContent)) {
        iconContent = `<img src="${iconContent}" alt="Ícone" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">`;
    } else if (link.image) {
        iconContent = `<img src="${link.image}" alt="Ícone" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">`;
    } else if (!iconContent) {
        // Busca automaticamente o ícone do site usando a API do Google
        try {
            const urlObj = new URL(finalUrl);
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
            iconContent = `<img src="${faviconUrl}" alt="Ícone" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">`;
        } catch(e) {
            iconContent = '🌐';
        }
    }

    a.innerHTML = `
        <button class="edit-card-btn" type="button" title="Editar Link">✏️</button>
        <div class="card-icon">${iconContent}</div>
        <div class="card-content">
            <h3 class="card-title">${escapeHTML(link.title || 'Sem título')}</h3>
            <p class="card-description">${escapeHTML(link.description || '')}</p>
        </div>
    `;

    // Botão de editar link
    const editBtn = a.querySelector('.edit-card-btn');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openModalForEdit(link, index);
        });
    }

    return a;
}

function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderLinks() {
    const container = document.getElementById('categories-container');
    container.innerHTML = ''; // Limpa a grade
    const linksData = getLinks();

    if (linksData.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: white; width: 100%;">Nenhum link encontrado. Adicione pelo botão acima!</p>';
        return;
    }

    // Agrupar por categoria (com normalização visual para agrupar categorias parecidas)
    const categories = {};
    const categoryNameMap = {}; // Guarda o nome original formatado da categoria

    linksData.forEach(link => {
        const rawCat = (link.category && link.category.trim()) ? link.category.trim() : 'Geral';
        const cleanKey = cleanString(rawCat);

        if (!categoryNameMap[cleanKey]) {
            categoryNameMap[cleanKey] = rawCat;
        }

        const canonicalName = categoryNameMap[cleanKey];
        if (!categories[canonicalName]) {
            categories[canonicalName] = [];
        }
        categories[canonicalName].push(link);
    });

    // Renderizar cada categoria
    for (const [catName, catLinks] of Object.entries(categories)) {
        const section = document.createElement('div');
        section.className = 'category-section';
        
        const title = document.createElement('h2');
        title.className = 'category-title';
        title.innerText = catName;
        section.appendChild(title);
        
        const grid = document.createElement('div');
        grid.className = 'links-grid';
        
        catLinks.forEach((link) => {
            // Encontra o índice global correspondente na lista currentLinks
            const globalIndex = currentLinks.indexOf(link);
            const card = createLinkCard(link, globalIndex !== -1 ? globalIndex : 0);
            grid.appendChild(card);
        });
        
        section.appendChild(grid);
        container.appendChild(section);
    }

    updateCategoryDatalist();
}

function openModalForAdd() {
    editingIndex = null;
    categoryUserEdited = false;
    
    document.getElementById('modal-title').innerText = 'Novo Link';
    document.getElementById('save-link-btn').innerText = 'Salvar Link';
    document.getElementById('delete-link-btn').style.display = 'none';
    
    const form = document.getElementById('add-link-form');
    form.reset();
    document.getElementById('link-id').value = '';
    
    updateCategoryDatalist();
    
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) modalOverlay.classList.add('active');
}

function openModalForEdit(link, index) {
    editingIndex = index;
    categoryUserEdited = true; // Ao editar, preserva a categoria a menos que alterada
    
    document.getElementById('modal-title').innerText = 'Editar Link';
    document.getElementById('save-link-btn').innerText = 'Salvar Alterações';
    document.getElementById('delete-link-btn').style.display = 'block';
    
    document.getElementById('link-id').value = index;
    document.getElementById('link-title').value = link.title || '';
    document.getElementById('link-desc').value = link.description || '';
    document.getElementById('link-url').value = link.url || '';
    document.getElementById('link-category').value = link.category || '';
    document.getElementById('link-icon').value = link.icon || '';
    
    updateCategoryDatalist();
    
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) modalOverlay.classList.add('active');
}

// Configurações da Modal e Interface
function setupUI() {
    const addBtn = document.getElementById('add-link-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const exportBtn = document.getElementById('export-csv-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const addLinkForm = document.getElementById('add-link-form');
    const deleteBtn = document.getElementById('delete-link-btn');
    
    const urlInput = document.getElementById('link-url');
    const titleInput = document.getElementById('link-title');
    const descInput = document.getElementById('link-desc');
    const categoryInput = document.getElementById('link-category');

    // Monitorar se o usuário digitou/alterou a categoria manualmente
    if (categoryInput) {
        categoryInput.addEventListener('input', () => {
            if (categoryInput.value.trim().length > 0) {
                categoryUserEdited = true;
            }
        });
    }

    // Auto-sugestão de Categoria ao digitar/colar URL, Título ou Descrição
    const triggerAutoCategory = () => {
        if (categoryUserEdited) return; // Não sobreescreve se o usuário já digitou uma categoria
        const autoCat = detectCategoryAutomatically(urlInput.value, titleInput.value, descInput.value);
        if (autoCat && categoryInput) {
            categoryInput.value = autoCat;
        }
    };

    if (urlInput) urlInput.addEventListener('input', triggerAutoCategory);
    if (titleInput) titleInput.addEventListener('input', triggerAutoCategory);
    if (descInput) descInput.addEventListener('input', triggerAutoCategory);

    // Abrir Modal de Novo Link
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openModalForAdd();
        });
    }

    // Fechar Modal no botão 'X'
    if (closeModalBtn && modalOverlay) {
        closeModalBtn.addEventListener('click', () => {
            modalOverlay.classList.remove('active');
        });
    }

    // Fechar Modal ao clicar fora
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('active');
            }
        });
    }

    // Excluir Link
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (editingIndex === null || editingIndex < 0 || editingIndex >= currentLinks.length) return;
            
            const linkToDelete = currentLinks[editingIndex];
            const confirmDelete = confirm(`Tem certeza que deseja excluir o link "${linkToDelete.title || linkToDelete.url}"?`);
            
            if (confirmDelete) {
                currentLinks.splice(editingIndex, 1);
                
                // Atualizar localStorage
                localCustomLinks = [...currentLinks];
                localStorage.setItem('custom_links', JSON.stringify(localCustomLinks));
                
                renderLinks();
                modalOverlay.classList.remove('active');
                alert('🗑️ Link excluído com sucesso!');
            }
        });
    }

    // Salvar Link (Novo ou Editado)
    if (addLinkForm) {
        addLinkForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = titleInput.value.trim();
            const description = descInput.value.trim();
            const url = urlInput.value.trim();
            const rawCategory = categoryInput.value.trim();
            
            // Normaliza a categoria digitada contra as categorias existentes
            const category = findExistingCategoryMatch(rawCategory);
            
            const iconInput = document.getElementById('link-icon').value.trim();
            const imageFileInput = document.getElementById('link-image');

            let icon = iconInput;

            // Se for modo edição e não forneceu novo ícone/imagem, mantém o existente se houver
            if (editingIndex !== null && editingIndex < currentLinks.length && !icon && (!imageFileInput || !imageFileInput.files[0])) {
                icon = currentLinks[editingIndex].icon || '';
            }

            // Se enviou arquivo de imagem, converter para Base64
            if (imageFileInput && imageFileInput.files && imageFileInput.files[0]) {
                const file = imageFileInput.files[0];
                icon = await readFileAsBase64(file);
            }

            const updatedLink = { title, description, url, category, icon };

            if (editingIndex !== null && editingIndex >= 0 && editingIndex < currentLinks.length) {
                // Atualizar link existente
                currentLinks[editingIndex] = updatedLink;
            } else {
                // Adicionar novo link
                currentLinks.push(updatedLink);
            }

            // Salvar no LocalStorage
            localCustomLinks = [...currentLinks];
            localStorage.setItem('custom_links', JSON.stringify(localCustomLinks));

            // Atualizar estado e tela
            renderLinks();

            // Limpar formulário e fechar modal
            addLinkForm.reset();
            modalOverlay.classList.remove('active');
            
            const actionText = editingIndex !== null ? 'atualizado' : 'adicionado';
            alert(`✅ Link "${title}" ${actionText} com sucesso!`);
        });
    }

    // Botão Atualizar (busca CSV atualizado sem cache)
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.innerText = "Atualizando...";
            fetchLinks().then(() => {
                setTimeout(() => {
                    refreshBtn.innerText = "Atualizar";
                }, 500);
            });
        });
    }

    // Botão Baixar CSV (Gera o arquivo links.csv com todos os links)
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportCSV();
        });
    }
}

// Converter arquivo para Base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// Exportar links para arquivo CSV
function exportCSV() {
    if (currentLinks.length === 0) {
        alert("Nenhum link para exportar.");
        return;
    }

    const csvData = Papa.unparse(currentLinks, {
        columns: ["title", "description", "url", "icon", "category"]
    });

    const blob = new Blob(["\ufeff" + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'links.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Inicializar aplicação
document.addEventListener('DOMContentLoaded', () => {
    fetchLinks();
    setupUI();
});
