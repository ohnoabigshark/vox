import { describe, expect, it } from 'vitest';
import { FROG_RAIN } from '../../src/arcade/content/fieldEvents';
import { eventsCheck } from '../../tools/eventsSave';
import { handleSave, type SavedFileDeps } from '../../tools/savedFile';

/** docs/FIELD_EVENTS.md, test 6: the event editor's Save, as the bench's (k1). */

const fake = (): { written: string[]; deps: SavedFileDeps } => {
  const written: string[] = [];
  return {
    written,
    deps: {
      write: async (text) => void written.push(text),
      inServedGame: async () => written.length === 0,
      check: eventsCheck,
    },
  };
};

describe('the events save endpoint (test 6)', () => {
  it('GET says whether saved-events.json is in the served game', async () => {
    expect(await handleSave('GET', '', fake().deps)).toEqual({
      status: 200,
      body: '{"inServedGame":true}',
    });
  });

  it('POST writes the whole file, its events in id order, as prettier writes JSON', async () => {
    const { written, deps } = fake();
    const other = { ...FROG_RAIN, id: 'aaa', name: 'A' };
    const r = await handleSave('POST', JSON.stringify({ frogRain: FROG_RAIN, aaa: other }), deps);
    expect(r).toEqual({ status: 200, body: '{"inServedGame":false}' });
    expect(Object.keys(JSON.parse(written[0] ?? '{}'))).toEqual(['aaa', 'frogRain']);
    expect(written[0]?.endsWith('}\n')).toBe(true);
    expect(written[0]).toContain('\n  "aaa": {\n');
  });

  it('a file with an event that can’t be read is refused in its own words, and nothing is written', async () => {
    const { written, deps } = fake();
    const r = await handleSave(
      'POST',
      JSON.stringify({ frogRain: { ...FROG_RAIN, lasts: 'x' } }),
      deps,
    );
    expect(r).toEqual({
      status: 400,
      body: 'saved-events.json: frogRain can’t be read (lasts is not a number), so it was left out',
    });
    expect(written).toEqual([]);
    expect(await handleSave('POST', 'not json', deps)).toEqual({ status: 400, body: 'not JSON' });
  });
});
