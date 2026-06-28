import React from 'react';
import ReactDOM from 'react-dom/client';
import { JukeboxApp } from './JukeboxApp';
import { I18nProvider } from '../../providers/I18nProvider';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <JukeboxApp />
    </I18nProvider>
  </React.StrictMode>
);
