// ===== CONFIGURACIÓN =====
const CONFIG = {
    TVMAZE_API: 'https://api.tvmaze.com/shows',
    JIKAN_API: 'https://api.jikan.moe/v4/top/anime',
    UNLOCK_COST: 25,
    DAILY_BONUS: 50,
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutos
    MAX_SUGGESTIONS: 5
};

// ===== ESTADO GLOBAL =====
let currentUser = null;
let unlockedContent = new Set();
let favoriteContent = new Set();
let lastBonusDate = null;
let currentModalContent = null;
let cache = new Map();
let isLoading = false;

// ===== USUARIOS PREDEFINIDOS =====
const PREDEFINED_USERS = [
    { id: 1, name: "Alex", coins: 500 },
    { id: 2, name: "María", coins: 500 },
    { id: 3, name: "Carlos", coins: 500 },
    { id: 4, name: "Ana", coins: 500 },
    { id: 5, name: "David", coins: 500 },
    { id: 6, name: "Laura", coins: 500 },
    { id: 7, name: "Javier", coins: 500 },
    { id: 8, name: "Elena", coins: 500 },
    { id: 9, name: "Pablo", coins: 500 },
    { id: 10, name: "Sofía", coins: 500 }
];

// ===== ELEMENTOS DOM =====
const elements = {
    // Auth
    authScreen: document.getElementById('authScreen'),
    authForm: document.getElementById('authForm'),
    userNameInput: document.getElementById('userName'),
    userSuggestions: document.getElementById('userSuggestions'),
    
    // Header
    mainHeader: document.getElementById('mainHeader'),
    userAvatar: document.getElementById('userAvatar'),
    userDisplayName: document.getElementById('userDisplayName'),
    userCoins: document.getElementById('userCoins'),
    coinsAmount: document.getElementById('coinsAmount'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    // Hero
    heroSection: document.getElementById('heroSection'),
    dailyBonusBtn: document.getElementById('dailyBonus'),
    infoBtn: document.getElementById('infoBtn'),
    
    // Sections
    mainContent: document.getElementById('mainContent'),
    seriesSection: document.getElementById('seriesSection'),
    animeSection: document.getElementById('animeSection'),
    favoritesSection: document.getElementById('favoritesSection'),
    searchSection: document.getElementById('searchSection'),
    
    // Grids
    seriesGrid: document.getElementById('seriesGrid'),
    animeGrid: document.getElementById('animeGrid'),
    favoritesGrid: document.getElementById('favoritesGrid'),
    searchGrid: document.getElementById('searchGrid'),
    
    // Search
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    searchTitle: document.getElementById('searchTitle'),
    backToMain: document.getElementById('backToMain'),
    
    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    favoritesTab: document.getElementById('favoritesTab'),
    
    // Modal
    contentModal: document.getElementById('contentModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalPoster: document.getElementById('modalPoster'),
    modalBadge: document.getElementById('modalBadge'),
    modalType: document.getElementById('modalType'),
    modalGenre: document.getElementById('modalGenre'),
    modalRating: document.getElementById('modalRating'),
    modalStatus: document.getElementById('modalStatus'),
    modalDescription: document.getElementById('modalDescription'),
    modalWatchBtn: document.getElementById('modalWatchBtn'),
    modalUnlockBtn: document.getElementById('modalUnlockBtn'),
    modalFavoriteBtn: document.getElementById('modalFavoriteBtn'),
    closeModal: document.getElementById('closeModal'),
    
    // Controls
    refreshSeries: document.getElementById('refreshSeries'),
    refreshAnime: document.getElementById('refreshAnime'),
    clearFavorites: document.getElementById('clearFavorites'),
    
    // Quick Actions
    quickActions: document.getElementById('quickActions'),
    quickBonus: document.getElementById('quickBonus'),
    quickUnlock: document.getElementById('quickUnlock'),
    quickFavorites: document.getElementById('quickFavorites'),
    
    // Loading
    loadingOverlay: document.getElementById('loadingOverlay'),
    
    // Notification Container
    notificationContainer: document.getElementById('notificationContainer')
};

// ===== FUNCIONES DE UTILIDAD =====
const utils = {
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    generateAvatar(name) {
        return name.charAt(0).toUpperCase();
    },

    formatNumber(num) {
        return num.toLocaleString('es-ES');
    },

    getCacheKey(key) {
        return `mediahub_${key}`;
    },

    saveToCache(key, data, duration = CONFIG.CACHE_DURATION) {
        const cacheItem = {
            data,
            timestamp: Date.now(),
            duration
        };
        cache.set(key, cacheItem);
        localStorage.setItem(utils.getCacheKey(key), JSON.stringify(cacheItem));
    },

    getFromCache(key) {
        // Primero verificar memoria
        if (cache.has(key)) {
            const item = cache.get(key);
            if (Date.now() - item.timestamp < item.duration) {
                return item.data;
            }
            cache.delete(key);
        }

        // Luego verificar localStorage
        const stored = localStorage.getItem(utils.getCacheKey(key));
        if (stored) {
            try {
                const item = JSON.parse(stored);
                if (Date.now() - item.timestamp < item.duration) {
                    cache.set(key, item);
                    return item.data;
                }
                localStorage.removeItem(utils.getCacheKey(key));
            } catch (e) {
                console.error('Error reading cache:', e);
            }
        }
        return null;
    },

    clearCache(key) {
        cache.delete(key);
        localStorage.removeItem(utils.getCacheKey(key));
    }
};

// ===== MANEJO DE ESTADO =====
const stateManager = {
    saveUserData() {
        if (!currentUser) return;
        
        const data = {
            user: currentUser,
            unlocked: Array.from(unlockedContent),
            favorites: Array.from(favoriteContent),
            lastBonus: lastBonusDate
        };
        
        localStorage.setItem('mediahub_data', JSON.stringify(data));
    },

    loadUserData() {
        try {
            const saved = localStorage.getItem('mediahub_data');
            if (!saved) return false;
            
            const data = JSON.parse(saved);
            currentUser = data.user;
            unlockedContent = new Set(data.unlocked || []);
            favoriteContent = new Set(data.favorites || []);
            lastBonusDate = data.lastBonus || null;
            
            return true;
        } catch (error) {
            console.error('Error loading user data:', error);
            return false;
        }
    },

    clearUserData() {
        currentUser = null;
        unlockedContent.clear();
        favoriteContent.clear();
        lastBonusDate = null;
        localStorage.removeItem('mediahub_data');
        
        // Limpiar cache específico del usuario
        cache.clear();
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('mediahub_')) {
                localStorage.removeItem(key);
            }
        });
    },

    updateCoinsDisplay() {
        if (!currentUser) return;
        
        elements.coinsAmount.textContent = currentUser.coins;
        elements.userCoins.textContent = `${currentUser.coins} monedas`;
        
        // Actualizar botones de desbloqueo si no hay suficientes monedas
        document.querySelectorAll('.unlock-btn, .card-btn[data-action="unlock"]').forEach(btn => {
            const cost = parseInt(btn.dataset.cost) || CONFIG.UNLOCK_COST;
            btn.disabled = currentUser.coins < cost;
            btn.title = currentUser.coins < cost ? 
                `Necesitas ${cost} monedas` : 
                `Desbloquear por ${cost} monedas`;
        });
    },

    checkDailyBonus() {
        if (!currentUser) return;
        
        const today = new Date().toDateString();
        if (lastBonusDate !== today) {
            elements.dailyBonusBtn.classList.add('pulse');
            showNotification('¡Bonificación diaria disponible!', 'info');
        } else {
            elements.dailyBonusBtn.classList.remove('pulse');
        }
    }
};

// ===== INTERFAZ DE USUARIO =====
const ui = {
    showLoading() {
        if (isLoading) return;
        isLoading = true;
        elements.loadingOverlay.classList.remove('hidden');
    },

    hideLoading() {
        isLoading = false;
        elements.loadingOverlay.classList.add('hidden');
    },

    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                               type === 'error' ? 'exclamation-circle' : 
                               'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        elements.notificationContainer.appendChild(notification);
        
        // Auto-remover
        setTimeout(() => {
            notification.style.animation = 'slideInLeft 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    },

    showPlatform() {
        elements.authScreen.classList.add('hidden');
        elements.mainHeader.classList.remove('hidden');
        elements.heroSection.classList.remove('hidden');
        elements.mainContent.classList.remove('hidden');
        elements.quickActions.classList.remove('hidden');
        
        elements.userAvatar.textContent = utils.generateAvatar(currentUser.name);
        elements.userDisplayName.textContent = currentUser.name;
        stateManager.updateCoinsDisplay();
        stateManager.checkDailyBonus();
        
        // Cargar contenido inicial
        this.loadInitialContent();
    },

    showSection(sectionId) {
        // Ocultar todas las secciones
        [elements.seriesSection, elements.animeSection, 
         elements.favoritesSection, elements.searchSection].forEach(s => {
            s.classList.add('hidden');
        });
        
        // Mostrar sección solicitada
        const section = document.getElementById(`${sectionId}Section`);
        if (section) {
            section.classList.remove('hidden');
        }
        
        // Actualizar pestañas activas
        elements.tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.section === sectionId) {
                btn.classList.add('active');
            }
        });
        
        // Cargar favoritos si es necesario
        if (sectionId === 'favorites') {
            this.displayFavorites();
        }
    },

    showContentModal(content, type) {
        currentModalContent = { content, type };
        const contentId = content.id || content.mal_id;
        const cacheKey = `${type}_${contentId}`;
        
        const isUnlocked = unlockedContent.has(cacheKey);
        const isFavorite = favoriteContent.has(cacheKey);
        
        // Configurar modal
        elements.modalTitle.textContent = isUnlocked ? 
            (content.name || content.title) : 
            '🔒 Contenido Bloqueado';
        
        elements.modalPoster.src = content.image?.medium || 
                                  content.images?.jpg?.large_image_url || 
                                  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
        elements.modalPoster.alt = content.name || content.title || 'Poster';
        
        elements.modalType.textContent = type === 'series' ? '📺 Serie TV' : '👻 Anime';
        elements.modalGenre.textContent = type === 'series' ? 
            (content.genres?.[0] || 'General') : 
            (content.genres?.[0]?.name || 'General');
        
        elements.modalRating.textContent = isUnlocked ? 
            (type === 'series' ? 
                (content.rating?.average ? `⭐ ${content.rating.average}/10` : 'N/A') : 
                (content.score ? `⭐ ${content.score}/10` : 'N/A')) : 
            '❓ ???';
        
        elements.modalStatus.textContent = isUnlocked ? 
            (content.status || 'Desconocido') : 
            '🔒 Bloqueado';
        
        elements.modalDescription.textContent = isUnlocked ? 
            (type === 'series' ? 
                (content.summary ? content.summary.replace(/<[^>]*>/g, '') : 'Sin descripción disponible.') : 
                (content.synopsis || 'Sin sinopsis disponible.')) : 
            'Este contenido está bloqueado. Desbloquéalo para ver la descripción completa y acceder a todas las funciones.';
        
        // Configurar badge
        elements.modalBadge.textContent = isUnlocked ? '🔓 Desbloqueado' : '🔒 Bloqueado';
        elements.modalBadge.style.background = isUnlocked ? 
            'linear-gradient(135deg, #4CAF50, #00E5FF)' : 
            'linear-gradient(135deg, #FF5252, #FFC107)';
        
        // Configurar botones
        elements.modalWatchBtn.style.display = isUnlocked ? 'flex' : 'none';
        elements.modalUnlockBtn.style.display = isUnlocked ? 'none' : 'flex';
        elements.modalUnlockBtn.disabled = currentUser.coins < CONFIG.UNLOCK_COST;
        elements.modalUnlockBtn.innerHTML = `
            <i class="fas fa-unlock"></i> 
            Desbloquear (${CONFIG.UNLOCK_COST} monedas)
        `;
        
        // Configurar botón de favoritos
        elements.modalFavoriteBtn.innerHTML = `
            <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i> 
            ${isFavorite ? 'En Favoritos' : 'Añadir a Favoritos'}
        `;
        elements.modalFavoriteBtn.classList.toggle('active', isFavorite);
        
        // Mostrar modal
        elements.contentModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    },

    async loadInitialContent() {
        try {
            ui.showLoading();
            await Promise.all([
                contentManager.fetchTVShows(),
                contentManager.fetchAnime()
            ]);
        } catch (error) {
            console.error('Error loading initial content:', error);
            ui.showNotification('Error al cargar contenido', 'error');
        } finally {
            ui.hideLoading();
        }
    },

    displayUserSuggestions(input) {
        if (!input.trim()) {
            elements.userSuggestions.innerHTML = '';
            return;
        }
        
        const suggestions = PREDEFINED_USERS
            .filter(user => 
                user.name.toLowerCase().includes(input.toLowerCase())
            )
            .slice(0, CONFIG.MAX_SUGGESTIONS);
        
        if (suggestions.length === 0) {
            elements.userSuggestions.innerHTML = '';
            return;
        }
        
        elements.userSuggestions.innerHTML = suggestions
            .map(user => `
                <button type="button" class="user-suggestion" data-name="${user.name}">
                    ${user.name}
                </button>
            `).join('');
        
        // Agregar event listeners a las sugerencias
        elements.userSuggestions.querySelectorAll('.user-suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                elements.userNameInput.value = btn.dataset.name;
                elements.userSuggestions.innerHTML = '';
            });
        });
    },

    displayFavorites() {
        if (favoriteContent.size === 0) {
            elements.favoritesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-heart-broken"></i>
                    <h3>No hay favoritos</h3>
                    <p>Añade contenido a favoritos para verlo aquí</p>
                </div>
            `;
            return;
        }
        
        // Aquí implementarías la lógica para mostrar los favoritos
        // Por ahora solo mostramos un mensaje
        elements.favoritesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-heart"></i>
                <h3>${favoriteContent.size} favoritos</h3>
                <p>Funcionalidad completa en desarrollo</p>
            </div>
        `;
    }
};

// ===== GESTIÓN DE CONTENIDO =====
const contentManager = {
    async fetchTVShows() {
        const cacheKey = 'tvmaze_shows';
        const cached = utils.getFromCache(cacheKey);
        
        if (cached) {
            this.displayTVShows(cached);
            return;
        }
        
        try {
            const response = await fetch(CONFIG.TVMAZE_API);
            if (!response.ok) throw new Error('Network response was not ok');
            
            const shows = await response.json();
            const limitedShows = shows.slice(0, 20); // Limitar para mejor rendimiento
            
            utils.saveToCache(cacheKey, limitedShows);
            this.displayTVShows(limitedShows);
        } catch (error) {
            console.error('Error fetching TV shows:', error);
            elements.seriesGrid.innerHTML = `
                <div class="error" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--error-red);">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error al cargar series. Intenta de nuevo.</p>
                    <button onclick="contentManager.fetchTVShows()" class="card-btn unlock-btn" style="margin-top: 15px;">
                        Reintentar
                    </button>
                </div>
            `;
        }
    },

    displayTVShows(shows) {
        elements.seriesGrid.innerHTML = '';
        
        shows.forEach(show => {
            const isUnlocked = unlockedContent.has(`series_${show.id}`);
            const rating = show.rating?.average || 'N/A';
            const genre = show.genres?.[0] || 'General';
            const isFavorite = favoriteContent.has(`series_${show.id}`);
            
            const card = document.createElement('div');
            card.className = `content-card ${isUnlocked ? '' : 'blurred'} ${isFavorite ? 'favorite' : ''}`;
            card.dataset.id = show.id;
            card.dataset.type = 'series';
            
            card.innerHTML = `
                <div class="card-img-container">
                    <img src="${show.image?.medium || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'}" 
                         alt="${show.name}" 
                         class="card-img" 
                         loading="lazy">
                    ${!isUnlocked ? `
                        <div class="censored-overlay">
                            <i class="fas fa-lock"></i>
                            <h3>Bloqueado</h3>
                            <p>${CONFIG.UNLOCK_COST} monedas</p>
                        </div>
                    ` : ''}
                </div>
                <div class="card-content">
                    <div class="card-header">
                        <h3 class="card-title">${isUnlocked ? show.name : '🔒 Bloqueado'}</h3>
                        <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                                data-id="${show.id}" 
                                data-type="series"
                                aria-label="${isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}">
                            <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                    </div>
                    <div class="card-meta">
                        <span class="card-genre">${genre}</span>
                        <span class="card-rating">
                            <i class="fas fa-star"></i> ${isUnlocked ? rating : '??'}
                        </span>
                    </div>
                    <div class="card-actions">
                        <button class="card-btn details-btn" 
                                onclick="ui.showContentModal(${JSON.stringify(show).replace(/"/g, '&quot;')}, 'series')">
                            <i class="fas fa-eye"></i> Detalles
                        </button>
                        ${!isUnlocked ? `
                            <button class="card-btn unlock-btn" 
                                    data-cost="${CONFIG.UNLOCK_COST}"
                                    onclick="unlockContent('series', ${show.id})">
                                <i class="fas fa-unlock"></i> ${CONFIG.UNLOCK_COST}
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            
            elements.seriesGrid.appendChild(card);
        });
        
        // Agregar event listeners para favoritos
        this.attachFavoriteListeners();
    },

    async fetchAnime() {
        const cacheKey = 'jikan_anime';
        const cached = utils.getFromCache(cacheKey);
        
        if (cached) {
            this.displayAnime(cached);
            return;
        }
        
        try {
            const response = await fetch(CONFIG.JIKAN_API);
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            const animeList = data.data.slice(0, 20); // Limitar para mejor rendimiento
            
            utils.saveToCache(cacheKey, animeList);
            this.displayAnime(animeList);
        } catch (error) {
            console.error('Error fetching anime:', error);
            elements.animeGrid.innerHTML = `
                <div class="error" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--error-red);">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error al cargar anime. Intenta de nuevo.</p>
                    <button onclick="contentManager.fetchAnime()" class="card-btn unlock-btn" style="margin-top: 15px;">
                        Reintentar
                    </button>
                </div>
            `;
        }
    },

    displayAnime(animeList) {
        elements.animeGrid.innerHTML = '';
        
        animeList.forEach(anime => {
            const isUnlocked = unlockedContent.has(`anime_${anime.mal_id}`);
            const rating = anime.score || 'N/A';
            const genre = anime.genres?.[0]?.name || 'General';
            const isFavorite = favoriteContent.has(`anime_${anime.mal_id}`);
            
            const card = document.createElement('div');
            card.className = `content-card ${isUnlocked ? '' : 'blurred'} ${isFavorite ? 'favorite' : ''}`;
            card.dataset.id = anime.mal_id;
            card.dataset.type = 'anime';
            
            card.innerHTML = `
                <div class="card-img-container">
                    <img src="${anime.images?.jpg?.large_image_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'}" 
                         alt="${anime.title}" 
                         class="card-img" 
                         loading="lazy">
                    ${!isUnlocked ? `
                        <div class="censored-overlay">
                            <i class="fas fa-lock"></i>
                            <h3>Bloqueado</h3>
                            <p>${CONFIG.UNLOCK_COST} monedas</p>
                        </div>
                    ` : ''}
                </div>
                <div class="card-content">
                    <div class="card-header">
                        <h3 class="card-title">${isUnlocked ? anime.title : '🔒 Bloqueado'}</h3>
                        <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                                data-id="${anime.mal_id}" 
                                data-type="anime"
                                aria-label="${isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}">
                            <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                    </div>
                    <div class="card-meta">
                        <span class="card-genre">${genre}</span>
                        <span class="card-rating">
                            <i class="fas fa-star"></i> ${isUnlocked ? rating : '??'}
                        </span>
                    </div>
                    <div class="card-actions">
                        <button class="card-btn details-btn" 
                                onclick="ui.showContentModal(${JSON.stringify(anime).replace(/"/g, '&quot;')}, 'anime')">
                            <i class="fas fa-eye"></i> Detalles
                        </button>
                        ${!isUnlocked ? `
                            <button class="card-btn unlock-btn" 
                                    data-cost="${CONFIG.UNLOCK_COST}"
                                    onclick="unlockContent('anime', ${anime.mal_id})">
                                <i class="fas fa-unlock"></i> ${CONFIG.UNLOCK_COST}
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            
            elements.animeGrid.appendChild(card);
        });
        
        // Agregar event listeners para favoritos
        this.attachFavoriteListeners();
    },

    attachFavoriteListeners() {
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const type = btn.dataset.type;
                const cacheKey = `${type}_${id}`;
                
                if (favoriteContent.has(cacheKey)) {
                    favoriteContent.delete(cacheKey);
                    btn.classList.remove('active');
                    btn.innerHTML = '<i class="far fa-heart"></i>';
                    btn.setAttribute('aria-label', 'Añadir a favoritos');
                    ui.showNotification('Eliminado de favoritos', 'info');
                } else {
                    favoriteContent.add(cacheKey);
                    btn.classList.add('active');
                    btn.innerHTML = '<i class="fas fa-heart"></i>';
                    btn.setAttribute('aria-label', 'Quitar de favoritos');
                    ui.showNotification('Añadido a favoritos', 'success');
                }
                
                // Actualizar botón en modal si está abierto
                if (currentModalContent && 
                    (currentModalContent.content.id == id || currentModalContent.content.mal_id == id) &&
                    currentModalContent.type === type) {
                    elements.modalFavoriteBtn.classList.toggle('active', favoriteContent.has(cacheKey));
                    elements.modalFavoriteBtn.innerHTML = `
                        <i class="${favoriteContent.has(cacheKey) ? 'fas' : 'far'} fa-heart"></i> 
                        ${favoriteContent.has(cacheKey) ? 'En Favoritos' : 'Añadir a Favoritos'}
                    `;
                }
                
                stateManager.saveUserData();
                
                // Actualizar contador de favoritos en la pestaña
                if (elements.favoritesTab) {
                    const count = favoriteContent.size;
                    elements.favoritesTab.innerHTML = `
                        <i class="fas fa-heart"></i> 
                        Favoritos ${count > 0 ? `<span class="badge">${count}</span>` : ''}
                    `;
                }
            });
        });
    },

    async searchContent(query) {
        if (!query.trim()) {
            ui.showNotification('Ingresa un término de búsqueda', 'error');
            return;
        }
        
        ui.showLoading();
        ui.showSection('search');
        elements.searchTitle.innerHTML = `<i class="fas fa-search"></i> "${query}"`;
        elements.searchGrid.innerHTML = `
            <div class="loading" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Buscando "${query}"...</p>
            </div>
        `;
        
        try {
            const [tvResponse, animeResponse] = await Promise.all([
                fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`),
                fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=8`)
            ]);
            
            const tvResults = await tvResponse.json();
            const animeResults = await animeResponse.json();
            
            this.displaySearchResults(
                tvResults.slice(0, 12),
                animeResults.data?.slice(0, 12) || []
            );
        } catch (error) {
            console.error('Search error:', error);
            elements.searchGrid.innerHTML = `
                <div class="error" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--error-red);">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error en la búsqueda. Intenta de nuevo.</p>
                </div>
            `;
        } finally {
            ui.hideLoading();
        }
    },

    displaySearchResults(tvResults, animeResults) {
        elements.searchGrid.innerHTML = '';
        
        const allResults = [...tvResults, ...animeResults];
        
        if (allResults.length === 0) {
            elements.searchGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No se encontraron resultados</h3>
                    <p>Intenta con otros términos de búsqueda</p>
                </div>
            `;
            return;
        }
        
        allResults.forEach(result => {
            const isTv = result.show !== undefined;
            const content = isTv ? result.show : result;
            const type = isTv ? 'series' : 'anime';
            const id = isTv ? content.id : content.mal_id;
            const cacheKey = `${type}_${id}`;
            
            const isUnlocked = unlockedContent.has(cacheKey);
            const isFavorite = favoriteContent.has(cacheKey);
            
            const card = document.createElement('div');
            card.className = `content-card ${isUnlocked ? '' : 'blurred'} ${isFavorite ? 'favorite' : ''}`;
            card.dataset.id = id;
            card.dataset.type = type;
            
            card.innerHTML = `
                <div class="card-img-container">
                    <img src="${isTv ? 
                        (content.image?.medium || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80') : 
                        (content.images?.jpg?.large_image_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80')}" 
                         alt="${isTv ? content.name : content.title}" 
                         class="card-img" 
                         loading="lazy">
                    ${!isUnlocked ? `
                        <div class="censored-overlay">
                            <i class="fas fa-lock"></i>
                            <h3>Bloqueado</h3>
                        </div>
                    ` : ''}
                </div>
                <div class="card-content">
                    <div class="card-header">
                        <h3 class="card-title">${isUnlocked ? (isTv ? content.name : content.title) : '🔒 Bloqueado'}</h3>
                        <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                                data-id="${id}" 
                                data-type="${type}">
                            <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                    </div>
                    <div class="card-meta">
                        <span class="card-genre">${isTv ? '📺 TV' : '👻 Anime'}</span>
                        <span class="card-rating">
                            <i class="fas fa-star"></i> ${isUnlocked ? 
                                (isTv ? (content.rating?.average || 'N/A') : (content.score || 'N/A')) : 
                                '??'}
                        </span>
                    </div>
                    <div class="card-actions">
                        <button class="card-btn details-btn" 
                                onclick="ui.showContentModal(${JSON.stringify(content).replace(/"/g, '&quot;')}, '${type}')">
                            <i class="fas fa-eye"></i> Detalles
                        </button>
                        ${!isUnlocked ? `
                            <button class="card-btn unlock-btn" 
                                    data-cost="${CONFIG.UNLOCK_COST}"
                                    onclick="unlockContent('${type}', ${id})">
                                <i class="fas fa-unlock"></i> ${CONFIG.UNLOCK_COST}
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            
            elements.searchGrid.appendChild(card);
        });
        
        this.attachFavoriteListeners();
    }
};

// ===== FUNCIONES PRINCIPALES =====
function claimDailyBonus() {
    if (!currentUser) return;
    
    const today = new Date().toDateString();
    if (lastBonusDate === today) {
        ui.showNotification('Ya reclamaste tu bonificación hoy', 'error');
        elements.dailyBonusBtn.classList.add('shake');
        setTimeout(() => elements.dailyBonusBtn.classList.remove('shake'), 500);
        return;
    }
    
    currentUser.coins += CONFIG.DAILY_BONUS;
    lastBonusDate = today;
    stateManager.updateCoinsDisplay();
    stateManager.saveUserData();
    
    ui.showNotification(`¡+${CONFIG.DAILY_BONUS} monedas! Total: ${currentUser.coins}`, 'success');
    elements.dailyBonusBtn.classList.remove('pulse');
    
    // Efecto visual
    elements.dailyBonusBtn.innerHTML = `
        <i class="fas fa-gift"></i>
        <span>¡Reclamado!</span>
    `;
    setTimeout(() => {
        elements.dailyBonusBtn.innerHTML = `
            <i class="fas fa-gift"></i>
            <span>Reclamar bonificación diaria (+${CONFIG.DAILY_BONUS})</span>
        `;
    }, 2000);
}

function unlockContent(type, id) {
    if (!currentUser) return;
    
    if (currentUser.coins < CONFIG.UNLOCK_COST) {
        ui.showNotification(
            `Necesitas ${CONFIG.UNLOCK_COST} monedas. Tienes ${currentUser.coins}.`, 
            'error'
        );
        elements.coinsAmount.classList.add('shake');
        setTimeout(() => elements.coinsAmount.classList.remove('shake'), 500);
        return;
    }
    
    if (confirm(`¿Desbloquear este contenido por ${CONFIG.UNLOCK_COST} monedas?`)) {
        currentUser.coins -= CONFIG.UNLOCK_COST;
        const cacheKey = `${type}_${id}`;
        unlockedContent.add(cacheKey);
        
        stateManager.updateCoinsDisplay();
        stateManager.saveUserData();
        
        // Actualizar modal si está abierto
        if (currentModalContent && 
            (currentModalContent.content.id == id || currentModalContent.content.mal_id == id) &&
            currentModalContent.type === type) {
            ui.showContentModal(currentModalContent.content, type);
        }
        
        // Actualizar tarjetas en la cuadrícula
        const cards = document.querySelectorAll(`.content-card[data-id="${id}"][data-type="${type}"]`);
        cards.forEach(card => {
            card.classList.remove('blurred');
            const overlay = card.querySelector('.censored-overlay');
            if (overlay) overlay.remove();
            
            // Actualizar título y rating
            const title = card.querySelector('.card-title');
            const rating = card.querySelector('.card-rating');
            
            if (title) {
                title.textContent = currentModalContent?.content.name || 
                                  currentModalContent?.content.title || 
                                  (type === 'series' ? 'Serie' : 'Anime');
            }
            
            if (rating) {
                const newRating = type === 'series' ? 
                    (currentModalContent?.content.rating?.average || 'N/A') : 
                    (currentModalContent?.content.score || 'N/A');
                rating.innerHTML = `<i class="fas fa-star"></i> ${newRating}`;
            }
            
            // Reemplazar botón de desbloquear por detalles
            const actions = card.querySelector('.card-actions');
            if (actions) {
                const unlockBtn = actions.querySelector('.unlock-btn');
                if (unlockBtn) {
                    unlockBtn.remove();
                    const detailsBtn = document.createElement('button');
                    detailsBtn.className = 'card-btn details-btn';
                    detailsBtn.innerHTML = '<i class="fas fa-eye"></i> Detalles';
                    detailsBtn.onclick = () => ui.showContentModal(currentModalContent.content, type);
                    actions.appendChild(detailsBtn);
                }
            }
        });
        
        ui.showNotification(
            `¡Desbloqueado! Gastaste ${CONFIG.UNLOCK_COST} monedas. Quedan: ${currentUser.coins}`, 
            'success'
        );
    }
}

function toggleFavorite(contentId, type) {
    if (!currentUser) return;
    
    const cacheKey = `${type}_${contentId}`;
    
    if (favoriteContent.has(cacheKey)) {
        favoriteContent.delete(cacheKey);
        ui.showNotification('Eliminado de favoritos', 'info');
    } else {
        favoriteContent.add(cacheKey);
        ui.showNotification('Añadido a favoritos', 'success');
    }
    
    stateManager.saveUserData();
    
    // Actualizar UI
    const favoriteBtns = document.querySelectorAll(`.favorite-btn[data-id="${contentId}"][data-type="${type}"]`);
    favoriteBtns.forEach(btn => {
        btn.classList.toggle('active', favoriteContent.has(cacheKey));
        btn.innerHTML = `<i class="${favoriteContent.has(cacheKey) ? 'fas' : 'far'} fa-heart"></i>`;
    });
    
    // Actualizar modal si está abierto
    if (currentModalContent && 
        (currentModalContent.content.id == contentId || currentModalContent.content.mal_id == contentId) &&
        currentModalContent.type === type) {
        elements.modalFavoriteBtn.classList.toggle('active', favoriteContent.has(cacheKey));
        elements.modalFavoriteBtn.innerHTML = `
            <i class="${favoriteContent.has(cacheKey) ? 'fas' : 'far'} fa-heart"></i> 
            ${favoriteContent.has(cacheKey) ? 'En Favoritos' : 'Añadir a Favoritos'}
        `;
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Auth Form
    elements.authForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const userName = elements.userNameInput.value.trim();
        if (!userName) {
            ui.showNotification('Ingresa un nombre de usuario', 'error');
            return;
        }
        
        // Buscar usuario existente o crear uno nuevo
        const existingUser = PREDEFINED_USERS.find(u => 
            u.name.toLowerCase() === userName.toLowerCase()
        );
        
        currentUser = existingUser || {
            id: Date.now(),
            name: userName,
            coins: 500
        };
        
        stateManager.saveUserData();
        ui.showPlatform();
    });
    
    // User name input suggestions
    elements.userNameInput.addEventListener('input', utils.debounce(() => {
        ui.displayUserSuggestions(elements.userNameInput.value);
    }, 300));
    
    // Logout
    elements.logoutBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
            stateManager.clearUserData();
            
            elements.mainHeader.classList.add('hidden');
            elements.heroSection.classList.add('hidden');
            elements.mainContent.classList.add('hidden');
            elements.quickActions.classList.add('hidden');
            elements.contentModal.classList.add('hidden');
            elements.authScreen.classList.remove('hidden');
            
            elements.userNameInput.value = '';
            elements.userSuggestions.innerHTML = '';
            
            document.body.style.overflow = 'auto';
        }
    });
    
    // Daily Bonus
    elements.dailyBonusBtn.addEventListener('click', claimDailyBonus);
    elements.quickBonus.addEventListener('click', claimDailyBonus);
    
    // Info Button
    elements.infoBtn.addEventListener('click', () => {
        ui.showNotification(
            `MediaHub v1.0 | Monedas: ${currentUser?.coins || 0} | Desbloqueos: ${unlockedContent.size}`,
            'info'
        );
    });
    
    // Modal
    elements.closeModal.addEventListener('click', () => {
        elements.contentModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    });
    
    elements.modalUnlockBtn.addEventListener('click', () => {
        if (!currentModalContent) return;
        unlockContent(currentModalContent.type, 
                     currentModalContent.content.id || currentModalContent.content.mal_id);
    });
    
    elements.modalWatchBtn.addEventListener('click', () => {
        ui.showNotification('Reproduciendo contenido... 🎬', 'success');
        elements.contentModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    });
    
    elements.modalFavoriteBtn.addEventListener('click', () => {
        if (!currentModalContent) return;
        const id = currentModalContent.content.id || currentModalContent.content.mal_id;
        toggleFavorite(id, currentModalContent.type);
    });
    
    // Cerrar modal con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !elements.contentModal.classList.contains('hidden')) {
            elements.contentModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    });
    
    // Cerrar modal al hacer clic fuera
    elements.contentModal.addEventListener('click', (e) => {
        if (e.target === elements.contentModal) {
            elements.contentModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    });
    
    // Tabs
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            ui.showSection(section);
            elements.searchInput.value = ''; // Limpiar búsqueda
        });
    });
    
    // Search
    const performSearch = utils.debounce(() => {
        const query = elements.searchInput.value.trim();
        if (query) {
            contentManager.searchContent(query);
        }
    }, 500);
    
    elements.searchBtn.addEventListener('click', performSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Back to main
    elements.backToMain.addEventListener('click', () => {
        ui.showSection('series');
        elements.searchInput.value = '';
    });
    
    // Refresh buttons
    elements.refreshSeries.addEventListener('click', () => {
        utils.clearCache('tvmaze_shows');
        contentManager.fetchTVShows();
        ui.showNotification('Series actualizadas', 'success');
    });
    
    elements.refreshAnime.addEventListener('click', () => {
        utils.clearCache('jikan_anime');
        contentManager.fetchAnime();
        ui.showNotification('Anime actualizado', 'success');
    });
    
    // Clear favorites
    elements.clearFavorites.addEventListener('click', () => {
        if (favoriteContent.size === 0) {
            ui.showNotification('No hay favoritos para limpiar', 'info');
            return;
        }
        
        if (confirm(`¿Eliminar ${favoriteContent.size} favoritos?`)) {
            favoriteContent.clear();
            stateManager.saveUserData();
            ui.displayFavorites();
            ui.showNotification('Favoritos eliminados', 'success');
            
            // Actualizar botones de favoritos en toda la UI
            document.querySelectorAll('.favorite-btn.active').forEach(btn => {
                btn.classList.remove('active');
                btn.innerHTML = '<i class="far fa-heart"></i>';
            });
            
            // Actualizar contador en pestaña
            if (elements.favoritesTab) {
                elements.favoritesTab.innerHTML = `
                    <i class="fas fa-heart"></i> Favoritos
                `;
            }
        }
    });
    
    // Quick actions
    elements.quickUnlock.addEventListener('click', () => {
        ui.showNotification('Selecciona un contenido para desbloquear', 'info');
    });
    
    elements.quickFavorites.addEventListener('click', () => {
        ui.showSection('favorites');
    });
    
    // Preload images cuando están en viewport
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                imageObserver.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px 0px',
        threshold: 0.1
    });
    
    // Observar imágenes para lazy loading
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    });
    
    // Manejar conexión/desconexión
    window.addEventListener('online', () => {
        ui.showNotification('Conexión restablecida', 'success');
    });
    
    window.addEventListener('offline', () => {
        ui.showNotification('Sin conexión a internet', 'error');
    });
}

// ===== INICIALIZACIÓN =====
function init() {
    // Cargar datos del usuario
    if (stateManager.loadUserData()) {
        ui.showPlatform();
    }
    
    // Configurar event listeners
    setupEventListeners();
    
    // Configurar Service Worker para PWA (opcional)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
        });
    }
    
    // Mostrar bienvenida
    console.log('MediaHub v1.0 - Plataforma de streaming optimizada');
}

// ===== EXPORTAR FUNCIONES GLOBALES =====
window.ui = ui;
window.contentManager = contentManager;
window.unlockContent = unlockContent;
window.toggleFavorite = toggleFavorite;

// ===== INICIAR APLICACIÓN =====
document.addEventListener('DOMContentLoaded', init);