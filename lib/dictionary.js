// Tra từ: Free Dictionary API (nghĩa, IPA, audio) + Google Translate (nghĩa tiếng Việt)
(function (VB) {
  'use strict';

  const API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
  const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dj=1&q=';
  const CAMBRIDGE_URL = 'https://dictionary.cambridge.org/dictionary/english/';
  const MAX_DEFINITIONS = 3;

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

  function parseEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error('No entries');
    }

    const phonetics = entries.flatMap((e) => e.phonetics || []);
    const phonetic =
      entries.find((e) => e.phonetic)?.phonetic ||
      phonetics.find((p) => p.text)?.text ||
      '';

    const audios = { us: '', uk: '', other: '' };
    for (const { audio } of phonetics) {
      if (!audio) continue;
      const url = audio.startsWith('//') ? 'https:' + audio : audio;
      const accent = /-us\.mp3$/i.test(url) ? 'us' : /-uk\.mp3$/i.test(url) ? 'uk' : 'other';
      audios[accent] = audios[accent] || url;
    }

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
      if (best) byPartOfSpeech.set(pos, { partOfSpeech: pos, definition: best, vi: '' });
    }
    const definitions = [...byPartOfSpeech.values()].slice(0, MAX_DEFINITIONS);

    if (definitions.length === 0) throw new Error('No definitions');

    return { word: entries[0].word, phonetic, audios, definitions };
  }

  async function lookup(rawWord, { showVietnamese = true, translateDefinitions = true } = {}) {
    const word = String(rawWord).toLowerCase();
    const [english, vietnamese] = await Promise.allSettled([
      fetchJson(API_URL + encodeURIComponent(word)).then(parseEntries),
      showVietnamese ? translate(word) : Promise.resolve('')
    ]);

    let vi = vietnamese.status === 'fulfilled' ? vietnamese.value : '';
    if (vi.toLowerCase() === word) vi = ''; // Google trả lại nguyên từ = không dịch được

    if (english.status === 'rejected' && !vi) throw new Error('Not found');

    const result = english.status === 'fulfilled'
      ? english.value
      : { word, phonetic: '', audios: { us: '', uk: '', other: '' }, definitions: [] };
    result.vi = vi;

    if (translateDefinitions && result.definitions.length) {
      try {
        const translated = await translateLines(result.definitions.map((d) => d.definition));
        result.definitions.forEach((d, i) => {
          let text = translated[i] || '';
          // Định nghĩa động từ "To ..." hay bị dịch thành "Để ..." -> bỏ chữ "Để" thừa
          if (/^to\s/i.test(d.definition)) {
            text = text.replace(/^Để\s+(.)/u, (_, c) => c.toLocaleUpperCase('vi'));
          }
          d.vi = text;
        });
      } catch {
        // Không dịch được định nghĩa thì vẫn hiển thị bản tiếng Anh
      }
    }
    return result;
  }

  function cambridgeUrl(word) {
    return CAMBRIDGE_URL + encodeURIComponent(String(word).toLowerCase());
  }

  VB.dictionary = { lookup, cambridgeUrl, MAX_DEFINITIONS };
})(globalThis.VB = globalThis.VB || {});
