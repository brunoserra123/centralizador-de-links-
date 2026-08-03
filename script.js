// Estado global para armazenar os links na memória
let currentLinks = [];
let localCustomLinks = JSON.parse(localStorage.getItem('custom_links') || '[]');

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
        // Se houver falha de rede/CORS por abrir direto no navegador (file://)
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
                .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove acentos (ex: descrição -> descricao)
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
    
    // Adiciona links locais que não estejam no CSV (usando URL ou título como chave)
    localLinks.forEach(localItem => {
        const exists = combined.some(csvItem => 
            (csvItem.url && csvItem.url.trim() === localItem.url.trim()) ||
            (csvItem.title && csvItem.title.trim() === localItem.title.trim())
        );
        if (!exists) {
            combined.push(localItem);
        }
    });
    
    return combined;
}

// Retorna os links atuais da memória
function getLinks() {
    return currentLinks;
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

    let iconContent = link.icon ? link.icon.trim() : "";
    
    // Se o ícone for um Data URL (imagem enviada localmente) ou link de imagem
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
        <div class="card-icon">${iconContent}</div>
        <div class="card-content">
            <h2 class="card-title">${escapeHTML(link.title || 'Sem título')}</h2>
            <p class="card-description">${escapeHTML(link.description || '')}</p>
        </div>
    `;

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

    // Agrupar por categoria
    const categories = {};
    linksData.forEach(link => {
        const cat = (link.category && link.category.trim()) ? link.category.trim() : 'Geral';
        if (!categories[cat]) {
            categories[cat] = [];
        }
        categories[cat].push(link);
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
        
        catLinks.forEach((link, index) => {
            const card = createLinkCard(link, index);
            grid.appendChild(card);
        });
        
        section.appendChild(grid);
        container.appendChild(section);
    }
}

// Configurações da Modal e Interface
function setupUI() {
    const addBtn = document.getElementById('add-link-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const exportBtn = document.getElementById('export-csv-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const addLinkForm = document.getElementById('add-link-form');

    // Abrir Modal
    if (addBtn && modalOverlay) {
        addBtn.addEventListener('click', () => {
            modalOverlay.classList.add('active');
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

    // Salvar Novo Link pelo Formulário da Modal
    if (addLinkForm) {
        addLinkForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('link-title').value.trim();
            const description = document.getElementById('link-desc').value.trim();
            const url = document.getElementById('link-url').value.trim();
            const category = document.getElementById('link-category').value.trim() || 'Geral';
            const iconInput = document.getElementById('link-icon').value.trim();
            const imageFileInput = document.getElementById('link-image');

            let icon = iconInput;

            // Se enviou arquivo de imagem, converter para Base64
            if (imageFileInput && imageFileInput.files && imageFileInput.files[0]) {
                const file = imageFileInput.files[0];
                icon = await readFileAsBase64(file);
            }

            const newLink = { title, description, url, category, icon };

            // Salvar no array local e localStorage
            localCustomLinks.push(newLink);
            localStorage.setItem('custom_links', JSON.stringify(localCustomLinks));

            // Atualizar estado e tela
            currentLinks.push(newLink);
            renderLinks();

            // Limpar formulário e fechar modal
            addLinkForm.reset();
            modalOverlay.classList.remove('active');
            alert(`✅ Link "${title}" adicionado com sucesso!`);
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
