// Phát âm dùng chung: ưu tiên file mp3 theo giọng đã chọn, lỗi thì chuyển sang Web Speech API
(function (VB) {
  'use strict';

  let currentAudio = null;

  function stop() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function speak(word, accent) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  // Giọng đã chọn -> giọng còn lại -> file không rõ giọng
  function pickAudio(audios, accent) {
    if (!audios) return '';
    const other = accent === 'uk' ? 'us' : 'uk';
    return audios[accent] || audios[other] || audios.other || '';
  }

  function pronounce(word, audios, accent = 'us') {
    stop();
    const audioUrl = pickAudio(audios, accent);
    if (!audioUrl) {
      speak(word, accent);
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
      speak(word, accent);
    };

    audio.addEventListener('error', fallback, { once: true });
    audio.play().catch(fallback);
  }

  VB.audio = { pronounce, stop };
})(globalThis.VB = globalThis.VB || {});
