/* Optional progressive enhancement: all product collections remain visible without JavaScript. */
(() => {
  const cards = Array.from(document.querySelectorAll('.product-card[data-category]'));
  const buttons = Array.from(document.querySelectorAll('.filter-button[data-filter]'));
  const status = document.getElementById('filter-status');
  if (!cards.length || !buttons.length) return;

  document.documentElement.classList.add('has-js');

  const update = (value) => {
    let visible = 0;
    cards.forEach((card) => {
      const categories = (card.getAttribute('data-category') || '').split(/\s+/).filter(Boolean);
      const matches = value === 'all' || categories.includes(value);
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    buttons.forEach((button) => {
      const active = button.dataset.filter === value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (status) {
      status.textContent = `Showing ${visible} ${visible === 1 ? 'collection' : 'collections'}.`;
    }
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => update(button.dataset.filter || 'all'));
  });
  update('all');
})();
