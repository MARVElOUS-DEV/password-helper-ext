import { createRoot } from 'react-dom/client';
import Popup from './Popup';
import '../../styles/base.css';
import './Popup.css';

const container = document.getElementById('app-container');

if (!container) {
  throw new Error('Popup root container was not found.');
}

createRoot(container).render(<Popup />);
