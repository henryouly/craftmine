import './style.css';
import { startGame } from './game';

console.log('craftmine boot');

const canvas = document.getElementById('game') as HTMLCanvasElement;

startGame(canvas).catch((err) => {
  console.error('craftmine start failed', err);
  const overlay = document.getElementById('startOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    const card = overlay.querySelector('.card');
    if (card && !document.getElementById('startError')) {
      const msg = document.createElement('p');
      msg.id = 'startError';
      msg.textContent =
        'Could not start: WebGL unavailable. Use a browser with hardware acceleration enabled.';
      card.appendChild(msg);
    }
  }
});
