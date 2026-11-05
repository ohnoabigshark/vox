/**
 * Player settings, saved to localStorage (TECHNICAL.md §15). Storage can be
 * unavailable (private mode, cleared by the OS), so every access is guarded
 * and the game works with the defaults.
 */

const KEY = 'getJackBack.settings';
const VERSION = 1;

export interface Settings {
  /** Measured tap latency in milliseconds (positive = the player taps late). */
  audioOffsetMs: number;
  haptics: boolean;
  /** Your players' names on the field before the snap (the Aa switch, docs/SELECT.md n1-n3). */
  names: boolean;
}

const DEFAULTS: Settings = { audioOffsetMs: 0, haptics: true, names: true };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings> & { version?: number };
    if (parsed.version !== VERSION) return { ...DEFAULTS };
    return {
      audioOffsetMs:
        typeof parsed.audioOffsetMs === 'number' ? parsed.audioOffsetMs : DEFAULTS.audioOffsetMs,
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : DEFAULTS.haptics,
      // Saved before the switch existed: on.
      names: typeof parsed.names === 'boolean' ? parsed.names : DEFAULTS.names,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, ...settings }));
  } catch {
    // Storage unavailable: settings last for this session only.
  }
}
