// Xuất sổ từ ra Anki (TSV) và sao lưu/khôi phục JSON
(function (VB) {
  'use strict';

  const BACKUP_APP = 'vocab-bubble';
  const BACKUP_VERSION = 1;

  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
  // Mỗi note là một dòng TSV -> không được chứa tab/xuống dòng
  const tsvField = (html) => html.replace(/[\t\r\n]+/g, ' ');

  function ankiFront(entry) {
    let html = `<b>${escapeHtml(entry.word)}</b>`;
    if (entry.phonetic) html += `<br>${escapeHtml(entry.phonetic)}`;
    return html;
  }

  function ankiBack(entry) {
    const sections = [];
    if (entry.vi) sections.push(`<b>${escapeHtml(entry.vi)}</b>`);

    const definitions = entry.definitions.map((d) => {
      let line = d.partOfSpeech ? `<i>(${escapeHtml(d.partOfSpeech)})</i> ` : '';
      line += escapeHtml(d.definition);
      if (d.vi) line += `<br>→ ${escapeHtml(d.vi)}`;
      return line;
    });
    if (definitions.length) sections.push(definitions.join('<br>'));

    if (entry.context) sections.push(`<i>“${escapeHtml(entry.context)}”</i>`);
    if (entry.source?.url) {
      sections.push(`<a href="${escapeHtml(entry.source.url)}">${escapeHtml(entry.source.title || entry.source.url)}</a>`);
    }
    return sections.join('<br><br>');
  }

  // File text import thẳng vào Anki (File → Import), mỗi từ một flashcard Front/Back
  function toAnki(words) {
    const lines = ['#separator:tab', '#html:true', '#tags:vocab-bubble', '#columns:Front\tBack'];
    for (const entry of words) {
      lines.push(`${tsvField(ankiFront(entry))}\t${tsvField(ankiBack(entry))}`);
    }
    return lines.join('\n') + '\n';
  }

  function toBackup(words, history) {
    return JSON.stringify({
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      words,
      history
    }, null, 2);
  }

  function parseBackup(text) {
    const data = JSON.parse(text);
    if (!data || data.app !== BACKUP_APP || !Array.isArray(data.words)) {
      throw new Error('Invalid backup file');
    }
    return { words: data.words, history: Array.isArray(data.history) ? data.history : [] };
  }

  VB.exporter = { toAnki, toBackup, parseBackup };
})(globalThis.VB = globalThis.VB || {});
