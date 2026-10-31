import { describe, expect, it } from 'vitest';
import {
  FROG_RAIN,
  fieldEventDefaults,
  type FieldEvent,
} from '../../src/arcade/content/fieldEvents';
import { checkSavedEvents, layerEvents } from '../../src/arcade/content/savedEvents';

/** docs/FIELD_EVENTS.md, test 5: saved events over the defaults (k1). */

const tuned: FieldEvent = { ...FROG_RAIN, goesOff: 2 };
const made: FieldEvent = {
  ...FROG_RAIN,
  id: 'graveyardRain',
  name: 'Graveyard rain',
  boss: null,
  area: { shape: 'circle', across: 'either', out: 4, at: 10, radius: 2 },
  effect: { kind: 'flatten', on: 'theirs' },
  call: null,
  look: 'plain',
};

describe('saved events (test 5)', () => {
  it('a saved event takes its default’s place; a new one is added after the defaults', () => {
    const { events, warnings } = checkSavedEvents({ frogRain: tuned, graveyardRain: made });
    expect(warnings).toEqual([]);
    const layered = layerEvents(fieldEventDefaults, events);
    expect(layered.map((e) => e.id)).toEqual(['frogRain', 'graveyardRain']);
    expect(layered[0]?.goesOff).toBe(2);
    expect(layered[1]).toEqual(made);
  });

  it('nothing saved plays the defaults; Restore (dropping it from the file) puts one back', () => {
    expect(layerEvents(fieldEventDefaults, checkSavedEvents({}).events)).toEqual(
      fieldEventDefaults,
    );
    const restored = checkSavedEvents({ graveyardRain: made }).events;
    expect(layerEvents(fieldEventDefaults, restored)[0]).toEqual(FROG_RAIN);
  });

  it('one that can’t be read is left out with a warning saying which and why; the rest stay', () => {
    const bad = { ...made, id: 'broken', area: { shape: 'triangle' } };
    const { events, warnings } = checkSavedEvents({ frogRain: tuned, broken: bad });
    expect(events.map((e) => e.id)).toEqual(['frogRain']);
    expect(warnings).toEqual([
      'saved-events.json: broken can’t be read (its area is not a lane, band or circle), so it was left out',
    ]);
    expect(checkSavedEvents({ frogRain: { ...tuned, goesOff: 'soon' } }).warnings).toEqual([
      'saved-events.json: frogRain can’t be read (goesOff is not a number), so it was left out',
    ]);
    expect(checkSavedEvents({ other: tuned }).warnings).toEqual([
      'saved-events.json: other can’t be read (its id is frogRain), so it was left out',
    ]);
    expect(checkSavedEvents([1]).warnings).toEqual([
      'saved-events.json is not an object of events, so none were read',
    ]);
  });

  it('one that would never go off, or catches nobody, is refused too, saying which part (review r2)', () => {
    const why = (x: object): readonly string[] =>
      checkSavedEvents({ frogRain: { ...tuned, ...x } }).warnings;
    const said = (part: string): string[] => [
      `saved-events.json: frogRain can’t be read (${part}), so it was left out`,
    ];
    expect(why({ goesOff: 0 })).toEqual(said('goesOff must be more than 0'));
    // JSON reads 1e999 as Infinity.
    expect(why(JSON.parse('{"goesOff": 1e999}'))).toEqual(said('goesOff must be more than 0'));
    expect(why({ lasts: 0 })).toEqual(said('lasts must be more than 0'));
    expect(why({ area: { ...FROG_RAIN.area, width: 0 } })).toEqual(
      said("its area's width must be more than 0"),
    );
    expect(why({ area: { ...FROG_RAIN.area, from: 5, to: 3 } })).toEqual(
      said("its area's far edge must be past its near edge"),
    );
    expect(why({ area: made.area.shape === 'circle' ? { ...made.area, radius: -1 } : {} })).toEqual(
      said("its area's radius must be more than 0"),
    );
  });
});
