import { layerSaved } from '../src/arcade/content/savedTuning';
import { arcadeTuning, tuningDefaults } from '../src/arcade/content/tuning';

// Tests pin the game to tuning.ts's defaults, whatever the Coach has saved
// on the test bench (docs/BENCH.md, Saving): a save is a playtest, not a
// change to the rules the tests describe.
layerSaved(arcadeTuning, tuningDefaults, {});
