let initialized = false;

const HELP_HTML = `<div class="help-card">
<h2>Controls</h2>
<ul>
<li><b>WASD</b> move · <b>Space</b> jump · <b>F</b> fly</li>
<li><b>Mouse</b> look · <b>LMB</b> break · <b>RMB</b> place</li>
<li><b>1-9 / wheel</b> select block · <b>H</b> help</li>
</ul>
<p>Click Play, then click the world to lock the mouse. Esc opens the menu.</p>
</div>`;

/** Crosshair is static HTML. Ensures #debug + #help exist; H toggles help. Idempotent. */
export function initHud(): void {
  if (initialized) return;
  initialized = true;

  let debug = document.getElementById('debug');
  if (!debug) {
    const hud = document.getElementById('hud') ?? document.body;
    debug = document.createElement('div');
    debug.id = 'debug';
    hud.appendChild(debug);
  }

  let help = document.getElementById('help');
  if (!help) {
    help = document.createElement('div');
    help.id = 'help';
    document.body.appendChild(help);
  }
  help.innerHTML = HELP_HTML;
  help.classList.add('hidden');

  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyH') help?.classList.toggle('hidden');
  });
}
