// ===============================================
// Market Monitoring System - Main Script
// ===============================================

// Real-time clock
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    const clockEl = document.getElementById('currentTime');
    if (clockEl) clockEl.textContent = timeStr;
}

setInterval(updateClock, 1000);
updateClock();

// ===============================================
// Configuration
// ===============================================

// Backend API URL (автоматически определяется для Docker или локального запуска)
const API_BASE_URL = `http://${window.location.hostname}:5000/api`;

let bazarsData = [];
let filteredData = [];
let notificationCache = new Set(); // Кеш для уведомлений

// ===============================================
// Локализация / Internationalization
// ===============================================
const translations = {
    ru: {
        nav: {
            analytics: 'Аналитика',
            containers: 'Контейнеры',
            addService: 'Добавить базар',
            logs: 'Логи'
        },
        dashboard: {
            systemOverview: 'Обзор системы',
            refresh: 'Обновить',
            total: 'Всего',
            online: 'Онлайн',
            offline: 'Оффлайн',
            allBozor: 'Все базары',
            activeBozor: 'Активные базары',
            downBozor: 'Недоступные базары',
            liveData: 'Данные в реальном времени',
            bozorEndpoints: 'Конечные точки базаров',
            establishingConnection: 'Установка соединения',
            fetchingData: 'Получение данных базаров с сервера...',
            noDataAvailable: 'Нет данных',
            checkConnection: 'Проверьте подключение к серверу',
            errorLoading: 'Ошибка загрузки',
            tryAgain: 'Попробуйте обновить страницу',
            search: 'Поиск по названию или городу...',
            filterByCity: 'Фильтр по городу',
            filterByStatus: 'Фильтр по статусу',
            allLocations: 'Все локации',
            allStatuses: 'Все статусы',
            showMap: 'Показать карту'
        },
        modal: {
            addService: {
                title: 'Добавить новый базар',
                tabAdditional: 'Дополнительно (контакты, координаты)',
                serviceName: 'Название базара',
                city: 'Город',
                ipAddress: 'IP адрес',
                frontendPort: 'Порт фронтенда',
                backendPort: 'Порт backend API',
                pgPort: 'Порт PostgreSQL',
                contactInfo: 'Контактная информация',
                contactClickName: 'Имя контакта Click',
                contactClickNamePlaceholder: 'Например: Иван Иванов',
                contactClick: 'Телефон Click',
                contactSccName: 'Имя контакта SCC',
                contactSccNamePlaceholder: 'Например: Петр Петров',
                contactScc: 'Телефон SCC',
                mapCoordinates: 'Координаты на карте',
                latitude: 'Широта',
                longitude: 'Долгота',
                save: 'Сохранить базар',
                cancel: 'Отмена'
            },
            logs: {
                title: 'Системные логи',
                allStatuses: 'Все статусы',
                online: 'Online',
                offline: 'Offline',
                recordsCount: 'Количество записей',
                download: 'Скачать',
                loading: 'Загрузка логов...',
                noLogs: 'Нет логов',
                logsWillAppear: 'Логи появятся при изменении статуса сервисов'
            }
        },
        status: {
            online: 'Онлайн',
            offline: 'Оффлайн',
            added: 'Добавлен',
            updated: 'Изменен',
            deleted: 'Удален'
        },
        logs: {
            previousStatus: 'Было',
            newService: 'Новый сервис добавлен в систему',
            serviceUpdated: 'Сервис изменен',
            serviceDeleted: 'Сервис удален из системы',
            changes: 'Изменения',
            error: 'Ошибка'
        },
        notifications: {
            serviceAdded: 'Сервис успешно добавлен!',
            serviceDeleted: 'Сервис успешно удален!',
            errorAddingService: 'Ошибка добавления сервиса',
            errorDeletingService: 'Ошибка удаления сервиса',
            logsDownloaded: 'Логи скачаны',
            errorExport: 'Ошибка экспорта',
            servicesOffline: 'сервисов offline',
            requireAttention: 'сервисов требуют внимания'
        },
        actions: {
            delete: 'Удалить',
            confirmDelete: 'Вы уверены, что хотите удалить этот сервис?'
        }
    },
    uz: {
        nav: {
            analytics: 'Analitika',
            containers: 'Konteynerlar',
            addService: 'Bozor qo\'shish',
            logs: 'Loglar'
        },
        dashboard: {
            systemOverview: 'Tizim ko\'rinishi',
            refresh: 'Yangilash',
            total: 'Jami',
            online: 'Onlayn',
            offline: 'Oflayn',
            allBozor: 'Barcha bozorlar',
            activeBozor: 'Faol bozorlar',
            downBozor: 'Ishlamayotgan bozorlar',
            liveData: 'Jonli ma\'lumotlar',
            bozorEndpoints: 'Bozor nuqtalari',
            establishingConnection: 'Ulanish o\'rnatilmoqda',
            fetchingData: 'Serverdan bozor ma\'lumotlari yuklanmoqda...',
            noDataAvailable: 'Ma\'lumot yo\'q',
            checkConnection: 'Serverga ulanishni tekshiring',
            errorLoading: 'Yuklashda xatolik',
            tryAgain: 'Sahifani yangilashga harakat qiling',
            search: 'Nom yoki shahar bo\'yicha qidirish...',
            filterByCity: 'Shahar bo\'yicha filtr',
            filterByStatus: 'Status bo\'yicha filtr',
            allLocations: 'Barcha joylar',
            allStatuses: 'Barcha statuslar',
            showMap: 'Xaritani ko\'rsatish'
        },
        modal: {
            addService: {
                title: 'Yangi bozor qo\'shish',
                tabAdditional: 'Qo\'shimcha (kontaktlar, koordinatalar)',
                serviceName: 'Bozor nomi',
                city: 'Shahar',
                ipAddress: 'IP manzil',
                frontendPort: 'Frontend porti',
                backendPort: 'Backend API porti',
                pgPort: 'PostgreSQL porti',
                contactInfo: 'Aloqa ma\'lumotlari',
                contactClickName: 'Click kontakt ismi',
                contactClickNamePlaceholder: 'Masalan: Alisher Aliyev',
                contactClick: 'Click telefoni',
                contactSccName: 'SCC kontakt ismi',
                contactSccNamePlaceholder: 'Masalan: Bobur Boboev',
                contactScc: 'SCC telefoni',
                mapCoordinates: 'Xarita koordinatalari',
                latitude: 'Kenglik',
                longitude: 'Uzunlik',
                save: 'Bozorni saqlash',
                cancel: 'Bekor qilish'
            },
            logs: {
                title: 'Tizim loglari',
                allStatuses: 'Barcha statuslar',
                online: 'Onlayn',
                offline: 'Oflayn',
                recordsCount: 'Yozuvlar soni',
                download: 'Yuklab olish',
                loading: 'Loglar yuklanmoqda...',
                noLogs: 'Loglar yo\'q',
                logsWillAppear: 'Xizmatlar statusi o\'zgarganda loglar paydo bo\'ladi'
            }
        },
        status: {
            online: 'Onlayn',
            offline: 'Oflayn',
            added: 'Qo\'shildi',
            updated: 'O\'zgartirildi',
            deleted: 'O\'chirildi'
        },
        logs: {
            previousStatus: 'Oldingi',
            newService: 'Yangi xizmat tizimga qo\'shildi',
            serviceUpdated: 'Xizmat o\'zgartirildi',
            serviceDeleted: 'Xizmat tizimdan o\'chirildi',
            changes: 'O\'zgarishlar',
            error: 'Xatolik'
        },
        notifications: {
            serviceAdded: 'Xizmat muvaffaqiyatli qo\'shildi!',
            serviceDeleted: 'Xizmat muvaffaqiyatli o\'chirildi!',
            errorAddingService: 'Xizmat qo\'shishda xatolik',
            errorDeletingService: 'Xizmatni o\'chirishda xatolik',
            logsDownloaded: 'Loglar yuklab olindi',
            errorExport: 'Eksport xatoligi',
            servicesOffline: 'xizmatlar oflayn',
            requireAttention: 'xizmatlar e\'tibor talab qiladi'
        },
        actions: {
            delete: 'O\'chirish',
            confirmDelete: 'Ushbu xizmatni o\'chirishni xohlaysizmi?'
        }
    }
};

let currentLang = localStorage.getItem('language') || 'ru';

const elements = {
    totalBazars: document.getElementById('totalBazars'),
    onlineBazars: document.getElementById('onlineBazars'),
    offlineBazars: document.getElementById('offlineBazars'),
    bazarsGrid: document.getElementById('bazarsGrid'),
    searchInput: document.getElementById('searchInput'),
    cityFilter: document.getElementById('cityFilter'),
    statusFilter: document.getElementById('statusFilter'),
    refreshBtn: document.getElementById('refreshBtn'),
    themeToggle: document.getElementById('themeToggle'),
    // Add Service Modal elements
    addServiceBtn: document.getElementById('addServiceBtn'),
    addServiceModal: document.getElementById('addServiceModal'),
    closeAddServiceBtn: document.getElementById('closeAddServiceBtn'),
    addServiceForm: document.getElementById('addServiceForm'),
    // Logs Modal elements
    logsBtn: document.getElementById('logsBtn'),
    logsModal: document.getElementById('logsModal'),
    closeLogsBtn: document.getElementById('closeLogsBtn'),
    logsList: document.getElementById('logsList'),
    logStatusFilter: document.getElementById('logStatusFilter'),
    logLimit: document.getElementById('logLimit')
};

// ===============================================
// Language Management
// ===============================================
function t(key) {
    const keys = key.split('.');
    let value = translations[currentLang];
    for (const k of keys) {
        value = value[k];
        if (!value) return key;
    }
    return value;
}

function updateLanguage() {
    // Обновляем все элементы с data-i18n
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = t(key);
        
        // Для элементов с иконками внутри, обновляем только текстовый узел
        if (element.querySelector('i')) {
            const textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            if (textNode) {
                textNode.textContent = translation;
            } else {
                // Если текстового узла нет, добавляем его после иконки
                element.appendChild(document.createTextNode(translation));
            }
        } else {
            element.textContent = translation;
        }
    });
    
    // Обновляем placeholder'ы
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = t(key);
    });
    
    // Обновляем индикатор языка
    document.getElementById('currentLang').textContent = currentLang.toUpperCase();
    
    // Сохраняем выбор
    localStorage.setItem('language', currentLang);
    
    // Перезагружаем динамический контент
    if (elements.addServiceModal.classList.contains('active')) {
        updateAddServiceModalText();
    }
    if (elements.logsModal.classList.contains('active')) {
        updateLogsModalText();
    }
    
    // Обновляем фильтр городов если есть данные
    if (bazarsData.length > 0) {
        populateCityFilter();
    }
}

function toggleLanguage() {
    currentLang = currentLang === 'ru' ? 'uz' : 'ru';
    updateLanguage();
}

function initLanguage() {
    currentLang = localStorage.getItem('language') || 'ru';
    updateLanguage();
}

// ===============================================
// Theme Management
// ===============================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    const icon = elements.themeToggle.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'fas fa-moon';
    } else {
        icon.className = 'fas fa-sun';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

// ===============================================
// Data Fetching
// ===============================================
async function loadAllBazars() {
    elements.refreshBtn.disabled = true;
    elements.refreshBtn.innerHTML = `<i class="fas fa-sync-alt fa-spin"></i><span>${t('dashboard.refresh')}</span>`;
    
    elements.bazarsGrid.innerHTML = `
        <div class="loading-state">
            <div class="modern-loader">
                <div class="loader-ring"></div>
                <div class="loader-ring"></div>
                <div class="loader-ring"></div>
                <div class="loader-core"></div>
            </div>
            <div class="loading-info">
                <p class="loading-title">${t('dashboard.establishingConnection')}</p>
                <p class="loading-subtitle">${t('dashboard.fetchingData')}</p>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill" style="width: 50%"></div>
            </div>
            <p class="progress-text" id="progressText">${t('dashboard.refresh')}</p>
        </div>
    `;

    try {
        // Запрос к backend API
        const response = await fetch(`${API_BASE_URL}/bazars`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            bazarsData = result.data;
            filteredData = bazarsData;
            
            updateStats();
            populateCityFilter();
            renderBazars();
            updateMapMarkers();
            checkOfflineServices();
        } else {
            throw new Error('Backend returned error');
        }
    } catch (error) {
        console.error('Error loading bazars:', error);
        elements.bazarsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>${t('dashboard.errorLoading')}</h3>
                <p>${error.message}</p>
                <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 1rem;">
                    ${t('dashboard.checkConnection')}
                </p>
            </div>
        `;
    } finally {
        elements.refreshBtn.disabled = false;
        elements.refreshBtn.innerHTML = `<i class="fas fa-sync-alt"></i><span>${t('dashboard.refresh')}</span>`;
    }
}

// ===============================================
// UI Rendering
// ===============================================
function createServiceCard(bazar, index) {
    const card = document.createElement('div');
    card.className = `market-card ${bazar.status}`;

    const statusClass = bazar.status === 'online' ? 'online' : 'offline';
    const statusText = bazar.status === 'online' ? 'Active' : 'Offline';

    // Формируем блок контактов если они есть
    let contactsHtml = '';
    if (bazar.contact_click || bazar.contact_scc) {
        contactsHtml = `
            <div class="endpoint-group" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                <div class="endpoint-header" style="margin-bottom: 0.75rem;">
                    <div class="endpoint-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                        <i class="fas fa-phone"></i>
                    </div>
                    <span class="endpoint-label">Контакты</span>
                </div>
                ${bazar.contact_click ? `
                    <div class="contact-row" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.875rem;">
                        <span style="color: var(--text-muted); min-width: 80px;">Click:</span>
                        <span style="font-weight: 500;">${bazar.contact_click_name || 'N/A'}</span>
                        <a href="tel:${bazar.contact_click}" style="color: var(--primary); text-decoration: none; margin-left: auto;">
                            ${bazar.contact_click}
                        </a>
                    </div>
                ` : ''}
                ${bazar.contact_scc ? `
                    <div class="contact-row" style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem;">
                        <span style="color: var(--text-muted); min-width: 80px;">SCC:</span>
                        <span style="font-weight: 500;">${bazar.contact_scc_name || 'N/A'}</span>
                        <a href="tel:${bazar.contact_scc}" style="color: var(--primary); text-decoration: none; margin-left: auto;">
                            ${bazar.contact_scc}
                        </a>
                    </div>
                ` : ''}
            </div>
        `;
    }

    card.innerHTML = `
        <div class="market-header">
            <div class="market-title-row">
                <div>
                    <h3 class="market-title">${bazar.name || 'Unknown Bozor'}</h3>
                    <div class="market-location">
                        <i class="fas fa-location-dot"></i>
                        <span>${bazar.city || 'Unknown Location'}</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button class="btn-edit" onclick="openEditServiceModal(${bazar.id})" title="Редактировать">
                        <i class="fas fa-pencil"></i>
                    </button>
                    <div class="market-status ${statusClass}">
                        <span class="status-indicator"></span>
                        <span>${statusText}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="market-body">
            <div class="endpoint-group">
                <div class="endpoint-row">
                    <div class="endpoint-header">
                        <div class="endpoint-icon frontend">
                            <i class="fas fa-globe"></i>
                        </div>
                        <span class="endpoint-label">Frontend Service</span>
                    </div>
                    <div class="endpoint-data">
                        <code>${bazar.endpoint.ip}:${bazar.endpoint.port}</code>
                        <button class="btn-copy" onclick="copyToClipboard('${bazar.endpoint.ip}:${bazar.endpoint.port}')" title="Copy endpoint">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>

                <div class="endpoint-row">
                    <div class="endpoint-header">
                        <div class="endpoint-icon backend">
                            <i class="fas fa-server"></i>
                        </div>
                        <span class="endpoint-label">Backend API</span>
                    </div>
                    <div class="endpoint-data">
                        <code>${bazar.endpoint.ip}:${bazar.endpoint.backendPort}</code>
                        <button class="btn-copy" onclick="copyToClipboard('${bazar.endpoint.ip}:${bazar.endpoint.backendPort}')" title="Copy endpoint">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>

                <div class="endpoint-row">
                    <div class="endpoint-header">
                        <div class="endpoint-icon database">
                            <i class="fas fa-database"></i>
                        </div>
                        <span class="endpoint-label">Database</span>
                    </div>
                    <div class="endpoint-data">
                        <code>${bazar.endpoint.ip}:${bazar.endpoint.pgPort}</code>
                        <button class="btn-copy" onclick="copyToClipboard('${bazar.endpoint.ip}:${bazar.endpoint.pgPort}')" title="Copy endpoint">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            ${contactsHtml}
        </div>

        <div class="market-footer">
            <button class="btn-open" onclick="openService('${bazar.endpoint.ip}', ${bazar.endpoint.port})">
                <i class="fas fa-arrow-up-right-from-square"></i>
                <span>Access Bozor</span>
            </button>
        </div>
    `;

    return card;
}

function renderBazars() {
    elements.bazarsGrid.innerHTML = '';

    if (filteredData.length === 0) {
        elements.bazarsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No bozors found</h3>
                <p>Try adjusting your filters</p>
            </div>
        `;
        return;
    }

    filteredData.forEach((bazar, index) => {
        const card = createServiceCard(bazar, index);
        elements.bazarsGrid.appendChild(card);
    });
}

function updateStats() {
    const total = bazarsData.length;
    const online = bazarsData.filter(b => b.status === 'online').length;
    const offline = total - online;

    elements.totalBazars.textContent = total;
    elements.onlineBazars.textContent = online;
    elements.offlineBazars.textContent = offline;
}

function checkOfflineServices() {
    const offlineServices = bazarsData.filter(b => b.status === 'offline');
    
    if (offlineServices.length > 0) {
        // Создаем ключ для кеша на основе offline сервисов
        const offlineKey = offlineServices
            .map(s => `${s.endpoint.ip}:${s.endpoint.port}`)
            .sort()
            .join(',');
        
        // Проверяем, показывали ли мы уже это уведомление
        if (!notificationCache.has(offlineKey)) {
            notificationCache.add(offlineKey);
            showOfflineNotification(offlineServices);
            
            // Очищаем кеш через 5 минут
            setTimeout(() => {
                notificationCache.delete(offlineKey);
            }, 5 * 60 * 1000);
        }
    }
}

function showOfflineNotification(offlineServices) {
    const count = offlineServices.length;
    const serviceNames = offlineServices
        .slice(0, 3)
        .map(s => `${s.name || 'Unknown'} (${s.city || 'Unknown'})`)
        .join(', ');
    
    // Используем единую систему уведомлений
    showNotification(
        `⚠️ ${count} сервис${count > 1 ? 'ов' : ''} offline: ${count > 3 ? `${count} сервисов требуют внимания` : serviceNames}`,
        'error',
        10000 // Показываем дольше для важных уведомлений
    );
}

function populateCityFilter() {
    const cities = [...new Set(bazarsData.map(b => b.city || 'Unknown'))].sort();
    
    elements.cityFilter.innerHTML = `<option value="all" data-i18n="dashboard.allLocations">${t('dashboard.allLocations')}</option>`;
    cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        elements.cityFilter.appendChild(option);
    });
}

// ===============================================
// Filtering & Search
// ===============================================
function applyFilters() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    const cityFilter = elements.cityFilter.value;
    const statusFilter = elements.statusFilter.value;

    filteredData = bazarsData.filter(bazar => {
        const matchesSearch = !searchTerm || 
            (bazar.name && bazar.name.toLowerCase().includes(searchTerm)) ||
            (bazar.city && bazar.city.toLowerCase().includes(searchTerm)) ||
            (bazar.endpoint.ip && bazar.endpoint.ip.includes(searchTerm));
        
        const matchesCity = cityFilter === 'all' || bazar.city === cityFilter;
        const matchesStatus = statusFilter === 'all' || bazar.status === statusFilter;

        return matchesSearch && matchesCity && matchesStatus;
    });

    renderBazars();
}

// ===============================================
// Utility Functions
// ===============================================
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy', 'error');
    });
}

function showNotification(message, type = 'success', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const iconMap = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-triangle-exclamation',
        'info': 'fa-info-circle'
    };
    const icon = iconMap[type] || 'fa-info-circle';
    
    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-xmark"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматически скрыть
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, duration);
}

function openService(ip, port) {
    window.open(`http://${ip}:${port}`, '_blank');
}

// ===============================================
// Event Listeners
// ===============================================
elements.searchInput.addEventListener('input', applyFilters);
elements.cityFilter.addEventListener('change', applyFilters);
elements.statusFilter.addEventListener('change', applyFilters);
elements.refreshBtn.addEventListener('click', () => {
    const icon = elements.refreshBtn.querySelector('i');
    icon.style.animation = 'spin 1s linear';
    setTimeout(() => {
        icon.style.animation = '';
    }, 1000);
    loadAllBazars();
});
elements.themeToggle.addEventListener('click', toggleTheme);
document.getElementById('langToggle').addEventListener('click', toggleLanguage);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+F to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        elements.searchInput.focus();
        elements.searchInput.select();
    }
    
    // R to refresh
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        loadAllBazars();
    }
});

// ===============================================
// Geographic Map
// ===============================================
let uzbekistanMap = null;
let cityMarkers = {};

// Координаты базаров Узбекистана (из location.txt)
const bazarLocations = {
    'MIROBOD DEHQON BOZORI': { lat: 41.291173, lng: 69.274854, city: 'Tashkent' },
    'Oloy Dehqon Bozori': { lat: 41.318803, lng: 69.284862, city: 'Tashkent' },
    'Chigatoy Dehqon Bozori': { lat: 41.338319, lng: 69.221211, city: 'Tashkent' },
    'Chorsu bozori': { lat: 41.326886, lng: 69.235261, city: 'Tashkent' },
    'FARXOD DEHQON BOZORI': { lat: 41.285622, lng: 69.190409, city: 'Tashkent' },
    'Kadeshva Oziq-Ovqat Dehqon Bozori': { lat: 41.286464, lng: 69.348377, city: 'Tashkent' },
    'TTZ Oziq-Ovqat Dehqon Bozori': { lat: 41.355940, lng: 69.385280, city: 'Tashkent' },
    'JARQO\'RG\'ON DEXQON (OZIQ-OVQAT) BOZORI': { lat: 37.508386, lng: 67.413693, city: 'Surxondaryo' },
    'SHO\'RCHI DEHQON (OZIQ-OVQAT) BOZORI': { lat: 38.01247304028448, lng: 67.79188472653348, city: 'Surxondaryo' },
    'TERMIZ SHAHAR DEHQON OZIQ-OVQAT BOZORI': { lat: 37.213056, lng: 67.274903, city: 'Surxondaryo' },
    'SARIOSIYO DEHQON OZIQ-OVQAT BOZORI': { lat: 38.412765, lng: 67.956869, city: 'Surxondaryo' },
    'MARKAZIY DEHQON BOZORI FARG\'ONA': { lat: 40.395890, lng: 71.788552, city: 'Farg\'ona' },
    'QO`QON SHAHAR DEHQON BOZORI': { lat: 40.525339, lng: 70.954376, city: 'Farg\'ona' },
    'Uchko`prik Dehqon Bozori': { lat: 40.544029265896405, lng: 71.06111042694653, city: 'Farg\'ona' }
};

function initMap() {
    // Инициализация карты с центром на Узбекистане
    uzbekistanMap = L.map('uzbekistanMap', {
        center: [41.3, 64.5],
        zoom: 6,
        minZoom: 5,
        maxZoom: 10,
        zoomControl: true,
        attributionControl: false // Убираем атрибуцию
    });

    // Добавляем тайлы карты (темная тема)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(uzbekistanMap);

    // Устанавливаем границы Узбекистана
    const bounds = L.latLngBounds(
        [37.0, 56.0], // Southwest
        [45.5, 73.2]  // Northeast
    );
    uzbekistanMap.setMaxBounds(bounds);
}

// Modal controls
const mapModal = document.getElementById('mapModal');
const openMapBtn = document.getElementById('openMapBtn');
const closeMapBtn = document.getElementById('closeMapBtn');
const fullscreenMapBtn = document.getElementById('fullscreenMapBtn');
const mapModalOverlay = document.querySelector('.map-modal-overlay');

function openMapModal() {
    mapModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Обновляем размер карты после открытия модального окна
    setTimeout(() => {
        if (uzbekistanMap) {
            uzbekistanMap.invalidateSize();
        }
    }, 100);
}

function closeMapModal() {
    mapModal.classList.remove('active');
    mapModal.classList.remove('fullscreen');
    document.body.style.overflow = '';
    
    // Обновляем иконку кнопки
    const icon = fullscreenMapBtn.querySelector('i');
    icon.className = 'fas fa-expand';
}

function toggleFullscreen() {
    mapModal.classList.toggle('fullscreen');
    
    // Обновляем иконку кнопки
    const icon = fullscreenMapBtn.querySelector('i');
    if (mapModal.classList.contains('fullscreen')) {
        icon.className = 'fas fa-compress';
    } else {
        icon.className = 'fas fa-expand';
    }
    
    // Обновляем размер карты
    setTimeout(() => {
        if (uzbekistanMap) {
            uzbekistanMap.invalidateSize();
        }
    }, 100);
}

openMapBtn.addEventListener('click', openMapModal);
closeMapBtn.addEventListener('click', closeMapModal);
fullscreenMapBtn.addEventListener('click', toggleFullscreen);
mapModalOverlay.addEventListener('click', closeMapModal);

// Закрытие по Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mapModal.classList.contains('active')) {
        closeMapModal();
    }
    
    // F11 или F для полноэкранного режима
    if ((e.key === 'f' || e.key === 'F') && mapModal.classList.contains('active') && !e.ctrlKey) {
        e.preventDefault();
        toggleFullscreen();
    }
});

function updateMapMarkers() {
    // Очищаем существующие маркеры
    Object.values(cityMarkers).forEach(marker => marker.remove());
    cityMarkers = {};

    // Группируем базары по локациям для определения статуса
    const locationGroups = {};
    bazarsData.forEach(bazar => {
        // Используем координаты из БД, если они есть
        if (!bazar.latitude || !bazar.longitude) return;
        
        const locationKey = `${bazar.latitude}_${bazar.longitude}`;
        if (!locationGroups[locationKey]) {
            locationGroups[locationKey] = {
                name: bazar.name || 'Unknown',
                coords: { lat: bazar.latitude, lng: bazar.longitude },
                bazars: [],
                online: 0,
                offline: 0
            };
        }
        locationGroups[locationKey].bazars.push(bazar);
        if (bazar.status === 'online') {
            locationGroups[locationKey].online++;
        } else {
            locationGroups[locationKey].offline++;
        }
    });

    // Добавляем маркер для каждой локации
    Object.values(locationGroups).forEach((location, index) => {
        const total = location.bazars.length;
        const online = location.online;
        const offline = location.offline;
        
        // Определяем статус локации
        let status, markerColor, statusText, statusIcon;
        if (offline === 0) {
            status = 'online';
            markerColor = '#00c853';
            statusText = 'Online';
            statusIcon = '✓';
        } else if (online === 0) {
            status = 'offline';
            markerColor = '#ff3d00';
            statusText = 'Offline';
            statusIcon = '✕';
        } else {
            status = 'partial';
            markerColor = '#ffa000';
            statusText = 'Partial';
            statusIcon = '!';
        }
        
        // Создаем улучшенную иконку маркера
        const icon = L.divIcon({
            html: `<div style="
                width: 36px;
                height: 36px;
                background: ${markerColor};
                border: 4px solid white;
                border-radius: 50%;
                box-shadow: 0 6px 12px rgba(0,0,0,0.5);
                position: relative;
                cursor: pointer;
                transition: all 0.3s ease;
            ">
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: white;
                    font-size: 18px;
                    font-weight: bold;
                    line-height: 1;
                ">${statusIcon}</div>
            </div>`,
            className: 'custom-marker',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        // Создаем детальный popup
        const bazarsList = location.bazars.map(b => `
            <div class="city-popup-stat">
                <span class="label">${b.name || 'Unknown'}:</span>
                <span class="value ${b.status}">${b.status === 'online' ? 'Online' : 'Offline'}</span>
            </div>
        `).join('');
        
        const popupContent = `
            <div class="city-popup">
                <div class="city-popup-title">${location.name}</div>
                <div class="city-popup-stats">
                    <div class="city-popup-stat">
                        <span class="label">Location:</span>
                        <span class="value">${location.bazars[0].city || location.coords.city}</span>
                    </div>
                    <div class="city-popup-stat">
                        <span class="label">Status:</span>
                        <span class="value ${status}">${statusText}</span>
                    </div>
                    <div class="city-popup-stat">
                        <span class="label">Total Services:</span>
                        <span class="value">${total}</span>
                    </div>
                    <div class="city-popup-stat">
                        <span class="label">Online:</span>
                        <span class="value online">${online}</span>
                    </div>
                    <div class="city-popup-stat">
                        <span class="label">Offline:</span>
                        <span class="value offline">${offline}</span>
                    </div>
                    <hr style="border: none; border-top: 1px solid rgba(100, 116, 139, 0.3); margin: 0.75rem 0;">
                    ${bazarsList}
                </div>
            </div>
        `;

        // Добавляем маркер на карту
        const marker = L.marker([location.coords.lat, location.coords.lng], { icon })
            .bindPopup(popupContent)
            .addTo(uzbekistanMap);

        cityMarkers[`${location.name}_${index}`] = marker;
    });
}

// ===============================================
// Admin Panel Functions
// ===============================================
function updateAddServiceModalText() {
    // Обновляем заголовок
    document.querySelector('#addServiceModal .admin-modal-title h2').textContent = t('modal.addService.title');
    
    // Обновляем кнопку раскрытия
    document.querySelector('#toggleAdditional span').textContent = t('modal.addService.tabAdditional');
    
    // Обновляем метки полей - Основное
    document.querySelector('label[for="serviceName"]').textContent = t('modal.addService.serviceName');
    document.querySelector('label[for="serviceCity"]').textContent = t('modal.addService.city');
    document.querySelector('label[for="serviceIp"]').textContent = t('modal.addService.ipAddress');
    document.querySelector('label[for="servicePort"]').textContent = t('modal.addService.frontendPort');
    document.querySelector('label[for="serviceBackendPort"]').textContent = t('modal.addService.backendPort');
    document.querySelector('label[for="servicePgPort"]').textContent = t('modal.addService.pgPort');
    
    // Обновляем метки полей - Дополнительно
    document.querySelectorAll('.form-section-title h4')[0].textContent = t('modal.addService.contactInfo');
    document.querySelector('label[for="serviceContactClickName"]').textContent = t('modal.addService.contactClickName');
    document.getElementById('serviceContactClickName').placeholder = t('modal.addService.contactClickNamePlaceholder');
    document.querySelector('label[for="serviceContactClick"]').textContent = t('modal.addService.contactClick');
    document.querySelector('label[for="serviceContactSccName"]').textContent = t('modal.addService.contactSccName');
    document.getElementById('serviceContactSccName').placeholder = t('modal.addService.contactSccNamePlaceholder');
    document.querySelector('label[for="serviceContactScc"]').textContent = t('modal.addService.contactScc');
    document.querySelectorAll('.form-section-title h4')[1].textContent = t('modal.addService.mapCoordinates');
    document.querySelector('label[for="serviceLatitude"]').textContent = t('modal.addService.latitude');
    document.querySelector('label[for="serviceLongitude"]').textContent = t('modal.addService.longitude');
    
    // Обновляем кнопки
    document.querySelector('#addServiceForm .btn-submit span').textContent = t('modal.addService.save');
    document.querySelector('#cancelAddService span').textContent = t('modal.addService.cancel');
}

function updateLogsModalText() {
    // Обновляем заголовок
    document.querySelector('#logsModal .admin-modal-title h2').textContent = t('modal.logs.title');
    
    // Обновляем фильтры
    document.querySelector('#logStatusFilter option[value=""]').textContent = t('modal.logs.allStatuses');
    document.querySelector('#logStatusFilter option[value="online"]').textContent = t('modal.logs.online');
    document.querySelector('#logStatusFilter option[value="offline"]').textContent = t('modal.logs.offline');
    document.querySelector('#logLimit').placeholder = t('modal.logs.recordsCount');
    document.querySelector('#downloadLogsBtn span').textContent = t('modal.logs.download');
}

function openAddServiceModal() {
    elements.addServiceModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    updateAddServiceModalText();
}

function closeAddServiceModal() {
    elements.addServiceModal.classList.remove('active');
    document.body.style.overflow = '';
}

function openLogsModal() {
    elements.logsModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    updateLogsModalText();
    loadLogsList();
}

function closeLogsModal() {
    elements.logsModal.classList.remove('active');
    document.body.style.overflow = '';
}


async function addService(formData) {
    try {
        const response = await fetch(`${API_BASE_URL}/services`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success || response.status === 201) {
            showNotification(`✅ ${formData.name || formData.ip} - ${t('notifications.serviceAdded')}`, 'success');
            elements.addServiceForm.reset();
            closeAddServiceModal(); // Закрываем модальное окно после успешного добавления
            // Обновляем логи только если модальное окно логов открыто
            if (elements.logsModal.classList.contains('active')) {
                loadLogsList();
            }
            loadAllBazars(); // Обновляем основной список
        } else {
            showNotification(result.error || t('notifications.errorAddingService'), 'error');
        }
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
}

async function deleteService(serviceId) {
    if (!confirm(t('actions.confirmDelete'))) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/services/${serviceId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`🗑️ ${t('notifications.serviceDeleted')}`, 'success');
            // Обновляем логи только если модальное окно логов открыто
            if (elements.logsModal.classList.contains('active')) {
                loadLogsList();
            }
            loadAllBazars(); // Обновляем основной список
        } else {
            showNotification(result.error || t('notifications.errorDeletingService'), 'error');
        }
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
}

async function openEditServiceModal(serviceId) {
    try {
        // Получаем данные сервиса из API
        const response = await fetch(`${API_BASE_URL}/status`);
        const result = await response.json();
        
        if (!result.success) {
            showNotification('Ошибка загрузки данных сервиса', 'error');
            return;
        }
        
        const service = result.data.find(s => s.id === serviceId);
        if (!service) {
            showNotification('Сервис не найден', 'error');
            return;
        }
        
        // Заполняем форму редактирования
        document.getElementById('editServiceId').value = service.id;
        document.getElementById('editServiceName').value = service.name || '';
        document.getElementById('editServiceCity').value = service.city || '';
        document.getElementById('editServiceIp').value = service.ip;
        document.getElementById('editServicePort').value = service.port;
        document.getElementById('editServiceBackendPort').value = service.backend_port;
        document.getElementById('editServicePgPort').value = service.pg_port;
        
        // Заполняем контакты
        if (service.contact_click) {
            // Убираем +998 из начала для отображения
            document.getElementById('editServiceContactClick').value = service.contact_click.replace('+998', '');
        } else {
            document.getElementById('editServiceContactClick').value = '';
        }
        document.getElementById('editServiceContactClickName').value = service.contact_click_name || '';
        
        if (service.contact_scc) {
            document.getElementById('editServiceContactScc').value = service.contact_scc.replace('+998', '');
        } else {
            document.getElementById('editServiceContactScc').value = '';
        }
        document.getElementById('editServiceContactSccName').value = service.contact_scc_name || '';
        
        // Заполняем координаты
        document.getElementById('editServiceLatitude').value = service.latitude || '';
        document.getElementById('editServiceLongitude').value = service.longitude || '';
        
        // Открываем модальное окно
        document.getElementById('editServiceModal').classList.add('active');
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
}

function closeEditServiceModal() {
    document.getElementById('editServiceModal').classList.remove('active');
    document.body.style.overflow = '';
}

async function updateService(serviceId, formData) {
    try {
        const response = await fetch(`${API_BASE_URL}/services/${serviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`✅ ${formData.name || formData.ip} - обновлен успешно!`, 'success');
            closeEditServiceModal();
            // Обновляем логи только если модальное окно логов открыто
            if (elements.logsModal.classList.contains('active')) {
                loadLogsList();
            }
            loadAllBazars(); // Обновляем основной список
        } else {
            showNotification(result.error || 'Ошибка обновления сервиса', 'error');
        }
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
}

async function loadLogsList() {
    try {
        const statusFilter = elements.logStatusFilter.value;
        const limit = elements.logLimit.value || 50;
        
        let url = `${API_BASE_URL}/logs?limit=${limit}`;
        if (statusFilter) {
            url += `&status=${statusFilter}`;
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            renderLogsList(result.data);
        } else {
            elements.logsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Ошибка загрузки логов</h3>
                    <p>${result.error || 'Неизвестная ошибка'}</p>
                </div>
            `;
        }
    } catch (error) {
        elements.logsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Ошибка подключения</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function renderLogsList(logs) {
    if (logs.length === 0) {
        elements.logsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-list"></i>
                <h3>${t('modal.logs.noLogs')}</h3>
                <p>${t('modal.logs.logsWillAppear')}</p>
            </div>
        `;
        return;
    }
    
    elements.logsList.innerHTML = logs.map(log => {
        const actionType = log.action_type || 'status_change';
        let icon, statusLabel, statusClass, details;
        
        // Определяем тип действия и стиль
        switch(actionType) {
            case 'service_added':
                icon = 'fa-plus-circle';
                statusLabel = t('status.added');
                statusClass = 'added';
                details = t('logs.newService');
                break;
            case 'service_updated':
                icon = 'fa-edit';
                statusLabel = t('status.updated');
                statusClass = 'updated';
                const changes = log.action_details ? JSON.parse(log.action_details).changes : {};
                const changesList = Object.keys(changes).map(key => 
                    `${key}: ${changes[key].old} → ${changes[key].new}`
                ).join(', ');
                details = `${t('logs.changes')}: ${changesList}`;
                break;
            case 'service_deleted':
                icon = 'fa-trash';
                statusLabel = t('status.deleted');
                statusClass = 'deleted';
                details = t('logs.serviceDeleted');
                break;
            default: // status_change
                icon = 'fa-circle';
                statusLabel = log.status === 'online' ? t('status.online') : t('status.offline');
                statusClass = log.status;
                details = `${log.previous_status ? `${t('logs.previousStatus')}: ${log.previous_status}` : t('status.online')}${log.error_message ? ` | ${t('logs.error')}: ${log.error_message}` : ''}`;
        }
        
        return `
            <div class="log-item log-${actionType}">
                <div class="log-info">
                    <div class="log-service">
                        <i class="fas ${icon}"></i>
                        ${log.bazar_name}
                    </div>
                    <div class="log-status ${statusClass}">
                        <span class="status-badge">${statusLabel}</span>
                    </div>
                    <div class="log-details">${details}</div>
                </div>
                <div class="log-time">
                    <i class="fas fa-clock"></i>
                    ${new Date(log.timestamp).toLocaleString('ru-RU')}
                </div>
            </div>
        `;
    }).join('');
}

async function downloadLogs() {
    try {
        const statusFilter = elements.logStatusFilter.value;
        const limit = elements.logLimit.value || 1000; // Больше логов для экспорта
        
        let url = `${API_BASE_URL}/logs?limit=${limit}`;
        if (statusFilter) {
            url += `&status=${statusFilter}`;
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (!result.success || !result.data) {
            showNotification('Ошибка загрузки логов для экспорта', 'error');
            return;
        }
        
        // Формируем текстовый файл
        let logText = '='.repeat(80) + '\n';
        logText += 'BAZAR MONITORING SYSTEM - SYSTEM LOGS\n';
        logText += `Exported: ${new Date().toLocaleString('ru-RU')}\n`;
        logText += `Total Records: ${result.data.length}\n`;
        logText += '='.repeat(80) + '\n\n';
        
        result.data.forEach((log, index) => {
            const actionType = log.action_type || 'status_change';
            let actionLabel = '';
            
            switch(actionType) {
                case 'service_added':
                    actionLabel = '[ДОБАВЛЕН]';
                    break;
                case 'service_updated':
                    actionLabel = '[ИЗМЕНЕН]';
                    break;
                case 'service_deleted':
                    actionLabel = '[УДАЛЕН]';
                    break;
                default:
                    actionLabel = log.status === 'online' ? '[ONLINE]' : '[OFFLINE]';
            }
            
            logText += `${index + 1}. ${actionLabel} ${log.bazar_name}\n`;
            logText += `   IP: ${log.bazar_ip}:${log.bazar_port}\n`;
            logText += `   Город: ${log.city || 'Unknown'}\n`;
            logText += `   Время: ${new Date(log.timestamp).toLocaleString('ru-RU')}\n`;
            
            if (log.previous_status) {
                logText += `   Предыдущий статус: ${log.previous_status}\n`;
            }
            
            if (log.error_message) {
                logText += `   Ошибка: ${log.error_message}\n`;
            }
            
            if (log.action_details) {
                try {
                    const details = JSON.parse(log.action_details);
                    if (details.changes) {
                        logText += `   Изменения:\n`;
                        Object.keys(details.changes).forEach(key => {
                            logText += `      ${key}: ${details.changes[key].old} → ${details.changes[key].new}\n`;
                        });
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }
            }
            
            logText += '\n' + '-'.repeat(80) + '\n\n';
        });
        
        // Создаем и скачиваем файл
        const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `bazar_logs_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        
        showNotification(`📥 ${t('notifications.logsDownloaded')} (${result.data.length})`, 'success');
        
    } catch (error) {
        showNotification(`Ошибка экспорта: ${error.message}`, 'error');
    }
}

// ===============================================
// Event Listeners for Modals
// ===============================================
// Add Service Modal
elements.addServiceBtn.addEventListener('click', openAddServiceModal);
elements.closeAddServiceBtn.addEventListener('click', closeAddServiceModal);

// Edit Service Modal
document.getElementById('closeEditServiceBtn').addEventListener('click', closeEditServiceModal);
document.getElementById('cancelEditService').addEventListener('click', closeEditServiceModal);

// Logs Modal
elements.logsBtn.addEventListener('click', openLogsModal);
elements.closeLogsBtn.addEventListener('click', closeLogsModal);

// Закрытие по клику на overlay
document.querySelectorAll('.admin-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeAddServiceModal();
            closeEditServiceModal();
            closeLogsModal();
        }
    });
});

// Раскрытие/скрытие дополнительных полей
document.getElementById('toggleAdditional').addEventListener('click', function() {
    const content = document.getElementById('additionalContent');
    const button = this;
    
    button.classList.toggle('active');
    content.classList.toggle('active');
});

// Раскрытие/скрытие дополнительных полей в форме редактирования
document.getElementById('toggleEditAdditional').addEventListener('click', function() {
    const content = document.getElementById('editAdditionalContent');
    const button = this;
    
    button.classList.toggle('active');
    content.classList.toggle('active');
});

// Форма добавления сервиса
elements.addServiceForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(elements.addServiceForm);
    const serviceData = {
        name: formData.get('name'),
        city: formData.get('city'),
        ip: formData.get('ip'),
        port: parseInt(formData.get('port')),
        backend_port: parseInt(formData.get('backend_port')),
        pg_port: parseInt(formData.get('pg_port'))
    };
    
    // Добавляем контакты если заполнены
    const contactClick = formData.get('contact_click');
    const contactClickName = formData.get('contact_click_name');
    const contactScc = formData.get('contact_scc');
    const contactSccName = formData.get('contact_scc_name');
    
    if (contactClick && contactClick.trim()) {
        serviceData.contact_click = '+998' + contactClick.trim();
    }
    if (contactClickName && contactClickName.trim()) {
        serviceData.contact_click_name = contactClickName.trim();
    }
    if (contactScc && contactScc.trim()) {
        serviceData.contact_scc = '+998' + contactScc.trim();
    }
    if (contactSccName && contactSccName.trim()) {
        serviceData.contact_scc_name = contactSccName.trim();
    }
    
    // Добавляем координаты если заполнены
    const latitude = formData.get('latitude');
    const longitude = formData.get('longitude');
    if (latitude && latitude.trim()) {
        serviceData.latitude = parseFloat(latitude);
    }
    if (longitude && longitude.trim()) {
        serviceData.longitude = parseFloat(longitude);
    }
    
    addService(serviceData);
});

// Кнопка отмены формы
document.getElementById('cancelAddService').addEventListener('click', () => {
    elements.addServiceForm.reset();
    closeAddServiceModal();
});

// Форма редактирования сервиса
document.getElementById('editServiceForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(document.getElementById('editServiceForm'));
    const serviceId = parseInt(document.getElementById('editServiceId').value);
    const serviceData = {
        name: formData.get('name'),
        city: formData.get('city'),
        backend_port: parseInt(formData.get('backend_port')),
        pg_port: parseInt(formData.get('pg_port'))
    };
    
    // Добавляем контакты если заполнены
    const contactClick = formData.get('contact_click');
    const contactClickName = formData.get('contact_click_name');
    const contactScc = formData.get('contact_scc');
    const contactSccName = formData.get('contact_scc_name');
    
    if (contactClick && contactClick.trim()) {
        serviceData.contact_click = '+998' + contactClick.trim();
    } else {
        serviceData.contact_click = null;
    }
    if (contactClickName && contactClickName.trim()) {
        serviceData.contact_click_name = contactClickName.trim();
    } else {
        serviceData.contact_click_name = null;
    }
    if (contactScc && contactScc.trim()) {
        serviceData.contact_scc = '+998' + contactScc.trim();
    } else {
        serviceData.contact_scc = null;
    }
    if (contactSccName && contactSccName.trim()) {
        serviceData.contact_scc_name = contactSccName.trim();
    } else {
        serviceData.contact_scc_name = null;
    }
    
    // Добавляем координаты если заполнены
    const latitude = formData.get('latitude');
    const longitude = formData.get('longitude');
    if (latitude && latitude.trim()) {
        serviceData.latitude = parseFloat(latitude);
    } else {
        serviceData.latitude = null;
    }
    if (longitude && longitude.trim()) {
        serviceData.longitude = parseFloat(longitude);
    } else {
        serviceData.longitude = null;
    }
    
    updateService(serviceId, serviceData);
});

// Кнопка удаления в форме редактирования
document.getElementById('deleteEditService').addEventListener('click', () => {
    const serviceId = parseInt(document.getElementById('editServiceId').value);
    closeEditServiceModal();
    deleteService(serviceId);
});

// Фильтры логов
elements.logStatusFilter.addEventListener('change', loadLogsList);
elements.logLimit.addEventListener('change', loadLogsList);

// Скачивание логов
document.getElementById('downloadLogsBtn').addEventListener('click', downloadLogs);

// ===============================================
// Initialization
// ===============================================
initLanguage();
initTheme();
initMap();
loadAllBazars();

// Optional: Auto-refresh every 60 seconds
// setInterval(loadAllBazars, 60000);
