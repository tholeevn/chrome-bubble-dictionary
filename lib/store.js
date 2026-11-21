// Lưu trữ dùng chung: cài đặt (chrome.storage.sync), sổ từ & lịch sử (chrome.storage.local)
(function (VB) {
  'use strict';

  const DEFAULT_SETTINGS = Object.freeze({
    trigger: 'contextMenu', // 'contextMenu' | 'select' | 'altSelect'
    accent: 'us', // 'us' | 'uk'
    showVietnamese: true,
    translateDefinitions: true,
    maxDefinitions: 2, // 1–3
    theme: 'auto', // 'auto' | 'light' | 'dark'
    historyEnabled: true,
    historyLimit: 500
  });

  const normalize = (word) => String(word || '').trim().toLowerCase();
  const str = (value) => (typeof value === 'string' ? value : '');
  const httpUrl = (value) => (/^https?:\/\//i.test(str(value)) ? value : '');

  // ---------- Cài đặt ----------

  async function getSettings() {
    const { settings } = await chrome.storage.sync.get('settings');
    return { ...DEFAULT_SETTINGS, ...settings };
  }

  async function saveSettings(patch) {
    const settings = { ...(await getSettings()), ...patch };
    await chrome.storage.sync.set({ settings });
    return settings;
  }

  function onSettingsChanged(callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.settings) {
        callback({ ...DEFAULT_SETTINGS, ...changes.settings.newValue });
      }
    });
  }

  // ---------- Sổ từ ----------

  // Chuẩn hoá một mục từ (dùng cả khi lưu và khi khôi phục từ file JSON không tin cậy)
  function sanitizeWord(entry) {
    const audios = entry.audios || {};
    return {
      word: str(entry.word).trim(),
      phonetic: str(entry.phonetic),
      audios: { us: httpUrl(audios.us), uk: httpUrl(audios.uk), other: httpUrl(audios.other) },
      vi: str(entry.vi),
      definitions: (Array.isArray(entry.definitions) ? entry.definitions : [])
        .filter((d) => d && typeof d.definition === 'string')
        .map((d) => ({ partOfSpeech: str(d.partOfSpeech), definition: d.definition, vi: str(d.vi) })),
      context: str(entry.context),
      source: { url: httpUrl(entry.source?.url), title: str(entry.source?.title) },
      savedAt: Number(entry.savedAt) || Date.now()
    };
  }

  async function getWordMap() {
    const { words } = await chrome.storage.local.get('words');
    return words && typeof words === 'object' ? words : {};
  }

  async function getWords() {
    return Object.values(await getWordMap()).sort((a, b) => b.savedAt - a.savedAt);
  }

  async function isSaved(word) {
    return Object.hasOwn(await getWordMap(), normalize(word));
  }

  async function saveWord(entry) {
    const words = await getWordMap();
    const item = sanitizeWord(entry);
    words[normalize(item.word)] = item;
    await chrome.storage.local.set({ words });
    return item;
  }

  async function removeWord(word) {
    const words = await getWordMap();
    delete words[normalize(word)];
    await chrome.storage.local.set({ words });
  }

  // Gộp danh sách từ vào sổ: thêm từ mới, ghi đè nếu bản nhập có savedAt mới hơn. Trả về số từ mới.
  async function importWords(list) {
    const words = await getWordMap();
    let added = 0;
    for (const raw of Array.isArray(list) ? list : []) {
      if (!raw || typeof raw.word !== 'string' || !normalize(raw.word)) continue;
      const item = sanitizeWord(raw);
      const key = normalize(item.word);
      const existing = words[key];
      if (!existing) added++;
      if (!existing || item.savedAt > existing.savedAt) words[key] = item;
    }
    await chrome.storage.local.set({ words });
    return added;
  }

  // ---------- Lịch sử ----------

  function sanitizeHistory(item) {
    const audios = item.audios || {};
    return {
      word: str(item.word).trim(),
      meaning: str(item.meaning),
      audios: { us: httpUrl(audios.us), uk: httpUrl(audios.uk), other: httpUrl(audios.other) },
      url: httpUrl(item.url),
      title: str(item.title),
      count: Math.max(1, Number(item.count) || 1),
      lookedUpAt: Number(item.lookedUpAt) || Date.now()
    };
  }

  async function getHistory() {
    const { history } = await chrome.storage.local.get('history');
    return Array.isArray(history) ? history : [];
  }

  // Tra lại một từ đã có -> đưa lên đầu và tăng số lần tra
  async function addHistory(item, limit = DEFAULT_SETTINGS.historyLimit) {
    const key = normalize(item.word);
    const history = await getHistory();
    const index = history.findIndex((h) => normalize(h.word) === key);
    const previous = index >= 0 ? history.splice(index, 1)[0] : null;
    history.unshift(sanitizeHistory({
      ...item,
      count: (previous?.count || 0) + 1,
      lookedUpAt: Date.now()
    }));
    await chrome.storage.local.set({ history: history.slice(0, limit) });
  }

  async function removeHistory(word) {
    const key = normalize(word);
    const history = (await getHistory()).filter((h) => normalize(h.word) !== key);
    await chrome.storage.local.set({ history });
  }

  async function clearHistory() {
    await chrome.storage.local.set({ history: [] });
  }

  async function trimHistory(limit) {
    const history = await getHistory();
    if (history.length > limit) await chrome.storage.local.set({ history: history.slice(0, limit) });
  }

  // Gộp lịch sử từ file sao lưu: mỗi từ giữ bản tra gần nhất
  async function importHistory(list, limit = DEFAULT_SETTINGS.historyLimit) {
    const byWord = new Map();
    const all = [...(await getHistory()), ...(Array.isArray(list) ? list : [])];
    for (const raw of all) {
      if (!raw || typeof raw.word !== 'string' || !normalize(raw.word)) continue;
      const item = sanitizeHistory(raw);
      const key = normalize(item.word);
      const existing = byWord.get(key);
      if (!existing || item.lookedUpAt > existing.lookedUpAt) byWord.set(key, item);
    }
    const history = [...byWord.values()].sort((a, b) => b.lookedUpAt - a.lookedUpAt).slice(0, limit);
    await chrome.storage.local.set({ history });
  }

  function onDataChanged(callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes.words || changes.history)) callback(changes);
    });
  }

  VB.store = {
    DEFAULT_SETTINGS,
    normalize,
    getSettings,
    saveSettings,
    onSettingsChanged,
    getWords,
    isSaved,
    saveWord,
    removeWord,
    importWords,
    getHistory,
    addHistory,
    removeHistory,
    clearHistory,
    trimHistory,
    importHistory,
    onDataChanged
  };
})(globalThis.VB = globalThis.VB || {});
