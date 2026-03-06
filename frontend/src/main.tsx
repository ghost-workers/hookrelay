// ABOUTME: React app entry point for HookRelay frontend.
// ABOUTME: Renders the root App component into the DOM.

import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

createRoot(document.getElementById('root')!).render(<App />);
