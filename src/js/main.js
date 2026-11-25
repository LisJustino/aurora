import '../css/main.css';
import { registerViewportKeyboard } from './app/viewport-keyboard.js';
import { registerRender } from './app/render.js';
import { registerDialogs } from './app/dialogs.js';
import { registerActions } from './app/actions.js';
import { registerForms } from './app/forms.js';
import { registerGlobalEvents } from './app/global-events.js';
import { registerFinanceDialogs } from './app/finance-dialogs.js';
import { registerFinanceActions } from './app/finance-actions.js';
import { registerFinanceExtras } from './app/finance-extras.js';
import { registerStartup } from './app/startup.js';
import { showAccountStartupError, startAurora } from './app/startup.js';

export { startAuthenticatedAurora } from './app/startup.js';

registerViewportKeyboard();
registerRender();
registerDialogs();
registerActions();
registerForms();
registerGlobalEvents();
registerFinanceDialogs();
registerFinanceActions();
registerFinanceExtras();
registerStartup();
startAurora().catch((error) => {
  console.error('Aurora: a inicialização segura falhou.', error);
  showAccountStartupError(
    document.getElementById('app'),
    'Não foi possível carregar os módulos de conta. Inicie o projeto com `npm run dev`; a demonstração pública não exige login.',
  );
});
