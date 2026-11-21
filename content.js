(() => {
  'use strict';

  const { store, audio, dictionary, ui } = globalThis.VB;
  const { el, iconButton, ICONS } = ui;

  const WORD_PATTERN = /^[A-Za-z]+$/;
  const MAX_WORD_LENGTH = 45;
  const MAX_CONTEXT_LENGTH = 300;
  const CURSOR_OFFSET = 12;
  const VIEWPORT_MARGIN = 8;
  const BUBBLE_ID = 'vocab-bubble-ext';

  const cache = new Map(); // word -> Promise<result>
  let settings = { ...store.DEFAULT_SETTINGS };
  let bubble = null;
  let anchor = { x: 0, y: 0 };
  let lastContextMenuPoint = null;
  let requestId = 0;

  store.getSettings().then((value) => { settings = value; });
  store.onSettingsChanged((value) => {
    settings = value;
    cache.clear(); // kết quả tra phụ thuộc cài đặt (dịch tiếng Việt, dịch định nghĩa)
  });

  // ---------- Tra từ ----------

  function lookup(word) {
    const key = word.toLowerCase();
    if (cache.has(key)) return cache.get(key);

    const promise = dictionary.lookup(key, settings);
    cache.set(key, promise);
    promise.catch(() => cache.delete(key)); // không cache lỗi để lần sau thử lại
    return promise;
  }

  function isValidWord(text) {
    return text.length <= MAX_WORD_LENGTH && WORD_PATTERN.test(text);
  }

  // Lấy câu chứa từ đang chọn để làm ví dụ khi lưu vào sổ từ
  function getSelectionContext(word) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return '';

    let node = selection.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
    // Leo lên vài cấp vì từ có thể nằm trong <b>, <a>, ...
    for (let i = 0; i < 3 && node?.parentElement && node.textContent.trim().length < 80; i++) {
      node = node.parentElement;
    }
    if (!node || node === document.body || node === document.documentElement) return '';

    const text = node.textContent.replace(/\s+/g, ' ');
    const index = text.search(new RegExp(`\\b${word}\\b`, 'i'));
    if (index < 0) return '';

    const start = Math.max(
      text.lastIndexOf('. ', index),
      text.lastIndexOf('! ', index),
      text.lastIndexOf('? ', index)
    ) + 1;
    const endOffset = text.slice(index).search(/[.!?](\s|$)/);
    const end = endOffset < 0 ? text.length : index + endOffset + 1;

    let sentence = text.slice(start, end).trim();
    if (sentence.length > MAX_CONTEXT_LENGTH) {
      const half = MAX_CONTEXT_LENGTH / 2;
      sentence = '…' + text.slice(Math.max(start, index - half), Math.min(end, index + half)).trim() + '…';
    }
    return sentence;
  }

  function recordHistory(result) {
    if (!settings.historyEnabled) return;
    store.addHistory({
      word: result.word,
      meaning: result.vi || result.definitions[0]?.definition || '',
      audios: result.audios,
      url: location.href,
      title: document.title
    }, settings.historyLimit).catch(() => {});
  }

  // ---------- Bong bóng ----------

  function hideBubble() {
    requestId++; // huỷ các response đang chờ
    audio.stop();
    if (bubble) {
      bubble.remove();
      bubble = null;
    }
  }

  function positionBubble() {
    if (!bubble) return;
    const { offsetWidth: w, offsetHeight: h } = bubble;
    const minX = window.scrollX + VIEWPORT_MARGIN;
    const maxX = window.scrollX + document.documentElement.clientWidth - w - VIEWPORT_MARGIN;
    const maxY = window.scrollY + document.documentElement.clientHeight - h - VIEWPORT_MARGIN;

    let left = anchor.x + CURSOR_OFFSET;
    let top = anchor.y + CURSOR_OFFSET;

    if (left > maxX) left = Math.max(minX, maxX);
    // Không đủ chỗ phía dưới -> hiển thị phía trên con trỏ
    if (top > maxY) top = Math.max(window.scrollY + VIEWPORT_MARGIN, anchor.y - h - CURSOR_OFFSET);

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
  }

  function createRoot(role, label) {
    const root = el('div');
    root.id = BUBBLE_ID;
    root.dataset.theme = settings.theme;
    root.setAttribute('role', role);
    if (label) root.setAttribute('aria-label', label);
    return root;
  }

  function setSaved(button, saved) {
    button.classList.toggle('vb-saved', saved);
    button.setAttribute('aria-pressed', String(saved));
    const label = saved ? 'Bỏ khỏi sổ từ' : 'Lưu vào sổ từ';
    button.title = label;
    button.setAttribute('aria-label', label);
  }

  function buildBubble(word, state) {
    const root = createRoot('dialog', `Tra từ: ${word}`);

    const header = el('div', 'vb-header');
    const title = el('div', 'vb-title');
    const wordEl = el('span', 'vb-word', word);
    const phoneticEl = el('span', 'vb-phonetic');
    title.append(wordEl, phoneticEl);

    const actions = el('div', 'vb-actions');
    const speakBtn = iconButton(ICONS.speaker, 'Phát âm', 'vb-btn', () => {
      audio.pronounce(state.result?.word || word, state.result?.audios, settings.accent);
    });
    const saveBtn = iconButton(ICONS.star, 'Lưu vào sổ từ', 'vb-btn vb-btn-save', async (btn) => {
      if (!state.result) return;
      btn.disabled = true;
      try {
        const saved = await store.isSaved(state.result.word);
        if (saved) {
          await store.removeWord(state.result.word);
        } else {
          await store.saveWord({ ...structuredClone(state.result), context: state.context, source: state.source, savedAt: Date.now() });
        }
        setSaved(btn, !saved);
      } finally {
        btn.disabled = false;
      }
    });
    saveBtn.disabled = true; // chỉ bật khi tra thành công
    const cambridgeBtn = iconButton(ICONS.book, 'Mở trên Cambridge', 'vb-btn', () => {
      window.open(dictionary.cambridgeUrl(word), '_blank', 'noopener');
    });
    actions.append(speakBtn, saveBtn, cambridgeBtn);

    header.append(title, actions);
    const body = el('div', 'vb-body');
    root.append(header, body);

    return { root, wordEl, phoneticEl, saveBtn, body };
  }

  function renderLoading(body) {
    body.replaceChildren();
    const status = el('div', 'vb-status');
    status.append(el('span', 'vb-spinner'), el('span', null, 'Đang tra từ...'));
    body.appendChild(status);
  }

  function renderError(body) {
    body.replaceChildren(el('div', 'vb-status vb-error', 'Không tìm thấy từ'));
  }

  function renderResult(parts, result) {
    const { wordEl, phoneticEl, body } = parts;
    wordEl.textContent = result.word;
    phoneticEl.textContent = result.phonetic;

    body.replaceChildren();
    if (result.vi) {
      const vi = el('div', 'vb-vi');
      vi.append(el('span', 'vb-vi-label', 'VI'), el('span', 'vb-vi-text', result.vi));
      body.appendChild(vi);
    }

    const definitions = result.definitions.slice(0, settings.maxDefinitions);
    if (definitions.length) {
      const list = el('ol', 'vb-defs');
      for (const def of definitions) {
        const item = el('li', 'vb-def');
        if (def.partOfSpeech) item.appendChild(el('span', 'vb-pos', def.partOfSpeech));
        item.appendChild(el('span', 'vb-def-text', def.definition));
        if (def.vi) item.appendChild(el('span', 'vb-def-vi', def.vi));
        list.appendChild(item);
      }
      body.appendChild(list);
    }
  }

  function mountBubble(root, point) {
    hideBubble();
    anchor = point;
    bubble = root;
    document.documentElement.appendChild(bubble);
    positionBubble();
  }

  function showNotice(message, point) {
    const root = createRoot('status');
    root.appendChild(el('div', 'vb-status vb-error', message));
    mountBubble(root, point);
  }

  function showBubble(word, point) {
    // Lấy ngữ cảnh ngay lúc này, khi vùng chọn vẫn còn
    const state = {
      result: null,
      context: getSelectionContext(word),
      source: { url: location.href, title: document.title }
    };
    const parts = buildBubble(word, state);
    renderLoading(parts.body);
    mountBubble(parts.root, point);

    const id = ++requestId;
    lookup(word)
      .then(async (result) => {
        if (id !== requestId) return;
        state.result = result;
        renderResult(parts, result);
        recordHistory(result);
        setSaved(parts.saveBtn, await store.isSaved(result.word));
        parts.saveBtn.disabled = false;
      })
      .catch(() => {
        if (id !== requestId) return;
        renderError(parts.body);
      })
      .finally(() => {
        if (id === requestId) positionBubble();
      });
  }

  // ---------- Sự kiện ----------

  function isInsideBubble(target) {
    return !!bubble && target instanceof Node && bubble.contains(target);
  }

  document.addEventListener('mousedown', (e) => {
    if (bubble && !isInsideBubble(e.target)) hideBubble();
  }, true);

  // Chế độ "Tự hiện khi bôi đen" / "Bôi đen khi giữ Alt"
  document.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || isInsideBubble(e.target)) return;
    if (settings.trigger === 'contextMenu') return;
    if (settings.trigger === 'altSelect' && !e.altKey) return;
    const point = { x: e.pageX, y: e.pageY };

    // Đợi trình duyệt cập nhật vùng chọn xong
    setTimeout(() => {
      const text = (window.getSelection()?.toString() || '').trim();
      if (text && isValidWord(text)) showBubble(text, point);
    }, 0);
  });

  // Ghi nhớ vị trí chuột phải để hiển thị bong bóng tại đó khi chọn mục "Tra từ" trong menu
  document.addEventListener('contextmenu', (e) => {
    lastContextMenuPoint = { x: e.pageX, y: e.pageY };
  }, true);

  // Dự phòng khi mở menu bằng bàn phím: đặt bong bóng ngay dưới vùng chọn
  function getSelectionPoint() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (rect.width || rect.height) {
        return { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY };
      }
    }
    return { x: window.scrollX + VIEWPORT_MARGIN, y: window.scrollY + VIEWPORT_MARGIN };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'VB_LOOKUP') return;

    const point = lastContextMenuPoint || getSelectionPoint();
    lastContextMenuPoint = null;

    const text = String(message.text || '').trim();
    if (!isValidWord(text)) {
      showNotice('Hãy bôi đen một từ tiếng Anh (chỉ gồm chữ cái, không có khoảng trắng).', point);
    } else {
      showBubble(text, point);
    }
    sendResponse({ ok: true });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && bubble) hideBubble();
  });
})();
