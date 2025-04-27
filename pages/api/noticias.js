import {
  scrapeElPeruanoCategorias,
  scrapeDeporCategoriaCompleto,
  scrapeElPeruanoNoticiasDeSeccion,
  scrapeJornada,
  scrapeJornadaCategoriaSimple,
  scrapeJornadaCategorias
} from '../../lib/newsScrapers';
import { launchBrowser } from '../../lib/puppeteerLauncher';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function formatPing(ms) {
  return ms > 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { type, site, categoria, limit } = req.query;
    const t0 = Date.now();
    try {
      if (type === 'categorias') {
        let categorias = [];
        if (site === 'elperuano') {
          const rawCategorias = await scrapeElPeruanoCategorias();
          categorias = rawCategorias.map((c, idx) => ({ ...c, id: idx + 1 }));
          const t1 = Date.now();
          return res.status(200).json({ status: 'ok', ping: formatPing(t1 - t0), data: categorias });
        }
        if (site === 'jornada') {
          // Optimiza el tiempo de respuesta usando cache temporal en memoria (5 minutos)
          if (!global._jornadaCategoriasCache) global._jornadaCategoriasCache = { data: null, timestamp: 0 };
          const now = Date.now();
          const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
          if (global._jornadaCategoriasCache.data && (now - global._jornadaCategoriasCache.timestamp < CACHE_DURATION)) {
            categorias = global._jornadaCategoriasCache.data;
          } else {
            const rawCategorias = await scrapeJornadaCategorias();
            categorias = rawCategorias.map((c, idx) => ({ ...c, id: idx + 1 }));
            global._jornadaCategoriasCache = { data: categorias, timestamp: now };
          }
          const t1 = Date.now();
          return res.status(200).json({ status: 'ok', ping: formatPing(t1 - t0), data: categorias });
        }
        return res.status(400).json({ status: 'error', ping: formatPing(0), data: [], message: 'Sitio no soportado' });
      }
      if (type === 'noticias') {
        let noticias = [];
        if (site === 'eldepor') {
          let url = '';
          if (categoria === 'peruano') {
            url = 'https://depor.com/futbol-peruano/';
          } else if (categoria === 'internacional') {
            url = 'https://depor.com/futbol-internacional/';
          } else {
            return res.status(400).json({ status: 'error', ping: formatPing(0), data: [], message: 'Categoría no soportada para eldepor' });
          }
          const lim = limit ? Math.max(1, Math.min(Number(limit), 50)) : 20;
          const rawNoticias = await scrapeDeporCategoriaCompleto(url, lim);
          noticias = rawNoticias.map((n, idx) => ({ ...n, id: idx + 1 }));
          const t1 = Date.now();
          return res.status(200).json({ status: 'ok', ping: formatPing(t1 - t0), data: noticias });
        }
        if (site === 'elperuano') {
          let url = categoria;
          if (!url) {
            return res.status(400).json({ status: 'error', ping: formatPing(0), data: [], message: 'Debes proporcionar la categoría o URL de sección para elperuano' });
          }
          if (!url.startsWith('https://elperuano.pe/')) {
            url = `https://elperuano.pe/${url}`;
          }
          const lim = limit ? Math.max(1, Math.min(Number(limit), 50)) : 20;
          const rawNoticias = await scrapeElPeruanoNoticiasDeSeccion(url, lim);
          noticias = rawNoticias.map((n, idx) => ({ ...n, id: idx + 1 }));
          const t1 = Date.now();
          return res.status(200).json({ status: 'ok', ping: formatPing(t1 - t0), data: noticias });
        }
        if (site === 'jornada') {
          if (categoria) {
            let catUrl = categoria;
            if (!/^https?:\/\//.test(catUrl)) {
              catUrl = `https://jornada.com.pe/${catUrl.replace(/^\/+/, '')}/`;
            }
            const lim = limit ? Math.max(1, Math.min(Number(limit), 50)) : 20;
            const rawNoticias = await scrapeJornadaCategoriaSimple(catUrl, lim);
            noticias = rawNoticias.map((n, idx) => ({ ...n, id: idx + 1 }));
            const t1 = Date.now();
            return res.status(200).json({ status: 'ok', ping: formatPing(t1 - t0), data: noticias });
          }
          const rawNoticias = await scrapeJornada();
          noticias = rawNoticias.map((n, idx) => ({ ...n, id: idx + 1 }));
          const t1 = Date.now();
          return res.status(200).json({ status: 'ok', ping: formatPing(t1 - t0), data: noticias });
        }
        return res.status(400).json({ status: 'error', ping: formatPing(0), data: [], message: 'Sitio no soportado' });
      }
      // Si no es type esperado
      return res.status(400).json({ status: 'error', ping: formatPing(0), data: [], message: 'Tipo no soportado' });
    } catch (err) {
      return res.status(500).json({ status: 'error', ping: formatPing(0), data: [], message: err.message });
    }
  }

  // POST y otros métodos quedan igual (scrapper de Twitter)
  if (req.method === 'POST') {
    try {
      const { xUrl, width, theme, padding, hideCard, hideThread } = req.body;
      const lang = 'en';
      const splitUrl = xUrl.split('/');
      const lastItem = splitUrl[splitUrl.length - 1];
      const splitLastItem = lastItem.split('?');
      const xPostId = splitLastItem[0];

      const browser = await launchBrowser();
      const page = await browser.newPage();
      await page.goto(`https://platform.twitter.com/embed/index.html?dnt=true&embedId=twitter-widget-0&frame=false&hideCard=${hideCard}&hideThread=${hideThread}&id=${xPostId}&lang=${lang}&theme=${theme}&widgetsVersion=ed20a2b%3A1601588405575`, { waitUntil: 'networkidle2' });

      const embedDefaultWidth = 550;
      const percent = width / embedDefaultWidth;
      const pageWidth = embedDefaultWidth * percent;
      const pageHeight = 100;
      await page.setViewport({ width: pageWidth, height: pageHeight });

      await page.evaluate(
        (props) => {
          const { theme, padding, percent } = props;
          const style = document.createElement('style');
          style.innerHTML = "* { font-family: -apple-system, BlinkMacSystemFont, Ubuntu, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol' !important; }";
          document.getElementsByTagName('head')[0].appendChild(style);
          const body = document.querySelector('body');
          if (body) {
            body.style.padding = `${padding}px`;
            body.style.backgroundColor = theme === 'dark' ? '#000' : '#fff';
            body.style.zoom = `${100 * percent}%`;
          }
        },
        { theme, padding, percent }
      );

      const imageBuffer = await page.screenshot({
        type: 'png',
        fullPage: true,
        encoding: 'base64'
      });

      if (process.env.VERCEL_ENV !== 'production') {
        await browser.close();
      }

      res.status(200).json({ data: imageBuffer });
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
}
