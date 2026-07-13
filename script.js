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

// Carrega os links do localStorage ou usa os padrões
function getLinks() {
    const savedLinks = localStorage.getItem('myFavoriteLinks');
    if (savedLinks) {
        return JSON.parse(savedLinks);
    }
    return JSON.parse(JSON.stringify(defaultLinks));
}

// Salva os links no localStorage
function saveLinks(links) {
    localStorage.setItem('myFavoriteLinks', JSON.stringify(links));
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
    deleteBtn.addEventListener('click', () => {
        const id = document.getElementById('link-id').value;
        if (id !== "") {
            const currentLinks = getLinks();
            currentLinks.splice(Number(id), 1);
            saveLinks(currentLinks);
            renderLinks();
            modalOverlay.classList.remove('active');
        }
    });

    // Adicionar/Editar link
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        try {
            const title = document.getElementById('link-title').value;
            const description = document.getElementById('link-desc').value;
            let url = document.getElementById('link-url').value;
            
            // Garante que o link tenha http:// ou https://
            if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }

            const icon = document.getElementById('link-icon').value || "🔗";
            const imageFile = document.getElementById('link-image').files[0];
            const linkId = document.getElementById('link-id').value;

            const saveAndRender = (imageBase64) => {
                try {
                    const currentLinks = getLinks();
                    
                    const newLink = {
                        title,
                        description,
                        url,
                        icon: imageBase64 ? "" : icon,
                        image: imageBase64 || null
                    };

                    // Mantém a imagem antiga se não enviou uma nova e já tinha uma
                    if (!imageBase64 && linkId !== "" && currentLinks[linkId] && currentLinks[linkId].image && !document.getElementById('link-icon').value) {
                        newLink.image = currentLinks[linkId].image;
                        newLink.icon = "";
                    }

                    if (linkId === "") {
                        // É um link novo
                        currentLinks.push(newLink);
                    } else {
                        // É uma edição
                        currentLinks[Number(linkId)] = newLink;
                    }

                    saveLinks(currentLinks);
                    renderLinks();

                    form.reset();
                    modalOverlay.classList.remove('active');
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
                        
                        // Converte para WebP (ou PNG se WebP falhar) comprimido
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
    const linksData = getLinks();
    const link = linksData[index];
    
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

// Renderiza os links e configura o modal quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    renderLinks();
    setupModal();
});
