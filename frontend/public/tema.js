// Aplica el tema guardado (o el del sistema) antes de que React pinte la página, para que no
// parpadee en claro al abrir en modo oscuro. Es un archivo y no un script en línea porque la
// política de seguridad (CSP) del sitio solo permite scripts propios: script-src 'self'.
(function () {
  try {
    var guardado = localStorage.getItem('shopcart.tema');
    var oscuro =
      guardado === 'dark' ||
      ((!guardado || guardado === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (oscuro) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = oscuro ? 'dark' : 'light';
  } catch {
    // Sin acceso a localStorage: se queda en claro y React aplica el tema al cargar
  }
})();
