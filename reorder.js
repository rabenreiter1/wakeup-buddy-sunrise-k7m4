// Pointer events support a mouse and touch screens without a drag-and-drop library.
// The persisted order changes on drop only; cancel leaves the model untouched.
export function attachReorder(root, { getSteps, setSteps, announce }) {
  let drag = null;
  const list = () => root.querySelector('.step-list');
  root.addEventListener('pointerdown', event => {
    const handle = event.target.closest('[data-drag]');
    if (!handle || handle.disabled || event.button !== 0 || drag) return;
    drag = { id: handle.dataset.drag, pointer: event.pointerId, startY: event.clientY, y: event.clientY, moved: false, handle, row: handle.closest('.step'), original: [...getSteps()] };
    handle.setPointerCapture(event.pointerId);
  });
  function position() {
    if (!drag?.moved) return;
    drag.ghost.style.top = `${drag.y - 24}px`;
    const rows = [...list().children].filter(row => row !== drag.row);
    const index = rows.findIndex(row => { const r = row.getBoundingClientRect(); return drag.y < r.top + r.height / 2; });
    drag.targetIndex = index < 0 ? rows.length : index;
    list().querySelectorAll('.drop-before,.drop-after').forEach(row => row.classList.remove('drop-before','drop-after'));
    if (rows[index]) rows[index].classList.add('drop-before');
    else rows.at(-1)?.classList.add('drop-after');
  }
  function autoScroll() {
    if (!drag?.moved) return;
    const navBottom = root.querySelector('.fixed-nav').getBoundingClientRect().bottom;
    if (drag.y < navBottom + 35) window.scrollBy(0, -9);
    else if (drag.y > innerHeight - 65) window.scrollBy(0, 9);
    position();
    drag.frame = requestAnimationFrame(autoScroll);
  }
  document.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    drag.y = event.clientY;
    if (!drag.moved && Math.abs(drag.y - drag.startY) < 6) return;
    event.preventDefault();
    if (!drag.moved) {
      drag.moved = true;
      list().classList.add('sorting'); drag.row.classList.add('drag-source');
      drag.ghost = document.createElement('div'); drag.ghost.className = 'drag-ghost';
      drag.ghost.textContent = getSteps().find(s => s.id === drag.id)?.message?.text || getSteps().find(s => s.id === drag.id)?.title || 'Schritt';
      const rect = list().getBoundingClientRect();
      drag.ghost.style.left = `${rect.left}px`; drag.ghost.style.width = `${rect.width}px`;
      document.body.append(drag.ghost); autoScroll();
    }
    position();
  }, { passive: false });
  function finish(cancel = false) {
    if (!drag) return;
    const current = drag; drag = null;
    cancelAnimationFrame(current.frame); current.ghost?.remove();
    if (current.handle.hasPointerCapture(current.pointer)) current.handle.releasePointerCapture(current.pointer);
    if (current.moved) {
      const steps = [...current.original];
      if (!cancel) { const from = steps.findIndex(step => step.id === current.id); const [moved] = steps.splice(from,1); steps.splice(current.targetIndex ?? from,0,moved); }
      setSteps(steps);
      root.querySelector(`[data-drag="${current.id}"]`)?.focus({ preventScroll: true });
      announce(cancel ? 'Verschieben abgebrochen.' : `Schritt an Position ${steps.findIndex(s => s.id === current.id) + 1}.`);
    }
  }
  document.addEventListener('pointerup', event => { if (drag?.pointer === event.pointerId) finish(); });
  document.addEventListener('pointercancel', () => finish(true));
  window.addEventListener('blur', () => finish(true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drag) { event.preventDefault(); finish(true); return; }
    const handle = event.target.closest('[data-drag]');
    if (!handle || !root.contains(handle) || handle.disabled || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const steps = [...getSteps()];
    const from = steps.findIndex(s => s.id === handle.dataset.drag);
    const to = from + (event.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= steps.length) return;
    [steps[from], steps[to]] = [steps[to], steps[from]];
    setSteps(steps); root.querySelector(`[data-drag="${handle.dataset.drag}"]`).focus({ preventScroll: true });
    announce(`Schritt an Position ${to + 1}.`);
  });
}
