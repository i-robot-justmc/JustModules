(function() {
  const savedTheme = localStorage.getItem('theme');
  const savedColor = localStorage.getItem('colorScheme') || 'purple';

  // Применяем тему
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
  }

  // Применяем цветовую схему
  if (savedColor !== 'purple') {
    document.body.classList.add('theme-' + savedColor);
  }
})();