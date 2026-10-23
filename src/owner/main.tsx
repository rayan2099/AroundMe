import {createRoot} from 'react-dom/client';
import Owner from './Owner.tsx';
import './owner.css';

// owner-web.html (or ?web): a full computer layout on wide screens; phones keep the mobile layout.
if (/owner-web/.test(location.pathname) || new URLSearchParams(location.search).has('web')) document.documentElement.classList.add('o-web');

createRoot(document.getElementById('root')!).render(<Owner />);
