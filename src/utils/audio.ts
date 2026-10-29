let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

// Synthesized sound effects
export function playTone(freq: number, duration = 0.12, type: OscillatorType = 'sine', volume = 0.15) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // audio failure silent fallback
  }
}

export function playChime() {
  playTone(523.25, 0.12, 'triangle', 0.2); // C5
  setTimeout(() => playTone(659.25, 0.14, 'triangle', 0.22), 90); // E5
  setTimeout(() => playTone(783.99, 0.28, 'triangle', 0.25), 180); // G5
}

export function playBuzzer() {
  playTone(220, 0.22, 'sawtooth', 0.18);
  setTimeout(() => playTone(174.61, 0.32, 'sawtooth', 0.2), 160);
}

export function playLetterPop() {
  playTone(1200, 0.04, 'sine', 0.06);
}

export function playTimerTick() {
  playTone(880, 0.05, 'sine', 0.1);
}

export function playFanfare() {
  playTone(440, 0.1, 'triangle', 0.2);
  setTimeout(() => playTone(554.37, 0.1, 'triangle', 0.2), 100);
  setTimeout(() => playTone(659.25, 0.12, 'triangle', 0.22), 200);
  setTimeout(() => playTone(880, 0.4, 'triangle', 0.25), 320);
}

// Alarm when student moves face away from camera center
export function playPositionAlarm() {
  playTone(850, 0.14, 'sawtooth', 0.25);
  setTimeout(() => playTone(600, 0.14, 'sawtooth', 0.25), 150);
  setTimeout(() => playTone(850, 0.18, 'sawtooth', 0.3), 300);
}

// Text-to-speech helpers
export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter(v => /^en[-_]/i.test(v.lang) || v.lang.toLowerCase() === 'en');
  // Sort prioritized voices (Natural, Google, Neural, Samantha, Daniel, Jenny)
  return en.sort((a, b) => {
    const isSpecialA = /natural|neural|online|google|aria|jenny|guy|samantha|daniel|libby/i.test(a.name) ? 0 : 1;
    const isSpecialB = /natural|neural|online|google|aria|jenny|guy|samantha|daniel|libby/i.test(b.name) ? 0 : 1;
    return isSpecialA - isSpecialB;
  });
}

export function speakText(
  text: string,
  options?: {
    voiceURI?: string;
    lang?: string;
    rate?: number;
    pitch?: number;
  }
): Promise<void> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options?.rate ?? 0.82;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.lang = options?.lang ?? 'en-US';

    const voices = getEnglishVoices();
    if (options?.voiceURI) {
      const match = voices.find(v => v.voiceURI === options.voiceURI);
      if (match) utterance.voice = match;
    } else if (voices.length > 0) {
      utterance.voice = voices[0];
    }

    let isDone = false;
    const finish = () => {
      if (!isDone) {
        isDone = true;
        resolve();
      }
    };

    utterance.onend = finish;
    utterance.onerror = finish;
    // Timeout safeguard for browsers where onend may hang
    setTimeout(finish, 1200 + text.length * 110);

    window.speechSynthesis.speak(utterance);
  });
}
