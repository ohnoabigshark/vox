/** The dev setup page's entry (dev/setup.html, docs/DEV_SETUP.md). */
import { setupStore } from '../../arcade/content/savedSetup';
import { browserStorage } from '../playEditor/sketches';
import { required } from '../pageKit';
import { mountSetupPage } from './page';

const root = required('setup.html', '#setup');
await mountSetupPage(root, {
  store: setupStore(browserStorage()),
  // The game is the page above the dev pages (the tailnet's /vox/, the release's /vox/).
  gameUrl: new URL('../', location.href).href,
  copy: async (text) => {
    if (!navigator.clipboard) throw new Error('this page has no clipboard');
    await navigator.clipboard.writeText(text);
  },
  go: (url) => location.assign(url),
});
