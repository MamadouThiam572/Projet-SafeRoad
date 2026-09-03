// Pose la classe `.dark` sur <html> avant le premier rendu React (évite un flash du
// mauvais thème). Priorité : préférence explicite enregistrée > préférence système.
const THEME_STOCKE = localStorage.getItem('saferoad-theme')
const prefereSombre = THEME_STOCKE
  ? THEME_STOCKE === 'sombre'
  : window.matchMedia?.('(prefers-color-scheme: dark)').matches

document.documentElement.classList.toggle('dark', !!prefereSombre)
