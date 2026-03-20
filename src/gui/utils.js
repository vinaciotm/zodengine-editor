export function showModal(title, label, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>${title}</h2>
        <input class="modal-input" type="text" value="${defaultValue}" placeholder="${label}" />
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="modal-ok">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('.modal-input');
    input.select();
    const finish = (val) => { overlay.remove(); resolve(val); };
    overlay.querySelector('#modal-ok').addEventListener('click', () => finish(input.value.trim() || null));
    overlay.querySelector('#modal-cancel').addEventListener('click', () => finish(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(input.value.trim() || null);
      if (e.key === 'Escape') finish(null);
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(null); });
  });
}

export function showNewSceneModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>New Scene</h2>
        <input class="modal-input" type="text" value="New Scene" placeholder="Scene name" />
        <label class="modal-checkbox-row">
          <input type="checkbox" id="modal-copy-cb" />
          <span>Copy objects from current scene</span>
        </label>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="modal-ok">Create</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('.modal-input');
    const cb = overlay.querySelector('#modal-copy-cb');
    input.select();
    const finish = (name, copy) => { overlay.remove(); resolve(name ? { name, copy } : null); };
    overlay.querySelector('#modal-ok').addEventListener('click', () => finish(input.value.trim() || null, cb.checked));
    overlay.querySelector('#modal-cancel').addEventListener('click', () => finish(null, false));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(input.value.trim() || null, cb.checked);
      if (e.key === 'Escape') finish(null, false);
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(null, false); });
  });
}

export function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast${type ? ' ' + type : ''}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

export function numInput(value, onChange, step = 0.01) {
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.className = 'inspector-input';
  inp.value = Number(value).toFixed(3);
  inp.step = step;
  inp.addEventListener('change', () => onChange(parseFloat(inp.value) || 0));
  return inp;
}

export function dragNum(value, onChange, step = 0.01) {
  const decimals = step < 0.1 ? 3 : step < 1 ? 2 : 1;
  const wrap = document.createElement('div');
  wrap.className = 'drag-num-wrap';

  const inp = document.createElement('input');
  inp.type = 'number';
  inp.className = 'inspector-input';
  inp.value = Number(value).toFixed(decimals);
  inp.step = step;
  inp.addEventListener('change', () => onChange(parseFloat(inp.value) || 0));

  const handle = document.createElement('span');
  handle.className = 'drag-num-handle';
  handle.innerHTML = '&#8597;';
  handle.title = 'Drag up/down to adjust';

  let startY, startVal;
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startY = e.clientY;
    startVal = parseFloat(inp.value) || 0;
    document.body.style.cursor = 'ns-resize';

    const onMove = (ev) => {
      const dy = startY - ev.clientY;
      const newVal = startVal + dy * step;
      inp.value = newVal.toFixed(decimals);
      onChange(newVal);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  wrap.appendChild(inp);
  wrap.appendChild(handle);
  return wrap;
}

export function colorToHex(num) {
  return '#' + num.toString(16).padStart(6, '0');
}

export function hexToNum(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

export function makeCollapsiblePanel(headerEl, contentEl, initialOpen = true, onToggle = null) {
  let open = initialOpen;
  // Find the parent panel element to manage its flex
  const panelEl = headerEl.parentElement;
  const savedFlex = panelEl?.style.flex || '';

  const chevron = document.createElement('span');
  chevron.className = 'panel-chevron';
  chevron.innerHTML = open ? '&#9660;' : '&#9654;';
  chevron.style.cssText = 'font-size:9px;margin-right:6px;transition:transform 0.15s;display:inline-block;flex-shrink:0;';
  headerEl.insertBefore(chevron, headerEl.firstChild);

  if (!open) {
    contentEl.style.display = 'none';
    if (panelEl) panelEl.style.flex = '0 0 auto';
  }
  headerEl.classList.toggle('header-collapsed', !open);

  headerEl.style.cursor = 'pointer';
  headerEl.addEventListener('click', (e) => {
    // Don't collapse when clicking action buttons
    if (e.target.closest('.panel-header-actions')) return;
    open = !open;
    chevron.innerHTML = open ? '&#9660;' : '&#9654;';
    headerEl.classList.toggle('header-collapsed', !open);
    if (open) {
      contentEl.style.display = '';
      if (panelEl) panelEl.style.flex = savedFlex;
      contentEl.classList.remove('panel-content-opening');
      // Trigger slide-in animation
      requestAnimationFrame(() => contentEl.classList.add('panel-content-opening'));
      contentEl.addEventListener('animationend', () => contentEl.classList.remove('panel-content-opening'), { once: true });
    } else {
      contentEl.style.display = 'none';
      if (panelEl) panelEl.style.flex = '0 0 auto';
    }
    onToggle?.(open);
  });
}

export function showConfirm(title, message, confirmLabel = 'Confirm') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>${title}</h2>
        <p class="modal-msg">${message}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button class="btn btn-danger" id="modal-ok">${confirmLabel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const finish = (val) => { overlay.remove(); resolve(val); };
    overlay.querySelector('#modal-ok').addEventListener('click', () => finish(true));
    overlay.querySelector('#modal-cancel').addEventListener('click', () => finish(false));
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(false); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false); });
  });
}
