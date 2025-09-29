document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('search');
  const itemsContainer = document.getElementById('items');
  const categoriesContainer = document.getElementById('categories');

  let currentCategory = 'all';
  let uniqueCategories = [];

  /**
   * Создаёт кнопку категории и добавляет её в контейнер. При нажатии
   * кнопка становится активной, устанавливает фильтр и перерисовывает карточки.
   */
  function createCategoryButton(catKey, displayName) {
    const btn = document.createElement('button');
    btn.textContent = displayName;
    btn.setAttribute('data-category', catKey);
    if (catKey === 'all') {
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      // Удаляем активный класс у всех кнопок
      categoriesContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      // Делаем текущую кнопку активной
      btn.classList.add('active');
      // Запоминаем выбранную категорию и перерисовываем
      currentCategory = catKey;
      renderItems();
    });
    return btn;
  }

  /**
   * Генерирует кнопки категорий на основе списка уникальных категорий.
   * Всегда добавляет кнопку "Все".
   */
  function generateCategoryButtons() {
    categoriesContainer.innerHTML = '';
    // кнопка Все
    const allBtn = createCategoryButton('all', 'Все');
    categoriesContainer.appendChild(allBtn);
    // остальные категории
    uniqueCategories.forEach(cat => {
      const btn = createCategoryButton(cat, cat);
      categoriesContainer.appendChild(btn);
    });
  }

  /**
   * Отрисовывает карточки на основе window.portalItems и текущих фильтров.
   */
  function renderItems() {
    const searchTerm = searchInput.value.toLowerCase();
    itemsContainer.innerHTML = '';
    const items = Array.isArray(window.portalItems) ? window.portalItems : [];
    // Фильтруем элементы по категории и поиску
    const filtered = items.filter(item => {
      const matchesCategory = currentCategory === 'all' || item.category === currentCategory;
      const titleMatch = (item.title || '').toLowerCase().includes(searchTerm);
      const descMatch = (item.description || '').toLowerCase().includes(searchTerm);
      return matchesCategory && (titleMatch || descMatch);
    });
    if (filtered.length === 0) {
      itemsContainer.innerHTML = '<p>Совпадений не найдено.</p>';
      return;
    }
    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'item-card';
      // Форматируем дату в российском формате, если доступно
      let dateStr = item.date || '';
      if (item.dateObj instanceof Date && !isNaN(item.dateObj)) {
        dateStr = item.dateObj.toLocaleDateString('ru-RU');
      }
      card.innerHTML = `
        ${item.logo ? `<img class="item-logo" src="${item.logo}" alt="${item.title}">` : ''}
        <h2>${item.title || ''}</h2>
        <p class="item-category"><strong>Категория:</strong> ${item.category || ''}</p>
        <p class="item-date"><strong>Дата:</strong> ${dateStr}</p>
        <p class="item-description">${item.description || ''}</p>
        <a href="${item.link || '#'}" target="_blank" rel="noopener">Открыть</a>
      `;
      itemsContainer.appendChild(card);
    });
  }

  /**
   * Загружает данные из Google Sheets с помощью официального API.
   * После загрузки сортирует элементы по дате (от новых к старым), генерирует
   * список уникальных категорий и создаёт кнопки фильтра.
   */
  function loadFromSheet() {
    const SHEET_ID = '1fm8DS_c5sZFtFx1qvu03Qf-vKkDrjRLEMtw9WiEmFVY';
    const API_KEY  = 'AIzaSyAQcfiN2HujLtT_6Ye1Fof5-55jj5epZBo';
    const RANGE    = 'Лист1!A:F';
    if (SHEET_ID === 'YOUR_SHEET_ID' || API_KEY === 'YOUR_API_KEY') {
      renderItems();
      return;
    }
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;
    itemsContainer.innerHTML = '<p>Загрузка данных…</p>';
    fetch(url)
      .then(resp => {
        if (!resp.ok) throw new Error('Network response was not ok');
        return resp.json();
      })
      .then(data => {
        const values = Array.isArray(data.values) ? data.values : [];
        if (values.length > 0) values.shift();
        const items = [];
        values.forEach((row, idx) => {
          const title = row[1] ? row[1].trim() : '';
          const category = row[2] ? row[2].trim() : '';
          const dateStr = row[3] ? row[3].trim() : '';
          const description = row[4] ? row[4].trim() : '';
          const link = row[5] ? row[5].trim() : '';
          // Парсим дату в формате DD.MM.YYYY
          let dateObj = null;
          if (dateStr) {
            const parts = dateStr.split('.');
            if (parts.length === 3) {
              const d = parseInt(parts[0], 10);
              const m = parseInt(parts[1], 10) - 1;
              const y = parseInt(parts[2], 10);
              dateObj = new Date(y, m, d);
            }
          }
          items.push({ id: idx + 1, category, title, date: dateStr, dateObj, description, link });
        });
        // Сортируем от новых к старым
        items.sort((a, b) => {
          const aTime = a.dateObj ? a.dateObj.getTime() : 0;
          const bTime = b.dateObj ? b.dateObj.getTime() : 0;
          return bTime - aTime;
        });
        window.portalItems = items;
        // Список уникальных категорий
        uniqueCategories = [...new Set(items.map(i => i.category))].filter(c => c);
        generateCategoryButtons();
        renderItems();
      })
      .catch(() => {
        itemsContainer.innerHTML = '<p>Не удалось загрузить данные из таблицы.</p>';
        renderItems();
      });
  }

  // Обработчик поиска
  searchInput.addEventListener('input', renderItems);

  // Запускаем загрузку данных
  loadFromSheet();
});
