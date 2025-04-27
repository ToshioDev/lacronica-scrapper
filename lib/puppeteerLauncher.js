import puppeteer from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function launchBrowser() {
  // Si está en Vercel o producción y existe @sparticuz/chromium, úsalo
  if ((process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') && process.env.CHROMIUM_USE_SYSTEM !== 'true') {
    try {
      const executablePath = await chromium.executablePath();
      if (executablePath && executablePath !== '/usr/bin/chromium-browser') {
        return puppeteerCore.launch({
          executablePath,
          args: chromium.args,
          headless: chromium.headless,
          defaultViewport: chromium.defaultViewport
        });
      }
    } catch {
      // Si falla, intenta con el chromium del sistema
      // (continúa abajo)
    }
  }

  // Si estás en un VPS o quieres forzar Chromium del sistema
  const systemPaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ];
  for (const path of systemPaths) {
    try {
      const { accessSync, constants } = await import('fs');
      accessSync(path, constants.X_OK);
      return puppeteer.launch({
        executablePath: path,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    } catch {
      // Continúa buscando otras rutas
    }
  }

  // Fallback: intenta con Puppeteer default (descarga Chromium propio)
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
}
