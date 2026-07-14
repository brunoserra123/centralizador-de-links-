// Estado global para armazenar os links na memória
let currentLinks = [];

// Busca os links do arquivo links.json local
async function fetchLinks() {
    try {
        const response = await fetch('links.json');
        
        if (!response.ok) {
            throw new Error('Falha ao carregar o arquivo links.json');
        }

        const data = await response.json();
        currentLinks = data;
        renderLinks();
    } catch (err) {
        console.error("Erro ao buscar links do arquivo links.json:", err);
        alert("Aviso: Não foi possível carregar os links do arquivo 'links.json'. Verifique se você abriu o site com um servidor local ou hospedou corretamente.");
    }
}

// Retorna os links atuais da memória
function getLinks() {
    return currentLinks;
}

function createLinkCard(link, index) {
    const a = document.createElement('a');
    a.href = link.url;
    a.target = "_blank"; // Abre em nova aba
    a.rel = "noopener noreferrer"; // Segurança
    a.className = "link-card";

    let iconContent = link.icon;
    if (link.image) {
        iconContent = `<img src="${link.image}" alt="Ícone">`;
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
    const grid = document.getElementById('links-grid');
    grid.innerHTML = ''; // Limpa a grade
    const linksData = getLinks();

    if (linksData.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: white; width: 100%;">Nenhum link encontrado. Adicione no arquivo links.json!</p>';
        return;
    }

    linksData.forEach((link, index) => {
        const card = createLinkCard(link, index);
        grid.appendChild(card);
    });
}

// Configuração do Botão
function setupUI() {
    const addBtn = document.getElementById('add-link-btn');

    // Como é estático e lido do bloco de notas, o botão avisa o usuário
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            alert("Para adicionar um novo link, abra o arquivo 'links.json' no bloco de notas ou VS Code e adicione os dados lá!");
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
