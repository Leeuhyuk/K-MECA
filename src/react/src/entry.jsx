import { createRoot } from 'react-dom/client';

function boot() {
  const host = document.getElementById('inventory-table');
  if (host) {
    host.innerHTML = '';
    createRoot(host).render(<div data-react-probe="ok">React mounted</div>);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
