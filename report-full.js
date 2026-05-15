/* Full report — copy-snippet buttons */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.full-copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const snippet = btn.parentElement.querySelector('.full-code code');
      if (!snippet) return;
      const text = snippet.innerText;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          const original = btn.textContent;
          btn.textContent = '✓ Copied';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove('copied');
          }, 1800);
        });
      }
    });
  });
});
