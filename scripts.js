document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('search');
  const itemsContainer = document.getElementById('items');
  const buttons = document.querySelectorAll('#categories button');

  /**
   * Русские названия категорий для отображения в карточках. Если добавите новые
   * категории в таблицу, просто расширьте этот объект (например, portfolio: 'Портфель').
   */
  const categoryNames = {
    reports: 'Отчёты',
    news: 'Новости',
    documents: 'Документы',
    portfolio: 'Портфель',
    all: 'Все'
  };

  let currentCategory = 'all';

  /**
   * Отрисовывает карточки на основе window.portalItems и текущих фильтров. Вызывается
   * после загрузки данных и при изменении фильтров.
   */
  function renderItems() {
    const searchTerm = searchInput.value.toLowerCase();
    itemsContainer.innerHTML = '';
    const items = Array.isArray(window.portalItems) ? window.portalItems : [];
    const filtered = items.filter(item => {
      const matchesCategory = currentCategory === 'all' || item.category === currentCategory;
      const matchesSearch =
        (item.title || '').toLowerCase().includes(searchTerm) ||
        (item.description || '').toLowerCase().includes(searchTerm);
      return matchesCategory && matchesSearch;
    });
    if (filtered.length === 0) {
      itemsContainer.innerHTML = '<p>Совпадений не найдено.</p>';
      return;
    }
    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <h2>${item.title || ''}</h2>
        <p><strong>Категория:</strong> ${categoryNames[item.category] || item.category}</p>
        <p><strong>Дата:</strong> ${item.date || ''}</p>
        <p>${item.description || ''}</p>
        <a href="${item.link || '#'}" target="_blank" rel="noopener">Открыть</a>
      `;
      itemsContainer.appendChild(card);
    });
  }

  /**
   * Функция загрузки данных из Google Sheets через opensheet.elk.sh.
   * Замените SHEET_ID и SHEET_NAME на свои значения. Таблица должна быть
   * опубликована для чтения (Share → Anyone with the link). Колонки:
   * category, title, date, description, link
   */
  /**
   * Загружает данные из Google Sheets с помощью официального API.
   *
   * Чтобы сайт мог автоматически обновляться при изменениях в таблице,
   * необходимо выполнить три шага:
   *   1. Создайте проект в Google Cloud Console и включите Google Sheets API.
   *   2. Выпустите API‑ключ и разрешите домен вашего сайта в реферерах.
   *   3. Укажите переменные SHEET_ID и API_KEY ниже. Диапазон RANGE
   *      определяет, какие столбцы будут загружаться (здесь A:F для 6 столбцов).
   *
   * Таблица должна быть доступна для чтения (Share → Anyone with the link can view).
   * Первая строка — заголовки, остальные строки содержат данные:
   *   A — порядковый номер (может быть пустым),
   *   B — Название документа (title),
   *   C — Категория (category, на русском),
   *   D — Дата обновления (date),
   *   E — Пояснение (description),
   *   F — Ссылка (link).
   */
  function loadFromSheet() {
    // Идентификатор таблицы (из URL). Замените на ваш ID.
    // Идентификатор таблицы LP‑портала. Взят из URL таблицы Google Sheets.
    // Если вы используете другую таблицу, замените этот ID.
    const SHEET_ID = '1fm8DS_c5sZFtFx1qvu03Qf-vKkDrjRLEMtw9WiEmFVY';
    // Ключ доступа Google API. Получите в Google Cloud Console.
    // API‑ключ Google. Установлен для автоматической загрузки данных из таблицы.
    // Этот ключ получен владельцем портала и должен оставаться секретным.
    const API_KEY = 'AIzaSyAQcfiN2HujLtT_6Ye1Fof5-55jj5epZBo';
    // Диапазон данных: название листа и диапазон столбцов. По умолчанию берём
    // все строки (без указания нижней границы) из шести первых столбцов.
    const RANGE = 'Лист1!A:F';
    // Если ID или ключ не указаны, используем локальные данные (config.js)
    if (SHEET_ID === 'YOUR_SHEET_ID' || API_KEY === 'YOUR_API_KEY') {
      renderItems();
      return;
    }
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;
    itemsContainer.innerHTML = '<p>Загрузка данных…</p>';
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        const values = Array.isArray(data.values) ? data.values : [];
        // Удаляем строку заголовков
        if (values.length > 0) {
          values.shift();
        }
        // Сопоставление русских категорий на латинские ключи
        const categorySlug = {
          'Отчёты': 'reports',
          'Новости': 'news',
          'Документы': 'documents',
          'Портфель': 'portfolio'
        };
        window.portalItems = values.map((row, idx) => {
          // Обрезаем или задаём пустую строку для отсутствующих столбцов
          const title = row[1] ? row[1].trim() : '';
          const categoryRus = row[2] ? row[2].trim() : '';
          const date = row[3] ? row[3].trim() : '';
          const description = row[4] ? row[4].trim() : '';
          const link = row[5] ? row[5].trim() : '';
          // Получаем slug категории; если не нашли, используем 'documents'
          const cat = categorySlug[categoryRus] || (categoryRus ? categoryRus.toLowerCase() : 'documents');
          return {
            id: idx + 1,
            category: cat,
            title,
            date,
            description,
            link
          };
        });
        renderItems();
      })
      .catch(() => {
        itemsContainer.innerHTML = '<p>Не удалось загрузить данные из таблицы.</p>';
        renderItems();
      });
  }

  // Устанавливаем обработчики для фильтров
  searchInput.addEventListener('input', renderItems);
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.getAttribute('data-category');
      renderItems();
    });
  });

  // Загружаем данные из Google Sheets. Если пользователь не указал ID,
  // будет использован встроенный массив window.portalItems, определённый в config.js.
  loadFromSheet();
});
