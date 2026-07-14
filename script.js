// Estado global para armazenar os links na memória
let currentLinks = [];

// Busca os links do arquivo links.csv local
async function fetchLinks() {
    try {
        const response = await fetch('links.csv');
        
        if (!response.ok) {
            throw new Error('Falha ao carregar o arquivo links.csv');
        }

        const csvText = await response.text();
        
        // Usa PapaParse para ler o CSV
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                currentLinks = results.data;
                renderLinks();
            }
        });
    } catch (err) {
        console.error("Erro ao buscar links do arquivo links.csv:", err);
        alert("Aviso: Não foi possível carregar os links do arquivo 'links.csv'. Verifique se você abriu o site com um servidor local ou hospedou corretamente.");
    }
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

    let iconContent = link.icon;
    
    // Se o ícone for um link de imagem ou arquivo (ex: .webp, .png, .jpg)
    if (link.icon && /\.(webp|png|jpg|jpeg|gif|svg)(\?.*)?$/i.test(link.icon.trim())) {
        iconContent = `<img src="${link.icon.trim()}" alt="Ícone" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">`;
    } else if (link.image) {
        iconContent = `<img src="${link.image}" alt="Ícone" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">`;
    } else if (!link.icon || link.icon.trim() === '') {
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
            <h2 class="card-title">${link.title}</h2>
            <p class="card-description">${link.description}</p>
        </div>
    `;

    return a;
}

function renderLinks() {
    const container = document.getElementById('categories-container');
    container.innerHTML = ''; // Limpa a grade
    const linksData = getLinks();

    if (linksData.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: white; width: 100%;">Nenhum link encontrado. Adicione no arquivo links.csv!</p>';
        return;
    }

    // Agrupar por categoria
    const categories = {};
    linksData.forEach(link => {
        const cat = link.category ? link.category.trim() : 'Geral';
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

// Configuração do Botão
function setupUI() {
    const addBtn = document.getElementById('add-link-btn');

    // Como é estático e lido do Excel/Planilha, o botão avisa o usuário
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            alert("Para adicionar um novo link, abra o arquivo 'links.csv' no Excel, Google Sheets ou Bloco de Notas, adicione uma nova linha e salve!");
        });
        
        // Ou podemos mudar o texto do botão
        addBtn.innerText = "Como Adicionar?";
    }
}

// Carrega os dados na inicialização
document.addEventListener('DOMContentLoaded', () => {
    fetchLinks();
    setupUI();
});
