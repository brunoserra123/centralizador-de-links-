const API_URL = "https://script.google.com/macros/s/AKfycbxitpUj0jLocXvNK8kHpCml7yeK9d693MO6m0Bl8pWcIUl0Ztloqu2Zh0tiDDcz2bWg6A/exec"; // Cole aqui o URL que termina com /exec

const defaultLinks = [
    {
        title: "Thingiverse",
        description: "Maior comunidade de arquivos para impressão 3D.",
        url: "https://www.thingiverse.com/",
        icon: "🎲"
    },
    {
        title: "Printables",
        description: "Modelos 3D de alta qualidade para baixar e imprimir.",
        url: "https://www.printables.com/",
        icon: "🖨️"
    },
    {
        title: "GitHub",
        description: "Onde o mundo constrói software.",
        url: "https://github.com/",
        icon: "💻"
    },
    {
        title: "YouTube",
        description: "Vídeos, tutoriais e muito mais.",
        url: "https://www.youtube.com/",
        icon: "▶️"
    }
];

// Estado global para armazenar os links na memória
let currentLinks = [];

// Busca os links da planilha (Google Sheets)
async function fetchLinks() {
    if (!API_URL || API_URL === "COLE_O_SEU_LINK_AQUI_DEPOIS") {
        console.warn("API_URL não configurada. Usando links padrão da memória.");
        currentLinks = JSON.parse(JSON.stringify(defaultLinks));
        renderLinks();
        return;
    }

    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        currentLinks = data;
        renderLinks();
    } catch (err) {
        console.error("Erro ao buscar links da planilha:", err);
        // Fallback
        if (currentLinks.length === 0) {
            currentLinks = JSON.parse(JSON.stringify(defaultLinks));
        }
        renderLinks();
    }
}

// Retorna os links atuais da memória
function getLinks() {
    return currentLinks;
}

// Salva a alteração (Adicionar, Editar ou Deletar) na Planilha
async function syncWithServer(action, linkData) {
    if (!API_URL || API_URL === "COLE_O_SEU_LINK_AQUI_DEPOIS") {
        return;
    }
    
    try {
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors', // Evita bloqueio do navegador (CORS)
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({ action: action, data: linkData })
        });
        
        // Dá um pequeno tempo para a planilha processar antes de recarregar
        setTimeout(async () => {
            await fetchLinks();
        }, 1500);
        
    } catch (err) {
        console.error("Erro ao sincronizar com servidor:", err);
        alert("Aviso: Houve um erro ao salvar na planilha, mas a alteração está visível na tela.");
    }
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
        <button class="edit-card-btn" data-index="${index}" title="Editar">✏️</button>
        <div class="card-icon">${iconContent}</div>
        <div class="card-content">
            <h2 class="card-title">${link.title}</h2>
            <p class="card-description">${link.description}</p>
        </div>
    `;

    // Evita que clicar no botão de editar abra o link
    const editBtn = a.querySelector('.edit-card-btn');
    editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEditModal(index);
    });

    return a;
}

function renderLinks() {
    const grid = document.getElementById('links-grid');
    grid.innerHTML = ''; // Limpa a grade
    const linksData = getLinks();

    linksData.forEach((link, index) => {
        const card = createLinkCard(link, index);
        grid.appendChild(card);
    });
}

// Configuração do Modal
function setupModal() {
    const addBtn = document.getElementById('add-link-btn');
    const closeBtn = document.getElementById('close-modal-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    const form = document.getElementById('add-link-form');
    const deleteBtn = document.getElementById('delete-link-btn');

    // Abrir modal novo
    addBtn.addEventListener('click', () => {
        form.reset();
        document.getElementById('link-id').value = "";
        document.getElementById('modal-title').innerText = "Novo Link";
        deleteBtn.style.display = 'none';
        modalOverlay.classList.add('active');
    });

    // Fechar modal
    closeBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
    });

    // Fechar modal clicando fora dele
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    });

    // Deletar Link
    deleteBtn.addEventListener('click', async () => {
        const index = document.getElementById('link-id').value;
        if (index !== "") {
            const linkToDelete = currentLinks[Number(index)];
            
            // Remove da tela imediatamente para parecer rápido
            currentLinks.splice(Number(index), 1);
            renderLinks();
            modalOverlay.classList.remove('active');
            
            // Sincroniza em segundo plano
            await syncWithServer('delete', linkToDelete);
        }
    });

    // Adicionar/Editar link
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        try {
            const title = document.getElementById('link-title').value;
            const description = document.getElementById('link-desc').value;
            let url = document.getElementById('link-url').value;
            
            if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }

            const icon = document.getElementById('link-icon').value || "🔗";
            const imageFile = document.getElementById('link-image').files[0];
            const indexStr = document.getElementById('link-id').value;

            const saveAndRender = async (imageBase64) => {
                try {
                    const newLink = {
                        title,
                        description,
                        url,
                        icon: imageBase64 ? "" : icon,
                        image: imageBase64 || null
                    };

                    if (!imageBase64 && indexStr !== "" && currentLinks[indexStr] && currentLinks[indexStr].image && !document.getElementById('link-icon').value) {
                        newLink.image = currentLinks[indexStr].image;
                        newLink.icon = "";
                    }

                    let action = 'add';
                    
                    if (indexStr === "") {
                        currentLinks.push(newLink);
                    } else {
                        // O ID interno da planilha, se existir, precisamos manter ao editar
                        if (currentLinks[Number(indexStr)].id) {
                            newLink.id = currentLinks[Number(indexStr)].id;
                        }
                        currentLinks[Number(indexStr)] = newLink;
                        action = 'update';
                    }

                    // Atualiza a tela rápido
                    renderLinks();
                    form.reset();
                    modalOverlay.classList.remove('active');
                    
                    // Sincroniza com a planilha
                    await syncWithServer(action, newLink);

                } catch (err2) {
                    alert("Erro ao salvar os dados: " + err2.message);
                }
            };

            if (imageFile) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 150;
                        const MAX_HEIGHT = 150;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                            }
                        } else {
                            if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                            }
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        const dataUrl = canvas.toDataURL('image/webp', 0.8);
                        saveAndRender(dataUrl);
                    };
                    img.src = event.target.result;
                };
                reader.onerror = function() {
                    alert("Erro ao ler a imagem");
                };
                reader.readAsDataURL(imageFile);
            } else {
                saveAndRender(null);
            }
        } catch (err) {
            alert("Erro no código do formulário: " + err.message);
        }
    });
}

function openEditModal(index) {
    const link = currentLinks[index];
    
    document.getElementById('link-id').value = index;
    document.getElementById('link-title').value = link.title;
    document.getElementById('link-desc').value = link.description;
    document.getElementById('link-url').value = link.url;
    document.getElementById('link-icon').value = link.image ? "" : link.icon;
    
    document.getElementById('modal-title').innerText = "Editar Link";
    document.getElementById('delete-link-btn').style.display = 'block';
    
    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.classList.add('active');
}

// Carrega os dados na inicialização
document.addEventListener('DOMContentLoaded', () => {
    fetchLinks();
    setupModal();
});
