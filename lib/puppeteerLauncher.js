import puppeteer from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function launchBrowser() {
  // En producción (NODE_ENV o VERCEL_ENV), conecta a browserless si está configurado
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    let browserlessWSEndpoint = process.env.BROWSERLESS_WS_ENDPOINT || 'wss://news.academia-nova.com/';
    const browserlessToken = process.env.BROWSERLESS_TOKEN;
    if (browserlessToken) {
      // Añade el token como query param, respetando si ya hay otros parámetros
      browserlessWSEndpoint += browserlessWSEndpoint.includes('?')
        ? `&token=${browserlessToken}`
        : `?token=${browserlessToken}`;
    }
    try {
      return await puppeteerCore.connect({
        browserWSEndpoint: browserlessWSEndpoint,
        defaultViewport: chromium.defaultViewport
      });
    } catch (error) {
      console.error('No se pudo conectar a browserless:', error);
      // Si falla, continúa con el flujo normal
    }
  }

  // Fallback: intenta con Puppeteer default (descarga Chromium propio)
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
}
