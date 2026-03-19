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

export function colorToHex(num) {
  return '#' + num.toString(16).padStart(6, '0');
}

export function hexToNum(hex) {
  return parseInt(hex.replace('#', ''), 16);
}
