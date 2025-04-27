import puppeteer from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function launchBrowser() {
  // Soporte para producción en Vercel o en VPS (NODE_ENV=production)
  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    const executablePath = await chromium.executablePath();
    return puppeteerCore.launch({
      executablePath,
      args: chromium.args,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport
    });
  } else {
    return puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
}
