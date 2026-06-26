/**
 * Central de Links - Logica Principal da Aplicacao
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // CONFIGURAÇÃO DO ESTADO DA APLICAÇÃO
    // ==========================================================================
    const state = {
        profile: {},
        categories: [],
        links: [],
        selectedCategory: 'Todos',
        searchQuery: '',
        clicks: JSON.parse(localStorage.getItem('link_clicks')) || {}
    };

    // ==========================================================================
    // SELETORES DO DOM
    // ==========================================================================
    const themeToggleBtn = document.getElementById('theme-toggle');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileAvatarFallback = document.getElementById('profile-avatar-fallback');
    const profileName = document.getElementById('profile-name');
    const profileRole = document.getElementById('profile-role');
    const profileBio = document.getElementById('profile-bio');
    const profileSocials = document.getElementById('profile-socials');
    
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const categoriesNav = document.getElementById('categories-nav');
    
    const popularSection = document.getElementById('popular-section');
    const popularGrid = document.getElementById('popular-grid');
    
    const linksGrid = document.getElementById('links-grid');
    const statusMessage = document.getElementById('status-message');
    const listTitle = document.getElementById('list-title');
    
    const copyrightYear = document.getElementById('copyright-year');
    const footerName = document.getElementById('footer-name');

    // Definir ano dinâmico no copyright do footer
    if (copyrightYear) {
        copyrightYear.textContent = new Date().getFullYear();
    }

    // ==========================================================================
    // SISTEMA DE TEMAS (DARK / LIGHT)
    // ==========================================================================
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        // Se houver tema salvo, usa. Caso contrário, verifica a preferência do sistema
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const themeToSet = systemPrefersDark ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', themeToSet);
        }
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }

    themeToggleBtn.addEventListener('click', toggleTheme);
    initTheme();

    // ==========================================================================
    // PARSER DE CSV E MAPEAMENTO DO GOOGLE SHEETS
    // ==========================================================================
    function parseCSV(text) {
        if (!text || !text.trim()) return [];
        
        // Detecta delimitador (vírgula ou ponto e vírgula)
        const firstLine = text.split('\n')[0];
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semiCount = (firstLine.match(/;/g) || []).length;
        const delimiter = semiCount > commaCount ? ';' : ',';

        const lines = [];
        let row = [""];
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            const next = text[i+1];

            if (c === '"') {
                if (inQuotes && next === '"') {
                    row[row.length - 1] += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c === delimiter && !inQuotes) {
                row.push("");
            } else if ((c === '\r' || c === '\n') && !inQuotes) {
                if (c === '\r' && next === '\n') {
                    i++;
                }
                lines.push(row);
                row = [""];
            } else {
                row[row.length - 1] += c;
            }
        }
        if (row.length > 1 || row[0] !== "") {
            lines.push(row);
        }
        return lines;
    }

    function normalizeHeader(str) {
        if (!str) return "";
        return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // remove acentos
            .replace(/[^a-z0-9]/g, "") // remove caracteres especiais
            .trim();
    }

    function detectIconFromUrl(url) {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('github.com')) return 'github';
        if (lowerUrl.includes('linkedin.com')) return 'linkedin';
        if (lowerUrl.includes('instagram.com')) return 'instagram';
        if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
        if (lowerUrl.includes('facebook.com')) return 'facebook';
        if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
        if (lowerUrl.includes('whatsapp.com') || lowerUrl.includes('wa.me')) return 'phone';
        if (lowerUrl.includes('mailto:') || lowerUrl.includes('@')) return 'mail';
        if (lowerUrl.includes('drive.google') || lowerUrl.includes('docs.google')) return 'file-text';
        if (lowerUrl.includes('calendly.com')) return 'calendar';
        return 'globe'; // Ícone padrão para outros sites
    }

    function mapCSVToLinks(csvLines) {
        if (csvLines.length === 0) return [];
        
        let startIndex = 0;
        let titleCol = 0;
        let urlCol = 1;
        
        // Verifica se a primeira linha tem cabeçalhos
        const firstLine = csvLines[0];
        const hasHeaders = firstLine.some(cell => {
            const normalized = normalizeHeader(cell);
            return ['nome', 'titulo', 'title', 'link', 'url', 'site', 'endereco'].includes(normalized);
        });
        
        if (hasHeaders) {
            startIndex = 1;
            const headers = firstLine.map(h => normalizeHeader(h));
            
            const tIndex = headers.findIndex(h => h === 'nome' || h === 'titulo' || h === 'title');
            const uIndex = headers.findIndex(h => h === 'link' || h === 'url' || h === 'site' || h === 'endereco');
            
            if (tIndex !== -1) titleCol = tIndex;
            if (uIndex !== -1) urlCol = uIndex;
        }

        const links = [];
        for (let i = startIndex; i < csvLines.length; i++) {
            const row = csvLines[i];
            if (!row || row.length === 0) continue;

            let title = row[titleCol] ? row[titleCol].trim() : '';
            let url = row[urlCol] ? row[urlCol].trim() : '';
            
            // Se inverteu ou se a coluna de título parece uma URL e vice-versa
            if (title.startsWith('http://') || title.startsWith('https://')) {
                const temp = title;
                title = url;
                url = temp;
            }

            if (!url) continue;

            // Se não tem título, adivinha pelo domínio da URL
            if (!title) {
                try {
                    const domain = new URL(url).hostname.replace('www.', '');
                    title = domain.charAt(0).toUpperCase() + domain.slice(1);
                } catch (e) {
                    title = 'Link';
                }
            }

            // Auto-detecta o ícone com base na URL
            const icon = detectIconFromUrl(url);

            links.push({
                title,
                description: '',
                url,
                category: 'Todos',
                icon,
                highlight: false,
                tags: []
            });
        }
        return links;
    }

    // ==========================================================================
    // CARREGAMENTO DE DADOS (FETCH DO JSON E GOOGLE SHEETS)
    // ==========================================================================
    async function loadData() {
        showStatus('loading', 'Carregando links...');
        try {
            const response = await fetch('links.json');
            if (!response.ok) {
                throw new Error(`Erro HTTP ao carregar links.json: ${response.status}`);
            }
            const data = await response.json();
            
            state.profile = data.profile || {};
            state.categories = data.categories || ['Todos'];
            state.links = data.links || [];

            // Se houver integração com Google Sheets configurada
            if (data.googleSheetUrl) {
                const sheetIdMatch = data.googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
                const sheetId = sheetIdMatch ? sheetIdMatch[1] : null;
                
                if (sheetId) {
                    try {
                        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
                        const csvResponse = await fetch(csvUrl);
                        if (csvResponse.ok) {
                            const csvText = await csvResponse.text();
                            const csvLines = parseCSV(csvText);
                            const sheetLinks = mapCSVToLinks(csvLines);
                            
                            if (sheetLinks && sheetLinks.length > 0) {
                                state.links = sheetLinks;
                                
                                // Extrai as categorias únicas definidas na planilha
                                const sheetCategories = Array.from(new Set(sheetLinks.map(l => l.category).filter(Boolean)));
                                // Mescla "Todos" com as categorias da planilha
                                state.categories = ['Todos', ...sheetCategories];
                                console.log('Dados sincronizados com sucesso a partir do Google Sheets!');
                            } else {
                                console.warn('Nenhum link estruturado encontrado na planilha. Usando dados do links.json.');
                            }
                        } else {
                            console.warn('Erro ao carregar a planilha (CORS ou Privada). Código HTTP:', csvResponse.status, '. Usando links locais.');
                        }
                    } catch (sheetError) {
                        console.error('Falha de conexão ao acessar a planilha:', sheetError, '. Usando links locais.');
                    }
                }
            }

            // Preenche e renderiza a tela
            renderProfile();
            renderCategories();
            renderLinks();
            renderPopularLinks();
            hideStatus();
        } catch (error) {
            console.error('Falha geral ao carregar dados:', error);
            showStatus('error', 'Não foi possível carregar os links. Verifique se os arquivos locais e configurações estão corretos.');
        }
    }

    // ==========================================================================
    // EXIBIÇÃO DE MENSAGENS DE STATUS
    // ==========================================================================
    function showStatus(type, message) {
        statusMessage.className = `status-message ${type}`;
        statusMessage.classList.remove('hidden');
        linksGrid.classList.add('hidden');
        
        if (type === 'loading') {
            statusMessage.innerHTML = `
                <div class="spinner"></div>
                <p>${message}</p>
            `;
        } else if (type === 'error') {
            statusMessage.innerHTML = `
                <i data-lucide="alert-triangle"></i>
                <p>${message}</p>
            `;
        } else if (type === 'empty') {
            statusMessage.innerHTML = `
                <i data-lucide="search-code"></i>
                <p>${message}</p>
            `;
        }
        lucide.createIcons();
    }

    function hideStatus() {
        statusMessage.classList.add('hidden');
        linksGrid.classList.remove('hidden');
    }

    // ==========================================================================
    // RENDERIZAÇÃO DO PERFIL E REDES SOCIAIS
    // ==========================================================================
    function renderProfile() {
        const { name, role, bio, avatar, socials } = state.profile;
        
        // Nome e Metadados SEO básicos
        if (name) {
            profileName.textContent = name;
            footerName.textContent = name;
            document.title = `Central de Links - ${name}`;
            
            // Iniciais do Avatar
            const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
            profileAvatarFallback.textContent = initials;
        }

        if (role) profileRole.textContent = role;
        if (bio) profileBio.textContent = bio;

        // Configuração do Avatar
        if (avatar) {
            profileAvatar.src = avatar;
            profileAvatar.onload = () => {
                profileAvatar.classList.remove('hidden');
                profileAvatarFallback.classList.add('hidden');
            };
            profileAvatar.onerror = () => {
                profileAvatar.classList.add('hidden');
                profileAvatarFallback.classList.remove('hidden');
            };
        } else {
            profileAvatar.classList.add('hidden');
            profileAvatarFallback.classList.remove('hidden');
        }

        // Renderiza redes sociais horizontais no perfil
        profileSocials.innerHTML = '';
        if (socials && socials.length > 0) {
            socials.forEach(soc => {
                const a = document.createElement('a');
                a.href = soc.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.className = 'social-link';
                a.setAttribute('aria-label', soc.platform);
                a.title = soc.platform.charAt(0).toUpperCase() + soc.platform.slice(1);
                a.innerHTML = `<i data-lucide="${soc.icon || 'link'}"></i>`;
                profileSocials.appendChild(a);
            });
        }
        lucide.createIcons();
    }

    // ==========================================================================
    // RENDERIZAÇÃO E FILTRAGEM DE CATEGORIAS
    // ==========================================================================
    function renderCategories() {
        categoriesNav.innerHTML = '';
        
        // Se houver apenas a categoria "Todos" ou nenhuma, esconde o menu de categorias
        if (state.categories.length <= 1) {
            categoriesNav.classList.add('hidden');
            return;
        }
        categoriesNav.classList.remove('hidden');
        
        state.categories.forEach(cat => {
            const button = document.createElement('button');
            button.className = `category-pill ${state.selectedCategory === cat ? 'active' : ''}`;
            button.textContent = cat;
            button.addEventListener('click', () => {
                state.selectedCategory = cat;
                
                // Atualiza classes ativas
                document.querySelectorAll('.category-pill').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
                
                renderLinks();
            });
            categoriesNav.appendChild(button);
        });
    }

    // ==========================================================================
    // RENDERIZAÇÃO DOS CARDS DE LINKS PRINCIPAIS
    // ==========================================================================
    function renderLinks() {
        linksGrid.innerHTML = '';
        
        // Filtragem dos links baseada na busca e na categoria selecionada
        const filteredLinks = state.links.filter(link => {
            const matchesCategory = state.selectedCategory === 'Todos' || link.category === state.selectedCategory;
            
            const query = state.searchQuery.toLowerCase().trim();
            const matchesSearch = !query || 
                link.title.toLowerCase().includes(query) || 
                link.description.toLowerCase().includes(query) || 
                (link.tags && link.tags.some(tag => tag.toLowerCase().includes(query)));
                
            return matchesCategory && matchesSearch;
        });

        // Título dinâmico da lista
        if (state.searchQuery) {
            listTitle.textContent = `Resultados para "${state.searchQuery}"`;
        } else {
            listTitle.textContent = state.selectedCategory === 'Todos' ? 'Todos os Links' : `Categoria: ${state.selectedCategory}`;
        }

        // Caso nenhum resultado seja retornado
        if (filteredLinks.length === 0) {
            showStatus('empty', 'Nenhum link correspondente encontrado para os filtros selecionados.');
            return;
        }

        hideStatus();

        // Renderiza cada link na lista
        filteredLinks.forEach((link, index) => {
            const card = document.createElement('a');
            card.href = link.url;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            card.className = `link-card ${link.highlight ? 'highlighted' : ''}`;
            // Delay de animação cascateada sutil
            card.style.animationDelay = `${index * 0.05}s`;
            
            // Evento para rastrear o clique
            card.addEventListener('click', () => {
                trackClick(link.url);
            });

            // Tags HTML
            let tagsHtml = '';
            if (link.tags && link.tags.length > 0) {
                tagsHtml = `<div class="link-tags">` + 
                    link.tags.map(tag => `<span class="link-tag">${tag}</span>`).join('') + 
                    `</div>`;
            }

            card.innerHTML = `
                <div class="link-icon-container">
                    <i data-lucide="${link.icon || 'link-2'}"></i>
                </div>
                <div class="link-content">
                    <div class="link-title-row">
                        <span class="link-title">${link.title}</span>
                        ${link.highlight ? '<span class="badge-featured">Destaque</span>' : ''}
                    </div>
                    <p class="link-description">${link.description || ''}</p>
                    ${tagsHtml}
                </div>
                <div class="link-arrow">
                    <i data-lucide="arrow-up-right"></i>
                </div>
            `;

            linksGrid.appendChild(card);
        });
        
        lucide.createIcons();
    }

    // ==========================================================================
    // ESTATÍSTICAS E LINKS POPULARES (LOCALSTORAGE)
    // ==========================================================================
    function trackClick(url) {
        state.clicks[url] = (state.clicks[url] || 0) + 1;
        localStorage.setItem('link_clicks', JSON.stringify(state.clicks));
        renderPopularLinks();
    }

    function renderPopularLinks() {
        popularGrid.innerHTML = '';
        
        // Criar uma cópia dos links que têm cliques registrados (mínimo 1 clique)
        const popularLinks = state.links
            .filter(link => state.clicks[link.url] && state.clicks[link.url] > 0)
            // Ordenar por maior número de cliques
            .sort((a, b) => state.clicks[b.url] - state.clicks[a.url])
            // Pegar apenas os top 4
            .slice(0, 4);

        // Se não houver cliques ou links populares, esconde a seção
        if (popularLinks.length === 0) {
            popularSection.classList.add('hidden');
            return;
        }

        popularSection.classList.remove('hidden');

        popularLinks.forEach(link => {
            const count = state.clicks[link.url];
            
            const card = document.createElement('a');
            card.href = link.url;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            card.className = 'popular-card';
            
            card.addEventListener('click', () => {
                trackClick(link.url);
            });

            card.innerHTML = `
                <div class="popular-card-content">
                    <div class="popular-card-title">${link.title}</div>
                    <div class="popular-card-visits">
                        <i data-lucide="trending-up"></i>
                        <span>${count} ${count === 1 ? 'visita' : 'visitas'}</span>
                    </div>
                </div>
                <div class="link-arrow">
                    <i data-lucide="arrow-up-right"></i>
                </div>
            `;
            popularGrid.appendChild(card);
        });

        lucide.createIcons();
    }

    // ==========================================================================
    // BUSCA DINÂMICA
    // ==========================================================================
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        
        // Exibe ou esconde o botão de limpar com base no input
        if (state.searchQuery.length > 0) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
        
        renderLinks();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        renderLinks();
        searchInput.focus();
    });

    // ==========================================================================
    // INICIALIZAÇÃO
    // ==========================================================================
    loadData();
});
