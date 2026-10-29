// Spelling Bee Letter Pronunciation Lexicon with enhanced VOIP & acoustic confusion tolerance

export const NATO_MAP: Record<string, string> = {
  alpha: 'A', bravo: 'B', charlie: 'C', delta: 'D', echo: 'E', foxtrot: 'F',
  golf: 'G', hotel: 'H', india: 'I', juliet: 'J', juliette: 'J', kilo: 'K', lima: 'L',
  mike: 'M', november: 'N', oscar: 'O', papa: 'P', quebec: 'Q', romeo: 'R',
  sierra: 'S', tango: 'T', uniform: 'U', victor: 'V', whiskey: 'W', whisky: 'W',
  xray: 'X', 'x-ray': 'X', yankee: 'Y', zulu: 'Z'
};

export const PHONETIC_CONFUSION_GROUPS: Record<string, string[]> = {
  // EE-rhyme group (the most confused in online VOIP meetings)
  B: ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z'],
  C: ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z', 'S'],
  D: ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z'],
  E: ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z', 'A'],
  G: ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z', 'J'],
  P: ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z'],
  T: ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z'],
  V: ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z'],
  Z: ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z', 'S'],

  // AY-rhyme group
  A: ['A', 'H', 'J', 'K', 'E', 'I'],
  H: ['A', 'H', 'J', 'K', 'eight'],
  J: ['A', 'H', 'J', 'K', 'G'],
  K: ['A', 'H', 'J', 'K', 'Q'],

  // EM / EN nasal group
  M: ['M', 'N'],
  N: ['M', 'N'],

  // Fricative group
  F: ['F', 'S', 'X'],
  S: ['S', 'F', 'C', 'Z'],
  X: ['X', 'S', 'F'],

  // EYE-rhyme group
  I: ['I', 'Y', 'A'],
  Y: ['I', 'Y', 'U'],

  // OO / YOU group
  U: ['U', 'Q', 'W', 'O'],
  Q: ['Q', 'U', 'K'],
  W: ['W', 'U'],
  O: ['O', 'U']
};

export const LETTER_MAP: Record<string, string> = {
  // A
  a: 'A', ay: 'A', eh: 'A', hey: 'A', 'a.': 'A', ei: 'A', aa: 'A', eight: 'A', ate: 'A', ape: 'A',
  // B
  b: 'B', be: 'B', bee: 'B', bea: 'B', bi: 'B', 'b.': 'B',
  // C
  c: 'C', see: 'C', sea: 'C', si: 'C', cee: 'C', she: 'C', 'c.': 'C',
  // D
  d: 'D', dee: 'D', di: 'D', de: 'D', 'd.': 'D',
  // E
  e: 'E', ee: 'E', ea: 'E', 'e.': 'E',
  // F
  f: 'F', ef: 'F', eff: 'F', af: 'F', 'f.': 'F',
  // G
  g: 'G', gee: 'G', ji: 'G', jee: 'G', gi: 'G', 'g.': 'G',
  // H
  h: 'H', aitch: 'H', haitch: 'H', ach: 'H', age: 'H', eich: 'H', etch: 'H', each: 'H', itch: 'H', ich: 'H', eitch: 'H', hech: 'H', 'h.': 'H',
  // I
  i: 'I', eye: 'I', aye: 'I', ai: 'I', 'i.': 'I',
  // J
  j: 'J', jay: 'J', jae: 'J', je: 'J', 'j.': 'J',
  // K
  k: 'K', kay: 'K', okay: 'K', ok: 'K', cay: 'K', ka: 'K', que: 'K', 'k.': 'K',
  // L
  l: 'L', el: 'L', ell: 'L', elle: 'L', al: 'L', 'l.': 'L',
  // M
  m: 'M', em: 'M', im: 'M', 'm.': 'M',
  // N
  n: 'N', en: 'N', in: 'N', an: 'N', 'n.': 'N',
  // O
  o: 'O', oh: 'O', owe: 'O', ow: 'O', 'o.': 'O',
  // P
  p: 'P', pee: 'P', pea: 'P', pe: 'P', pi: 'P', 'p.': 'P',
  // Q
  q: 'Q', cue: 'Q', queue: 'Q', kew: 'Q', kyu: 'Q', cu: 'Q', 'q.': 'Q',
  // R
  r: 'R', ar: 'R', are: 'R', our: 'R', or: 'R', arr: 'R', 'r.': 'R',
  // S
  s: 'S', es: 'S', ess: 'S', ass: 'S', is: 'S', yes: 'S', 's.': 'S',
  // T
  t: 'T', tee: 'T', tea: 'T', ti: 'T', te: 'T', 't.': 'T',
  // U
  u: 'U', you: 'U', yu: 'U', ewe: 'U', yew: 'U', yoo: 'U', iu: 'U', 'u.': 'U',
  // V
  v: 'V', vee: 'V', vi: 'V', 'v.': 'V',
  // W
  w: 'W', doubleyou: 'W', doubleu: 'W', 'double-u': 'W', 'w.': 'W',
  // X
  x: 'X', ex: 'X', eks: 'X', axe: 'X', 'x.': 'X',
  // Y
  y: 'Y', why: 'Y', wye: 'Y', wai: 'Y', 'y.': 'Y',
  // Z
  z: 'Z', zee: 'Z', zed: 'Z', zet: 'Z', zi: 'Z', 'z.': 'Z'
};

export const FILLER_WORDS = new Set([
  'letter', 'capital', 'small', 'uh', 'um', 'erm', 'hmm', 'and', 'then', 'the', 'ah', 'like', 'so', 'okay', 'next', 'spelling', 'word'
]);

export function parseSpokenLetters(rawTranscript: string): { letters: string[]; ignored: string[] } {
  // 1. Check for NATO words (e.g. "Bravo", "Charlie", "Delta")
  let normalized = rawTranscript.toLowerCase();

  // 2. Check for clarification phrases: e.g. "B as in boy", "D as in dog", "M for Mary"
  normalized = normalized.replace(/\b([a-z])\s+(?:as\s+in|for)\s+[a-z]+\b/gi, (_match, letter) => {
    return ` ${letter} `;
  });

  // 3. Handle phrases like "double E", "double S", "double-u"
  normalized = normalized.replace(/\bdouble[\s-]?(u|you|yu)\b/gi, ' doubleyou ');

  const tokens = normalized.split(/[\s,\.\-!?;:"]+/).filter(Boolean);
  const letters: string[] = [];
  const ignored: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    const low = raw.toLowerCase();

    // Check NATO phonetic word
    if (NATO_MAP[low]) {
      letters.push(NATO_MAP[low]);
      continue;
    }

    // Check "double [letter]" (e.g. "double S" -> S, S)
    if (low === 'double' && i + 1 < tokens.length) {
      const nextMapped = mapTokenToLetter(tokens[i + 1]);
      if (nextMapped && nextMapped.length === 1) {
        letters.push(nextMapped[0], nextMapped[0]);
        i++;
        continue;
      }
    }

    if (FILLER_WORDS.has(low) && !(low in LETTER_MAP && LETTER_MAP[low])) {
      continue;
    }

    const mapped = mapTokenToLetter(raw);
    if (mapped && mapped.length > 0) {
      letters.push(...mapped);
    } else {
      ignored.push(raw);
    }
  }

  return { letters, ignored };
}

function mapTokenToLetter(t: string): string[] | null {
  const low = t.toLowerCase();
  if (NATO_MAP[low]) {
    return [NATO_MAP[low]];
  }
  if (LETTER_MAP[low]) {
    return [LETTER_MAP[low]];
  }
  // Single letter "a" -> "A"
  if (/^[a-z]$/i.test(t)) {
    return [t.toUpperCase()];
  }
  // Runs of continuous uppercase letters e.g. "EXTRA" -> ['E','X','T','R','A']
  if (/^[A-Z]{2,15}$/.test(t)) {
    return t.split('');
  }
  // Dotted letters e.g. "C.A.T."
  if (/^([a-z]\.){2,}$/i.test(t)) {
    return t.replace(/\./g, '').toUpperCase().split('');
  }
  return null;
}

// Target-Aware Multi-Alternative letter extractor:
// Checks up to 5 guesses from SpeechRecognition.
// If an alternative matches the expected phonetic confusion set of the target word at the current position,
// it intelligently disambiguates acoustic ties (e.g. B vs D vs P vs T) without dropping letters!
export function extractBestLettersFromResults(
  results: any,
  startIndex: number,
  expectedTargetLetters?: string[],
  currentLettersCount = 0
): { finals: string[]; interims: string[]; ignored: string[] } {
  const finals: string[] = [];
  const interims: string[] = [];
  const ignored: string[] = [];

  let simulatedPosition = currentLettersCount;

  for (let i = startIndex; i < results.length; i++) {
    const res = results[i];
    let bestFinal: { letters: string[]; ignored: string[]; score: number } | null = null;
    let bestInterim: { letters: string[]; ignored: string[]; score: number } | null = null;

    const expectedChar = expectedTargetLetters && simulatedPosition < expectedTargetLetters.length
      ? expectedTargetLetters[simulatedPosition].toUpperCase()
      : null;

    const confusionGroup = expectedChar ? PHONETIC_CONFUSION_GROUPS[expectedChar] || [expectedChar] : [];

    // Evaluate up to 5 alternatives
    for (let a = 0; a < Math.min(res.length, 5); a++) {
      const alt = res[a];
      const parsed = parseSpokenLetters(alt?.transcript || '');

      let score = parsed.letters.length * 4 - parsed.ignored.length * 1.5 + (alt?.confidence || 0);

      // Acoustic Disambiguation Bonus:
      // If the candidate letter is in the same phonetic confusion set as the target letter (e.g. said "B" or "D"),
      // give priority to the exact expected letter if present in this alternative
      if (expectedChar && parsed.letters.length === 1) {
        const candidate = parsed.letters[0];
        if (candidate === expectedChar) {
          score += 6.0; // Strong match with expected letter in phonetic set
        } else if (confusionGroup.includes(candidate)) {
          score += 1.5; // Related phonetic group match
        }
      }

      if (res.isFinal) {
        if (!bestFinal || score > bestFinal.score) {
          bestFinal = { letters: parsed.letters, ignored: parsed.ignored, score };
        }
      } else {
        if (!bestInterim || score > bestInterim.score) {
          bestInterim = { letters: parsed.letters, ignored: parsed.ignored, score };
        }
      }
    }

    if (res.isFinal && bestFinal) {
      finals.push(...bestFinal.letters);
      simulatedPosition += bestFinal.letters.length;
      if (bestFinal.ignored.length > 0) ignored.push(...bestFinal.ignored);
    } else if (!res.isFinal && bestInterim) {
      interims.push(...bestInterim.letters);
    }
  }

  return { finals, interims, ignored };
}

export interface AudioMeterController {
  start: (options?: { kind?: 'mic' | 'display'; deviceId?: string }) => Promise<boolean>;
  stop: () => void;
  setGain: (gain: number) => void;
  getLevel: () => number; // 0 to 100
  stream: MediaStream | null;
  audioSourceKind: 'mic' | 'display';
}

export function createAudioMeter(onLevelChange?: (level: number) => void): AudioMeterController {
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let gainNode: GainNode | null = null;
  let animationId = 0;
  let currentLevel = 0;
  let currentKind: 'mic' | 'display' = 'mic';

  const getLevel = () => currentLevel;

  const setGain = (val: number) => {
    if (gainNode && audioContext) {
      gainNode.gain.setValueAtTime(val, audioContext.currentTime);
    }
  };

  const start = async (options?: { kind?: 'mic' | 'display'; deviceId?: string }): Promise<boolean> => {
    try {
      currentKind = options?.kind || 'mic';

      if (currentKind === 'display') {
        if (!navigator.mediaDevices?.getDisplayMedia) return false;
        // Capture Teams / online meeting audio directly from computer/tab
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true,
          },
        });

        // Check if user shared audio
        if (!displayStream.getAudioTracks().length) {
          displayStream.getTracks().forEach(t => t.stop());
          return false;
        }

        // Disable unnecessary video track to save CPU
        displayStream.getVideoTracks().forEach(t => (t.enabled = false));
        stream = displayStream;
      } else {
        if (!navigator.mediaDevices?.getUserMedia) return false;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: options?.deviceId ? { exact: options.deviceId } : undefined,
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: true,
          },
        });
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioCtx();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      gainNode = audioContext.createGain();
      gainNode.gain.value = 3.5; // High sensitivity default for online meetings

      // Dynamics compressor with higher compression to elevate quiet voice letters
      const comp = audioContext.createDynamicsCompressor();
      comp.threshold.value = -48;
      comp.knee.value = 25;
      comp.ratio.value = 10;
      comp.attack.value = 0.001;
      comp.release.value = 0.15;

      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;

      source.connect(gainNode);
      gainNode.connect(comp);
      comp.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);

      const tick = () => {
        if (!analyser) return;
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);
        const rawLevel = Math.min(100, Math.round(rms * 500));
        currentLevel = Math.max(rawLevel, currentLevel * 0.82); // responsive rise, smooth fall
        if (onLevelChange) {
          onLevelChange(currentLevel);
        }
        animationId = requestAnimationFrame(tick);
      };

      tick();
      return true;
    } catch {
      return false;
    }
  };

  const stop = () => {
    if (animationId) cancelAnimationFrame(animationId);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    analyser = null;
    gainNode = null;
    currentLevel = 0;
    if (onLevelChange) onLevelChange(0);
  };

  return {
    start,
    stop,
    setGain,
    getLevel,
    get stream() {
      return stream;
    },
    get audioSourceKind() {
      return currentKind;
    },
  };
}
