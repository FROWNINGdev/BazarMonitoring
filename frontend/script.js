// ===============================================
// Camera and ROI Data Functions
// ===============================================

/**
 * Получает список всех камер для базара
 * @param {string} ip - IP адрес базара
 * @param {number} backendPort - Порт backend сервиса
 * @returns {Promise<Array>} - Список камер
 */
async function fetchCamerasForBazaar(ip, backendPort) {
    try {
        const camerasApiUrl = `http://${ip}:${backendPort}/api/cameras`;
        const response = await fetch(camerasApiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            mode: 'cors',
            timeout: 5000
        });

        if (response.ok) {
            const data = await response.json();
            return data.data || data || [];
        } else {
            console.warn(`Failed to fetch cameras for ${ip}:${backendPort}, status: ${response.status}`);
            return [];
        }
    } catch (error) {
        console.warn(`Error fetching cameras for ${ip}:${backendPort}:`, error);
        return [];
    }
}

/**
 * Получает ROI для конкретной камеры
 * @param {string} ip - IP адрес базара
 * @param {number} backendPort - Порт backend сервиса
 * @param {string|number} cameraId - ID камеры
 * @returns {Promise<Array>} - Список ROI
 */
async function fetchROIsForCamera(ip, backendPort, cameraId) {
    try {
        const roisApiUrl = `http://${ip}:${backendPort}/api/cameras/${cameraId}/rois`;
        const response = await fetch(roisApiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            mode: 'cors',
            timeout: 5000
        });

        if (response.ok) {
            const data = await response.json();
            return data.data || data || [];
        } else {
            console.warn(`Failed to fetch ROIs for camera ${cameraId} at ${ip}:${backendPort}, status: ${response.status}`);
            return [];
        }
    } catch (error) {
        console.warn(`Error fetching ROIs for camera ${cameraId} at ${ip}:${backendPort}:`, error);
        return [];
    }
}

/**
 * Получает детальную статистику по камерам и ROI для базара
 * @param {Object} bazar - Объект базара
 * @returns {Promise<Object>} - Статистика по камерам и ROI
 */
async function getDetailedCameraStatsForBazaar(bazar) {
    const stats = {
        totalCameras: 0,
        onlineCameras: 0,
        offlineCameras: 0,
        camerasWithROI: 0,
        totalROIs: 0,
        roiTypes: {
            rasta: 0,
            food: 0,
            animal: 0
        }
    };

    // Проверяем доступность базара
    if (bazar.status !== 'online' || !bazar.endpoint) {
        return stats;
    }

    try {
        let ip, backendPort;

        // Определяем IP и порт из разных возможных структур данных
        if (bazar.endpoint && bazar.endpoint.ip && bazar.endpoint.backendPort) {
            ip = bazar.endpoint.ip;
            backendPort = bazar.endpoint.backendPort;
        } else if (bazar.endpoint && bazar.endpoint.ip && bazar.backend) {
            ip = bazar.endpoint.ip;
            backendPort = bazar.backend;
        } else if (bazar.ipAddress && bazar.backendPort) {
            ip = bazar.ipAddress;
            backendPort = bazar.backendPort;
        } else if (bazar.endpoint && bazar.endpoint.ip && bazar.endpoint.backend) {
            ip = bazar.endpoint.ip;
            backendPort = bazar.endpoint.backend;
        }

        if (!ip || !backendPort) {
            console.warn(`No valid IP/port found for bazaar ${bazar.name}`);
            return stats;
        }

        // Получаем список камер
        const cameras = await fetchCamerasForBazaar(ip, backendPort);
        stats.totalCameras = cameras.length;

        if (cameras.length === 0) {
            return stats;
        }

        // Обрабатываем каждую камеру параллельно
        const cameraPromises = cameras.map(async (camera) => {
            const cameraStats = {
                isOnline: false,
                hasROI: false,
                roiCount: 0,
                roiTypes: { rasta: 0, food: 0, animal: 0 }
            };

            // Определяем статус камеры
            cameraStats.isOnline = camera.hasError === false || camera.status === 'online';

            // Получаем ROI для камеры
            try {
                const rois = await fetchROIsForCamera(ip, backendPort, camera.id);
                cameraStats.roiCount = rois.length;
                cameraStats.hasROI = rois.length > 0;

                // Подсчитываем типы ROI
                rois.forEach(roi => {
                    if (roi.type === 1 || roi.roiType === 1 || roi.type === 'RASTA') {
                        cameraStats.roiTypes.rasta++;
                    } else if (roi.type === 2 || roi.roiType === 2 || roi.type === 'FOOD') {
                        cameraStats.roiTypes.food++;
                    } else if (roi.type === 3 || roi.roiType === 3 || roi.type === 'ANIMAL') {
                        cameraStats.roiTypes.animal++;
                    }
                });
            } catch (error) {
                console.warn(`Error processing camera ${camera.id}:`, error);
            }

            return cameraStats;
        });

        const cameraStatsResults = await Promise.allSettled(cameraPromises);

        // Агрегируем результаты
        cameraStatsResults.forEach(result => {
            if (result.status === 'fulfilled') {
                const cameraStats = result.value;

                if (cameraStats.isOnline) {
                    stats.onlineCameras++;
                } else {
                    stats.offlineCameras++;
                }

                if (cameraStats.hasROI) {
                    stats.camerasWithROI++;
                }

                stats.totalROIs += cameraStats.roiCount;
                stats.roiTypes.rasta += cameraStats.roiTypes.rasta;
                stats.roiTypes.food += cameraStats.roiTypes.food;
                stats.roiTypes.animal += cameraStats.roiTypes.animal;
            }
        });

    } catch (error) {
        console.error(`Error getting detailed camera stats for bazaar ${bazar.name}:`, error);
    }

    return stats;
}

// ===============================================
// Excel Export Functions
// ===============================================

async function exportToExcel() {
    try {
        // Получаем данные статистики
        const statsData = getCurrentStatsData();

        if (!statsData) {
            showNotification('Нет данных для экспорта', 'warning');
            return;
        }

        // Создаем рабочую книгу Excel
        const wb = XLSX.utils.book_new();

        // Определяем язык для экспорта
        const isUzbek = currentLang === 'uz';

        // Лист 1: Общая статистика
        const overviewData = [
            [isUzbek ? 'Ko\'rsatkich' : 'Показатель', isUzbek ? 'Qiymat' : 'Значение'],
            [isUzbek ? 'Jami bozorlar' : 'Всего базаров', statsData.totalBazars || 0],
            [isUzbek ? 'Onlayn' : 'Онлайн', statsData.onlineBazars || 0],
            [isUzbek ? 'Oflayn' : 'Оффлайн', statsData.offlineBazars || 0],
            [isUzbek ? 'Jami kameralar' : 'Всего камер', statsData.totalCameras || 0],
            [isUzbek ? 'Ishlamoqda kameralar' : 'Работает камер', statsData.onlineCameras || 0],
            [isUzbek ? 'Ishlamaydi kameralar' : 'Не работает камер', statsData.offlineCameras || 0],
            [isUzbek ? 'Mavjudlik foizi' : 'Процент доступности', `${statsData.uptimePercentage || 0}%`]
        ];

        const ws1 = XLSX.utils.aoa_to_sheet(overviewData);
        XLSX.utils.book_append_sheet(wb, ws1, isUzbek ? 'Bozor statistikasi' : 'Общая статистика');

        // Лист 2: Детальная статистика по базарам
        const detailedData = [
            [
                isUzbek ? 'Nom' : 'Название',
                isUzbek ? 'Shahar' : 'Город',
                isUzbek ? 'Status' : 'Статус',
                isUzbek ? 'Jami kameralar' : 'Всего камер',
                isUzbek ? 'Onlayn kameralar' : 'Онлайн камер',
                isUzbek ? 'Oflayn kameralar' : 'Офлайн камер',
                isUzbek ? 'Kameralar ROI bilan' : 'Камеры с ROI'
            ]
        ];

        // Добавляем данные по каждому базару
        if (statsData.bazars && Array.isArray(statsData.bazars)) {
            // Получаем детальную статистику для каждого базара
            const detailedStatsPromises = statsData.bazars.map(async (bazar) => {
                const detailedCameraStats = await getDetailedCameraStatsForBazaar(bazar);
                return {
                    bazar,
                    detailedCameraStats
                };
            });

            const detailedStatsResults = await Promise.allSettled(detailedStatsPromises);

            detailedStatsResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    const { bazar, detailedCameraStats } = result.value;
                    detailedData.push([
                        bazar.name || '',
                        bazar.city || '',
                        bazar.status === 'online' ? (isUzbek ? 'Onlayn' : 'Онлайн') : (isUzbek ? 'Oflayn' : 'Оффлайн'),
                        detailedCameraStats.totalCameras || 0,
                        detailedCameraStats.onlineCameras || 0,
                        detailedCameraStats.offlineCameras || 0,
                        detailedCameraStats.camerasWithROI || 0
                    ]);
                } else {
                    // Если не удалось получить детальную статистику, добавляем базовые данные
                    const bazar = result.reason?.bazar || {};
                    detailedData.push([
                        bazar.name || '',
                        bazar.city || '',
                        bazar.status === 'online' ? (isUzbek ? 'Onlayn' : 'Онлайн') : (isUzbek ? 'Oflayn' : 'Оффлайн'),
                        0,
                        0,
                        0,
                        0
                    ]);
                }
            });
        }

        const ws2 = XLSX.utils.aoa_to_sheet(detailedData);

        // Styling function
        const applyHeaderStyle = (ws) => {
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_cell({ r: 0, c: C });
                if (!ws[address]) continue;
                ws[address].s = {
                    font: { bold: true, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "4F81BD" } },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin", color: { auto: 1 } },
                        bottom: { style: "thin", color: { auto: 1 } },
                        left: { style: "thin", color: { auto: 1 } },
                        right: { style: "thin", color: { auto: 1 } }
                    }
                };
            }
        };

        const applyCellStyle = (ws) => {
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const address = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!ws[address]) continue;
                    ws[address].s = {
                        alignment: { horizontal: "center", vertical: "center" },
                        border: {
                            top: { style: "thin", color: { auto: 1 } },
                            bottom: { style: "thin", color: { auto: 1 } },
                            left: { style: "thin", color: { auto: 1 } },
                            right: { style: "thin", color: { auto: 1 } }
                        }
                    };
                }
            }
        };

        // Apply styles
        applyHeaderStyle(ws1);
        applyCellStyle(ws1);
        ws1['!cols'] = [{ wch: 30 }, { wch: 15 }];

        applyHeaderStyle(ws2);
        applyCellStyle(ws2);
        ws2['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

        XLSX.utils.book_append_sheet(wb, ws2, isUzbek ? 'Bozorlar statistika' : 'Статистика базаров');

        // Лист 3: Статистика по областям
        const regionsData = [
            [
                isUzbek ? 'Viloyat' : 'Область',
                isUzbek ? 'Jami bozorlar' : 'Всего базаров',
                isUzbek ? 'Onlayn' : 'Онлайн',
                isUzbek ? 'Oflayn' : 'Оффлайн',
                isUzbek ? 'Jami kameralar' : 'Всего камер',
                isUzbek ? 'Ishlamoqda kameralar' : 'Работает камер'
            ]
        ];

        if (statsData.regionsStats && Object.keys(statsData.regionsStats).length > 0) {
            Object.entries(statsData.regionsStats).forEach(([region, stats]) => {
                regionsData.push([
                    region,
                    stats.totalBazars || 0,
                    stats.onlineBazars || 0,
                    stats.offlineBazars || 0,
                    stats.totalCameras || 0,
                    stats.onlineCameras || 0
                ]);
            });
        } else {
            // Если нет данных по областям, добавляем информационную строку
            regionsData.push([isUzbek ? 'Viloyatlar bo\'yicha ma\'lumot yo\'q' : 'Нет данных по областям', '', '', '', '', '']);
        }

        const ws3 = XLSX.utils.aoa_to_sheet(regionsData);
        applyHeaderStyle(ws3);
        applyCellStyle(ws3);
        ws3['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

        XLSX.utils.book_append_sheet(wb, ws3, isUzbek ? 'Viloyatlar statistika' : 'Статистика областей');

        // Генерируем имя файла с текущей датой и языком
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const langSuffix = isUzbek ? '_uz' : '_ru';
        const fileName = `bazar_statistics_${dateStr}_${timeStr}${langSuffix}.xlsx`;

        // Скачиваем файл
        XLSX.writeFile(wb, fileName);

        const successMessage = isUzbek ?
            'Statistika muvaffaqiyatli Excel fayliga eksport qilindi!' :
            'Статистика успешно экспортирована в Excel!';
        showNotification(successMessage, 'success');

    } catch (error) {
        console.error('Ошибка экспорта в Excel:', error);
        const isUzbek = currentLang === 'uz';
        const errorMessage = isUzbek ?
            'Excel fayliga eksport qilishda xatolik: ' + error.message :
            'Ошибка при экспорте в Excel: ' + error.message;
        showNotification(errorMessage, 'error');
    }
}

function getCurrentStatsData() {
    // Получаем данные из текущего состояния приложения
    const statsData = {
        totalBazars: parseInt(document.getElementById('totalBazarsStats')?.textContent) || 0,
        onlineBazars: parseInt(document.getElementById('onlineBazarsStats')?.textContent) || 0,
        offlineBazars: parseInt(document.getElementById('offlineBazarsStats')?.textContent) || 0,
        totalCameras: parseInt(document.getElementById('totalCamerasStats')?.textContent) || 0,
        onlineCameras: parseInt(document.getElementById('onlineCamerasStats')?.textContent) || 0,
        offlineCameras: parseInt(document.getElementById('offlineCamerasStats')?.textContent) || 0,
        uptimePercentage: 0,
        bazars: bazarsData || [],
        regionsStats: currentRegionsStats || {}
    };

    // Вычисляем процент доступности
    if (statsData.totalBazars > 0) {
        statsData.uptimePercentage = Math.round((statsData.onlineBazars / statsData.totalBazars) * 100);
    }

    console.log('Export data:', statsData);
    return statsData;
}

// ===============================================

// Real-time clock
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // Форматируем дату с переводом месяца
    const day = now.getDate();
    const monthIndex = now.getMonth();
    const year = now.getFullYear();

    // Проверяем, доступны ли translations и getMonthName
    let monthName;
    if (typeof getMonthName === 'function' && typeof translations !== 'undefined') {
        try {
            monthName = getMonthName(monthIndex);
        } catch (e) {
            // Если переводы еще не загружены, используем стандартный формат
            monthName = now.toLocaleDateString('ru-RU', { month: 'long' });
        }
    } else {
        // Если переводы еще не загружены, используем стандартный формат
        monthName = now.toLocaleDateString('ru-RU', { month: 'long' });
    }

    let dateStr;
    if (typeof currentLang !== 'undefined' && currentLang === 'uz') {
        dateStr = `${day} ${monthName} ${year} y.`;
    } else if (typeof currentLang !== 'undefined' && currentLang === 'en') {
        dateStr = `${monthName} ${day}, ${year}`;
    } else {
        dateStr = `${day} ${monthName} ${year} г.`;
    }

    // Обновляем время в сайдбаре
    const clockEl = document.getElementById('currentTime');
    if (clockEl) {
        clockEl.textContent = timeStr;
    }

    // Обновляем дату в сайдбаре
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        dateEl.textContent = dateStr;
    }
}

// Запускаем обновление часов только после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setInterval(updateClock, 1000);
        updateClock();
    });
} else {
    setInterval(updateClock, 1000);
    updateClock();
}

// ===============================================
// Configuration
// ===============================================

// Backend API URL (автоматически определяется для Docker или локального запуска)
const API_BASE_URL = `http://${window.location.hostname}:5000/api`;

let bazarsData = [];
let filteredData = [];
let notificationCache = new Set(); // Кеш для уведомлений
let currentRegionsStats = {}; // Глобальная переменная для статистики по областям

// ===============================================
// Локализация / Internationalization
// ===============================================
const translations = {
    ru: {
        nav: {
            analytics: 'Аналитика',
            containers: 'Контейнеры',
            addService: 'Добавить базар',
            logs: 'Логи',
            generalStats: 'Общая статистика',
            map: 'Карта',
            theme: 'Тема',
            menu: 'Меню'
        },
        sidebar: {
            title: 'Меню',
            statistics: 'Статистика',
            settings: 'Настройки',
            external: 'Внешние сервисы',
            management: 'Управление',
            calendar: 'Календарь'
        },
        dashboard: {
            systemOverview: 'Статус базаров',
            generalOverview: 'Общий обзор',
            bazars: 'Базары',
            bazarsList: 'Список базаров',
            api: 'API',
            database: 'База данных',
            refresh: 'Обновить',
            total: 'Всего',
            online: 'Онлайн',
            offline: 'Оффлайн',
            operational: 'Работает',
            requiresAction: 'Не работает',
            allBozor: 'Все базары',
            activeBozor: 'Активные базары',
            downBozor: 'Недоступные базары',
            liveData: 'Данные в реальном времени',
            bozorEndpoints: 'Конечные точки базаров',
            establishingConnection: 'Установка соединения',
            fetchingData: 'Получение данных базаров с сервера...',
            loadingDetailedStatistics: 'Загрузка детальной статистики',
            fetchingCameraData: 'Получение данных о камерах и ROI...',
            noDataAvailable: 'Нет данных',
            checkConnection: 'Проверьте подключение к серверу',
            errorLoading: 'Ошибка загрузки',
            tryAgain: 'Попробуйте обновить страницу',
            search: 'Поиск по названию или городу...',
            filterByCity: 'Фильтр по регионам',
            filterByStatus: 'Фильтр по статусу',
            all: 'Все',
            allLocations: 'Фильтр по регионам',
            allStatuses: 'Фильтр по статусу',
            showMap: 'Показать карту',
            noBazarsFound: 'Базары не найдены',
            tryAdjustingFilters: 'Попробуйте изменить фильтры',
            city: 'Город / Область'
        },
        cameras: {
            title: 'Статистика камер',
            total: 'Всего камер',
            online: 'Онлайн',
            offline: 'Оффлайн',
            working: 'Работает',
            notWorking: 'Не работает',
            types: 'Типы камер',
            rastaFood: 'RastaFood',
            peopleCounting: 'Подсчет людей',
            animals: 'Животные',
            vehicleCounting: 'Подсчет транспорта',
            dataUnavailable: 'Данные недоступны',
            accessBozor: 'Открыть базар',
            unavailable: 'Статистика камер недоступна',
            endpoints: 'Endpoints',
            frontendService: 'Frontend сервис',
            backendApi: 'Backend API',
            database: 'База данных',
            exportRois: 'Экспорт ROI',
            exportStreams: 'Экспорт потоков',
            copyEndpoint: 'Копировать endpoint'
        },
        statistics: {
            title: 'Общая статистика базаров',
            overview: 'Общая статистика',
            cameras: 'Статистика камер',
            detailed: 'Детальная статистика по базарам',
            totalBazars: 'Всего базаров',
            onlineBazars: 'Онлайн',
            offlineBazars: 'Оффлайн',
            totalCameras: 'Всего камер',
            workingCameras: 'Работает',
            notWorkingCameras: 'Не работает',
            byRegions: 'Статистика по областям',
            region: 'Область',
            bazarsInRegion: 'Базаров в области',
            camerasInRegion: 'Камер в области',
            camerasWithROI: 'Камер с ROI',
            totalROI: 'Всего ROI',
            roiStatistics: 'ROI статистика',
            rasta: 'RASTA (Люди)',
            food: 'FOOD (Еда)',
            peopleCounting: 'Подсчет людей',
            location: 'Локация',
            status: 'Статус',
            totalServices: 'Всего сервисов',
            systemHealth: 'Здоровье системы',
            uptime: 'Доступность',
            online: 'Онлайн',
            offline: 'Оффлайн',
            table: {
                name: 'Название',
                region: 'Регион',
                status: 'Статус',
                cameras: 'Камеры (Вкл/Всего)',
                roi: 'ROI',
                actions: 'Действия'
            }
        },
        modal: {
            addService: {
                title: 'Добавить новый базар',
                tabAdditional: 'Дополнительно (контакты, координаты)',
                serviceName: 'Название базара',
                city: 'Город / Область',
                ipAddress: 'IP адрес',
                frontendPort: 'Порт фронтенда',
                backendPort: 'Порт backend API',
                pgPort: 'Порт PostgreSQL',
                streamPort: 'Порт Stream',
                contactInfo: 'Контактная информация',
                contactClickName: 'Имя контакта Click',
                contactClickNamePlaceholder: 'Например: Иван Иванов',
                serviceNamePlaceholder: 'Например: MIROBOD DEHQON BOZORI',
                cityPlaceholder: 'Например: Tashkent',
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
            editService: {
                title: 'Редактировать базар',
                tabAdditional: 'Дополнительно (контакты, координаты)',
                serviceName: 'Название сервиса',
                city: 'Город / Область',
                ipAddress: 'IP адрес',
                frontendPort: 'Порт фронтенда',
                backendPort: 'Порт backend API',
                pgPort: 'Порт PostgreSQL',
                streamPort: 'Порт Stream',
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
                serviceNamePlaceholder: 'Например: MIROBOD DEHQON BOZORI',
                cityPlaceholder: 'Например: Tashkent',
                save: 'Сохранить изменения',
                cancel: 'Отмена'
            },
            logs: {
                title: 'Системные логи',
                allStatuses: 'Все',
                online: 'Online',
                offline: 'Offline',
                recordsCount: 'Количество записей',
                download: 'Скачать',
                loading: 'Загрузка логов...',
                noLogs: 'Нет логов',
                logsWillAppear: 'Логи появятся при изменении статуса сервисов'
            },
            telegram: {
                title: 'Управление Telegram Chat ID',
                addChatId: 'Добавить Chat ID',
                chatId: 'Chat ID',
                chatIdPlaceholder: '@channel, @username или числовой ID',
                chatIdHint: 'Можно использовать: числовой ID, @channel, @username',
                type: 'Тип',
                typeChannel: 'Канал',
                typeGroup: 'Группа',
                typeUser: 'Пользователь',
                description: 'Описание (опционально)',
                descriptionPlaceholder: 'Например: Основной канал',
                allowedRegions: 'Разрешенные области (оставьте пустым для всех областей)',
                loadingRegions: 'Загрузка областей...',
                noRegions: 'Нет доступных областей',
                add: 'Добавить',
                chatIdsList: 'Список Chat ID',
                testNotification: 'Отправить тестовое уведомление',
                sending: 'Отправка...',
                enabled: 'Включен',
                disabled: 'Выключен',
                noDescription: 'Без описания',
                allRegions: 'Все области',
                regionsLabel: 'Области',
                noChatIds: 'Нет добавленных Chat ID',
                errorLoading: 'Ошибка загрузки Chat ID',
                configureRegions: 'Настроить области',
                delete: 'Удалить',
                editRegionsTitle: 'Настройка областей для Chat ID',
                editRegionsDescription: 'Выберите области, для которых этот Chat ID будет получать уведомления. Если ничего не выбрано, будут приходить уведомления со всех областей.',
                save: 'Сохранить',
                cancel: 'Отмена',
                confirmDelete: 'Вы уверены, что хотите удалить этот Chat ID?',
                chatIdRequired: 'Chat ID обязателен',
                chatIdAdded: 'Chat ID добавлен',
                chatIdEnabled: 'Chat ID включен',
                chatIdDisabled: 'Chat ID выключен',
                regionsUpdated: 'Области обновлены'
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
        },
        cities: {
            tashkent: 'Ташкент',
            andijan: 'Андижан',
            bukhara: 'Бухара',
            fergana: 'Фергана',
            jizzakh: 'Джизак',
            namangan: 'Наманган',
            navoiy: 'Навои',
            kashkadarya: 'Кашкадарья',
            samarkand: 'Самарканд',
            sirdarya: 'Сырдарья',
            surkhandarya: 'Сурхандарья',
            tashkentRegion: 'Ташкентская область',
            khorezm: 'Хорезм',
            karakalpakstan: 'Каракалпакстан'
        },
        calendar: {
            months: {
                january: 'Январь',
                february: 'Февраль',
                march: 'Март',
                april: 'Апрель',
                may: 'Май',
                june: 'Июнь',
                july: 'Июль',
                august: 'Август',
                september: 'Сентябрь',
                october: 'Октябрь',
                november: 'Ноябрь',
                december: 'Декабрь'
            },
            weekdays: {
                monday: 'Пн',
                tuesday: 'Вт',
                wednesday: 'Ср',
                thursday: 'Чт',
                friday: 'Пт',
                saturday: 'Сб',
                sunday: 'Вс'
            },
            weekdaysFull: {
                monday: 'Понедельник',
                tuesday: 'Вторник',
                wednesday: 'Среда',
                thursday: 'Четверг',
                friday: 'Пятница',
                saturday: 'Суббота',
                sunday: 'Воскресенье'
            }
        }
    },
    uz: {
        nav: {
            analytics: 'Analitika',
            containers: 'Konteynerlar',
            addService: 'Bozor qo\'shish',
            logs: 'Loglar',
            generalStats: 'Bozor statistikasi',
            map: 'Xarita',
            theme: 'Mavzu',
            menu: 'Menyu'
        },
        sidebar: {
            title: 'Menyu',
            statistics: 'Statistika',
            settings: 'Sozlamalar',
            external: 'Tashqi xizmatlar',
            management: 'Boshqarish',
            calendar: 'Taqvim'
        },
        dashboard: {
            systemOverview: 'Bozorlar statusi',
            generalOverview: 'Umumiy ko\'rinish',
            bazars: 'Bozorlar',
            bazarsList: 'Bozorlar ro\'yxati',
            api: 'API',
            database: 'Ma\'lumotlar bazasi',
            refresh: 'Yangilash',
            total: 'Jami',
            online: 'Onlayn',
            offline: 'Oflayn',
            operational: 'Ishlamoqda',
            requiresAction: 'Ishlamaydi',
            allBozor: 'Barcha bozorlar',
            activeBozor: 'Faol bozorlar',
            downBozor: 'Ishlamayotgan bozorlar',
            liveData: 'Real vaqt ma\'lumotlari',
            bozorEndpoints: 'Bozor nuqtalari',
            establishingConnection: 'Ulanish o\'rnatilmoqda',
            fetchingData: 'Serverdan bozor ma\'lumotlari yuklanmoqda...',
            loadingDetailedStatistics: 'Batafsil statistika yuklanmoqda',
            fetchingCameraData: 'Kamera va ROI ma\'lumotlari olinmoqda...',
            noDataAvailable: 'Ma\'lumot yo\'q',
            checkConnection: 'Serverga ulanishni tekshiring',
            errorLoading: 'Yuklashda xatolik',
            tryAgain: 'Sahifani yangilashga harakat qiling',
            search: 'Nom yoki shahar bo\'yicha qidirish...',
            filterByCity: 'Hudud bo\'yicha filtr',
            filterByStatus: 'Status bo\'yicha filtr',
            all: 'Jami',
            allLocations: 'Hudud bo\'yicha filtr',
            allStatuses: 'Status bo\'yicha filtr',
            showMap: 'Xaritani ko\'rsatish',
            noBazarsFound: 'Bozorlar topilmadi',
            tryAdjustingFilters: 'Filtrlarni o\'zgartirishga harakat qiling',
            city: 'Shahar'
        },
        cameras: {
            title: 'Kamera statistikasi',
            total: 'Jami kameralar',
            online: 'Onlayn',
            offline: 'Oflayn',
            working: 'Ishlamoqda',
            notWorking: 'Ishlamaydi',
            types: 'Kamera turlari',
            rastaFood: 'RastaFood',
            peopleCounting: 'Odamlar soni',
            animals: 'Hayvonlar',
            vehicleCounting: 'Transport soni',
            dataUnavailable: 'Ma\'lumot mavjud emas',
            accessBozor: 'Bozorni ochish',
            unavailable: 'Kamera statistikasi mavjud emas',
            endpoints: 'Endpoints',
            frontendService: 'Frontend xizmati',
            backendApi: 'Backend API',
            database: 'Ma\'lumotlar bazasi',
            exportRois: 'ROI eksport',
            exportStreams: 'Oqimlar eksport',
            copyEndpoint: 'Endpoint nusxalash'
        },
        statistics: {
            title: 'Bozor statistikasi',
            overview: 'Bozor statistikasi',
            cameras: 'Kamera statistikasi',
            detailed: 'Bozorlar bo\'yicha batafsil statistika',
            totalBazars: 'Jami bozorlar',
            onlineBazars: 'Onlayn',
            offlineBazars: 'Oflayn',
            totalCameras: 'Jami kameralar',
            workingCameras: 'Ishlamoqda',
            notWorkingCameras: 'Ishlamaydi',
            byRegions: 'Viloyatlar bo\'yicha statistika',
            region: 'Viloyat',
            bazarsInRegion: 'Viloyatdagi bozorlar',
            camerasInRegion: 'Viloyatdagi kameralar',
            camerasWithROI: 'ROI bilan kameralar',
            totalROI: 'Jami ROI',
            roiStatistics: 'ROI statistikasi',
            rasta: 'RASTA (Odamlar)',
            food: 'FOOD (Mahsulot)',
            peopleCounting: 'Odamlar soni',
            location: 'Joylashuv',
            status: 'Status',
            totalServices: 'Jami xizmatlar',
            systemHealth: 'Tizim salomatligi',
            uptime: 'Mavjudlik',
            online: 'Onlayn',
            offline: 'Oflayn',
            table: {
                name: 'Nom',
                region: 'Viloyat',
                status: 'Status',
                cameras: 'Kameralar (Yoq/Jami)',
                roi: 'ROI',
                actions: 'Amallar'
            }
        },
        modal: {
            addService: {
                title: 'Yangi bozor qo\'shish',
                tabAdditional: 'Qo\'shimcha (kontaktlar, koordinatalar)',
                serviceName: 'Bozor nomi',
                city: 'Hudud',
                ipAddress: 'IP manzil',
                frontendPort: 'Frontend porti',
                backendPort: 'Backend API porti',
                pgPort: 'PostgreSQL porti',
                streamPort: 'Stream porti',
                contactInfo: 'Aloqa ma\'lumotlari',
                contactClickName: 'Click kontakt ismi',
                contactClickNamePlaceholder: 'Masalan: Alisher Aliyev',
                serviceNamePlaceholder: 'Masalan: MIROBOD DEHQON BOZORI',
                cityPlaceholder: 'Masalan: Tashkent',
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
            editService: {
                title: 'Bozorni tahrirlash',
                tabAdditional: 'Qo\'shimcha (kontaktlar, koordinatalar)',
                serviceName: 'Bozor nomi',
                city: 'Hudud',
                ipAddress: 'IP manzil',
                frontendPort: 'Frontend porti',
                backendPort: 'Backend API porti',
                pgPort: 'PostgreSQL porti',
                streamPort: 'Stream porti',
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
                serviceNamePlaceholder: 'Masalan: MIROBOD DEHQON BOZORI',
                cityPlaceholder: 'Masalan: Tashkent',
                save: 'O\'zgarishlarni saqlash',
                cancel: 'Bekor qilish'
            },
            logs: {
                title: 'Tizim loglari',
                allStatuses: 'Barchasi',
                online: 'Onlayn',
                offline: 'Oflayn',
                recordsCount: 'Yozuvlar soni',
                download: 'Yuklab olish',
                loading: 'Loglar yuklanmoqda...',
                noLogs: 'Loglar yo\'q',
                logsWillAppear: 'Xizmatlar statusi o\'zgarganda loglar paydo bo\'ladi'
            },
            telegram: {
                title: 'Telegram Chat ID boshqaruvi',
                addChatId: 'Chat ID qo\'shish',
                chatId: 'Chat ID',
                chatIdPlaceholder: '@channel, @username yoki raqamli ID',
                chatIdHint: 'Ishlatish mumkin: raqamli ID, @channel, @username',
                type: 'Turi',
                typeChannel: 'Kanal',
                typeGroup: 'Guruh',
                typeUser: 'Foydalanuvchi',
                description: 'Tavsif (ixtiyoriy)',
                descriptionPlaceholder: 'Masalan: Asosiy kanal',
                allowedRegions: 'Ruxsat etilgan viloyatlar (barcha viloyatlar uchun bo\'sh qoldiring)',
                loadingRegions: 'Viloyatlar yuklanmoqda...',
                noRegions: 'Mavjud viloyatlar yo\'q',
                add: 'Qo\'shish',
                chatIdsList: 'Chat ID ro\'yxati',
                testNotification: 'Test xabarnoma yuborish',
                sending: 'Yuborilmoqda...',
                enabled: 'Yoqilgan',
                disabled: 'O\'chirilgan',
                noDescription: 'Tavsif yo\'q',
                allRegions: 'Barcha viloyatlar',
                regionsLabel: 'Viloyatlar',
                noChatIds: 'Qo\'shilgan Chat ID yo\'q',
                errorLoading: 'Chat ID yuklashda xatolik',
                configureRegions: 'Viloyatlarni sozlash',
                delete: 'O\'chirish',
                editRegionsTitle: 'Chat ID uchun viloyatlarni sozlash',
                editRegionsDescription: 'Ushbu Chat ID xabarnomalarni oladigan viloyatlarni tanlang. Agar hech narsa tanlanmagan bo\'lsa, barcha viloyatlardan xabarnomalar keladi.',
                save: 'Saqlash',
                cancel: 'Bekor qilish',
                confirmDelete: 'Ushbu Chat ID ni o\'chirishni xohlaysizmi?',
                chatIdRequired: 'Chat ID majburiy',
                chatIdAdded: 'Chat ID qo\'shildi',
                chatIdEnabled: 'Chat ID yoqildi',
                chatIdDisabled: 'Chat ID o\'chirildi',
                regionsUpdated: 'Viloyatlar yangilandi'
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
        },
        cities: {
            tashkent: 'Toshkent',
            andijan: 'Andijon',
            bukhara: 'Buxoro',
            fergana: 'Farg\'ona',
            jizzakh: 'Jizzax',
            namangan: 'Namangan',
            navoiy: 'Navoiy',
            kashkadarya: 'Qashqadaryo',
            samarkand: 'Samarqand',
            sirdarya: 'Sirdaryo',
            surkhandarya: 'Surxondaryo',
            tashkentRegion: 'Toshkent viloyati',
            khorezm: 'Xorazm',
            karakalpakstan: 'Qoraqalpog\'iston'
        },
        calendar: {
            months: {
                january: 'Yanvar',
                february: 'Fevral',
                march: 'Mart',
                april: 'Aprel',
                may: 'May',
                june: 'Iyun',
                july: 'Iyul',
                august: 'Avgust',
                september: 'Sentabr',
                october: 'Oktabr',
                november: 'Noyabr',
                december: 'Dekabr'
            },
            weekdays: {
                monday: 'Du',
                tuesday: 'Se',
                wednesday: 'Chor',
                thursday: 'Pay',
                friday: 'Ju',
                saturday: 'Sha',
                sunday: 'Ya'
            },
            weekdaysFull: {
                monday: 'Dushanba',
                tuesday: 'Seshanba',
                wednesday: 'Chorshanba',
                thursday: 'Payshanba',
                friday: 'Juma',
                saturday: 'Shanba',
                sunday: 'Yakshanba'
            }
        }
    },
    en: {
        nav: {
            analytics: 'Analytics',
            containers: 'Containers',
            addService: 'Add Bazar',
            logs: 'Logs',
            generalStats: 'General Statistics',
            map: 'Map',
            theme: 'Theme',
            menu: 'Menu'
        },
        sidebar: {
            title: 'Menu',
            statistics: 'Statistics',
            settings: 'Settings',
            external: 'External Services',
            management: 'Management',
            calendar: 'Calendar'
        },
        dashboard: {
            systemOverview: 'Bazar Status',
            generalOverview: 'General Overview',
            bazars: 'Bazars',
            bazarsList: 'Bazars List',
            api: 'API',
            database: 'Database',
            refresh: 'Refresh',
            total: 'Total',
            online: 'Online',
            offline: 'Offline',
            operational: 'Operational',
            requiresAction: 'Not Working',
            allBozor: 'All Bazars',
            activeBozor: 'Active Bazars',
            downBozor: 'Down Bazars',
            liveData: 'Live Data',
            bozorEndpoints: 'Bazar Endpoints',
            establishingConnection: 'Establishing Connection',
            fetchingData: 'Fetching bazar data from server...',
            loadingDetailedStatistics: 'Loading Detailed Statistics',
            fetchingCameraData: 'Fetching camera and ROI data...',
            noDataAvailable: 'No Data Available',
            checkConnection: 'Check server connection',
            errorLoading: 'Error Loading',
            tryAgain: 'Try refreshing the page',
            search: 'Search by name or city...',
            filterByCity: 'Filter by region',
            filterByStatus: 'Filter by status',
            all: 'All',
            allLocations: 'Filter by region',
            allStatuses: 'Filter by status',
            showMap: 'Show Map',
            noBazarsFound: 'No bazars found',
            tryAdjustingFilters: 'Try adjusting your filters',
            city: 'City'
        },
        cameras: {
            title: 'Camera Statistics',
            total: 'Total Cameras',
            online: 'Online',
            offline: 'Offline',
            working: 'Working',
            notWorking: 'Not Working',
            types: 'Camera Types',
            rastaFood: 'RastaFood',
            peopleCounting: 'People Counting',
            animals: 'Animals',
            vehicleCounting: 'Vehicle Counting',
            dataUnavailable: 'Data Unavailable',
            accessBozor: 'Access Bozor',
            unavailable: 'Camera statistics unavailable',
            endpoints: 'Endpoints',
            frontendService: 'Frontend Service',
            backendApi: 'Backend API',
            database: 'Database',
            exportRois: 'Export ROIs',
            exportStreams: 'Export Streams',
            copyEndpoint: 'Copy endpoint'
        },
        statistics: {
            title: 'General Bazar Statistics',
            overview: 'General Statistics',
            cameras: 'Camera Statistics',
            detailed: 'Detailed Statistics by Bazars',
            totalBazars: 'Total Bazars',
            onlineBazars: 'Online',
            offlineBazars: 'Offline',
            totalCameras: 'Total Cameras',
            workingCameras: 'Working',
            notWorkingCameras: 'Not Working',
            byRegions: 'Statistics by Regions',
            region: 'Region',
            bazarsInRegion: 'Bazars in Region',
            camerasInRegion: 'Cameras in Region',
            camerasWithROI: 'Cameras with ROI',
            totalROI: 'Total ROI',
            roiStatistics: 'ROI Statistics',
            rasta: 'RASTA (People)',
            food: 'FOOD (Food)',
            peopleCounting: 'People Counting',
            location: 'Location',
            status: 'Status',
            totalServices: 'Total Services',
            systemHealth: 'System Health',
            uptime: 'Uptime',
            online: 'Online',
            offline: 'Offline',
            table: {
                name: 'Name',
                region: 'Region',
                status: 'Status',
                cameras: 'Cameras (On/Total)',
                roi: 'ROI',
                actions: 'Actions'
            }
        },
        modal: {
            addService: {
                title: 'Add New Bazar',
                tabAdditional: 'Additional (contacts, coordinates)',
                serviceName: 'Bazar Name',
                city: 'City',
                ipAddress: 'IP Address',
                frontendPort: 'Frontend Port',
                backendPort: 'Backend API Port',
                pgPort: 'PostgreSQL Port',
                contactInfo: 'Contact Information',
                contactClickName: 'Click Contact Name',
                contactClickNamePlaceholder: 'e.g. John Smith',
                serviceNamePlaceholder: 'e.g. MIROBOD DEHQON BOZORI',
                cityPlaceholder: 'e.g. Tashkent',
                contactClick: 'Click Phone',
                contactSccName: 'SCC Contact Name',
                contactSccNamePlaceholder: 'e.g. Jane Doe',
                contactScc: 'SCC Phone',
                mapCoordinates: 'Map Coordinates',
                latitude: 'Latitude',
                longitude: 'Longitude',
                save: 'Save Bazar',
                cancel: 'Cancel'
            },
            editService: {
                title: 'Edit Bazar',
                tabAdditional: 'Additional (contacts, coordinates)',
                serviceName: 'Bazar Name',
                city: 'City',
                ipAddress: 'IP Address',
                frontendPort: 'Frontend Port',
                backendPort: 'Backend API Port',
                pgPort: 'PostgreSQL Port',
                streamPort: 'Stream Port',
                contactInfo: 'Contact Information',
                contactClickName: 'Click Contact Name',
                contactClickNamePlaceholder: 'e.g. John Smith',
                contactClick: 'Click Phone',
                contactSccName: 'SCC Contact Name',
                contactSccNamePlaceholder: 'e.g. Jane Doe',
                contactScc: 'SCC Phone',
                mapCoordinates: 'Map Coordinates',
                latitude: 'Latitude',
                longitude: 'Longitude',
                serviceNamePlaceholder: 'e.g. MIROBOD DEHQON BOZORI',
                cityPlaceholder: 'e.g. Tashkent',
                save: 'Save Changes',
                cancel: 'Cancel'
            },
            logs: {
                title: 'System Logs',
                allStatuses: 'All',
                online: 'Online',
                offline: 'Offline',
                recordsCount: 'Records Count',
                download: 'Download',
                loading: 'Loading logs...',
                noLogs: 'No Logs',
                logsWillAppear: 'Logs will appear when service status changes'
            },
            telegram: {
                title: 'Telegram Chat ID Management',
                addChatId: 'Add Chat ID',
                chatId: 'Chat ID',
                chatIdPlaceholder: '@channel, @username or numeric ID',
                chatIdHint: 'Can use: numeric ID, @channel, @username',
                type: 'Type',
                typeChannel: 'Channel',
                typeGroup: 'Group',
                typeUser: 'User',
                description: 'Description (optional)',
                descriptionPlaceholder: 'e.g. Main channel',
                allowedRegions: 'Allowed regions (leave empty for all regions)',
                loadingRegions: 'Loading regions...',
                noRegions: 'No regions available',
                add: 'Add',
                chatIdsList: 'Chat ID List',
                testNotification: 'Send test notification',
                sending: 'Sending...',
                enabled: 'Enabled',
                disabled: 'Disabled',
                noDescription: 'No description',
                allRegions: 'All regions',
                regionsLabel: 'Regions',
                noChatIds: 'No chat IDs added',
                errorLoading: 'Error loading Chat IDs',
                configureRegions: 'Configure regions',
                delete: 'Delete',
                editRegionsTitle: 'Configure regions for Chat ID',
                editRegionsDescription: 'Select regions for which this Chat ID will receive notifications. If nothing is selected, notifications will come from all regions.',
                save: 'Save',
                cancel: 'Cancel',
                confirmDelete: 'Are you sure you want to delete this Chat ID?',
                chatIdRequired: 'Chat ID is required',
                chatIdAdded: 'Chat ID added',
                chatIdEnabled: 'Chat ID enabled',
                chatIdDisabled: 'Chat ID disabled',
                regionsUpdated: 'Regions updated'
            }
        },
        status: {
            online: 'Online',
            offline: 'Offline',
            added: 'Added',
            updated: 'Updated',
            deleted: 'Deleted'
        },
        logs: {
            previousStatus: 'Was',
            newService: 'New service added to system',
            serviceUpdated: 'Service updated',
            serviceDeleted: 'Service deleted from system',
            changes: 'Changes',
            error: 'Error'
        },
        notifications: {
            serviceAdded: 'Service successfully added!',
            serviceDeleted: 'Service successfully deleted!',
            errorAddingService: 'Error adding service',
            errorDeletingService: 'Error deleting service',
            logsDownloaded: 'Logs downloaded',
            errorExport: 'Export error',
            servicesOffline: 'services offline',
            requireAttention: 'services require attention'
        },
        actions: {
            delete: 'Delete',
            confirmDelete: 'Are you sure you want to delete this service?'
        }
    }
};

// Загружаем язык из localStorage при инициализации
let currentLang = localStorage.getItem('language') || 'ru';
// Убеждаемся, что язык сохранен
if (!localStorage.getItem('language')) {
    localStorage.setItem('language', currentLang);
}

const elements = {
    // Progress indicators
    totalProgress: document.getElementById('totalProgress'),
    totalProgressText: document.getElementById('totalProgressText'),
    onlineProgress: document.getElementById('onlineProgress'),
    onlineProgressText: document.getElementById('onlineProgressText'),
    offlineProgress: document.getElementById('offlineProgress'),
    offlineProgressText: document.getElementById('offlineProgressText'),
    // Grid and filters
    bazarsGrid: document.getElementById('bazarsGrid'),
    searchInput: document.getElementById('searchInput'),
    cityFilter: document.getElementById('cityFilter'),
    statusFilter: document.getElementById('statusFilter'),
    refreshBtn: document.getElementById('refreshBtn'),
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

        // Для элементов с иконками внутри (span внутри button), обновляем только текстовый узел
        if (element.querySelector('i')) {
            const textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            if (textNode) {
                textNode.textContent = translation;
            } else {
                // Если текстового узла нет, добавляем его после иконки
                element.appendChild(document.createTextNode(translation));
            }
        } else if (element.tagName === 'SPAN' && element.parentElement) {
            // Если это span внутри элемента с иконкой (например, span внутри button с иконкой)
            const parent = element.parentElement;
            if (parent.querySelector('i') && parent.querySelector('i') !== element.querySelector('i')) {
                // Родитель содержит иконку, но не сам span
                element.textContent = translation;
            } else {
                element.textContent = translation;
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

    // Обновляем фильтр городов с переводами
    if (elements.cityFilter && bazarsData.length > 0) {
        const selectedValue = elements.cityFilter.value;
        // Восстанавливаем оригинальные тексты перед обновлением
        restoreFilterOptions(elements.cityFilter);
        populateCityFilter();
        // Восстанавливаем выбранное значение
        if (selectedValue) {
            elements.cityFilter.value = selectedValue;
        } else {
            // Если ничего не выбрано, устанавливаем "all" с названием фильтра
            elements.cityFilter.value = 'all';
        }
    }

    // Обновляем statusFilter с переводом названия
    if (elements.statusFilter) {
        restoreFilterOptions(elements.statusFilter);
        const allOption = elements.statusFilter.options[0];
        if (allOption && allOption.value === 'all') {
            allOption.textContent = t('dashboard.filterByStatus');
        }
    }

    // Обновляем индикатор языка
    document.getElementById('currentLang').textContent = currentLang.toUpperCase();

    // Сохраняем выбор
    localStorage.setItem('language', currentLang);

    // Обновляем кнопку обновления
    if (elements.refreshBtn) {
        const icon = elements.refreshBtn.querySelector('i');
        const span = elements.refreshBtn.querySelector('span[data-i18n="dashboard.refresh"]');
        if (span) {
            // Обновляем только текст в span, сохраняя структуру
            span.textContent = t('dashboard.refresh');
        } else {
            // Если span не найден, обновляем через innerHTML
            const iconClass = icon ? icon.className.replace(' fa-spin', '') : 'fas fa-rotate';
            const isDisabled = elements.refreshBtn.disabled;
            if (isDisabled) {
                elements.refreshBtn.innerHTML = `<i class="${iconClass} fa-spin"></i><span data-i18n="dashboard.refresh">${t('dashboard.refresh')}</span>`;
            } else {
                elements.refreshBtn.innerHTML = `<i class="${iconClass}"></i><span data-i18n="dashboard.refresh">${t('dashboard.refresh')}</span>`;
            }
            elements.refreshBtn.disabled = isDisabled;
        }
    }

    // Перезагружаем динамический контент
    if (elements.addServiceModal && elements.addServiceModal.classList.contains('active')) {
        updateAddServiceModalText();
    }
    if (elements.logsModal && elements.logsModal.classList.contains('active')) {
        updateLogsModalText();
    }

    // Обновляем фильтр городов если есть данные
    if (bazarsData.length > 0) {
        populateCityFilter();
    }

    // Обновляем тексты в модальном окне редактирования, если оно открыто
    const editServiceModal = document.getElementById('editServiceModal');
    if (editServiceModal && editServiceModal.classList.contains('active')) {
        updateEditServiceModalText();
    }

    // Обновляем тексты в модальном окне Telegram, если оно открыто
    const telegramModal = document.getElementById('telegramChatIdsModal');
    if (telegramModal && telegramModal.classList.contains('active')) {
        updateTelegramModalTexts();
        loadTelegramChatIds();
    }

    // Обновляем тексты в модальном окне карты (всегда, так как оно может быть скрыто)
    const mapModal = document.getElementById('mapModal');
    if (mapModal) {
        // Обновляем заголовок карты
        const mapTitle = mapModal.querySelector('.map-modal-header h2');
        if (mapTitle && mapTitle.getAttribute('data-i18n')) {
            mapTitle.textContent = t(mapTitle.getAttribute('data-i18n'));
        }
        // Обновляем все элементы с data-i18n внутри модального окна карты
        mapModal.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = t(key);
            if (element.tagName === 'SPAN' && element.parentElement && element.parentElement.querySelector('i')) {
                element.textContent = translation;
            } else if (element.querySelector('i')) {
                const textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
                if (textNode) {
                    textNode.textContent = translation;
                }
            } else {
                element.textContent = translation;
            }
        });
    }

    // Обновляем календарь (месяц и дни недели)
    if (typeof updateCalendarDisplay === 'function') {
        updateCalendarDisplay();
    }

    // Перерисовываем карточки базаров, чтобы обновить переводы
    if (bazarsData.length > 0) {
        renderBazars();
    }

    // Обновляем раздел статистики, если он открыт
    const generalStatsModal = document.getElementById('generalStatsModal');
    if (generalStatsModal) {
        // Обновляем все элементы с data-i18n в модальном окне статистики
        generalStatsModal.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = t(key);
            if (element.tagName === 'SPAN' && element.parentElement && element.parentElement.querySelector('i')) {
                element.textContent = translation;
            } else if (element.querySelector('i')) {
                const textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
                if (textNode) {
                    textNode.textContent = translation;
                }
            } else {
                element.textContent = translation;
            }
        });

        // Перезагружаем статистику для обновления переводов названий областей и городов
        if (generalStatsModal.classList.contains('active')) {
            if (typeof loadGeneralStatistics === 'function') {
                loadGeneralStatistics();
            }
            if (typeof loadDetailedBazarsStatistics === 'function') {
                loadDetailedBazarsStatistics();
            }
        }
    }
}

function toggleLanguage() {
    // Переключаем язык: ru -> uz -> ru
    if (currentLang === 'ru') {
        currentLang = 'uz';
    } else if (currentLang === 'uz') {
        currentLang = 'ru';
    } else {
        currentLang = 'ru';
    }
    // Сохраняем язык в localStorage перед обновлением
    localStorage.setItem('language', currentLang);
    updateLanguage();
}

function initLanguage() {
    // Загружаем язык из localStorage
    const savedLang = localStorage.getItem('language');
    if (savedLang && (savedLang === 'ru' || savedLang === 'uz' || savedLang === 'en')) {
        currentLang = savedLang;
    } else {
        currentLang = 'ru';
        localStorage.setItem('language', currentLang);
    }
    // Обновляем язык сразу при инициализации
    updateLanguage();
    // Обновляем часы после инициализации языка
    updateClock();
}

// ===============================================
// Theme Management
// ===============================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Set initial theme button icon
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        const icon = themeToggleBtn.querySelector('i');
        if (icon) {
            icon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update theme button icon
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        const icon = themeToggleBtn.querySelector('i');
        if (icon) {
            icon.className = newTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }

    // Обновляем частицы при смене темы
    updateParticlesTheme();
}

function updateParticlesTheme() {
    // Переинициализируем частицы при смене темы (без падений)
    initParticles();
}

// Добавлено: безопасная инициализация particles.js
function initParticles() {
    const containerId = 'particles-js';
    const container = document.getElementById(containerId);
    if (!container) return;

    // Если библиотека не загружена — выходим тихо
    if (typeof window.particlesJS === 'undefined') {
        console.warn('particlesJS is not loaded, skipping particles init');
        return;
    }

    // Очищаем предыдущий canvas при переинициализации
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const color = isLight ? '#2563eb' : '#00bcd4';

    window.particlesJS(containerId, {
        particles: {
            number: { value: 50, density: { enable: true, value_area: 800 } },
            color: { value: color },
            shape: { type: 'circle' },
            opacity: { value: 0.3 },
            size: { value: 3, random: true },
            line_linked: { enable: true, distance: 150, color: color, opacity: 0.2, width: 1 },
            move: { enable: true, speed: 2, out_mode: 'out' }
        },
        interactivity: {
            detect_on: 'canvas',
            events: {
                onhover: { enable: true, mode: 'grab' },
                onclick: { enable: true, mode: 'push' },
                resize: true
            },
            modes: {
                grab: { distance: 140, line_linked: { opacity: 0.3 } },
                push: { particles_nb: 4 }
            }
        },
        retina_detect: true
    });
}

function initSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    const openBtn = document.getElementById('sidebarOpenBtn');

    // Инициализируем правильное состояние
    if (sidebar && openBtn) {
        // Боковое меню изначально открыто, поэтому кнопка должна быть скрыта
        openBtn.classList.add('hidden');
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    const openBtn = document.getElementById('sidebarOpenBtn');

    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-collapsed');

        // Управляем видимостью кнопки открытия
        if (openBtn) {
            if (sidebar.classList.contains('collapsed')) {
                // Меню закрыто - показываем кнопку открытия
                openBtn.classList.remove('hidden');
            } else {
                // Меню открыто - скрываем кнопку открытия
                openBtn.classList.add('hidden');
            }
        }
    }
}

// Calendar functionality
let currentDate = new Date();
let selectedDate = new Date();
let isCalendarExpanded = false;

function initCalendar() {
    updateCalendarDisplay();
    generateCalendarDays();
}

function updateCalendarDisplay() {
    const currentDay = document.getElementById('currentDay');
    const currentMonth = document.getElementById('currentMonth');
    const currentYear = document.getElementById('currentYear');

    if (currentDay) currentDay.textContent = currentDate.getDate();
    if (currentMonth) currentMonth.textContent = getMonthName(currentDate.getMonth());
    if (currentYear) currentYear.textContent = currentDate.getFullYear();
}

function getMonthName(monthIndex) {
    const monthKeys = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const monthKey = monthKeys[monthIndex];
    return t(`calendar.months.${monthKey}`);
}

function generateCalendarDays() {
    const daysContainer = document.getElementById('daysContainer');
    if (!daysContainer) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0

    // Clear container
    daysContainer.innerHTML = '';

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'day-box';
        daysContainer.appendChild(emptyDay);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayBox = document.createElement('div');
        dayBox.className = 'day-box';
        dayBox.innerHTML = `<span class="day-number">${day}</span>`;

        const dayDate = new Date(year, month, day);
        const dayOfWeek = dayDate.getDay();

        // Check if it's weekend (Saturday=6, Sunday=0)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            dayBox.classList.add('weekend');
        }

        // Check if it's today
        const today = new Date();
        if (dayDate.toDateString() === today.toDateString()) {
            dayBox.classList.add('today');
        }

        // Check if it's selected
        if (dayDate.toDateString() === selectedDate.toDateString()) {
            dayBox.classList.add('selected');
        }

        // Add click event
        dayBox.addEventListener('click', () => selectDate(dayDate));

        daysContainer.appendChild(dayBox);
    }
}

function selectDate(date) {
    selectedDate = new Date(date);
    generateCalendarDays(); // Regenerate to update selection
}

function toggleCalendar() {
    // Toggle calendar visibility or navigate to today
    currentDate = new Date();
    selectedDate = new Date();
    updateCalendarDisplay();
    generateCalendarDays();
}


// ===============================================
// Data Fetching
// ===============================================


async function loadAllBazars() {
    // Проверяем существование элементов
    if (!elements.refreshBtn || !elements.bazarsGrid) {
        console.error('Required elements not found:', { refreshBtn: !!elements.refreshBtn, bazarsGrid: !!elements.bazarsGrid });
        return;
    }

    elements.refreshBtn.disabled = true;
    elements.refreshBtn.innerHTML = `<i class="fas fa-sync-alt fa-spin"></i><span data-i18n="dashboard.refresh">${t('dashboard.refresh')}</span>`;

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

            // Отладочная информация о структуре данных
            console.log('Loaded bazars data:', bazarsData);
            if (bazarsData.length > 0) {
                console.log('First bazar structure:', bazarsData[0]);
            }

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
        if (elements.bazarsGrid) {
            elements.bazarsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>${t('dashboard.errorLoading')}</h3>
                    <p>${error.message || 'Unknown error'}</p>
                    <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 1rem;">
                        ${t('dashboard.checkConnection')}
                    </p>
                </div>
            `;
        }
    } finally {
        if (elements.refreshBtn) {
            elements.refreshBtn.disabled = false;
            elements.refreshBtn.innerHTML = `<i class="fas fa-sync-alt"></i><span data-i18n="dashboard.refresh">${t('dashboard.refresh')}</span>`;
        }
    }
}

// ===============================================
// UI Rendering
// ===============================================
async function createServiceCard(bazar, index) {
    const card = document.createElement('div');
    card.className = `market-card ${bazar.status}`;

    const statusClass = bazar.status === 'online' ? 'online' : 'offline';
    const statusText = bazar.status === 'online' ? t('dashboard.online') : t('dashboard.offline');

    // Загружаем статистику камер для этого базара
    let cameraStats = null;
    if (bazar.status === 'online' && bazar.endpoint) {
        try {
            const cameraApiUrl = `http://${bazar.endpoint.ip}:${bazar.endpoint.backendPort}/api/cameras/statistics`;
            const response = await fetch(cameraApiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors'
            });

            if (response.ok) {
                cameraStats = await response.json();
            }
        } catch (error) {
            console.warn(`Failed to fetch camera stats for ${bazar.name}:`, error);
        }
    }

    // Формируем блок статистики камер
    let camerasHtml = '';
    if (cameraStats) {
        camerasHtml = `
            <!-- Кнопка для раскрытия камер -->
            <div class="endpoints-toggle" onclick="toggleEndpoints(this)" style="cursor: pointer; padding: 0.75rem; display: flex; align-items: center; justify-content: space-between; background: var(--surface-color); border-radius: 8px; margin-top: 1rem; margin-bottom: 0.5rem; transition: all 0.3s ease;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-video" style="color: var(--primary);"></i>
                    <span style="font-weight: 500;">${t('cameras.title')}</span>
                </div>
                <i class="fas fa-chevron-down" style="color: var(--text-muted); transition: transform 0.3s ease;"></i>
            </div>
            
            <!-- Скрываемая секция камер -->
            <div class="endpoint-group" style="display: none; margin-bottom: 1rem;">
                <div class="endpoint-row">
                    <div class="endpoint-header">
                        <div class="endpoint-icon" style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);">
                            <i class="fas fa-video"></i>
                        </div>
                        <span class="endpoint-label">${t('statistics.cameras')}</span>
                    </div>
                    <div class="endpoint-data">
                        <div class="cameras-stats-inline">
                                   <div class="camera-stat-inline">
                                       <span class="stat-number">${cameraStats.totalCameras || 0}</span>
                                       <span class="stat-label">${t('statistics.totalCameras')}</span>
                                   </div>
                                   <div class="camera-stat-inline online">
                                       <span class="stat-number">${cameraStats.onlineCameras || 0}</span>
                                       <span class="stat-label">${t('statistics.workingCameras')}</span>
                                   </div>
                                   <div class="camera-stat-inline offline">
                                       <span class="stat-number">${cameraStats.offlineCameras || 0}</span>
                                       <span class="stat-label">${t('statistics.notWorkingCameras')}</span>
                                   </div>
                        </div>
                    </div>
                </div>
                ${cameraStats.rastaFoodCameras > 0 || cameraStats.peopleCountingCameras > 0 || cameraStats.animalCameras > 0 || cameraStats.vehicleCountingCameras > 0 ? `
                <div class="endpoint-row">
                    <div class="endpoint-header">
                        <div class="endpoint-icon" style="background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);">
                            <i class="fas fa-tags"></i>
                        </div>
                        <span class="endpoint-label">${t('cameras.types')}</span>
                    </div>
                    <div class="endpoint-data">
                        <div class="camera-types-inline">
                            ${cameraStats.rastaFoodCameras > 0 ? `<span class="camera-type-badge rasta-food"><i class="fas fa-utensils"></i> ${cameraStats.rastaFoodCameras}</span>` : ''}
                            ${cameraStats.peopleCountingCameras > 0 ? `<span class="camera-type-badge people-counting"><i class="fas fa-users"></i> ${cameraStats.peopleCountingCameras}</span>` : ''}
                            ${cameraStats.animalCameras > 0 ? `<span class="camera-type-badge animals"><i class="fas fa-paw"></i> ${cameraStats.animalCameras}</span>` : ''}
                            ${cameraStats.vehicleCountingCameras > 0 ? `<span class="camera-type-badge vehicles"><i class="fas fa-car"></i> ${cameraStats.vehicleCountingCameras}</span>` : ''}
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    // Формируем блок контактов если они есть (всегда видимый)
    let contactsHtml = '';
    if (bazar.contact_click || bazar.contact_scc) {
        contactsHtml = `
            <div class="endpoint-group" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                ${bazar.contact_click ? `
                    <div class="endpoint-row">
                        <div class="endpoint-header">
                            <div class="endpoint-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                <i class="fas fa-user"></i>
                            </div>
                            <span class="endpoint-label">Click: ${bazar.contact_click_name || 'N/A'}</span>
                        </div>
                        <div class="endpoint-data">
                            <code>${bazar.contact_click}</code>
                            <button class="btn-copy" onclick="copyToClipboard('${bazar.contact_click}')" title="Copy phone">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                ` : ''}
                ${bazar.contact_scc ? `
                    <div class="endpoint-row">
                        <div class="endpoint-header">
                            <div class="endpoint-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                                <i class="fas fa-headset"></i>
                            </div>
                            <span class="endpoint-label">SCC: ${bazar.contact_scc_name || 'N/A'}</span>
                        </div>
                        <div class="endpoint-data">
                            <code>${bazar.contact_scc}</code>
                            <button class="btn-copy" onclick="copyToClipboard('${bazar.contact_scc}')" title="Copy phone">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
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
                    <button class="btn-edit" onclick="openEditServiceModal('${bazar.endpoint.ip}', ${bazar.endpoint.port})" title="Редактировать">
                        <i class="fas fa-pencil"></i>
                    </button>
                    <label class="telegram-notification-toggle" title="Telegram уведомления">
                        <input type="checkbox" ${bazar.telegram_notifications_enabled ? 'checked' : ''} 
                               onchange="toggleTelegramNotifications('${bazar.endpoint.ip}', ${bazar.endpoint.port}, this.checked)">
                        <i class="fab fa-telegram" style="color: ${bazar.telegram_notifications_enabled ? '#0088cc' : '#999'};"></i>
                    </label>
                    <div class="market-status ${statusClass}">
                        <span class="status-indicator"></span>
                        <span>${statusText}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="market-body">
            <!-- Кнопка для раскрытия endpoints -->
            <div class="endpoints-toggle" onclick="toggleEndpoints(this)" style="cursor: pointer; padding: 0.75rem; display: flex; align-items: center; justify-content: space-between; background: var(--surface-color); border-radius: 8px; margin-bottom: 0.5rem; transition: all 0.3s ease;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-network-wired" style="color: var(--primary);"></i>
                    <span style="font-weight: 500;">${t('cameras.endpoints')}</span>
                </div>
                <i class="fas fa-chevron-down" style="color: var(--text-muted); transition: transform 0.3s ease;"></i>
            </div>
            
            <!-- Скрываемая секция endpoints -->
            <div class="endpoint-group" style="display: none; margin-bottom: 1rem;">
                <div class="endpoint-row">
                    <div class="endpoint-header">
                        <div class="endpoint-icon frontend">
                            <i class="fas fa-globe"></i>
                        </div>
                        <span class="endpoint-label">${t('cameras.frontendService')}</span>
                    </div>
                    <div class="endpoint-data">
                        <code>${bazar.endpoint.ip}:${bazar.endpoint.port}</code>
                        <button class="btn-copy" onclick="copyToClipboard('${bazar.endpoint.ip}:${bazar.endpoint.port}')" title="${t('cameras.copyEndpoint')}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>

                <div class="endpoint-row">
                    <div class="endpoint-header">
                        <div class="endpoint-icon backend">
                            <i class="fas fa-server"></i>
                        </div>
                        <span class="endpoint-label">${t('cameras.backendApi')}</span>
                    </div>
                    <div class="endpoint-data">
                        <code>${bazar.endpoint.ip}:${bazar.endpoint.backendPort}</code>
                        <button class="btn-copy" onclick="copyToClipboard('${bazar.endpoint.ip}:${bazar.endpoint.backendPort}')" title="${t('cameras.copyEndpoint')}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>

                <div class="endpoint-row">
                    <div class="endpoint-header">
                        <div class="endpoint-icon database">
                            <i class="fas fa-database"></i>
                        </div>
                        <span class="endpoint-label">${t('cameras.database')}</span>
                    </div>
                    <div class="endpoint-data">
                        <code>${bazar.endpoint.ip}:${bazar.endpoint.pgPort}</code>
                        <button class="btn-copy" onclick="copyToClipboard('${bazar.endpoint.ip}:${bazar.endpoint.pgPort}')" title="${t('cameras.copyEndpoint')}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            ${camerasHtml}
            ${contactsHtml}
        </div>

        <div class="market-footer">
            <button class="btn-open" onclick="openService('${bazar.endpoint.ip}', ${bazar.endpoint.port})">
                <i class="fas fa-arrow-up-right-from-square"></i>
                <span>${t('cameras.accessBozor')}</span>
            </button>
            ${bazar.endpoint && bazar.endpoint.ip && bazar.endpoint.backendPort ? `
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                <button class="btn-export" onclick="downloadROIsExport('${bazar.endpoint.ip}', ${bazar.endpoint.backendPort})" title="${t('cameras.exportRois')}">
                    <i class="fas fa-download"></i>
                    <span>${t('cameras.exportRois')}</span>
                </button>
                <button class="btn-export" onclick="downloadStreamsExport('${bazar.endpoint.ip}', ${bazar.endpoint.backendPort})" title="${t('cameras.exportStreams')}">
                    <i class="fas fa-download"></i>
                    <span>${t('cameras.exportStreams')}</span>
                </button>
            </div>
            ` : ''}
        </div>
    `;

    return card;
}

async function renderBazars() {
    elements.bazarsGrid.innerHTML = '';

    if (filteredData.length === 0) {
        elements.bazarsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>${t('dashboard.noBazarsFound')}</h3>
                <p>${t('dashboard.tryAdjustingFilters')}</p>
            </div>
        `;
        return;
    }

    // Создаем карточки асинхронно
    for (const [index, bazar] of filteredData.entries()) {
        const card = await createServiceCard(bazar, index);
        elements.bazarsGrid.appendChild(card);
    }
}

function updateStats() {
    const total = bazarsData.length;
    const online = bazarsData.filter(b => b.status === 'online').length;
    const offline = total - online;

    // Update progress circles
    updateProgressCircle(elements.totalProgress, total, total, elements.totalProgressText);
    updateProgressCircle(elements.onlineProgress, online, total, elements.onlineProgressText);
    updateProgressCircle(elements.offlineProgress, offline, total, elements.offlineProgressText);
}

function updateProgressCircle(circle, value, max, textElement) {
    if (!circle || !textElement) return;

    const circumference = 2 * Math.PI * 34; // radius = 34
    const percentage = max > 0 ? (value / max) * 100 : 0;
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;

    circle.style.strokeDasharray = strokeDasharray;
    textElement.textContent = `${value}/${max}`;
}

function checkOfflineServices() {
    const offlineServices = bazarsData.filter(b => b.status === 'offline');

    if (offlineServices.length > 0) {
        // Создаем ключ для кеша на основе offline сервисов
        const offlineKey = offlineServices
            .map(s => `${s.endpoint.ip}:${s.endpoint.port}`)
            .sort()
            .join(',');

        // Проверяем, показыдали ли мы уже это уведомление
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

// Функция для перевода названия города
function translateCity(cityName) {
    if (!cityName || cityName === 'Unknown') {
        return currentLang === 'uz' ? 'Noma\'lum' : currentLang === 'en' ? 'Unknown' : 'Неизвестно';
    }

    // Определяем тип: город (shahri/shahar) или область (viloyati/viloyat)
    const isCity = /\bshahri\b/gi.test(cityName) || /\bshahar\b/gi.test(cityName);
    const isRegion = /\bviloyati\b/gi.test(cityName) || /\bviloyat\b/gi.test(cityName);

    // Словарь для перевода названий городов
    const cityTranslations = {
        ru: {
            'Toshkent': 'Ташкент',
            'Farg\'ona': 'Фергана',
            'Fargona': 'Фергана',
            'Namangan': 'Наманган',
            'Andijon': 'Андижан',
            'Buxoro': 'Бухара',
            'Jizzax': 'Джизак',
            'Navoiy': 'Навои',
            'Qashqadaryo': 'Кашкадарья',
            'Samarqand': 'Самарканд',
            'Sirdaryo': 'Сырдарья',
            'Surxondaryo': 'Сурхандарья',
            'Xorazm': 'Хорезм',
            'Qoraqalpog\'iston': 'Каракалпакстан'
        },
        uz: {
            'Ташкент': 'Toshkent',
            'Фергана': 'Farg\'ona',
            'Fargona': 'Farg\'ona',
            'Наманган': 'Namangan',
            'Андижан': 'Andijon',
            'Бухара': 'Buxoro',
            'Джизак': 'Jizzax',
            'Навои': 'Navoiy',
            'Кашкадарья': 'Qashqadaryo',
            'Самарканд': 'Samarqand',
            'Сырдарья': 'Sirdaryo',
            'Сурхандарья': 'Surxondaryo',
            'Хорезм': 'Xorazm',
            'Каракалпакстан': 'Qoraqalpog\'iston'
        }
    };

    // Убираем shahri/shahar/viloyati/viloyat для поиска базового названия
    let baseName = cityName.replace(/\s*shahri\s*/gi, ' ').replace(/\s*shahar\s*/gi, ' ')
        .replace(/\s*viloyati\s*/gi, ' ').replace(/\s*viloyat\s*/gi, ' ').trim();

    let translatedName = baseName;
    const translations = cityTranslations[currentLang];

    // Применяем базовые переводы названий городов
    if (translations) {
        // Сначала проверяем точное совпадение
        if (translations[baseName]) {
            translatedName = translations[baseName];
        } else {
            // Проверяем частичное совпадение
            for (const [key, value] of Object.entries(translations)) {
                if (baseName.includes(key) || baseName.toLowerCase().includes(key.toLowerCase())) {
                    translatedName = baseName.replace(new RegExp(key, 'gi'), value);
                    break;
                }
            }
        }
    }

    // Форматируем названия: shahri/shahar -> "г. Название", viloyati/viloyat -> "Название область"
    if (currentLang === 'ru') {
        if (isCity) {
            // Для города: добавляем "г. " перед названием
            if (!translatedName.startsWith('г. ')) {
                translatedName = 'г. ' + translatedName;
            }
        } else if (isRegion) {
            // Для области: добавляем склонение и " область" в конце
            if (!translatedName.endsWith(' область')) {
                // Проверяем, нужно ли добавить склонение (например, "Ташкент" -> "Ташкентская")
                if (translatedName.endsWith('кент')) {
                    translatedName = translatedName.replace(/кент$/, 'кентская');
                } else if (translatedName.endsWith('на')) {
                    translatedName = translatedName.replace(/на$/, 'нская');
                } else if (translatedName.endsWith('о')) {
                    translatedName = translatedName.replace(/о$/, 'ская');
                } else if (translatedName.endsWith('а')) {
                    translatedName = translatedName.replace(/а$/, 'ская');
                } else if (translatedName.endsWith('я')) {
                    translatedName = translatedName.replace(/я$/, 'ская');
                }
                translatedName = translatedName + ' область';
            }
        }
    } else if (currentLang === 'en') {
        if (isCity) {
            if (!translatedName.endsWith(' City')) {
                translatedName = translatedName + ' City';
            }
        } else if (isRegion) {
            if (!translatedName.endsWith(' Region')) {
                translatedName = translatedName + ' Region';
            }
        }
    } else if (currentLang === 'uz') {
        // Для узбекского языка сохраняем shahri/shahar/viloyati/viloyat
        if (isCity) {
            // Определяем, какое слово было в оригинале (shahri или shahar)
            const originalCityWord = cityName.match(/\b(shahri|shahar)\b/gi);
            if (originalCityWord && originalCityWord[0]) {
                const cityWord = originalCityWord[0].toLowerCase();
                if (!translatedName.toLowerCase().includes(cityWord)) {
                    translatedName = translatedName + ' ' + cityWord;
                }
            } else {
                // По умолчанию используем shahri
                if (!translatedName.toLowerCase().includes('shahri') && !translatedName.toLowerCase().includes('shahar')) {
                    translatedName = translatedName + ' shahri';
                }
            }
        } else if (isRegion) {
            // Определяем, какое слово было в оригинале (viloyati или viloyat)
            const originalRegionWord = cityName.match(/\b(viloyati|viloyat)\b/gi);
            if (originalRegionWord && originalRegionWord[0]) {
                const regionWord = originalRegionWord[0].toLowerCase();
                if (!translatedName.toLowerCase().includes(regionWord)) {
                    translatedName = translatedName + ' ' + regionWord;
                }
            } else {
                // По умолчанию используем viloyati
                if (!translatedName.toLowerCase().includes('viloyati') && !translatedName.toLowerCase().includes('viloyat')) {
                    translatedName = translatedName + ' viloyati';
                }
            }
        }
    }

    return translatedName;
}

function populateCityFilter() {
    const cities = [...new Set(bazarsData.map(b => b.city || 'Unknown'))].sort();
    const filterName = t('dashboard.filterByCity');

    // Опция "all" показывает название фильтра
    elements.cityFilter.innerHTML = `<option value="all" data-i18n="dashboard.filterByCity" selected>${filterName}</option>`;
    cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = translateCity(city);
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

function toggleEndpoints(toggleButton) {
    const endpointGroup = toggleButton.nextElementSibling;
    const chevron = toggleButton.querySelector('.fa-chevron-down');

    if (endpointGroup.style.display === 'none') {
        endpointGroup.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
        toggleButton.style.background = 'linear-gradient(135deg, var(--primary-light), var(--primary))';
    } else {
        endpointGroup.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
        toggleButton.style.background = 'var(--surface-color)';
    }
}

// ===============================================
// Event Listeners
// ===============================================
console.log('Setting up event listeners...', elements);

// Initialize progress circles
document.addEventListener('DOMContentLoaded', function () {
    const circles = [elements.totalProgress, elements.onlineProgress, elements.offlineProgress];
    circles.forEach(circle => {
        if (circle) {
            const circumference = 2 * Math.PI * 34;
            circle.style.strokeDasharray = `0 ${circumference}`;
        }
    });
});

if (elements.searchInput) {
    elements.searchInput.addEventListener('input', applyFilters);
}

// Функция для возврата названия фильтра после выбора
function resetFilterDisplay(selectElement) {
    const filterNameKey = selectElement.getAttribute('data-filter-name');
    if (!filterNameKey) return;

    const selectedValue = selectElement.value;
    const filterName = t(filterNameKey);

    // Сохраняем выбранное значение в data-атрибут
    selectElement.setAttribute('data-selected-value', selectedValue);

    // Если выбрано "all", показываем название фильтра сразу
    if (selectedValue === 'all') {
        const allOption = selectElement.options[0];
        if (allOption && allOption.value === 'all') {
            allOption.textContent = filterName;
        }
        return;
    }

    // Через 2.5 секунды заменяем текст на название фильтра
    setTimeout(() => {
        // Находим выбранную опцию
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        if (selectedOption && selectedValue !== 'all') {
            // Сохраняем оригинальный текст
            selectedOption.setAttribute('data-original-text', selectedOption.textContent);
            // Временно меняем текст на название фильтра
            selectedOption.textContent = filterName;
        }
    }, 2500);
}

// Функция для восстановления оригинального текста при открытии select
function restoreFilterOptions(selectElement) {
    const filterNameKey = selectElement.getAttribute('data-filter-name');
    const filterName = filterNameKey ? t(filterNameKey) : '';

    Array.from(selectElement.options).forEach(option => {
        const originalText = option.getAttribute('data-original-text');
        if (originalText) {
            option.textContent = originalText;
            option.removeAttribute('data-original-text');
        }

        // Если это опция "all" и она выбрана, показываем название фильтра
        if (option.value === 'all' && selectElement.value === 'all' && filterName) {
            option.textContent = filterName;
        } else if (option.value === 'all' && selectElement.value !== 'all' && filterName) {
            // Если "all" не выбрана, показываем "Все" (Jami)
            option.textContent = t('dashboard.all');
        }
    });
}

if (elements.cityFilter) {
    elements.cityFilter.addEventListener('change', function () {
        const filterName = t('dashboard.filterByCity');
        const allOption = this.options[0];

        // Если выбрано "all", показываем название фильтра
        if (this.value === 'all' && allOption) {
            allOption.textContent = filterName;
        } else if (allOption) {
            // Иначе показываем "Все" (Jami)
            allOption.textContent = t('dashboard.all');
        }

        restoreFilterOptions(this);
        applyFilters();
        resetFilterDisplay(this);
    });

    elements.cityFilter.addEventListener('focus', function () {
        // При открытии показываем "Все" (Jami) в опции "all"
        const allOption = this.options[0];
        if (allOption && allOption.value === 'all') {
            allOption.textContent = t('dashboard.all');
        }
        restoreFilterOptions(this);
    });

    elements.cityFilter.addEventListener('mousedown', function () {
        // При открытии показываем "Все" (Jami) в опции "all"
        const allOption = this.options[0];
        if (allOption && allOption.value === 'all') {
            allOption.textContent = t('dashboard.all');
        }
        restoreFilterOptions(this);
    });
}

if (elements.statusFilter) {
    elements.statusFilter.addEventListener('change', function () {
        const filterName = t('dashboard.filterByStatus');
        const allOption = this.options[0];

        // Если выбрано "all", показываем название фильтра
        if (this.value === 'all' && allOption) {
            allOption.textContent = filterName;
        } else if (allOption) {
            // Иначе показываем "Все" (Jami)
            allOption.textContent = t('dashboard.all');
        }

        restoreFilterOptions(this);
        applyFilters();
        resetFilterDisplay(this);
    });

    elements.statusFilter.addEventListener('focus', function () {
        // При открытии показываем "Все" (Jami) в опции "all"
        const allOption = this.options[0];
        if (allOption && allOption.value === 'all') {
            allOption.textContent = t('dashboard.all');
        }
        restoreFilterOptions(this);
    });

    elements.statusFilter.addEventListener('mousedown', function () {
        // При открытии показываем "Все" (Jami) в опции "all"
        const allOption = this.options[0];
        if (allOption && allOption.value === 'all') {
            allOption.textContent = t('dashboard.all');
        }
        restoreFilterOptions(this);
    });
}

// Refresh button
if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', () => {
        const icon = elements.refreshBtn.querySelector('i');
        if (icon) {
            icon.style.animation = 'spin 1s linear';
            setTimeout(() => {
                icon.style.animation = '';
            }, 1000);
        }
        loadAllBazars();
    });
}

const langToggle = document.getElementById('langToggle');
if (langToggle) {
    langToggle.addEventListener('click', toggleLanguage);
}

// General Statistics button
const generalStatsBtn = document.getElementById('generalStatsBtn');
if (generalStatsBtn) {
    generalStatsBtn.addEventListener('click', showGeneralStatistics);
}

// Map button - handled in initMapControls()

// Theme toggle button
const themeToggleBtn = document.getElementById('themeToggleBtn');
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
}

// Sidebar toggle button

// Edit Service Modal Event Listeners
document.addEventListener('DOMContentLoaded', function () {
    // Edit Service Form Submit Handler
    const editServiceForm = document.getElementById('editServiceForm');
    if (editServiceForm) {
        editServiceForm.addEventListener('submit', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const serviceId = document.getElementById('editServiceId').value;
            if (!serviceId) {
                showNotification('Ошибка: ID сервиса не найден', 'error');
                return;
            }

            // Собираем данные формы
            const formData = {
                name: document.getElementById('editServiceName').value.trim(),
                city: document.getElementById('editServiceCity').value.trim(),
                ip: document.getElementById('editServiceIp').value.trim(),
                port: parseInt(document.getElementById('editServicePort').value),
                backend_port: parseInt(document.getElementById('editServiceBackendPort').value),
                pg_port: parseInt(document.getElementById('editServicePgPort').value),
                stream_port: document.getElementById('editServiceStreamPort').value ? parseInt(document.getElementById('editServiceStreamPort').value) : null,
                contact_click_name: document.getElementById('editServiceContactClickName').value.trim(),
                contact_click: document.getElementById('editServiceContactClick').value.trim() ? '+998' + document.getElementById('editServiceContactClick').value.trim() : '',
                contact_scc_name: document.getElementById('editServiceContactSccName').value.trim(),
                contact_scc: document.getElementById('editServiceContactScc').value.trim() ? '+998' + document.getElementById('editServiceContactScc').value.trim() : '',
                latitude: document.getElementById('editServiceLatitude').value.trim() ? parseFloat(document.getElementById('editServiceLatitude').value) : null,
                longitude: document.getElementById('editServiceLongitude').value.trim() ? parseFloat(document.getElementById('editServiceLongitude').value) : null
            };

            // Валидация обязательных полей
            if (!formData.name) {
                showNotification('Название сервиса обязательно', 'error');
                return;
            }
            if (!formData.ip) {
                showNotification('IP адрес обязателен', 'error');
                return;
            }
            if (!formData.port || formData.port <= 0) {
                showNotification('Порт фронтенда обязателен', 'error');
                return;
            }
            if (!formData.backend_port || formData.backend_port <= 0) {
                showNotification('Порт backend API обязателен', 'error');
                return;
            }
            if (!formData.pg_port || formData.pg_port <= 0) {
                showNotification('Порт PostgreSQL обязателен', 'error');
                return;
            }

            // Обновляем сервис
            updateService(serviceId, formData);
        });
    }

    // Close Edit Service Modal Button
    const closeEditServiceBtn = document.getElementById('closeEditServiceBtn');
    if (closeEditServiceBtn) {
        closeEditServiceBtn.addEventListener('click', closeEditServiceModal);
    }

    // Cancel Edit Service Button
    const cancelEditServiceBtn = document.getElementById('cancelEditService');
    if (cancelEditServiceBtn) {
        cancelEditServiceBtn.addEventListener('click', closeEditServiceModal);
    }

    // Delete Edit Service Button
    const deleteEditServiceBtn = document.getElementById('deleteEditService');
    if (deleteEditServiceBtn) {
        deleteEditServiceBtn.addEventListener('click', function () {
            const serviceId = document.getElementById('editServiceId').value;
            if (serviceId) {
                deleteService(serviceId);
            } else {
                showNotification('Ошибка: ID сервиса не найден', 'error');
            }
        });
    }

    // Close modal on overlay click
    const editServiceModal = document.getElementById('editServiceModal');
    if (editServiceModal) {
        const overlay = editServiceModal.querySelector('.admin-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', closeEditServiceModal);
        }
    }

    // Toggle Additional Fields
    const toggleEditAdditional = document.getElementById('toggleEditAdditional');
    const editAdditionalContent = document.getElementById('editAdditionalContent');

    if (toggleEditAdditional && editAdditionalContent) {
        toggleEditAdditional.addEventListener('click', function () {
            const isActive = editAdditionalContent.classList.contains('active');

            if (isActive) {
                editAdditionalContent.classList.remove('active');
                toggleEditAdditional.classList.remove('active');
                toggleEditAdditional.querySelector('i').style.transform = 'rotate(0deg)';
            } else {
                editAdditionalContent.classList.add('active');
                toggleEditAdditional.classList.add('active');
                toggleEditAdditional.querySelector('i').style.transform = 'rotate(180deg)';
            }
        });
    }

    // Add Service Modal Event Listeners
    // Add Service Form Submit Handler
    const addServiceForm = document.getElementById('addServiceForm');
    if (addServiceForm) {
        addServiceForm.addEventListener('submit', function (e) {
            e.preventDefault();
            e.stopPropagation();

            // Собираем данные формы
            const formData = {
                name: document.getElementById('serviceName').value.trim(),
                city: document.getElementById('serviceCity').value.trim(),
                ip: document.getElementById('serviceIp').value.trim(),
                port: parseInt(document.getElementById('servicePort').value),
                backend_port: parseInt(document.getElementById('serviceBackendPort').value),
                pg_port: parseInt(document.getElementById('servicePgPort').value),
                stream_port: document.getElementById('serviceStreamPort').value ? parseInt(document.getElementById('serviceStreamPort').value) : null,
                contact_click_name: document.getElementById('serviceContactClickName').value.trim(),
                contact_click: document.getElementById('serviceContactClick').value.trim() ? '+998' + document.getElementById('serviceContactClick').value.trim() : '',
                contact_scc_name: document.getElementById('serviceContactSccName').value.trim(),
                contact_scc: document.getElementById('serviceContactScc').value.trim() ? '+998' + document.getElementById('serviceContactScc').value.trim() : '',
                latitude: document.getElementById('serviceLatitude').value.trim() ? parseFloat(document.getElementById('serviceLatitude').value) : null,
                longitude: document.getElementById('serviceLongitude').value.trim() ? parseFloat(document.getElementById('serviceLongitude').value) : null
            };

            // Валидация обязательных полей
            if (!formData.name) {
                showNotification('Название сервиса обязательно', 'error');
                return;
            }
            if (!formData.ip) {
                showNotification('IP адрес обязателен', 'error');
                return;
            }
            if (!formData.port || formData.port <= 0) {
                showNotification('Порт фронтенда обязателен', 'error');
                return;
            }
            if (!formData.backend_port || formData.backend_port <= 0) {
                showNotification('Порт backend API обязателен', 'error');
                return;
            }
            if (!formData.pg_port || formData.pg_port <= 0) {
                showNotification('Порт PostgreSQL обязателен', 'error');
                return;
            }

            // Добавляем сервис
            addService(formData);
        });
    }

    // Close Add Service Modal Button
    const closeAddServiceBtn = document.getElementById('closeAddServiceBtn');
    if (closeAddServiceBtn) {
        closeAddServiceBtn.addEventListener('click', closeAddServiceModal);
    }

    // Cancel Add Service Button
    const cancelAddServiceBtn = document.getElementById('cancelAddService');
    if (cancelAddServiceBtn) {
        cancelAddServiceBtn.addEventListener('click', closeAddServiceModal);
    }

    // Close modal on overlay click
    const addServiceModal = document.getElementById('addServiceModal');
    if (addServiceModal) {
        const overlay = addServiceModal.querySelector('.admin-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', closeAddServiceModal);
        }
    }


    // Close Logs Modal Button
    const closeLogsBtn = document.getElementById('closeLogsBtn');
    if (closeLogsBtn) {
        closeLogsBtn.addEventListener('click', closeLogsModal);
    }

    // Close Logs Modal on overlay click
    const logsModal = document.getElementById('logsModal');
    if (logsModal) {
        const logsOverlay = logsModal.querySelector('.admin-modal-overlay');
        if (logsOverlay) {
            logsOverlay.addEventListener('click', closeLogsModal);
        }
    }

    // Telegram Chat IDs Modal
    const closeTelegramChatIdsBtn = document.getElementById('closeTelegramChatIdsBtn');
    if (closeTelegramChatIdsBtn) {
        closeTelegramChatIdsBtn.addEventListener('click', closeTelegramChatIdsModal);
    }

    const telegramChatIdsModal = document.getElementById('telegramChatIdsModal');
    if (telegramChatIdsModal) {
        const overlay = telegramChatIdsModal.querySelector('.admin-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', closeTelegramChatIdsModal);
        }
    }

    const addChatIdForm = document.getElementById('addChatIdForm');
    if (addChatIdForm) {
        addChatIdForm.addEventListener('submit', function (e) {
            e.preventDefault();
            addChatId();
        });
    }

    // Test Telegram Notification Button
    const testTelegramNotificationBtn = document.getElementById('testTelegramNotificationBtn');
    if (testTelegramNotificationBtn) {
        testTelegramNotificationBtn.addEventListener('click', testTelegramNotification);
    }

    // Edit Chat ID Regions Modal
    const closeEditRegionsBtn = document.getElementById('closeEditRegionsBtn');
    if (closeEditRegionsBtn) {
        closeEditRegionsBtn.addEventListener('click', closeEditRegionsModal);
    }

    const cancelRegionsBtn = document.getElementById('cancelRegionsBtn');
    if (cancelRegionsBtn) {
        cancelRegionsBtn.addEventListener('click', closeEditRegionsModal);
    }

    const saveRegionsBtn = document.getElementById('saveRegionsBtn');
    if (saveRegionsBtn) {
        saveRegionsBtn.addEventListener('click', saveChatIdRegions);
    }

    const editRegionsModal = document.getElementById('editChatIdRegionsModal');
    if (editRegionsModal) {
        const overlay = editRegionsModal.querySelector('.admin-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', closeEditRegionsModal);
        }
    }

    // Toggle Additional Fields for Add Service
    const toggleAdditional = document.getElementById('toggleAdditional');
    const additionalContent = document.getElementById('additionalContent');

    if (toggleAdditional && additionalContent) {
        toggleAdditional.addEventListener('click', function () {
            const isActive = additionalContent.classList.contains('active');

            if (isActive) {
                additionalContent.classList.remove('active');
                toggleAdditional.classList.remove('active');
                toggleAdditional.querySelector('i').style.transform = 'rotate(0deg)';
            } else {
                additionalContent.classList.add('active');
                toggleAdditional.classList.add('active');
                toggleAdditional.querySelector('i').style.transform = 'rotate(180deg)';
            }
        });
    }

    // Add Service Button (if exists)
    const addServiceBtn = document.getElementById('addServiceBtn');
    if (addServiceBtn) {
        addServiceBtn.addEventListener('click', openAddServiceModal);
    }
});

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
let uzbekistanBoundaries = null;
let uzbekistanRegions = null;

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
    'QO`QON SHAHAR DEHQON BOZORI': { lat: 40.525339, lng: 70.954376, city: 'Farg\'она' },
    'Uchko`prik Dehqon Bozori': { lat: 40.544029265896405, lng: 71.06111042694653, city: 'Farg\'она' }
};

function initMap() {
    // Инициализация карты с центром на Узбекистане
    uzbekistanMap = L.map('uzbekistanMap', {
        center: [41.3, 64.5],
        zoom: 6,
        minZoom: 5,
        maxZoom: 18,
        zoomControl: true,
        attributionControl: false, // Убираем атрибуцию
        zoomAnimation: true,
        zoomAnimationThreshold: 4,
        fadeAnimation: true,
        markerZoomAnimation: true,
        doubleClickZoom: false // Отключаем стандартный зум по двойному клику
    });

    // Устанавливаем границы Узбекистана
    const bounds = L.latLngBounds(
        [37.0, 56.0], // Southwest
        [45.5, 73.2]  // Northeast
    );
    uzbekistanMap.setMaxBounds(bounds);

    // Добавляем статичную карту (ландшафтная 2D карта черного цвета)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(uzbekistanMap);

    // Добавляем обработчик двойного клика для сброса зума с плавной анимацией
    uzbekistanMap.on('dblclick', function (e) {
        // Анимация "погружения со спутника" - сначала отдаляемся, потом возвращаемся
        uzbekistanMap.flyTo([41.3, 64.5], 6, {
            duration: 1.5, // Длительность анимации в секундах
            easeLinearity: 0.25, // Плавность анимации
            animate: true
        });
    });

    // Загружаем границы Узбекистана
    loadUzbekistanBoundaries();

    // Загружаем границы областей
    loadUzbekistanRegions();
}

// Функция для загрузки границ Узбекистана
function loadUzbekistanBoundaries() {
    console.log('Начинаем загрузку границ Узбекистана...');

    fetch('Uzb/gadm41_UZB_0.json')
        .then(response => {
            console.log('Ответ сервера:', response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('GeoJSON данные получены:', data);
            console.log('Количество features:', data.features ? data.features.length : 'неизвестно');

            // Создаем слой с границами
            uzbekistanBoundaries = L.geoJSON(data, {
                style: {
                    color: '#ffffff',
                    weight: 3,
                    opacity: 1,
                    fillColor: 'transparent',
                    fillOpacity: 0
                },
                onEachFeature: function (feature, layer) {
                    // Добавляем всплывающую подсказку
                    layer.bindPopup(`
                        <div style="text-align: center;">
                            <h4 style="margin: 0; color: #00bcd4;">${feature.properties.COUNTRY}</h4>
                            <p style="margin: 5px 0; color: #666;">Границы Узбекистана</p>
                        </div>
                    `);
                }
            }).addTo(uzbekistanMap);

            console.log('Границы Узбекистана загружены и добавлены на карту');
            console.log('uzbekistanBoundaries:', uzbekistanBoundaries);
        })
        .catch(error => {
            console.error('Ошибка загрузки границ Узбекистана:', error);
            console.error('Детали ошибки:', error.message);

            // Показываем пользователю уведомление об ошибке
            if (uzbekistanMap) {
                L.popup()
                    .setLatLng([41.3, 64.5])
                    .setContent(`
                        <div style="text-align: center; color: #ff6b6b;">
                            <h4>⚠️ Ошибка загрузки границ</h4>
                            <p>Не удалось загрузить границы Узбекистана</p>
                            <small>Проверьте консоль для деталей</small>
                        </div>
                    `)
                    .openOn(uzbekistanMap);
            }
        });
}

// Функция для загрузки границ областей (Level-1)
function loadUzbekistanRegions() {
    console.log('Начинаем загрузку границ областей Узбекистана...');

    fetch('Uzb/gadm41_UZB_1.json')
        .then(response => {
            console.log('Ответ сервера (области):', response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('GeoJSON данные областей получены:', data);
            console.log('Количество областей:', data.features ? data.features.length : 'неизвестно');

            // Создаем слой с границами областей
            uzbekistanRegions = L.geoJSON(data, {
                style: {
                    color: '#ffffff',
                    weight: 3,
                    opacity: 1,
                    fillColor: 'transparent',
                    fillOpacity: 0
                },
                onEachFeature: function (feature, layer) {
                    // Получаем название области
                    const regionName = feature.properties.NAME_1 || 'Неизвестная область';

                    // Добавляем обработчик клика для показа статистики
                    layer.on('click', function (e) {
                        showRegionStatistics(regionName, e.latlng);
                    });

                    // Добавляем подсветку при наведении
                    layer.on({
                        mouseover: function (e) {
                            const layer = e.target;
                            layer.setStyle({
                                weight: 4,
                                opacity: 1,
                                color: '#26c6da'
                            });
                        },
                        mouseout: function (e) {
                            uzbekistanRegions.resetStyle(e.target);
                        }
                    });
                }
            }).addTo(uzbekistanMap);

            console.log('Границы областей Узбекистана загружены и добавлены на карту');
        })
        .catch(error => {
            console.error('Ошибка загрузки границ областей Узбекистана:', error);
            console.error('Детали ошибки:', error.message);

            // Показываем пользователю уведомление об ошибке
            if (uzbekistanMap) {
                L.popup()
                    .setLatLng([41.3, 64.5])
                    .setContent(`
                        <div style="text-align: center; color: #ff6b6b;">
                            <h4>⚠️ Ошибка загрузки областей</h4>
                            <p>Не удалось загрузить границы областей</p>
                            <small>Проверьте консоль для деталей</small>
                        </div>
                    `)
                    .openOn(uzbekistanMap);
            }
        });
}

// Функция для показа статистики по области
async function showRegionStatistics(regionName, latlng) {
    console.log('Загрузка статистики для области:', regionName);

    // Получаем все базары из текущих данных
    const allBazars = bazarsData || [];

    // Выводим все уникальные города для отладки
    const uniqueCities = [...new Set(allBazars.map(b => b.city))];
    console.log('Все города в базе:', uniqueCities);
    console.log('Ищем область:', regionName);
    console.log('Всего базаров в данных:', allBazars.length);

    // Функция для нормализации строки (убираем апострофы, акценты и приводим к нижнему регистру)
    const normalize = (str) => {
        return str.toLowerCase()
            .replace(/['`']/g, '') // Убираем все виды апострофов
            .replace(/\s+/g, '')   // Убираем все пробелы
            .trim();
    };

    // Фильтруем базары по области (используем city как область)
    const regionBazars = allBazars.filter(bazar => {
        // Пробуем найти соответствие по разным полям
        const bazarCity = (bazar.city || '').trim();
        const bazarName = bazar.name || '';

        const normalizedCity = normalize(bazarCity);
        const normalizedRegion = normalize(regionName);

        // Специальная обработка для Ташкента
        if (regionName === 'Toshkent') {
            // Область Ташкент - исключаем ToshkentShahri
            const match = (normalizedCity.includes('tashkent') || normalizedCity.includes('toshkent')) &&
                normalizedCity !== 'toshkentshahri' && !normalizedCity.includes('shahri');
            if (match) {
                console.log(`Базар ${bazar.name} подходит для области Toshkent (city: ${bazarCity})`);
            }
            return match;
        } else if (regionName === 'ToshkentShahri') {
            // Город Ташкент - только ToshkentShahri
            const match = normalizedCity === 'toshkentshahri' || normalizedCity.includes('shahri');
            if (match) {
                console.log(`Базар ${bazar.name} подходит для города ToshkentShahri (city: ${bazarCity})`);
            }
            return match;
        }

        // Сопоставляем названия областей с городами
        const regionMapping = {
            'andijon': 'andijon',
            'buxoro': 'buxoro',
            'fargona': 'fargona',
            'jizzax': 'jizzax',
            'namangan': 'namangan',
            'navoiy': 'navoiy',
            'qaraqalpaqstan': 'qaraqalpaqstan',
            'qashqadaryo': 'qashqadaryo',
            'samarqand': 'samarqand',
            'sirdaryo': 'sirdaryo',
            'surxondaryo': 'surxondaryo',
            'xorazm': 'xorazm'
        };

        const mappedRegion = regionMapping[normalizedRegion] || normalizedRegion;
        const match = normalizedCity.includes(mappedRegion);

        if (match) {
            console.log(`Базар ${bazar.name} подходит для области ${regionName} (city: ${bazarCity})`);
        }

        return match;
    });

    console.log(`Найдено базаров в области ${regionName}:`, regionBazars.length);
    if (regionBazars.length > 0) {
        console.log('Найденные базары:', regionBazars.map(b => ({ name: b.name, city: b.city })));
    }

    // Собираем статистику по камерам
    let totalCameras = 0;
    let onlineCameras = 0;
    let offlineCameras = 0;
    let rastaFoodCameras = 0;
    let peopleCountingCameras = 0;
    let animalCameras = 0;
    let vehicleCountingCameras = 0;
    let loadedBazars = 0;

    // Загружаем статистику для каждого базара
    for (const bazar of regionBazars) {
        try {
            let ip, backendPort;

            if (bazar.endpoint && bazar.endpoint.ip && bazar.endpoint.backendPort) {
                ip = bazar.endpoint.ip;
                backendPort = bazar.endpoint.backendPort;
            } else if (bazar.endpoint && bazar.endpoint.ip && bazar.backend) {
                ip = bazar.endpoint.ip;
                backendPort = bazar.backend;
            } else if (bazar.ipAddress && bazar.backendPort) {
                ip = bazar.ipAddress;
                backendPort = bazar.backendPort;
            } else if (bazar.endpoint && bazar.endpoint.ip && bazar.endpoint.backend) {
                ip = bazar.endpoint.ip;
                backendPort = bazar.endpoint.backend;
            }

            if (ip && backendPort) {
                const cameraApiUrl = `http://${ip}:${backendPort}/api/cameras/statistics`;

                const response = await fetch(cameraApiUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    mode: 'cors'
                });

                if (response.ok) {
                    const stats = await response.json();
                    totalCameras += stats.totalCameras || 0;
                    onlineCameras += stats.onlineCameras || 0;
                    offlineCameras += stats.offlineCameras || 0;
                    rastaFoodCameras += stats.rastaFoodCameras || 0;
                    peopleCountingCameras += stats.peopleCountingCameras || 0;
                    animalCameras += stats.animalCameras || 0;
                    vehicleCountingCameras += stats.vehicleCountingCameras || 0;
                    loadedBazars++;
                }
            }
        } catch (error) {
            console.warn(`Не удалось загрузить статистику для ${bazar.name}:`, error);
        }
    }

    // Создаем попап со статистикой
    const popupContent = `
        <div class="region-popup">
            <div class="region-popup-header">
                <h3 style="margin: 0 0 10px 0; color: #00bcd4; font-size: 18px;">
                    ${regionName}
                </h3>
                <p style="margin: 0 0 15px 0; color: #8b97ab; font-size: 14px;">
                    ${t('dashboard.bazars')}: ${regionBazars.length}
                </p>
            </div>
            
            ${loadedBazars > 0 ? `
                <div class="region-popup-cameras">
                    <div class="cameras-header">
                        <i class="fas fa-video"></i>
                        <span>${t('cameras.title')}</span>
                    </div>
                    
                    <div class="camera-stats-grid">
                        <div class="camera-stat">
                            <span class="stat-label">${t('cameras.total')}:</span>
                            <span class="stat-value">${totalCameras}</span>
                        </div>
                        <div class="camera-stat online">
                            <span class="stat-label">${t('cameras.online')}:</span>
                            <span class="stat-value">${onlineCameras}</span>
                        </div>
                        <div class="camera-stat offline">
                            <span class="stat-label">${t('cameras.offline')}:</span>
                            <span class="stat-value">${offlineCameras}</span>
                        </div>
                    </div>
                    
                    <div class="camera-types">
                        <div class="camera-type">
                            <i class="fas fa-utensils"></i>
                            <span>${t('cameras.rastaFood')}: ${rastaFoodCameras}</span>
                        </div>
                        <div class="camera-type">
                            <i class="fas fa-users"></i>
                            <span>${t('cameras.peopleCounting')}: ${peopleCountingCameras}</span>
                        </div>
                        <div class="camera-type">
                            <i class="fas fa-paw"></i>
                            <span>${t('cameras.animals')}: ${animalCameras}</span>
                        </div>
                        <div class="camera-type">
                            <i class="fas fa-car"></i>
                            <span>${t('cameras.vehicleCounting')}: ${vehicleCountingCameras}</span>
                        </div>
                    </div>
                </div>
            ` : `
                <div style="text-align: center; padding: 20px; color: #8b97ab;">
                    <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
                    <p style="margin: 0;">${t('cameras.dataUnavailable')}</p>
                </div>
            `}
        </div>
    `;

    // Показываем попап
    L.popup({
        maxWidth: 350,
        className: 'region-statistics-popup'
    })
        .setLatLng(latlng)
        .setContent(popupContent)
        .openOn(uzbekistanMap);
}

// Modal controls
let mapModal, closeMapBtn, mapModalOverlay, fullscreenMapBtn, toggleBoundariesBtn;

function initMapControls() {
    console.log('=== Starting initMapControls ===');

    mapModal = document.getElementById('mapModal');
    const mapBtn = document.getElementById('mapBtn');
    closeMapBtn = document.getElementById('closeMapBtn');
    mapModalOverlay = document.querySelector('.map-modal-overlay');
    fullscreenMapBtn = document.getElementById('fullscreenMapBtn');
    toggleBoundariesBtn = document.getElementById('toggleBoundariesBtn');

    console.log('Map controls search results:', {
        mapModal: mapModal,
        mapBtn: mapBtn,
        closeMapBtn: closeMapBtn,
        mapModalOverlay: mapModalOverlay,
        fullscreenMapBtn: fullscreenMapBtn
    });

    if (mapBtn) {
        console.log('Adding click event to mapBtn');
        mapBtn.addEventListener('click', function (e) {
            console.log('=== Map button clicked! Event:', e);
            e.preventDefault();
            e.stopPropagation();
            openMapModal();
        });
        console.log('Click event added successfully');
    } else {
        console.error('ERROR: mapBtn not found in DOM!');
    }

    if (closeMapBtn) {
        closeMapBtn.addEventListener('click', closeMapModal);
    }
    if (mapModalOverlay) {
        mapModalOverlay.addEventListener('click', closeMapModal);
    }

    if (fullscreenMapBtn) {
        fullscreenMapBtn.addEventListener('click', toggleFullscreen);
    }

    if (toggleBoundariesBtn) {
        toggleBoundariesBtn.addEventListener('click', toggleBoundaries);
    }

    // Initialize overview panel toggle
    const overviewToggle = document.getElementById('overviewToggle');
    const overviewContent = document.getElementById('overviewContent');

    if (overviewToggle && overviewContent) {
        overviewToggle.addEventListener('click', function () {
            overviewContent.classList.toggle('collapsed');
            overviewToggle.classList.toggle('collapsed');
        });
    }

    console.log('=== initMapControls completed ===');
}

function openMapModal() {
    console.log('=== openMapModal() called ===');

    // Find mapModal element if not already found
    if (!mapModal) {
        mapModal = document.getElementById('mapModal');
    }

    console.log('mapModal element:', mapModal);
    console.log('mapModal classes before:', mapModal ? mapModal.className : 'null');

    if (!mapModal) {
        console.error('ERROR: mapModal is null! Cannot open map.');
        return;
    }

    console.log('Adding "active" class to modal...');
    mapModal.classList.add('active');
    console.log('mapModal classes after:', mapModal.className);

    document.body.style.overflow = 'hidden';
    console.log('Body overflow set to hidden');
    console.log('=== Map modal should be visible now ===');

    // Обновляем размер карты после открытия модального окна
    setTimeout(() => {
        if (uzbekistanMap) {
            console.log('Invalidating map size...');
            uzbekistanMap.invalidateSize();
        } else {
            console.warn('uzbekistanMap is not initialized');
        }
    }, 100);
}

function closeMapModal() {
    if (!mapModal) {
        mapModal = document.getElementById('mapModal');
    }
    if (!mapModal) return;
    mapModal.classList.remove('active');
    mapModal.classList.remove('fullscreen');
    document.body.style.overflow = '';
    updateFullscreenIcon();
}

// General Statistics functions
function showGeneralStatistics() {
    const statsModal = document.getElementById('generalStatsModal');
    if (statsModal) {
        statsModal.style.display = 'flex';
        setTimeout(() => {
            statsModal.classList.add('active');
        }, 10);

        // Load and update statistics
        loadGeneralStatistics();
    }
}

function closeGeneralStats() {
    const statsModal = document.getElementById('generalStatsModal');
    if (statsModal) {
        statsModal.classList.remove('active');
        setTimeout(() => {
            statsModal.style.display = 'none';
        }, 300);
    }
}

async function loadGeneralStatistics() {
    try {
        // Load cameras statistics
        const camerasResponse = await fetch(`${API_BASE_URL}/cameras/statistics`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (camerasResponse.ok) {
            const camerasResult = await camerasResponse.json();
            if (camerasResult.success) {
                updateGeneralStatisticsDisplay(camerasResult.data);
            }
        }

        // Load detailed statistics for each bazar
        await loadDetailedBazarsStatistics();

    } catch (error) {
        console.error('Error loading general statistics:', error);
    }
}

function updateGeneralStatisticsDisplay(data) {
    const totalBazars = data.totalBazars || 0;
    const onlineBazars = data.accessibleBazars || 0;
    const offlineBazars = totalBazars - onlineBazars;

    const totalCameras = data.totalCameras || 0;
    const onlineCameras = data.onlineCameras || 0;
    const offlineCameras = data.offlineCameras || 0;

    // 1. Update System Health (Hero Card)
    const healthPercentage = totalBazars > 0 ? Math.round((onlineBazars / totalBazars) * 100) : 0;

    const healthValueEl = document.getElementById('systemHealthValue');
    const healthChartEl = document.getElementById('systemHealthChart');

    if (healthValueEl) healthValueEl.textContent = `${healthPercentage}%`;
    if (healthChartEl) {
        healthChartEl.style.background = `conic-gradient(var(--primary) ${healthPercentage * 3.6}deg, var(--bg-tertiary) 0deg)`;
    }

    const heroOnlineEl = document.getElementById('heroOnlineCount');
    const heroOfflineEl = document.getElementById('heroOfflineCount');

    if (heroOnlineEl) heroOnlineEl.textContent = onlineBazars;
    if (heroOfflineEl) heroOfflineEl.textContent = offlineBazars;

    // 2. Update Key Metrics Grid
    const totalBazarsEl = document.getElementById('totalBazarsStats');
    const offlineBazarsEl = document.getElementById('offlineBazarsStats');
    const totalCamerasEl = document.getElementById('totalCamerasStats');
    const offlineCamerasEl = document.getElementById('offlineCamerasStats');

    if (totalBazarsEl) totalBazarsEl.textContent = totalBazars;
    if (offlineBazarsEl) offlineBazarsEl.textContent = offlineBazars;
    if (totalCamerasEl) totalCamerasEl.textContent = totalCameras;
    if (offlineCamerasEl) offlineCamerasEl.textContent = offlineCameras;

    // 3. Update regions statistics
    updateRegionsStatistics(data.regionsStats || {});
}

async function loadDetailedBazarsStatistics() {
    const statsDetailedList = document.getElementById('statsDetailedList');
    if (!statsDetailedList) {
        console.error('statsDetailedList element not found');
        return;
    }

    console.log('Loading detailed statistics for bazars:', bazarsData.length);

    // Show loading state in table
    statsDetailedList.innerHTML = `
        <tr>
            <td colspan="6" style="text-align: center; padding: 40px;">
                <div class="modern-loader" style="margin: 0 auto;">
                    <div class="loader-ring"></div>
                    <div class="loader-ring"></div>
                    <div class="loader-ring"></div>
                    <div class="loader-core"></div>
                </div>
                <p style="margin-top: 15px; color: var(--text-secondary);">${t('dashboard.loadingDetailedStatistics')}</p>
            </td>
        </tr>
    `;

    let detailedListHtml = '';

    // Process bazars in parallel
    const bazarPromises = bazarsData.map(async (bazar) => {
        const statusClass = bazar.status === 'online' ? 'online' : 'offline';
        const statusText = bazar.status === 'online' ? t('dashboard.online') : t('dashboard.offline');

        // Get detailed camera stats
        const detailedCameraStats = await getDetailedCameraStatsForBazaar(bazar);

        return {
            bazar,
            statusClass,
            statusText,
            detailedCameraStats
        };
    });

    const bazarResults = await Promise.allSettled(bazarPromises);

    // Generate HTML for table rows
    bazarResults.forEach(result => {
        if (result.status === 'fulfilled') {
            const { bazar, statusClass, statusText, detailedCameraStats } = result.value;
            const city = translateCity(bazar.city || 'Unknown');
            const totalCameras = detailedCameraStats.totalCameras || 0;
            const onlineCameras = detailedCameraStats.onlineCameras || 0;
            const roiCount = detailedCameraStats.totalROIs || 0;

            detailedListHtml += `
                <tr>
                    <td>
                        <div style="font-weight: 600;">${bazar.name || 'Unknown'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${bazar.endpoint ? `${bazar.endpoint.ip}:${bazar.endpoint.port}` : 'N/A'}</div>
                    </td>
                    <td>${city}</td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            <span class="dot"></span>
                            ${statusText}
                        </span>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-weight: 600; color: var(--text-primary);">${onlineCameras}</span>
                            <span style="color: var(--text-muted);">/ ${totalCameras}</span>
                            ${totalCameras > 0 ? `
                                <div style="width: 60px; height: 4px; background: var(--bg-tertiary); border-radius: 2px; overflow: hidden;">
                                    <div style="width: ${(onlineCameras / totalCameras) * 100}%; height: 100%; background: ${onlineCameras === totalCameras ? 'var(--success)' : 'var(--warning)'};"></div>
                                </div>
                            ` : ''}
                        </div>
                    </td>
                    <td>
                        ${roiCount > 0 ? `
                            <span style="color: var(--text-primary); font-weight: 500;">${roiCount}</span>
                        ` : '<span style="color: var(--text-muted);">-</span>'}
                    </td>
                    <td>
                        <button class="btn-icon" onclick="accessBozor('${bazar.endpoint?.ip}', ${bazar.endpoint?.port})" title="${t('cameras.accessBozor')}">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        }
    });

    statsDetailedList.innerHTML = detailedListHtml;

    if (detailedListHtml === '') {
        statsDetailedList.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">
                    ${t('dashboard.noBazarsFound')}
                </td>
            </tr>
        `;
    }

    // Initialize search functionality for the table
    const searchInput = document.getElementById('detailedSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = statsDetailedList.querySelectorAll('tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        });
    }
}

function updateRegionsStatistics(regionsStats) {
    const statsRegionsList = document.getElementById('statsRegionsList');
    if (!statsRegionsList) return;

    console.log('Updating regions statistics with data:', regionsStats);

    // Save data for export
    currentRegionsStats = regionsStats;

    let regionsHtml = '';

    // Sort regions by total bazars
    const sortedRegions = Object.entries(regionsStats).sort((a, b) => b[1].totalBazars - a[1].totalBazars);
    let rank = 1;

    for (const [regionName, stats] of sortedRegions) {
        const translatedRegionName = translateCity(regionName);
        const total = stats.totalBazars || 0;
        const online = stats.onlineBazars || 0;
        const health = total > 0 ? Math.round((online / total) * 100) : 0;

        // SVG Circle calculations (r=16)
        const circumference = 2 * Math.PI * 16;
        const offset = circumference - (health / 100) * circumference;
        const colorVar = health >= 90 ? 'var(--success)' : health >= 50 ? 'var(--warning)' : 'var(--danger)';

        regionsHtml += `
            <div class="stats-region-row">
                <div class="region-info">
                    <div class="region-rank">#${rank++}</div>
                    <div class="region-name">${translatedRegionName}</div>
                </div>
                <div class="region-metrics">
                    <div class="region-metric">
                        <span class="label">${t('statistics.totalBazars')}</span>
                        <span class="value">${total}</span>
                    </div>
                    <div class="region-metric">
                        <span class="label">${t('statistics.onlineBazars')}</span>
                        <span class="value success">${online}</span>
                    </div>
                    <div class="region-metric">
                        <span class="label">${t('statistics.totalCameras')}</span>
                        <span class="value">${stats.totalCameras || 0}</span>
                    </div>
                </div>
                <div class="region-progress-container">
                    <div class="region-mini-chart">
                        <svg viewBox="0 0 36 36">
                            <circle class="bg" cx="18" cy="18" r="16"></circle>
                            <circle class="progress" cx="18" cy="18" r="16" 
                                style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}; stroke: ${colorVar}">
                            </circle>
                        </svg>
                        <div class="text">${health}%</div>
                    </div>
                </div>
            </div>
        `;
    }

    if (regionsHtml === '') {
        regionsHtml = `
            <div class="stats-region-row" style="justify-content: center; color: var(--text-muted);">
                <i class="fas fa-info-circle" style="margin-right: 8px;"></i>
                <span>${t('dashboard.noBazarsFound')}</span>
            </div>
        `;
    }

    statsRegionsList.innerHTML = regionsHtml;
}

function toggleFullscreen() {
    if (!mapModal) {
        mapModal = document.getElementById('mapModal');
    }
    if (!mapModal) return;

    const isFullscreen = mapModal.classList.contains('fullscreen');

    if (isFullscreen) {
        mapModal.classList.remove('fullscreen');
        document.body.style.overflow = '';
    } else {
        mapModal.classList.add('fullscreen');
        document.body.style.overflow = 'hidden';
    }

    updateFullscreenIcon();

    // Перерисовываем карту после изменения размера
    setTimeout(() => {
        if (uzbekistanMap) {
            uzbekistanMap.invalidateSize();
        }
    }, 100);
}

function updateFullscreenIcon() {
    if (!fullscreenMapBtn) return;

    const icon = fullscreenMapBtn.querySelector('i');
    const isFullscreen = mapModal && mapModal.classList.contains('fullscreen');

    if (icon) {
        icon.className = isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
    }
}

// Функция для переключения видимости границ Узбекистана
function toggleBoundaries() {
    if (!uzbekistanBoundaries || !toggleBoundariesBtn) return;

    const isVisible = uzbekistanMap.hasLayer(uzbekistanBoundaries);

    if (isVisible) {
        // Скрываем границы
        uzbekistanMap.removeLayer(uzbekistanBoundaries);
        toggleBoundariesBtn.classList.remove('active');
        toggleBoundariesBtn.title = 'Показать границы Узбекистана';
    } else {
        // Показываем границы
        uzbekistanMap.addLayer(uzbekistanBoundaries);
        toggleBoundariesBtn.classList.add('active');
        toggleBoundariesBtn.title = 'Скрыть границы Узбекистана';
    }
}

function accessBozor(ipAddress, frontendPort) {
    // Открываем базар в новой вкладке
    const url = `http://${ipAddress}:${frontendPort}`;
    window.open(url, '_blank');
}

// Закрытие по Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mapModal && mapModal.classList.contains('active')) {
        closeMapModal();
    }
});

async function updateMapMarkers() {
    // Очищаем существующие маркеры
    Object.values(cityMarkers).forEach(marker => marker.remove());
    cityMarkers = {};

    // Группируем базары по локациям для определения статуса
    const locationGroups = {};
    let totalOnline = 0, totalOffline = 0;

    bazarsData.forEach(bazar => {
        // Используем координаты из БД, если они есть
        if (!bazar.latitude || !bazar.longitude) {
            return;
        }

        // Подсчитываем общую статистику
        if (bazar.status === 'online') {
            totalOnline++;
        } else {
            totalOffline++;
        }

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

    // Обновляем боковую панель
    updateOverviewPanel(totalOnline, totalOffline);

    // Добавляем маркер для каждой локации
    for (const [locationKey, location] of Object.entries(locationGroups)) {
        const total = location.bazars.length;
        const online = location.online;
        const offline = location.offline;

        // Определяем статус локации
        let status, markerColor, statusText, statusIcon;
        if (offline === 0) {
            status = 'online';
            markerColor = '#00c853';
            statusText = t('dashboard.online');
            statusIcon = '✓';
        } else if (online === 0) {
            status = 'offline';
            markerColor = '#ff3d00';
            statusText = t('dashboard.offline');
            statusIcon = '✕';
        } else {
            status = 'partial';
            markerColor = '#ffa000';
            statusText = currentLang === 'uz' ? 'Qisman' : currentLang === 'en' ? 'Partial' : 'Частично';
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

        // Получаем статистику камер для каждого базара
        const bazarsWithCameras = [];
        for (const bazar of location.bazars) {
            let cameraStats = null;
            try {
                // Пробуем разные возможные структуры данных
                let ip, backendPort;

                if (bazar.endpoint && bazar.endpoint.ip && bazar.endpoint.backendPort) {
                    ip = bazar.endpoint.ip;
                    backendPort = bazar.endpoint.backendPort;
                } else if (bazar.endpoint && bazar.endpoint.ip && bazar.backend) {
                    ip = bazar.endpoint.ip;
                    backendPort = bazar.backend;
                } else if (bazar.ipAddress && bazar.backendPort) {
                    ip = bazar.ipAddress;
                    backendPort = bazar.backendPort;
                } else if (bazar.endpoint && bazar.endpoint.ip && bazar.endpoint.backend) {
                    ip = bazar.endpoint.ip;
                    backendPort = bazar.endpoint.backend;
                }

                if (ip && backendPort) {
                    const cameraApiUrl = `http://${ip}:${backendPort}/api/cameras/statistics`;
                    console.log(`Fetching camera stats from: ${cameraApiUrl}`);

                    const response = await fetch(cameraApiUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        mode: 'cors'
                    });

                    console.log(`Response status for ${bazar.name}:`, response.status);

                    if (response.ok) {
                        cameraStats = await response.json();
                        console.log(`Camera stats for ${bazar.name}:`, cameraStats);
                    } else if (response.status === 401) {
                        console.warn(`API requires authentication for ${bazar.name} (401 Unauthorized)`);
                        // Попробуем без авторизации или с базовой авторизацией
                        try {
                            const retryResponse = await fetch(cameraApiUrl, {
                                method: 'GET',
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer ' // Попробуем пустой токен
                                },
                                mode: 'cors'
                            });

                            if (retryResponse.ok) {
                                cameraStats = await retryResponse.json();
                                console.log(`Camera stats for ${bazar.name} (retry):`, cameraStats);
                            } else {
                                console.warn(`API still requires authentication for ${bazar.name}`);
                            }
                        } catch (retryError) {
                            console.warn(`Retry failed for ${bazar.name}:`, retryError);
                        }
                    } else {
                        console.warn(`API returned ${response.status} for ${bazar.name}`);
                    }
                } else {
                    console.warn(`Missing backend port or IP for ${bazar.name}:`, {
                        bazar: bazar,
                        endpoint: bazar.endpoint,
                        'endpoint.backendPort': bazar.endpoint?.backendPort,
                        backend: bazar.backend,
                        ipAddress: bazar.ipAddress,
                        backendPort: bazar.backendPort
                    });
                }
            } catch (error) {
                console.warn(`Failed to fetch camera stats for ${bazar.name}:`, error);
            }

            bazarsWithCameras.push({
                ...bazar,
                cameraStats
            });
        }

        // Создаем детальный popup с информацией о камерах
        const bazarsList = bazarsWithCameras.map(b => {
            let camerasInfo = '';
            if (b.cameraStats) {
                camerasInfo = `
                    <div class="city-popup-cameras">
                        <div class="cameras-header">
                            <i class="fas fa-video"></i>
                            <span>${t('cameras.title')}</span>
                        </div>
                        <div class="cameras-stats">
                            <div class="camera-stat">
                                <span class="label">${t('cameras.total')}</span>
                                <span class="value">${b.cameraStats.totalCameras}</span>
                            </div>
                            <div class="camera-stat">
                                <span class="label">${t('cameras.online')}</span>
                                <span class="value online">${b.cameraStats.onlineCameras}</span>
                            </div>
                            <div class="camera-stat">
                                <span class="label">${t('cameras.offline')}</span>
                                <span class="value offline">${b.cameraStats.offlineCameras}</span>
                            </div>
                            ${b.cameraStats.rastaFoodCameras > 0 ? `
                            <div class="camera-stat">
                                <span class="label">${t('cameras.rastaFood')}</span>
                                <span class="value">${b.cameraStats.rastaFoodCameras}</span>
                            </div>
                            ` : ''}
                            ${b.cameraStats.peopleCountingCameras > 0 ? `
                            <div class="camera-stat">
                                <span class="label">${t('cameras.peopleCounting')}</span>
                                <span class="value">${b.cameraStats.peopleCountingCameras}</span>
                            </div>
                            ` : ''}
                            ${b.cameraStats.animalCameras > 0 ? `
                            <div class="camera-stat">
                                <span class="label">${t('cameras.animals')}</span>
                                <span class="value">${b.cameraStats.animalCameras}</span>
                            </div>
                            ` : ''}
                            ${b.cameraStats.vehicleCountingCameras > 0 ? `
                            <div class="camera-stat">
                                <span class="label">${t('cameras.vehicleCounting')}</span>
                                <span class="value">${b.cameraStats.vehicleCountingCameras}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            } else {
                camerasInfo = `
                    <div class="city-popup-cameras">
                        <div class="cameras-header">
                            <i class="fas fa-video"></i>
                            <span>${t('cameras.title')}</span>
                        </div>
                        <div class="cameras-stats">
                            <div class="camera-stat">
                                <span class="label">${t('cameras.dataUnavailable')}</span>
                            </div>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="bazar-info">
                    <div class="bazar-header">
                        <div class="bazar-name">${b.name || 'Unknown'}</div>
                        <div class="bazar-status ${b.status}">${b.status === 'online' ? t('dashboard.online') : t('dashboard.offline')}</div>
                    </div>
                    ${camerasInfo}
                    <div class="bazar-actions">
                        <button class="access-bozor-btn" onclick="accessBozor('${b.endpoint.ip}', ${b.endpoint.port})">
                            <i class="fas fa-external-link-alt"></i>
                            ${t('cameras.accessBozor')}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        const popupContent = `
            <div class="city-popup">
                <div class="city-popup-title">${location.name}</div>
                <div class="city-popup-stats">
                    <div class="city-popup-stat">
                        <span class="label">${t('statistics.location')}:</span>
                        <span class="value">${location.bazars[0].city || location.coords.city}</span>
                    </div>
                    <div class="city-popup-stat">
                        <span class="label">${t('statistics.status')}:</span>
                        <span class="value ${status}">${status === 'online' ? t('dashboard.online') : status === 'offline' ? t('dashboard.offline') : statusText}</span>
                    </div>
                    <div class="city-popup-stat">
                        <span class="label">${t('statistics.totalServices')}:</span>
                        <span class="value">${total}</span>
                    </div>
                    <div class="city-popup-stat">
                        <span class="label">${t('dashboard.online')}:</span>
                        <span class="value online">${online}</span>
                    </div>
                    <div class="city-popup-stat">
                        <span class="label">${t('dashboard.offline')}:</span>
                        <span class="value offline">${offline}</span>
                    </div>
                    <hr style="border: none; border-top: 1px solid rgba(100, 116, 139, 0.3); margin: 0.75rem 0;">
                    <div class="bazars-list">
                        ${bazarsList}
                    </div>
                </div>
            </div>
        `;

        // Добавляем маркер на карту
        const marker = L.marker([location.coords.lat, location.coords.lng], { icon })
            .bindPopup(popupContent)
            .bindTooltip(location.name, {
                permanent: false,
                direction: 'top',
                offset: [0, -35],
                className: 'custom-tooltip'
            })
            .addTo(uzbekistanMap);

        // При клике на маркер - центрируем карту с плавной анимацией
        marker.on('click', function () {
            uzbekistanMap.flyTo([location.coords.lat, location.coords.lng], 18, {
                duration: 2,
                easeLinearity: 0.1
            });
        });

        cityMarkers[`${location.name}_${Object.keys(cityMarkers).length}`] = marker;
    }
}

async function updateOverviewPanel(online, offline) {
    const overviewOnline = document.getElementById('overviewOnline');
    const overviewOffline = document.getElementById('overviewOffline');
    const overviewApiOnline = document.getElementById('overviewApiOnline');
    const overviewApiOffline = document.getElementById('overviewApiOffline');
    const overviewDbOnline = document.getElementById('overviewDbOnline');
    const overviewDbOffline = document.getElementById('overviewDbOffline');

    if (overviewOnline) overviewOnline.textContent = online;
    if (overviewOffline) overviewOffline.textContent = offline;

    // API статус - считаем количество онлайн/оффлайн API для всех базаров
    if (overviewApiOnline) overviewApiOnline.textContent = online; // Количество онлайн API = количеству онлайн базаров
    if (overviewApiOffline) overviewApiOffline.textContent = offline; // Количество оффлайн API = количеству оффлайн базаров

    // БД статус - считаем количество онлайн/оффлайн БД для всех базаров
    if (overviewDbOnline) overviewDbOnline.textContent = online; // Количество онлайн БД = количеству онлайн базаров
    if (overviewDbOffline) overviewDbOffline.textContent = offline; // Количество оффлайн БД = количеству оффлайн базаров

    // Загружаем и обновляем статистику камер для боковой панели
    try {
        const response = await fetch(`${API_BASE_URL}/cameras/statistics`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                updateMapOverviewCameras(result.data);
            }
        }
    } catch (error) {
        console.warn('Failed to load cameras statistics for map overview:', error);
    }
}

function updateMapOverviewCameras(data) {
    // Обновляем статистику камер в боковой панели карты
    const mapOverviewCameras = document.querySelector('.map-overview-cameras');
    if (mapOverviewCameras) {
        mapOverviewCameras.innerHTML = `
            <div class="overview-section">
                <div class="overview-section-header">
                    <i class="fas fa-video"></i>
                    <span>${t('cameras.title')}</span>
                </div>
                <div class="overview-stats">
                    <div class="overview-stat">
                        <div class="stat-dot online"></div>
                        <span class="stat-label">${t('statistics.totalCameras')}</span>
                        <span class="stat-value">${data.totalCameras || 0}</span>
                    </div>
                    <div class="overview-stat">
                        <div class="stat-dot online"></div>
                        <span class="stat-label">${t('statistics.workingCameras')}</span>
                        <span class="stat-value">${data.onlineCameras || 0}</span>
                    </div>
                    <div class="overview-stat">
                        <div class="stat-dot offline"></div>
                        <span class="stat-label">${t('statistics.notWorkingCameras')}</span>
                        <span class="stat-value">${data.offlineCameras || 0}</span>
                    </div>
                </div>
                <div class="overview-camera-types">
                    ${data.rastaFoodCameras > 0 ? `<div class="camera-type-overview"><i class="fas fa-utensils"></i> ${t('cameras.rastaFood')}: ${data.rastaFoodCameras}</div>` : ''}
                    ${data.peopleCountingCameras > 0 ? `<div class="camera-type-overview"><i class="fas fa-users"></i> ${t('cameras.peopleCounting')}: ${data.peopleCountingCameras}</div>` : ''}
                    ${data.animalCameras > 0 ? `<div class="camera-type-overview"><i class="fas fa-paw"></i> ${t('cameras.animals')}: ${data.animalCameras}</div>` : ''}
                    ${data.vehicleCountingCameras > 0 ? `<div class="camera-type-overview"><i class="fas fa-car"></i> ${t('cameras.vehicleCounting')}: ${data.vehicleCountingCameras}</div>` : ''}
                </div>
            </div>
        `;
    }
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
    const serviceNameInput = document.getElementById('serviceName');
    if (serviceNameInput) serviceNameInput.placeholder = t('modal.addService.serviceNamePlaceholder');
    document.querySelector('label[for="serviceCity"]').textContent = t('modal.addService.city');
    const serviceCityInput = document.getElementById('serviceCity');
    if (serviceCityInput) serviceCityInput.placeholder = t('modal.addService.cityPlaceholder');
    document.querySelector('label[for="serviceIp"]').textContent = t('modal.addService.ipAddress');
    document.querySelector('label[for="servicePort"]').textContent = t('modal.addService.frontendPort');
    document.querySelector('label[for="serviceBackendPort"]').textContent = t('modal.addService.backendPort');
    document.querySelector('label[for="servicePgPort"]').textContent = t('modal.addService.pgPort');
    const streamPortLabel = document.querySelector('label[for="serviceStreamPort"]');
    if (streamPortLabel) streamPortLabel.textContent = t('modal.addService.streamPort');

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

function updateEditServiceModalText() {
    // Обновляем заголовок
    const titleEl = document.querySelector('#editServiceModal .admin-modal-title h2');
    if (titleEl) titleEl.textContent = t('modal.editService.title');

    // Обновляем кнопку раскрытия
    const toggleBtn = document.querySelector('#toggleEditAdditional span');
    if (toggleBtn) toggleBtn.textContent = t('modal.editService.tabAdditional');

    // Обновляем метки полей - Основное
    const serviceNameLabel = document.querySelector('label[for="editServiceName"]');
    if (serviceNameLabel) serviceNameLabel.textContent = t('modal.editService.serviceName');
    const serviceNameInput = document.getElementById('editServiceName');
    if (serviceNameInput) serviceNameInput.placeholder = t('modal.editService.serviceNamePlaceholder');

    const serviceCityLabel = document.querySelector('label[for="editServiceCity"]');
    if (serviceCityLabel) serviceCityLabel.textContent = t('modal.editService.city');
    const serviceCityInput = document.getElementById('editServiceCity');
    if (serviceCityInput) serviceCityInput.placeholder = t('modal.editService.cityPlaceholder');

    const serviceIpLabel = document.querySelector('label[for="editServiceIp"]');
    if (serviceIpLabel) serviceIpLabel.textContent = t('modal.editService.ipAddress');

    const servicePortLabel = document.querySelector('label[for="editServicePort"]');
    if (servicePortLabel) servicePortLabel.textContent = t('modal.editService.frontendPort');

    const serviceBackendPortLabel = document.querySelector('label[for="editServiceBackendPort"]');
    if (serviceBackendPortLabel) serviceBackendPortLabel.textContent = t('modal.editService.backendPort');

    const servicePgPortLabel = document.querySelector('label[for="editServicePgPort"]');
    if (servicePgPortLabel) servicePgPortLabel.textContent = t('modal.editService.pgPort');

    const serviceStreamPortLabel = document.querySelector('label[for="editServiceStreamPort"]');
    if (serviceStreamPortLabel) serviceStreamPortLabel.textContent = t('modal.editService.streamPort');

    // Обновляем метки полей - Дополнительно
    const contactInfoTitle = document.querySelectorAll('#editServiceModal .form-section-title h4')[0];
    if (contactInfoTitle) contactInfoTitle.textContent = t('modal.editService.contactInfo');

    const contactClickNameLabel = document.querySelector('label[for="editServiceContactClickName"]');
    if (contactClickNameLabel) contactClickNameLabel.textContent = t('modal.editService.contactClickName');
    const contactClickNameInput = document.getElementById('editServiceContactClickName');
    if (contactClickNameInput) contactClickNameInput.placeholder = t('modal.editService.contactClickNamePlaceholder');

    const contactClickLabel = document.querySelector('label[for="editServiceContactClick"]');
    if (contactClickLabel) contactClickLabel.textContent = t('modal.editService.contactClick');

    const contactSccNameLabel = document.querySelector('label[for="editServiceContactSccName"]');
    if (contactSccNameLabel) contactSccNameLabel.textContent = t('modal.editService.contactSccName');
    const contactSccNameInput = document.getElementById('editServiceContactSccName');
    if (contactSccNameInput) contactSccNameInput.placeholder = t('modal.editService.contactSccNamePlaceholder');

    const contactSccLabel = document.querySelector('label[for="editServiceContactScc"]');
    if (contactSccLabel) contactSccLabel.textContent = t('modal.editService.contactScc');

    const mapCoordinatesTitle = document.querySelectorAll('#editServiceModal .form-section-title h4')[1];
    if (mapCoordinatesTitle) mapCoordinatesTitle.textContent = t('modal.editService.mapCoordinates');

    const latitudeLabel = document.querySelector('label[for="editServiceLatitude"]');
    if (latitudeLabel) latitudeLabel.textContent = t('modal.editService.latitude');

    const longitudeLabel = document.querySelector('label[for="editServiceLongitude"]');
    if (longitudeLabel) longitudeLabel.textContent = t('modal.editService.longitude');

    // Обновляем кнопки
    const saveBtn = document.querySelector('#editServiceForm .btn-submit span');
    if (saveBtn) saveBtn.textContent = t('modal.editService.save');
    const cancelBtn = document.querySelector('#cancelEditService span');
    if (cancelBtn) cancelBtn.textContent = t('modal.editService.cancel');
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

// Алиас для совместимости
function showAddServiceModal() {
    openAddServiceModal();
}

// Алиас для открытия модального окна логов (используется в HTML)
function showLogsModal() {
    openLogsModal();
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

async function openEditServiceModal(ip, port) {
    try {
        // Обновляем переводы перед открытием
        updateEditServiceModalText();

        // Загружаем данные из API /status
        const response = await fetch(`${API_BASE_URL}/status`);
        const result = await response.json();

        if (!result.success) {
            showNotification('Ошибка загрузки данных сервиса', 'error');
            console.error('API error:', result);
            return;
        }

        // Находим сервис по IP и порту (приводим порт к числу для сравнения)
        const portNum = parseInt(port);
        const service = result.data.find(s => s.ip === ip && parseInt(s.port) === portNum);

        if (!service) {
            showNotification(`Сервис не найден (${ip}:${port})`, 'error');
            console.error('Service not found. Searched:', ip, portNum);
            console.error('Available services:', result.data);
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
        document.getElementById('editServiceStreamPort').value = service.stream_port || '';

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
        console.error('Error in openEditServiceModal:', error);
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

        if (result.success || response.ok) {
            showNotification(`✅ ${formData.name || formData.ip} - обновлен успешно!`, 'success');
            closeEditServiceModal();
            // Обновляем логи только если модальное окно логов открыто
            if (elements.logsModal.classList.contains('active')) {
                loadLogsList();
            }
            loadAllBazars(); // Обновляем основной список
        } else {
            showNotification(result.error || result.message || 'Ошибка обновления сервиса', 'error');
            console.error('Update failed:', result);
        }
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, 'error');
        console.error('Update error:', error);
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
        switch (actionType) {
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

            switch (actionType) {
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
// Export Functions for Bazar Cards
// ===============================================
async function downloadROIsExport(ip, backendPort) {
    try {
        const exportUrl = `http://${ip}:${backendPort}/api/exports/rois`;

        // Use XMLHttpRequest to get better access to response headers
        const xhr = new XMLHttpRequest();
        xhr.open('GET', exportUrl, true);
        xhr.responseType = 'blob';

        // Set up promise to handle the response
        const filenamePromise = new Promise((resolve, reject) => {
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    // Try to get filename from Content-Disposition header
                    const contentDisposition = xhr.getResponseHeader('Content-Disposition');
                    let filename = null;

                    if (contentDisposition) {
                        console.log('Content-Disposition header:', contentDisposition);

                        // Try to extract filename from Content-Disposition header
                        // Format from server: attachment; filename=JARQO'RG'ON_rois_17112025.json; filename*=UTF-8''JARQO%27RG%27ON_rois_17112025.json

                        // First try filename* (RFC 5987) - highest priority, handles special characters better
                        let filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i);
                        if (filenameMatch && filenameMatch[1]) {
                            try {
                                filename = decodeURIComponent(filenameMatch[1].trim());
                                console.log('Extracted from filename*:', filename);
                            } catch (e) {
                                console.warn('Failed to decode filename*:', e);
                            }
                        }

                        // If filename* didn't work, try regular filename
                        if (!filename) {
                            // Try filename with quotes
                            filenameMatch = contentDisposition.match(/filename=["']([^"']+)["']/i);
                            if (filenameMatch && filenameMatch[1]) {
                                filename = filenameMatch[1].trim();
                                console.log('Extracted from filename (quoted):', filename);
                            } else {
                                // Try filename without quotes (may contain special chars like apostrophe)
                                filenameMatch = contentDisposition.match(/filename=([^;\s]+)/i);
                                if (filenameMatch && filenameMatch[1]) {
                                    filename = filenameMatch[1].trim();
                                    console.log('Extracted from filename (unquoted):', filename);
                                }
                            }
                        }
                    }

                    resolve({ blob: xhr.response, filename: filename });
                } else {
                    reject(new Error(`Failed to export ROIs: ${xhr.status} ${xhr.statusText}`));
                }
            };

            xhr.onerror = function () {
                reject(new Error('Network error while exporting ROIs'));
            };
        });

        xhr.send();

        const { blob, filename } = await filenamePromise;

        // If filename is still not found, throw error (no default fallback)
        if (!filename) {
            console.error('Could not extract filename from Content-Disposition header');
            throw new Error('Server did not provide filename in Content-Disposition header. Please ensure CORS exposes this header.');
        }

        console.log('Extracted filename:', filename);

        // Download the file with original filename from server
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename; // Use filename from Content-Disposition header
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);

        showNotification('📥 ROIs export downloaded successfully', 'success');

    } catch (error) {
        console.error('Error exporting ROIs:', error);
        showNotification(`Error exporting ROIs: ${error.message}`, 'error');
    }
}

async function downloadStreamsExport(ip, backendPort) {
    try {
        const exportUrl = `http://${ip}:${backendPort}/api/exports/streams`;

        // Use XMLHttpRequest to get better access to response headers
        const xhr = new XMLHttpRequest();
        xhr.open('GET', exportUrl, true);
        xhr.responseType = 'blob';

        // Set up promise to handle the response
        const filenamePromise = new Promise((resolve, reject) => {
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    // Try to get filename from Content-Disposition header
                    const contentDisposition = xhr.getResponseHeader('Content-Disposition');
                    let filename = null;

                    if (contentDisposition) {
                        console.log('Content-Disposition header:', contentDisposition);

                        // Try to extract filename from Content-Disposition header
                        // Format from server: attachment; filename=JARQO'RG'ON_rois_17112025.json; filename*=UTF-8''JARQO%27RG%27ON_rois_17112025.json

                        // First try filename* (RFC 5987) - highest priority, handles special characters better
                        let filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i);
                        if (filenameMatch && filenameMatch[1]) {
                            try {
                                filename = decodeURIComponent(filenameMatch[1].trim());
                                console.log('Extracted from filename*:', filename);
                            } catch (e) {
                                console.warn('Failed to decode filename*:', e);
                            }
                        }

                        // If filename* didn't work, try regular filename
                        if (!filename) {
                            // Try filename with quotes
                            filenameMatch = contentDisposition.match(/filename=["']([^"']+)["']/i);
                            if (filenameMatch && filenameMatch[1]) {
                                filename = filenameMatch[1].trim();
                                console.log('Extracted from filename (quoted):', filename);
                            } else {
                                // Try filename without quotes (may contain special chars like apostrophe)
                                filenameMatch = contentDisposition.match(/filename=([^;\s]+)/i);
                                if (filenameMatch && filenameMatch[1]) {
                                    filename = filenameMatch[1].trim();
                                    console.log('Extracted from filename (unquoted):', filename);
                                }
                            }
                        }
                    }

                    resolve({ blob: xhr.response, filename: filename });
                } else {
                    reject(new Error(`Failed to export Streams: ${xhr.status} ${xhr.statusText}`));
                }
            };

            xhr.onerror = function () {
                reject(new Error('Network error while exporting Streams'));
            };
        });

        xhr.send();

        const { blob, filename } = await filenamePromise;

        // If filename is still not found, throw error (no default fallback)
        if (!filename) {
            console.error('Could not extract filename from Content-Disposition header');
            throw new Error('Server did not provide filename in Content-Disposition header. Please ensure CORS exposes this header.');
        }

        console.log('Extracted filename:', filename);

        // Download the file with original filename from server
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename; // Use filename from Content-Disposition header
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);

        showNotification('📥 Streams export downloaded successfully', 'success');

    } catch (error) {
        console.error('Error exporting Streams:', error);
        showNotification(`Error exporting Streams: ${error.message}`, 'error');
    }
}

// ===============================================
// Telegram Notifications
// ===============================================

// Telegram Chat IDs Management
async function showTelegramChatIdsModal() {
    const modal = document.getElementById('telegramChatIdsModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Инициализируем кнопки типа (выбираем "channel" по умолчанию)
        selectChatType('channel');

        // Загружаем области для формы добавления
        const regions = await loadRegionsForChatId();
        const regionsContainer = document.getElementById('regionsCheckboxes');
        if (regionsContainer) {
            if (regions.length === 0) {
                regionsContainer.innerHTML = `<small style="color: var(--text-muted);">${t('modal.telegram.noRegions')}</small>`;
            } else {
                regionsContainer.innerHTML = regions.map(region => `
                    <label style="display: flex; align-items: center; padding: 0.25rem; cursor: pointer;">
                        <input type="checkbox" value="${region}" style="margin-right: 0.5rem;">
                        <span style="font-size: 0.875rem;">${region}</span>
                    </label>
                `).join('');
            }
        }

        // Обновляем переводы в модальном окне
        updateTelegramModalTexts();
        loadTelegramChatIds();
    }
}

function selectChatType(type) {
    // Обновляем скрытое поле
    const hiddenInput = document.getElementById('chatTypeSelect');
    if (hiddenInput) {
        hiddenInput.value = type;
    }

    // Обновляем визуальное состояние кнопок
    const typeOptions = document.querySelectorAll('.type-option');
    typeOptions.forEach(btn => {
        const btnType = btn.getAttribute('data-type');
        if (btnType === type) {
            btn.classList.add('active');
            btn.style.border = '2px solid var(--primary)';
            btn.style.background = 'var(--primary)';
            btn.style.color = 'white';
            btn.style.fontWeight = '500';
        } else {
            btn.classList.remove('active');
            btn.style.border = '2px solid var(--border-color)';
            btn.style.background = 'var(--surface-color)';
            btn.style.color = 'var(--text-primary)';
            btn.style.fontWeight = 'normal';
        }
    });
}

function updateTelegramModalTexts() {
    // Обновляем все тексты в модальном окне Telegram
    const modal = document.getElementById('telegramChatIdsModal');
    if (!modal) return;

    // Обновляем тексты кнопок типа
    const typeOptions = document.querySelectorAll('.type-option span[data-i18n]');
    typeOptions.forEach(span => {
        const key = span.getAttribute('data-i18n');
        span.textContent = t(key);
    });
}

function closeTelegramChatIdsModal() {
    const modal = document.getElementById('telegramChatIdsModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Кэш для списка областей
let cachedRegions = null;
let regionsCacheTime = 0;
const REGIONS_CACHE_TTL = 60000; // 1 минута

async function loadTelegramChatIds() {
    try {
        const listContainer = document.getElementById('chatIdsList');
        if (!listContainer) return;

        // Показываем индикатор загрузки
        listContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; padding: 2rem;">
                <i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
                <span style="color: var(--text-muted);">${t('dashboard.loading') || 'Загрузка...'}</span>
            </div>
        `;

        // Загружаем chat IDs и области параллельно
        const [chatIdsResponse, regionsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/telegram/chat-ids`),
            (Date.now() - regionsCacheTime > REGIONS_CACHE_TTL || !cachedRegions)
                ? fetch(`${API_BASE_URL}/bazars`).then(r => r.json())
                : Promise.resolve({ success: true, data: cachedRegions })
        ]);

        const result = await chatIdsResponse.json();
        const regionsResult = regionsResponse;

        // Обновляем кэш областей
        if (regionsResult.success && regionsResult.data) {
            const regionsSet = new Set();
            regionsResult.data.forEach(bazar => {
                if (bazar.city) {
                    regionsSet.add(bazar.city);
                }
            });
            cachedRegions = Array.from(regionsSet).sort();
            regionsCacheTime = Date.now();
        }

        if (result.success && result.data && result.data.length > 0) {
            const allRegions = cachedRegions || [];

            listContainer.innerHTML = result.data.map(chat => {
                const allowedRegions = chat.allowed_regions || [];
                // Переводим названия областей
                const translatedRegions = allowedRegions.map(region => translateCity(region));
                const regionsText = allowedRegions.length > 0
                    ? `${t('modal.telegram.regionsLabel')}: ${translatedRegions.join(', ')}`
                    : t('modal.telegram.allRegions');
                const chatTypeText = chat.chat_type === 'channel' ? t('modal.telegram.typeChannel') :
                    chat.chat_type === 'group' ? t('modal.telegram.typeGroup') :
                        t('modal.telegram.typeUser');
                return `
                <div class="chat-id-item" style="padding: 1rem; background: var(--surface-color); border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid var(--border-color);">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 0.5rem; font-size: 1rem; color: var(--text-primary);">${chat.chat_id}</div>
                            <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.25rem;">
                                ${chat.description || t('modal.telegram.noDescription')} • ${chatTypeText}
                            </div>
                            <div style="font-size: 0.875rem; color: var(--text-muted);">
                                ${regionsText}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0;">
                            <label style="display: flex; align-items: center; cursor: pointer; padding: 0.5rem; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='var(--hover-color)'" onmouseout="this.style.background='transparent'">
                                <input type="checkbox" ${chat.enabled ? 'checked' : ''} 
                                       onchange="toggleChatId(${chat.id}, this.checked)" style="margin-right: 0.5rem; cursor: pointer;">
                                <span style="font-size: 0.875rem; white-space: nowrap;">${t('modal.telegram.enabled')}</span>
                            </label>
                            <button class="btn-secondary" onclick="editChatIdRegions(${chat.id}, ${JSON.stringify(allowedRegions).replace(/"/g, '&quot;').replace(/'/g, '&#39;')})" 
                                    style="padding: 0.75rem; min-width: 40px; display: flex; align-items: center; justify-content: center; border-radius: 6px;" 
                                    title="${t('modal.telegram.configureRegions')}">
                                <i class="fas fa-cog"></i>
                            </button>
                            <button class="btn-delete" onclick="deleteChatId(${chat.id})" 
                                    style="padding: 0.75rem; min-width: 40px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: var(--error); color: white; border: none; cursor: pointer; transition: opacity 0.2s;" 
                                    onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"
                                    title="${t('modal.telegram.delete')}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
        } else {
            listContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">${t('modal.telegram.noChatIds')}</p>`;
        }
    } catch (error) {
        console.error('Error loading Telegram chat IDs:', error);
        const listContainer = document.getElementById('chatIdsList');
        if (listContainer) {
            listContainer.innerHTML = `<p style="color: var(--error);">${t('modal.telegram.errorLoading')}</p>`;
        }
    }
}

async function addChatId() {
    const chatId = document.getElementById('chatIdInput').value.trim();
    const chatType = document.getElementById('chatTypeSelect').value;
    const description = document.getElementById('chatDescriptionInput').value.trim();

    // Получаем выбранные области
    const selectedRegions = [];
    const checkboxes = document.querySelectorAll('#regionsCheckboxes input[type="checkbox"]:checked');
    checkboxes.forEach(cb => {
        selectedRegions.push(cb.value);
    });

    if (!chatId) {
        showNotification(t('modal.telegram.chatIdRequired'), 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/telegram/chat-ids`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                chat_type: chatType,
                description: description,
                allowed_regions: selectedRegions.length > 0 ? selectedRegions : []
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg = `HTTP ${response.status}`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMsg = errorJson.error || errorMsg;
            } catch {
                errorMsg = errorText || errorMsg;
            }
            throw new Error(errorMsg);
        }

        const result = await response.json();

        if (result.success) {
            showNotification(`✅ ${t('modal.telegram.chatIdAdded')}`, 'success');
            document.getElementById('chatIdInput').value = '';
            document.getElementById('chatDescriptionInput').value = '';
            // Сбрасываем чекбоксы
            const checkboxes = document.querySelectorAll('#regionsCheckboxes input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
            loadTelegramChatIds();
        } else {
            const errorMsg = result.error || 'Неизвестная ошибка';
            console.error('Error adding chat ID:', result);
            showNotification(`Ошибка: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('Exception adding chat ID:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
}

async function toggleChatId(chatIdId, enabled) {
    try {
        const response = await fetch(`${API_BASE_URL}/telegram/chat-ids/${chatIdId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                enabled: enabled
            })
        });

        const result = await response.json();

        if (result.success) {
            showNotification(`✅ ${enabled ? t('modal.telegram.chatIdEnabled') : t('modal.telegram.chatIdDisabled')}`, 'success');
        } else {
            showNotification(`Ошибка: ${result.error}`, 'error');
            loadTelegramChatIds(); // Перезагружаем чтобы вернуть состояние
        }
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, 'error');
        loadTelegramChatIds(); // Перезагружаем чтобы вернуть состояние
    }
}

async function deleteChatId(chatIdId) {
    if (!confirm(t('modal.telegram.confirmDelete'))) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/telegram/chat-ids/${chatIdId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showNotification('✅ Chat ID удален', 'success');
            loadTelegramChatIds();
        } else {
            showNotification(`Ошибка: ${result.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
}

let currentEditingChatId = null;

async function loadRegionsForChatId() {
    try {
        const response = await fetch(`${API_BASE_URL}/bazars`);
        const result = await response.json();
        const regionsSet = new Set();
        if (result.success && result.data) {
            result.data.forEach(bazar => {
                if (bazar.city) {
                    // Переводим название города
                    const cityName = translateCity(bazar.city);
                    regionsSet.add(cityName);
                }
            });
        }
        return Array.from(regionsSet).sort();
    } catch (error) {
        console.error('Error loading regions:', error);
        return [];
    }
}

async function editChatIdRegions(chatIdId, currentRegions) {
    currentEditingChatId = chatIdId;
    const modal = document.getElementById('editChatIdRegionsModal');
    if (!modal) return;

    // Открываем модальное окно сразу для мгновенной реакции
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    const checkboxesContainer = document.getElementById('editRegionsCheckboxes');
    if (!checkboxesContainer) return;

    // Показываем индикатор загрузки
    checkboxesContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 2rem;">
            <i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
            <span style="color: var(--text-muted);">${t('dashboard.loading') || 'Загрузка...'}</span>
        </div>
    `;

    try {
        // Делаем один запрос к API и переиспользуем данные
        const response = await fetch(`${API_BASE_URL}/bazars`);
        const result = await response.json();

        const regionsSet = new Set();
        const originalRegionsMap = new Map();

        if (result.success && result.data) {
            result.data.forEach(bazar => {
                if (bazar.city) {
                    const translatedName = translateCity(bazar.city);
                    regionsSet.add(translatedName);
                    originalRegionsMap.set(translatedName, bazar.city);
                }
            });
        }

        const regions = Array.from(regionsSet).sort();
        const regionsArray = Array.isArray(currentRegions) ? currentRegions : (currentRegions ? [currentRegions] : []);

        if (regions.length === 0) {
            checkboxesContainer.innerHTML = `<p style="color: var(--text-muted);">${t('modal.telegram.noRegions')}</p>`;
        } else {
            checkboxesContainer.innerHTML = regions.map(region => {
                const originalRegion = originalRegionsMap.get(region) || region;
                const isChecked = regionsArray.some(r => {
                    // Сравниваем как с оригинальным, так и с переведенным названием
                    return r === originalRegion || r === region ||
                        (r === 'Toshkent shahri' && (originalRegion === 'Toshkent shahri' || originalRegion === 'ToshkentShahri')) ||
                        (r === 'ToshkentShahri' && (originalRegion === 'Toshkent shahri' || originalRegion === 'ToshkentShahri'));
                });
                return `
                <label style="display: flex; align-items: center; padding: 0.5rem; cursor: pointer; border-radius: 4px; transition: background 0.2s;" 
                       onmouseover="this.style.background='var(--hover-color)'" onmouseout="this.style.background='transparent'">
                    <input type="checkbox" value="${originalRegion}" ${isChecked ? 'checked' : ''} 
                           style="margin-right: 0.75rem; cursor: pointer;">
                    <span style="font-size: 0.875rem;">${region}</span>
                </label>
            `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading regions:', error);
        checkboxesContainer.innerHTML = `<p style="color: var(--error);">${t('modal.telegram.errorLoading') || 'Ошибка загрузки'}</p>`;
    }
}

function closeEditRegionsModal() {
    const modal = document.getElementById('editChatIdRegionsModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        currentEditingChatId = null;
    }
}

async function saveChatIdRegions() {
    if (!currentEditingChatId) return;

    const selectedRegions = [];
    const checkboxes = document.querySelectorAll('#editRegionsCheckboxes input[type="checkbox"]:checked');
    checkboxes.forEach(cb => {
        selectedRegions.push(cb.value);
    });

    try {
        const response = await fetch(`${API_BASE_URL}/telegram/chat-ids/${currentEditingChatId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                allowed_regions: selectedRegions.length > 0 ? selectedRegions : []
            })
        });

        const result = await response.json();

        if (result.success) {
            showNotification(`✅ ${t('modal.telegram.regionsUpdated')}`, 'success');
            closeEditRegionsModal();
            loadTelegramChatIds();
        } else {
            showNotification(`Ошибка: ${result.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
}

async function testTelegramNotification() {
    const btn = document.getElementById('testTelegramNotificationBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${t('modal.telegram.sending')}</span>`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/telegram/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg = `HTTP ${response.status}`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMsg = errorJson.error || errorMsg;
            } catch {
                errorMsg = errorText || errorMsg;
            }
            throw new Error(errorMsg);
        }

        const result = await response.json();

        if (result.success) {
            const message = result.sent_to && result.total
                ? `✅ Тестовое уведомление отправлено в ${result.sent_to} из ${result.total} chat ID`
                : '✅ Тестовое уведомление отправлено';
            showNotification(message, 'success');

            if (result.errors && result.errors.length > 0) {
                console.warn('Some notifications failed:', result.errors);
            }
        } else {
            let errorMsg = result.error || 'Неизвестная ошибка';
            // Если есть детали ошибок, добавляем их
            if (result.errors && result.errors.length > 0) {
                errorMsg += `\nДетали: ${result.errors.join(', ')}`;
            }
            console.error('Error testing notification:', result);
            showNotification(`Ошибка: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('Error testing Telegram notification:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-paper-plane"></i> <span>${t('modal.telegram.testNotification')}</span>`;
        }
    }
}

async function toggleTelegramNotifications(ip, port, enabled) {
    try {
        // Находим ID сервиса по IP и порту
        const response = await fetch(`${API_BASE_URL}/status`);
        const result = await response.json();

        if (!result.success) {
            throw new Error('Не удалось получить список сервисов');
        }

        const service = result.data.find(s => s.ip === ip && s.port === port);
        if (!service) {
            throw new Error('Сервис не найден');
        }

        // Обновляем настройки уведомлений
        const updateResponse = await fetch(`${API_BASE_URL}/services/${service.id}/telegram-notifications`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                enabled: enabled
            })
        });

        const updateResult = await updateResponse.json();

        if (updateResult.success) {
            if (enabled) {
                showNotification(`✅ Уведомления включены. Статистика отправлена в Telegram.`, 'success');
            } else {
                showNotification(`✅ Уведомления выключены`, 'success');
            }
            // Обновляем данные базаров
            loadAllBazars();
        } else {
            // Проверяем, есть ли ошибка о настройках бота
            if (updateResult.error && updateResult.error.includes('token') || updateResult.error.includes('chat ID')) {
                showNotification(`❌ ${updateResult.error}`, 'error');
            } else {
                throw new Error(updateResult.error || 'Ошибка обновления настроек');
            }
        }
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, 'error');
        // Перезагружаем данные чтобы вернуть состояние галочки
        loadAllBazars();
    }
}

// ===============================================
// Preview Intro
// ===============================================
function initPreview() {
    const overlay = document.getElementById('previewOverlay');
    const video = document.getElementById('previewVideo');
    const skipBtn = document.getElementById('skipPreviewBtn');

    if (!overlay || !video) {
        // Если превью отсутствует, сразу загружаем данные
        loadAllBazars();
        return;
    }

    // Блокируем скролл на время превью
    document.body.style.overflow = 'hidden';

    let previewEnded = false;
    const endPreview = () => {
        if (previewEnded) return; // Предотвращаем множественные вызовы
        previewEnded = true;

        try {
            video.pause();
            video.currentTime = 0;
            video.src = '';
            video.load();
        } catch (e) {
            console.error('Error stopping video:', e);
        }

        overlay.classList.add('hidden');
        setTimeout(() => {
            try {
                if (overlay && overlay.parentNode) {
                    overlay.remove();
                }
                document.body.style.overflow = '';
                // Запускаем основную загрузку
                loadAllBazars().catch(err => {
                    console.error('Error in loadAllBazars after preview:', err);
                });
            } catch (e) {
                console.error('Error in endPreview setTimeout:', e);
            }
        }, 300);
    };

    // Попытка автоплея
    try {
        video.muted = true;
        const playPromise = video.play();
        if (playPromise && playPromise.catch) {
            playPromise.catch(() => {
                // Если автоплей заблокирован — воспроизводим по клику
                overlay.addEventListener('click', () => {
                    video.play().catch(() => { }); // повтор
                }, { once: true });
            });
        }
    } catch (e) {
        // В случае ошибки просто продолжаем
        endPreview();
    }

    // По окончанию видео — продолжить
    video.addEventListener('ended', endPreview, { once: true });
    video.addEventListener('error', endPreview, { once: true });

    // Кнопка "Пропустить"
    if (skipBtn) {
        skipBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            endPreview();
        });
    }
}

// ===============================================
// Initialization
// ===============================================
console.log('=== Starting application initialization ===');
initLanguage();
initTheme();
initParticles(); // теперь безопасно
initMap();
initCalendar();
initSidebar();

// Инициализируем элементы карты после загрузки DOM
console.log('DOM loaded, initializing map controls...');
initMapControls();

// Вместо мгновенной загрузки — сначала превью, затем loadAllBazars()
if (document.getElementById('previewOverlay')) {
    initPreview();
} else {
    loadAllBazars();
}
console.log('=== Application initialization complete ===');

// Optional: Auto-refresh every 60 seconds
// setInterval(loadAllBazars, 60000);

// ===============================================
// Stats Modal Tabs
// ===============================================

function switchStatsTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.stats-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Deactivate all tab buttons
    document.querySelectorAll('.stats-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab content
    const selectedContent = document.getElementById(`tab-${tabId}`);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }

    // Activate selected tab button
    const selectedBtn = document.querySelector(`.stats-tab-btn[data-tab="${tabId}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
}
