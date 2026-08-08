import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AuthenticatedDreamSheetApp from './AuthenticatedDreamSheetApp.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthenticatedDreamSheetApp />
    </AuthProvider>
  </StrictMode>,
);
