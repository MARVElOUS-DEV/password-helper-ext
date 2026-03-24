import { createRoot } from 'react-dom/client';
import Options from './Options';
import '../../styles/base.css';
import './Options.css';

const container = document.getElementById('app-container');

if (!container) {
  throw new Error('Options root container was not found.');
}

createRoot(container).render(<Options />);
