// Dùng chung cho popup (pages/popup.html) và trang quản lý (pages/manager.html).
// Chỉ gắn sự kiện cho những phần tử có trong trang hiện tại.
(() => {
  'use strict';

  const { store, audio, dictionary, ui } = globalThis.VB;
  const { el, iconButton, ICONS } = ui;

  const isPopup = document.body.classList.contains('popup');
  const VIEWS = isPopup ? ['words', 'history'] : ['words', 'history', 'settings'];
  const POPUP_LIMIT = 100;
  const LAST_VIEW_KEY = 'vb-popup-view';

  const state = {
    view: 'words',
    query: '',
    sort: 'recent',
    words: [],
    history: [],
    savedKeys: new Set(),
    settings: { ...store.DEFAULT_SETTINGS },
    expanded: new Set() // `${view}:${word}` của các thẻ đang mở rộng
  };

  const $ = (id) => document.getElementById(id);
  const relativeTime = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });
  const dateTime = new Intl.DateTimeFormat('vi', { dateStyle: 'medium', timeStyle: 'short' });
  const TIME_UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];

  function timeAgo(timestamp) {
    const seconds = Math.round((timestamp - Date.now()) / 1000);
    for (const [unit, size] of TIME_UNITS) {
      if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit);
    }
    return 'vừa xong';
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function openManager(view) {
    chrome.tabs.create({ url: chrome.runtime.getURL(`pages/manager.html#${view}`) });
    if (isPopup) window.close();
  }

  function openCambridge(word) {
    chrome.tabs.create({ url: dictionary.cambridgeUrl(word) });
  }

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* không bắt buộc */ }
  }

  // ---------- Dữ liệu ----------

  async function loadData() {
    const [words, history] = await Promise.all([store.getWords(), store.getHistory()]);
    state.words = words;
    state.history = history;
    state.savedKeys = new Set(words.map((w) => store.normalize(w.word)));
    render();
  }

  function applySettings(settings) {
    state.settings = settings;
    document.documentElement.dataset.theme = settings.theme;
    fillSettingsForm();
  }

  async function toggleSaveFromHistory(item, button) {
    button.disabled = true;
    try {
      if (state.savedKeys.has(store.normalize(item.word))) {
        await store.removeWord(item.word);
        showToast(`Đã bỏ "${item.word}" khỏi sổ từ`);
        return;
      }
      // Lịch sử chỉ lưu tóm tắt -> tra lại để có đủ dữ liệu cho sổ từ
      button.classList.add('is-loading');
      const result = await dictionary.lookup(item.word, state.settings);
      await store.saveWord({
        ...result,
        context: '',
        source: { url: item.url, title: item.title },
        savedAt: Date.now()
      });
      showToast(`Đã lưu "${result.word}" vào sổ từ`);
    } catch {
      showToast(`Không tra được "${item.word}"`);
    } finally {
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  }

  // ---------- Hiển thị ----------

  function matchesQuery(texts) {
    return !state.query || texts.some((t) => t && t.toLowerCase().includes(state.query));
  }

  function headline(word, phonetic, meaning) {
    const line = el('div', 'card-line');
    line.appendChild(el('span', 'card-word', word));
    if (phonetic) line.appendChild(el('span', 'card-phonetic', phonetic));
    return [line, el('div', 'card-meaning', meaning || '—')];
  }

  // Thẻ có details thì phần tiêu đề là nút bấm để mở rộng/thu gọn
  function card(view, word, mainChildren, actions, details) {
    const item = el('li', 'card');
    const head = el('div', 'card-head');
    const main = el(details ? 'button' : 'div', 'card-main');
    main.append(...mainChildren);

    const actionsEl = el('div', 'card-actions');
    actionsEl.append(...actions);
    head.append(main, actionsEl);
    item.appendChild(head);

    if (details) {
      const key = `${view}:${store.normalize(word)}`;
      main.type = 'button';
      main.setAttribute('aria-expanded', String(state.expanded.has(key)));
      details.hidden = !state.expanded.has(key);
      main.addEventListener('click', () => {
        const open = details.hidden;
        details.hidden = !open;
        main.setAttribute('aria-expanded', String(open));
        if (open) state.expanded.add(key);
        else state.expanded.delete(key);
      });
      item.appendChild(details);
    }
    return item;
  }

  function definitionList(definitions) {
    const list = el('ol', 'defs');
    for (const d of definitions) {
      const item = el('li');
      if (d.partOfSpeech) item.appendChild(el('span', 'pos', d.partOfSpeech));
      item.appendChild(el('span', null, d.definition));
      if (d.vi) item.appendChild(el('span', 'def-vi', d.vi));
      list.appendChild(item);
    }
    return list;
  }

  function sourceLink(url, title) {
    const link = el('a', 'card-source', title || url);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    return link;
  }

  function speakButton(word, audios) {
    return iconButton(ICONS.speaker, 'Phát âm', 'icon-btn', () => audio.pronounce(word, audios, state.settings.accent));
  }

  function cambridgeButton(word) {
    return iconButton(ICONS.book, 'Mở trên Cambridge', 'icon-btn', () => openCambridge(word));
  }

  function renderWordCard(entry) {
    const details = el('div', 'card-details');
    if (entry.definitions.length) details.appendChild(definitionList(entry.definitions));
    if (entry.context) details.appendChild(el('blockquote', 'card-context', entry.context));
    const meta = el('div', 'card-meta');
    meta.appendChild(el('span', null, `Đã lưu ${dateTime.format(entry.savedAt)}`));
    if (entry.source?.url) meta.appendChild(sourceLink(entry.source.url, entry.source.title));
    details.appendChild(meta);

    const actions = [
      speakButton(entry.word, entry.audios),
      cambridgeButton(entry.word),
      iconButton(ICONS.trash, 'Xoá khỏi sổ từ', 'icon-btn icon-btn-danger', async () => {
        await store.removeWord(entry.word);
        showToast(`Đã xoá "${entry.word}"`);
      })
    ];
    const meaning = entry.vi || entry.definitions[0]?.definition;
    return card('words', entry.word, headline(entry.word, entry.phonetic, meaning), actions, details);
  }

  function renderHistoryCard(item) {
    const saved = state.savedKeys.has(store.normalize(item.word));
    const saveButton = iconButton(
      ICONS.star,
      saved ? 'Bỏ khỏi sổ từ' : 'Lưu vào sổ từ',
      `icon-btn icon-btn-save${saved ? ' is-saved' : ''}`,
      (btn) => toggleSaveFromHistory(item, btn)
    );
    const actions = [speakButton(item.word, item.audios), cambridgeButton(item.word), saveButton];
    if (!isPopup) {
      actions.push(iconButton(ICONS.trash, 'Xoá khỏi lịch sử', 'icon-btn icon-btn-danger', () => store.removeHistory(item.word)));
    }

    const meta = el('div', 'card-sub');
    meta.appendChild(el('span', null, `${timeAgo(item.lookedUpAt)} · ${item.count} lần tra`));
    if (!isPopup && item.url) meta.appendChild(sourceLink(item.url, item.title));

    const node = card('history', item.word, headline(item.word, '', item.meaning), actions, null);
    node.appendChild(meta);
    return node;
  }

  function fillList(list, items, renderItem, emptyMessage, totalCount) {
    if (!totalCount) {
      list.replaceChildren(el('li', 'empty', emptyMessage));
      return;
    }
    if (!items.length) {
      list.replaceChildren(el('li', 'empty', 'Không có kết quả phù hợp.'));
      return;
    }
    const visible = isPopup ? items.slice(0, POPUP_LIMIT) : items;
    list.replaceChildren(...visible.map(renderItem));
    if (visible.length < items.length) {
      const more = el('li', 'more');
      const button = el('button', 'link-btn', `Xem tất cả ${items.length} mục trong trang quản lý`);
      button.type = 'button';
      button.addEventListener('click', () => openManager(state.view));
      more.appendChild(button);
      list.appendChild(more);
    }
  }

  function render() {
    $('words-count').textContent = state.words.length || '';
    $('history-count').textContent = state.history.length || '';

    let words = state.words.filter((w) =>
      matchesQuery([w.word, w.vi, ...w.definitions.map((d) => d.definition)]));
    if (state.sort === 'alpha') words = [...words].sort((a, b) => a.word.localeCompare(b.word));
    fillList($('words-list'), words, renderWordCard,
      'Chưa có từ nào. Tra một từ rồi bấm ⭐ trong bong bóng để lưu vào sổ.', state.words.length);

    const history = state.history.filter((h) => matchesQuery([h.word, h.meaning]));
    const historyEmpty = state.settings.historyEnabled
      ? 'Chưa tra từ nào.'
      : 'Đang tắt ghi lịch sử (bật lại trong Cài đặt).';
    fillList($('history-list'), history, renderHistoryCard, historyEmpty, state.history.length);
  }

  function setView(view) {
    if (!VIEWS.includes(view)) view = 'words';
    state.view = view;

    for (const tab of document.querySelectorAll('[data-view]')) {
      const active = tab.dataset.view === view;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    }
    for (const panel of document.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== view;
    for (const node of document.querySelectorAll('[data-for]')) node.hidden = node.dataset.for !== view;
    $('toolbar').hidden = view === 'settings';

    if (isPopup) storageSet(LAST_VIEW_KEY, view);
    else if (location.hash !== `#${view}`) window.history.replaceState(null, '', `#${view}`);
  }

  // ---------- Cài đặt ----------

  function fillSettingsForm() {
    const form = $('settings-form');
    if (!form) return;
    for (const input of form.elements) {
      if (!input.name || !(input.name in state.settings)) continue;
      const value = state.settings[input.name];
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else if (input.type === 'radio') input.checked = input.value === String(value);
      else input.value = String(value);
    }
    form.elements.historyLimit.disabled = !state.settings.historyEnabled;
  }

  function readInput(input) {
    if (input.type === 'checkbox') return input.checked;
    return input.dataset.type === 'number' ? Number(input.value) : input.value;
  }

  function bindSettings() {
    const form = $('settings-form');
    if (!form) return;
    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('change', async (e) => {
      const input = e.target;
      if (!input.name) return;
      const value = readInput(input);
      applySettings(await store.saveSettings({ [input.name]: value }));
      if (input.name === 'historyLimit') await store.trimHistory(value);
      showToast('Đã lưu cài đặt');
    });
  }

  // ---------- Xuất / nhập file ----------

  function download(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = el('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const today = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD theo giờ máy

  function bindFileActions() {
    $('export-anki')?.addEventListener('click', () => {
      if (!state.words.length) return showToast('Sổ từ đang trống');
      download(`vocab-anki-${today()}.txt`, VB.exporter.toAnki(state.words), 'text/plain;charset=utf-8');
      showToast(`Đã xuất ${state.words.length} từ cho Anki`);
    });

    $('export-json')?.addEventListener('click', () => {
      download(`vocab-bubble-backup-${today()}.json`,
        VB.exporter.toBackup(state.words, state.history), 'application/json');
      showToast('Đã tạo file sao lưu');
    });

    const fileInput = $('import-file');
    $('import-json')?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', async () => {
      const [file] = fileInput.files;
      if (!file) return;
      try {
        const data = VB.exporter.parseBackup(await file.text());
        const added = await store.importWords(data.words);
        await store.importHistory(data.history, state.settings.historyLimit);
        showToast(`Đã khôi phục: thêm ${added} từ mới`);
      } catch {
        showToast('File sao lưu không hợp lệ');
      } finally {
        fileInput.value = '';
      }
    });

    // Xác nhận bằng cách bấm lần thứ hai (không dùng confirm())
    const clearButton = $('clear-history');
    clearButton?.addEventListener('click', async () => {
      if (!clearButton.dataset.confirm) {
        clearButton.dataset.confirm = '1';
        const label = clearButton.textContent;
        clearButton.textContent = 'Bấm lần nữa để xác nhận';
        clearButton.timer = setTimeout(() => {
          delete clearButton.dataset.confirm;
          clearButton.textContent = label;
        }, 3000);
        return;
      }
      clearTimeout(clearButton.timer);
      delete clearButton.dataset.confirm;
      clearButton.textContent = 'Xoá toàn bộ lịch sử';
      await store.clearHistory();
      showToast('Đã xoá lịch sử');
    });
  }

  // ---------- Khởi động ----------

  function bindCommon() {
    for (const tab of document.querySelectorAll('[data-view]')) {
      tab.addEventListener('click', () => setView(tab.dataset.view));
    }
    $('search').addEventListener('input', (e) => {
      state.query = e.target.value.trim().toLowerCase();
      render();
    });
    $('sort')?.addEventListener('change', (e) => {
      state.sort = e.target.value;
      render();
    });

    if (isPopup) {
      $('header-actions').append(
        iconButton(ICONS.external, 'Mở trang quản lý', 'icon-btn', () => openManager(state.view)),
        iconButton(ICONS.settings, 'Cài đặt', 'icon-btn', () => openManager('settings'))
      );
    } else {
      window.addEventListener('hashchange', () => setView(location.hash.slice(1)));
    }
  }

  async function init() {
    bindCommon();
    bindSettings();
    bindFileActions();
    setView(isPopup ? storageGet(LAST_VIEW_KEY) : location.hash.slice(1));

    applySettings(await store.getSettings());
    await loadData();
    store.onDataChanged(loadData);
    store.onSettingsChanged((settings) => {
      applySettings(settings);
      render();
    });
  }

  init();
})();
