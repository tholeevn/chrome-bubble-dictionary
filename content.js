(() => {
  'use strict';

  const API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
  const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dj=1&q=';
  const CAMBRIDGE_URL ='https://dictionary.cambridge.org/dictionary/english/';
  const WORD_PATTERN = /^[A-Za-z]+$/;
  const MAX_WORD_LENGTH = 45;
  const MAX_DEFINITIONS = 2;
  const CURSOR_OFFSET = 12;
  const VIEWPORT_MARGIN = 8;
  const BUBBLE_ID = 'vocab-bubble-ext';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    speaker: [
      'M11 5 6 9H2v6h4l5 4V5z',
      'M15.54 8.46a5 5 0 0 1 0 7.07',
      'M19.07 4.93a10 10 0 0 1 0 14.14'
    ],
    book: [
      'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z',
      'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'
    ]
  };

  const cache = new Map(); // word -> Promise<result>
  let bubble = null;
  let anchor = { x: 0, y: 0 };
  let lastContextMenuPoint = null;
  let requestId = 0;
  let currentAudio = null;

  // ---------- Tiện ích DOM ----------

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // Dựng SVG bằng createElementNS (không dùng innerHTML để tương thích trang có Trusted Types)
  function createIcon(paths) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of paths) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }
    return svg;
  }

  function createIconButton(icon, label, extraClass, onClick) {
    const btn = el('button', `vb-btn ${extraClass}`);
    btn.type = 'button';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.appendChild(createIcon(icon));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  // ---------- Gọi API & xử lý dữ liệu ----------

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function translate(text) {
    const data = await fetchJson(TRANSLATE_URL + encodeURIComponent(text));
    return (data.sentences || []).map((s) => s.trans || '').join('').trim();
  }

  // Dịch nhiều dòng trong một request, giữ nguyên thứ tự từng dòng
  async function translateLines(lines) {
    const translated = (await translate(lines.join('\n'))).split('\n').map((s) => s.trim());
    return translated.length === lines.length ? translated : [];
  }

  async function fetchEntry(word) {
    const [english, vietnamese] = await Promise.allSettled([
      fetchJson(API_URL + encodeURIComponent(word)).then(parseEntries),
      translate(word)
    ]);

    let vi = vietnamese.status === 'fulfilled' ? vietnamese.value : '';
    if (vi.toLowerCase() === word) vi = ''; // Google trả lại nguyên từ = không dịch được

    if (english.status === 'rejected' && !vi) throw new Error('Not found');

    const result = english.status === 'fulfilled'
      ? english.value
      : { word, phonetic: '', audio: '', definitions: [] };
    result.vi = vi;

    if (result.definitions.length) {
      try {
        const translated = await translateLines(result.definitions.map((d) => d.definition));
        result.definitions.forEach((d, i) => {
          let vi = translated[i] || '';
          // Định nghĩa động từ "To ..." hay bị dịch thành "Để ..." -> bỏ chữ "Để" thừa
          if (/^to\s/i.test(d.definition)) {
            vi = vi.replace(/^Để\s+(.)/u, (_, c) => c.toLocaleUpperCase('vi'));
          }
          d.vi = vi;
        });
      } catch {
        // Không dịch được định nghĩa thì vẫn hiển thị bản tiếng Anh
      }
    }
    return result;
  }

  function lookup(word) {
    const key = word.toLowerCase();
    if (cache.has(key)) return cache.get(key);

    const promise = fetchEntry(key);
    cache.set(key, promise);
    promise.catch(() => cache.delete(key)); // không cache lỗi để lần sau thử lại
    return promise;
  }

  function parseEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error('No entries');
    }

    const phonetics = entries.flatMap((e) => e.phonetics || []);
    const phonetic =
      entries.find((e) => e.phonetic)?.phonetic ||
      phonetics.find((p) => p.text)?.text ||
      '';

    // Ưu tiên giọng US, nếu không có thì lấy file audio đầu tiên
    const audioEntry =
      phonetics.find((p) => p.audio && /-us\.mp3$/i.test(p.audio)) ||
      phonetics.find((p) => p.audio);
    let audio = audioEntry ? audioEntry.audio : '';
    if (audio.startsWith('//')) audio = 'https:' + audio;

    // Với mỗi từ loại, lấy định nghĩa ngắn nhất trong vài nghĩa đầu (phổ biến nhất),
    // bỏ qua định nghĩa chỉ lặp lại chính từ đó (vd: "To run.")
    const word = String(entries[0].word || '').toLowerCase();
    const isUseful = (text) => {
      const core = text.toLowerCase().replace(/^(to|a|an|the)\s+/, '').replace(/[^a-z]/g, '');
      return text && core !== word;
    };
    const byPartOfSpeech = new Map();
    for (const meaning of entries.flatMap((e) => e.meanings || [])) {
      const pos = meaning.partOfSpeech || '';
      if (byPartOfSpeech.has(pos)) continue;
      const best = (meaning.definitions || [])
        .slice(0, 3)
        .map((d) => d.definition || '')
        .filter(isUseful)
        .sort((a, b) => a.length - b.length)[0];
      if (best) byPartOfSpeech.set(pos, { partOfSpeech: pos, definition: best });
    }
    const definitions = [...byPartOfSpeech.values()].slice(0, MAX_DEFINITIONS);

    if (definitions.length === 0) throw new Error('No definitions');

    return { word: entries[0].word, phonetic, audio, definitions };
  }

  // ---------- Phát âm ----------

  function stopAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function speak(word) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  function pronounce(word, audioUrl) {
    stopAudio();
    if (!audioUrl) {
      speak(word);
      return;
    }

    const audio = new Audio(audioUrl);
    currentAudio = audio;
    let handled = false;
    const fallback = () => {
      // Bỏ qua nếu đã fallback rồi hoặc audio đã bị thay thế/dừng chủ động
      if (handled || currentAudio !== audio) return;
      handled = true;
      currentAudio = null;
      speak(word);
    };

    audio.addEventListener('error', fallback, { once: true });
    audio.play().catch(fallback);
  }

  function openCambridge(word) {
    window.open(CAMBRIDGE_URL + encodeURIComponent(word.toLowerCase()), '_blank', 'noopener');
  }

  // ---------- Bong bóng ----------

  function hideBubble() {
    requestId++; // huỷ các response đang chờ
    stopAudio();
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

  function buildBubble(word) {
    const root = el('div');
    root.id = BUBBLE_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', `Tra từ: ${word}`);

    const header = el('div', 'vb-header');
    const title = el('div', 'vb-title');
    const wordEl = el('span', 'vb-word', word);
    const phoneticEl = el('span', 'vb-phonetic');
    title.append(wordEl, phoneticEl);

    const actions = el('div', 'vb-actions');
    const speakBtn = createIconButton(ICONS.speaker, 'Phát âm', 'vb-btn-speak', () => {
      pronounce(root.dataset.word || word, root.dataset.audio || '');
    });
    const cambridgeBtn = createIconButton(ICONS.book, 'Mở trên Cambridge', 'vb-btn-cambridge', () => {
      openCambridge(word);
    });
    actions.append(speakBtn, cambridgeBtn);

    header.append(title, actions);
    const body = el('div', 'vb-body');
    root.append(header, body);

    return { root, wordEl, phoneticEl, body };
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
    const { root, wordEl, phoneticEl, body } = parts;
    root.dataset.word = result.word;
    root.dataset.audio = result.audio;
    wordEl.textContent = result.word;
    phoneticEl.textContent = result.phonetic;

    body.replaceChildren();
    if (result.vi) {
      const vi = el('div', 'vb-vi');
      vi.append(el('span', 'vb-vi-label', 'VI'), el('span', 'vb-vi-text', result.vi));
      body.appendChild(vi);
    }

    if (result.definitions.length) {
      const list = el('ol', 'vb-defs');
      for (const def of result.definitions) {
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
    const root = el('div');
    root.id = BUBBLE_ID;
    root.setAttribute('role', 'status');
    root.appendChild(el('div', 'vb-status vb-error', message));
    mountBubble(root, point);
  }

  function showBubble(word, point) {
    const parts = buildBubble(word);
    renderLoading(parts.body);
    mountBubble(parts.root, point);

    const id = ++requestId;
    lookup(word)
      .then((result) => {
        if (id !== requestId) return;
        renderResult(parts, result);
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
    if (text.length > MAX_WORD_LENGTH || !WORD_PATTERN.test(text)) {
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
