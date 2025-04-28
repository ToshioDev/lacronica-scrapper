import { launchBrowser } from './puppeteerLauncher';
import { readFileSync, writeFileSync } from 'fs';

export async function scrapeBBC() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto('https://www.bbc.com/news', { waitUntil: 'domcontentloaded' });
  const news = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a.gs-c-promo-heading')).slice(0, 5).map(el => ({
      id: 'bbc',
      title: el.textContent?.trim() || '',
      url: el instanceof HTMLAnchorElement ? el.href : '',
      source: 'BBC News',
    }));
  });
  await browser.close();
  return news;
}

export async function scrapeElPais() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto('https://elpais.com/', { waitUntil: 'domcontentloaded' });
  const news = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h2.c_t')).slice(0, 5).map(el => {
      const a = el.querySelector('a');
      return {
        id: 'elpais',
        title: el.textContent?.trim() || '',
        url: a instanceof HTMLAnchorElement ? a.href : '',
        source: 'El País',
      };
    });
  });
  await browser.close();
  return news;
}

export async function scrapeLeMonde() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto('https://www.lemonde.fr/', { waitUntil: 'domcontentloaded' });
  const news = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('section.article__wrapper h3.article__title a')).slice(0, 5).map(el => ({
      id: 'lemonde',
      title: el.textContent?.trim() || '',
      url: el instanceof HTMLAnchorElement ? el.href : '',
      source: 'Le Monde',
    }));
  });
  await browser.close();
  return news;
}

export async function scrapeElPeruano() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto('https://elperuano.pe/', { waitUntil: 'domcontentloaded' });
  const news = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a'));
    const items = anchors.filter(a => {
      const href = a.getAttribute('href') || '';
      return (
        a.textContent && a.textContent.trim().length > 30 &&
        href.startsWith('/noticia/')
      );
    }).slice(0, 5).map(a => ({
      id: 'elperuano',
      title: a.textContent?.trim() || '',
      url: a instanceof HTMLAnchorElement ? ('https://elperuano.pe' + a.getAttribute('href')) : '',
      source: 'El Peruano',
    }));
    return items;
  });
  await browser.close();
  return news;
}

export async function scrapeElPeruanoCategorias() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto('https://elperuano.pe/', { waitUntil: 'domcontentloaded' });
  const categorias = await page.evaluate(() => {
    const base = 'https://elperuano.pe';
    const ul = document.querySelector('ul.hide-on-med-and-down.inlineblock');
    if (!ul) return [];
    const categorias = [];
    ul.querySelectorAll(':scope > li').forEach(li => {
      const a = li.querySelector(':scope > a');
      if (!a) return;
      const name = a.textContent?.trim() || '';
      let url = a.getAttribute('href') || '';
      if (url.startsWith('http') && !url.includes('elperuano.pe')) return;
      if (url.startsWith('http') && url.includes('elperuano.pe')) url = url;
      else if (url.startsWith('/')) url = base + url;
      else url = base + '/' + url;
      const subUl = li.querySelector('ul.dropdown-content');
      let subcategories;
      if (subUl) {
        subcategories = Array.from(subUl.querySelectorAll('li > a')).map(subA => {
          let subUrl = subA.getAttribute('href') || '';
          if (subUrl.startsWith('http') && !subUrl.includes('elperuano.pe')) return null;
          if (subUrl.startsWith('http') && subUrl.includes('elperuano.pe')) subUrl = subUrl;
          else if (subUrl.startsWith('/')) subUrl = base + subUrl;
          else subUrl = base + '/' + subUrl;
          return { name: subA.textContent?.trim() || '', url: subUrl };
        }).filter(Boolean);
      }
      categorias.push({ name, url, subcategories });
    });
    return categorias.filter(cat => cat.name && cat.url);
  });
  await browser.close();
  return categorias;
}

export async function scrapeElPeruanoNoticiasDeSeccion(url, limit = 20) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Scroll para cargar más noticias (infinite scroll) hasta alcanzar el límite o no encontrar más
  let articlesCount = 0;
  let prevCount = 0;
  let scrollAttempts = 0;
  const maxScrollAttempts = 10; // Límite para evitar bucles infinitos

  while (articlesCount < limit && scrollAttempts < maxScrollAttempts) {
    prevCount = await page.evaluate(() => {
      const section = document.querySelector('#notasseccion');
      if (!section) return 0;
      return Array.from(section.querySelectorAll('article')).filter(article => !article.querySelector('.skeleton-nota')).length;
    });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // Espera un poco más para dar tiempo a que carguen los nuevos elementos
    await new Promise(res => setTimeout(res, 750));

    articlesCount = await page.evaluate(() => {
      const section = document.querySelector('#notasseccion');
      if (!section) return 0;
      return Array.from(section.querySelectorAll('article')).filter(article => !article.querySelector('.skeleton-nota')).length;
    });

    if (articlesCount === prevCount) {
      // No se cargaron más noticias, detener el scroll
      break;
    }
    scrollAttempts++;
  }

  // Extrae las noticias después del scroll
  const news = (await page.evaluate((url, limit) => {
    const base = 'https://elperuano.pe';
    const section = document.querySelector('#notasseccion');
    if (!section) {
      return [{
        id: 'elperuano',
        title: '',
        url,
        source: 'El Peruano', // Corregido
        summary: 'No se encontró el contenedor #notasseccion en esta URL',
        img: '',
        date: ''
      }];
    }
    const articles = Array.from(section.querySelectorAll('article')).filter(article => !article.querySelector('.skeleton-nota'));
    if (articles.length === 0) {
      return [{
        id: 'elperuano',
        title: '',
        url,
        source: 'El Peruano', // Corregido
        summary: 'No se encontraron artículos válidos en #notasseccion',
        img: '',
        date: ''
      }];
    }
    return articles.slice(0, limit).map(article => {
      const img = article.querySelector('.card-images img')?.getAttribute('src') || '';
      const titleAnchor = article.querySelector('.card-title2 .titular');
      const urlRel = titleAnchor?.getAttribute('href') || '';
      const newsUrl = urlRel.startsWith('http') ? urlRel : (base + (urlRel.startsWith('/') ? urlRel : '/' + urlRel));
      const title = titleAnchor?.textContent?.trim() || '';
      const bajadaAnchor = article.querySelector('.bajada');
      const summary = bajadaAnchor?.textContent?.trim() || '';
      const date = article.querySelector('.card-title3')?.textContent?.trim() || '';
      return {
        id: 'elperuano',
        title,
        url: newsUrl,
        source: 'El Peruano', // Corregido
        summary,
        img,
        date
      };
    });
  }, url, limit));
  await page.close();

  // Obtener detalles de cada noticia (título, subtítulo, contenido) usando el mismo browser y páginas independientes
  const results = [];
  for (const item of news) {
    if (!item.url) {
      results.push(item);
      continue;
    }
    let detalle = { titulo: '', subtitulo: '', contenido: '' };
    try {
      const pageDetalle = await browser.newPage();
      await pageDetalle.goto(item.url, { waitUntil: 'domcontentloaded' });
      await pageDetalle.waitForFunction(() => !document.querySelector('.skeleton-nota'), { timeout: 8000 }).catch(() => { });
      detalle = await pageDetalle.evaluate(() => {
        const titulo = document.querySelector('main#portada h1')?.textContent?.trim() || '';
        const contenido = (document.querySelector('#contenido'))?.innerText?.trim() || '';
        // Remove all dates in dd/mm/yyyy format
        const contenidoSinFechas = contenido.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '');
        // Extract subtitulo: up to first comma or period
        const match = contenidoSinFechas.match(/^(.*?[,.])/);
        const subtituloExtraido = match ? match[1].trim() : contenidoSinFechas.split(/\n/)[0].trim(); // fallback: first line
        // Format as left-justified HTML (convert newlines to <br> and wrap in a <div style="text-align:left">)
        const contenidoHTML = `<div style=\"text-align:left\">${contenidoSinFechas.replace(/\n/g, '<br>')}</div>`;
        return { titulo, subtitulo: subtituloExtraido, contenido: contenidoHTML };
      });
      await pageDetalle.close();
    } catch {
      // Si falla, deja los campos de detalle vacíos
    }
    results.push({
      ...item,
      titulo_detalle: detalle.titulo,
      subtitulo: detalle.subtitulo,
      contenido: detalle.contenido,
      date: formatDateToIsoPeru(item.date)
    });
  }
  await browser.close();
  return results;
}

export async function scrapeDeporCategoriaCompleto(url, limit = 20) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.stories-news__list .story-item', { timeout: 10000 });
  const items = await page.evaluate((base, limit) => {
    const nodes = Array.from(document.querySelectorAll('.stories-news__list .story-item')).slice(0, limit);
    return nodes.map(item => {
      let title = '';
      let url = '';
      let img = '';
      let subtitle = '';
      let section = '';
      let date = '';
      const titleA = item.querySelector('a.story-item__title');
      if (titleA) {
        title = titleA.textContent?.trim() || '';
        url = titleA.getAttribute('href') || '';
        if (url && !url.startsWith('http')) url = base + url;
      }
      const imgEl = item.querySelector('img.story-item__img');
      if (imgEl) img = imgEl.getAttribute('src') || '';
      const subtitleP = item.querySelector('p.story-item__subtitle');
      if (subtitleP) subtitle = subtitleP.textContent?.trim() || '';
      const sectionA = item.querySelector('a.story-item__section');
      if (sectionA) section = sectionA.textContent?.trim() || '';
      const dateP = item.querySelector('p.story-item__date');
      if (dateP) date = dateP.textContent?.trim() || '';
      return {
        id: 'depor',
        title,
        subtitle,
        url,
        source: 'Depor',
        section,
        img,
        date
      };
    });
  }, 'https://depor.com', limit);

  // Procesar detalles en paralelo (sin cache)
  const results = [];
  for (const item of items) {
    if (!item.url) continue;
    let detail = { section: '', title: '', subtitle: '', date: '', img: '', content: '' };
    const detailPage = await browser.newPage();
    try {
      await detailPage.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await detailPage.waitForSelector('.sht__title', { timeout: 5000 });
      detail = await detailPage.evaluate(() => {
        const section = document.querySelector('.sht__category a')?.textContent?.trim() || '';
        const title = document.querySelector('.sht__title')?.textContent?.trim() || '';
        const subtitle = document.querySelector('.sht__summary')?.textContent?.trim() || '';
        const date = document.querySelector('.story-contents__author-date time')?.getAttribute('datetime') ||
          document.querySelector('.story-contents__author-date time')?.textContent?.trim() || '';
        const img = document.querySelector('.s-multimedia picture img')?.getAttribute('src') || '';
        const contentDiv = document.querySelector('#contenedor');
        let content = '';
        if (contentDiv) {
          const paragraphs = Array.from(contentDiv.querySelectorAll('p.story-contents__font-paragraph'));
          content = paragraphs.map(p => p.textContent?.trim() || '').filter(Boolean).join('\n\n');
        }
        if (!content || content.trim() === '') {
          const liveBlocks = Array.from(document.querySelectorAll('.live-event2-comment.score'));
          const liveTexts = liveBlocks.map(block => {
            return Array.from(block.querySelectorAll('p')).map(p => p.textContent?.trim() || '').filter(Boolean).join(' ');
          }).filter(Boolean);
          content = liveTexts.join('\n\n');
        }
        return { section, title, subtitle, date, img, content };
      });
      await detailPage.close();
      // Lógica para subtitulo: si no hay, usar summary o el resumen hasta la primera coma
      const subtituloFinal = detail.subtitle || item.subtitle || '';
      if (!subtituloFinal) {
        let resumenFuente = detail.summary || item.summary || '';
        if (resumenFuente.includes(',')) {
          subtituloFinal = resumenFuente.split(',')[0].trim();
        } else {
          subtituloFinal = resumenFuente;
        }
      }
      results.push({
        id: 'depor',
        title: detail.title || item.title || '',
        subtitle: subtituloFinal,
        url: item.url,
        source: 'Depor',
        section: detail.section || item.section || '',
        img: detail.img || item.img || '',
        date: detail.date || item.date || '',
        content: detail.content || ''
      });
    } catch {
      await detailPage.close();
      results.push({
        ...item,
        content: ''
      });
    }
  }
  await browser.close();
  return results;
}

async function scrapeJornadaCategorias() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  const categorias = await scrapeJornadaCategoriasInner(page);
  await browser.close();
  return categorias;
}

async function scrapeJornadaCategoriasInner(page) {
  await page.goto('https://jornada.com.pe/', { waitUntil: 'domcontentloaded' });
  const categorias = await page.evaluate(() => {
    const result = [];
    const menu = document.querySelector('ul#menu-menu-principal-3');
    if (!menu) return result;
    const links = menu.querySelectorAll('li > a');
    links.forEach(a => {
      const name = a.textContent?.trim() || '';
      let url = a.getAttribute('href') || '';
      if (name && url) {
        result.push({ name, url });
      }
    });
    return result;
  });
  return categorias;
}

async function scrapeJornadaCategoria(page, url, limit = 20) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const articles = await page.evaluate((limit) => {
    const result = [];
    const blocks = Array.from(document.querySelectorAll('.tdb_module_loop.td_module_wrap')).slice(0, limit);
    blocks.forEach(block => {
      const a = block.querySelector('.td-module-title a');
      const imgEl = block.querySelector('.td-module-thumb .entry-thumb');
      const dateEl = block.querySelector('.td-post-date time');
      const summaryEl = block.querySelector('.td-excerpt');
      const title = a?.textContent?.trim() || '';
      const url = a?.getAttribute('href') || '';
      const img = imgEl?.getAttribute('data-img-url') || '';
      const date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';
      const summary = summaryEl?.textContent?.trim() || '';
      result.push({ title, url, img, date, summary });
    });
    return result;
  }, limit);

  // Extraer detalles de cada noticia (contenido) en paralelo
  const news = [];
  const detailPromises = articles.map(async (art) => {
    const detailPage = await page.browser().newPage();
    try {
      const detail = await scrapeJornadaDetalle(detailPage, art.url);
      // Genera el summary como extracto reducido del contenido
      const resumen = detail.content ? (detail.content.length > 180 ? detail.content.slice(0, 180) + '...' : detail.content) : '';
      news.push({
        id: '', // será asignado en el controlador
        title: detail.titulo || art.title,
        url: art.url,
        source: 'Jornada',
        summary: resumen,
        img: art.img,
        date: detail.date || art.date || '',
        titulo_detalle: detail.titulo || art.title || '',
        subtitulo: detail.subtitulo || art.summary || '',
        contenido: detail.content
      });
    } catch {
      news.push({
        id: '', // será asignado en el controlador
        title: art.title,
        url: art.url,
        source: 'Jornada',
        summary: '',
        img: art.img,
        date: art.date || '',
        titulo_detalle: '',
        subtitulo: art.summary || '',
        contenido: ''
      });
    } finally {
      await detailPage.close();
    }
  });
  await Promise.all(detailPromises);
  return news;
}

async function scrapeJornadaCategoriaSimple(url, limit = 20) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    // Extrae artículos principales
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const articles = await page.evaluate((limit) => {
      const result = [];
      const blocks = Array.from(document.querySelectorAll('.tdb_module_loop.td_module_wrap')).slice(0, limit);
      blocks.forEach(block => {
        const a = block.querySelector('.td-module-title a');
        const imgEl = block.querySelector('.td-module-thumb .entry-thumb');
        const dateEl = block.querySelector('.td-post-date time');
        const summaryEl = block.querySelector('.td-excerpt');
        result.push({
          title: a?.textContent?.trim() || '',
          url: a?.href || '',
          img: imgEl?.getAttribute('data-img-url') || imgEl?.src || '',
          date: dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '',
          summary: summaryEl?.textContent?.trim() || ''
        });
      });
      return result;
    }, limit);

    // Concurrencia dinámica según limit (máx 5)
    const concurrency = Math.min(5, Math.max(1, Math.floor(limit / 4) || 1));
    let idx = 0;
    const news = [];
    async function processBatch(batch) {
      const batchResults = await Promise.all(batch.map(async art => {
        if (!art.url) return null;
        let detail = { titulo: '', contenido: '' };
        const detailPage = await browser.newPage();
        try {
          await detailPage.goto(art.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          detail = await detailPage.evaluate(() => {
            const titulo = document.querySelector('h1.tdb-title-text')?.textContent?.trim() || '';
            let contenido = '';
            const contentBlock = document.querySelector('.tdb_single_content .tdb-block-inner');
            if (contentBlock) {
              const ps = Array.from(contentBlock.querySelectorAll('p, ul, ol, li'));
              contenido = ps.map(p => p.textContent?.trim()).join('\n');
            }
            // Remove all dates in dd/mm/yyyy format
            const contenidoSinFechas = contenido.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '');
            // Extract subtitulo: up to first comma or period
            const match = contenidoSinFechas.match(/^(.*?[,.])/);
            const subtituloExtraido = match ? match[1].trim() : contenidoSinFechas.split(/\n/)[0].trim(); // fallback: first line
            // Format as left-justified HTML (convert newlines to <br> and wrap in a <div style="text-align:left">)
            const contenidoHTML = `<div style=\"text-align:left\">${contenidoSinFechas.replace(/\n/g, '<br>')}</div>`;
            return { titulo, contenido: contenidoHTML, subtitulo: subtituloExtraido };
          });
        } catch {
          // Si falla, deja los campos de detalle vacíos
        } finally {
          await detailPage.close();
        }
        return {
          ...art,
          titulo_detalle: detail.titulo || art.title || '',
          subtitulo: detail.subtitulo || art.summary || '',
          contenido: detail.contenido
        };
      }));
      for (const r of batchResults) {
        if (r) news.push(r);
      }
    }
    while (idx < articles.length) {
      const batch = articles.slice(idx, idx + concurrency);
      await processBatch(batch);
      idx += concurrency;
    }
    await browser.close();
    return news;
  } catch {
    await browser.close();
    return [];
  }
}

async function scrapeJornadaDetalle(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Extraer título
  const titulo = await page.evaluate(() => {
    const tituloEl = document.querySelector('h1.tdb-title-text');
    return tituloEl?.textContent?.trim() || '';
  });
  // Extraer contenido principal
  const content = await page.evaluate(() => {
    const contentBlock = document.querySelector('.tdb_single_content .tdb-block-inner');
    if (!contentBlock) return '';
    // Elimina el <p> de redes sociales si existe
    const ps = contentBlock.querySelectorAll('p');
    ps.forEach(p => {
      if (p.textContent && p.textContent.includes('Búscanos en')) {
        p.remove();
      }
    });
    let text = '';
    contentBlock.querySelectorAll('p, ul, ol, li').forEach(el => {
      text += el.textContent?.trim() + '\n';
    });
    return text.trim();
  });
  // Extraer fecha si existe
  const date = await page.evaluate(() => {
    const dateEl = document.querySelector('.td-single-date, .tdb_single_date time, time.td-module-date');
    return dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';
  });
  // Remove all dates in dd/mm/yyyy format
  const contenidoSinFechas = content.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '');
  // Extract subtitulo: up to first comma or period
  const match = contenidoSinFechas.match(/^(.*?[,.])/);
  const subtituloExtraido = match ? match[1].trim() : contenidoSinFechas.split(/\n/)[0].trim(); // fallback: first line
  // Format as left-justified HTML (convert newlines to <br> and wrap in a <div style="text-align:left">)
  const contenidoHTML = `<div style=\"text-align:left\">${contenidoSinFechas.replace(/\n/g, '<br>')}</div>`;
  return { content: contenidoHTML, date, titulo, subtitulo: subtituloExtraido };
}

async function scrapeJornadaDetalleSimple(url) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    const result = await scrapeJornadaDetalle(page, url);
    await browser.close();
    return result;
  } catch {
    await browser.close();
    return [];
  }
}

// Agrega Jornada al flujo principal de scraping optimizado: concurrencia máxima en categorías y detalles, máximo 10 noticias
async function scrapeJornada() {
  const browser = await launchBrowser();
  const mainPage = await browser.newPage();
  // Opcional: prioriza categorías más relevantes si lo sabes
  let categorias = await scrapeJornadaCategoriasInner(mainPage);
  // Ejemplo: prioriza "Actualidad" y "Política" si existen
  const prioridad = ["Actualidad", "Política", "Economía", "Mundo"];
  categorias = categorias.sort((a, b) => {
    const ia = prioridad.indexOf(a.name);
    const ib = prioridad.indexOf(b.name);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  // Filtra categorías válidas
  const categoriasValidas = categorias.filter(cat => !["PORTADA", "EDICIONES"].includes(cat.name.toUpperCase()));

  // 1. Obtén artículos de todas las categorías (concurrencia)
  const catConcurrency = 8; // Número de tabs en paralelo para categorías
  const catPages = [];
  for (let i = 0; i < catConcurrency; i++) {
    catPages.push(await browser.newPage());
  }
  let allArticles = [];
  await Promise.all(categoriasValidas.map((cat, idx) => (async () => {
    if (allArticles.length >= 10) return; // Early exit si ya tenemos suficientes
    const myPage = catPages[idx % catConcurrency];
    await myPage.goto(cat.url, { waitUntil: 'domcontentloaded' });
    const articles = await myPage.evaluate(() => {
      const result = [];
      document.querySelectorAll('.tdb_module_loop.td_module_wrap').forEach(block => {
        const a = block.querySelector('.td-module-title a');
        const imgEl = block.querySelector('.td-module-thumb .entry-thumb');
        const dateEl = block.querySelector('.td-post-date time');
        const summaryEl = block.querySelector('.td-excerpt');
        const title = a?.textContent?.trim() || '';
        const url = a?.getAttribute('href') || '';
        const img = imgEl?.getAttribute('data-img-url') || '';
        const date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';
        const summary = summaryEl?.textContent?.trim() || '';
        if (title && url) {
          result.push({ title, url, img, date, summary });
        }
      });
      return result;
    });
    // Usa lock para evitar condición de carrera
    if (allArticles.length < 10) {
      for (const a of articles) {
        if (allArticles.length < 10) {
          allArticles.push({ ...a, section: cat.name });
        } else {
          break;
        }
      }
    }
  })()));

  // Cierra páginas de categorías
  for (const p of catPages) await p.close();

  // Limita a solo 10 noticias
  const topArticles = allArticles.slice(0, 10);

  // 2. Scraping paralelo real de detalles usando varias páginas (pool de 16 tabs)
  const concurrency = 16; // Número de tabs en paralelo para detalles
  const pages = [];
  for (let i = 0; i < concurrency; i++) {
    pages.push(await browser.newPage());
  }

  const news = [];
  await Promise.all(topArticles.map((art, idx) => (async () => {
    const myPage = pages[idx % concurrency];
    try {
      await myPage.goto(art.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      // Extraer detalles
      const [titulo, content, date] = await Promise.all([
        myPage.evaluate(() => document.querySelector('h1.tdb-title-text')?.textContent?.trim() || ''),
        myPage.evaluate(() => {
          const contentBlock = document.querySelector('.tdb_single_content .tdb-block-inner');
          if (!contentBlock) return '';
          // Elimina el <p> de redes sociales si existe
          const ps = contentBlock.querySelectorAll('p');
          ps.forEach(p => {
            if (p.textContent && p.textContent.includes('Búscanos en')) {
              p.remove();
            }
          });
          let text = '';
          contentBlock.querySelectorAll('p, ul, ol, li').forEach(el => {
            text += el.textContent?.trim() + '\n';
          });
          return text.trim();
        }),
        myPage.evaluate(() => {
          const dateEl = document.querySelector('.td-single-date, .tdb_single_date time, time.td-module-date');
          return dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';
        })
      ]);
      // Extract subtitle from content
      const contenidoSinFechas = content.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '');
      const match = contenidoSinFechas.match(/^(.*?[,.])/);
      const subtituloExtraido = match ? match[1].trim() : contenidoSinFechas.split(/\n/)[0].trim();
      // Format as left-justified HTML
      const contenidoHTML = `<div style=\"text-align:left\">${contenidoSinFechas.replace(/\n/g, '<br>')}</div>`;
      // Genera el summary como extracto reducido del contenido
      const resumen = contenidoHTML ? (contenidoHTML.length > 180 ? contenidoHTML.slice(0, 180) + '...' : contenidoHTML) : '';
      news.push({
        id: '', // será reemplazado por el id numérico en el controlador
        title: titulo || art.title,
        url: art.url,
        source: 'Jornada',
        summary: resumen,
        img: art.img,
        date: formatDateToIsoPeru(date || art.date || ''),
        titulo_detalle: titulo || art.title || '',
        subtitulo: subtituloExtraido || art.summary || '',
        contenido: contenidoHTML
      });
    } catch {
      news.push({
        id: '', // será reemplazado por el id numérico en el controlador
        title: art.title,
        url: art.url,
        source: 'Jornada',
        summary: '',
        img: art.img,
        date: formatDateToIsoPeru(art.date || ''),
        titulo_detalle: '',
        subtitulo: art.summary || '',
        contenido: ''
      });
    }
  })()));

  // Cierra las páginas extra
  for (const p of pages) await p.close();
  await browser.close();
  // Refuerza el límite: solo devuelve 10 noticias máximo
  return news.slice(0, 10);
}

async function readCache(file) {
  try {
    const data = readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeCache(file, data) {
  writeFileSync(file, JSON.stringify(data));
}

function formatDateToIsoPeru(dateStr) {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (match) {
    const [, dd, mm, yyyy, hh, min] = match;
    const fecha = `${yyyy}-${mm}-${dd}T${hh || '00'}:${min || '00'}:00-05:00`;
    return fecha;
  }
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateStr)) {
    return dateStr.replace(/([+-]\d{2}:\d{2}|Z)$/, '-05:00');
  }
  return dateStr;
}

// Exportaciones finales
export {
  readCache,
  writeCache,
  formatDateToIsoPeru,
  scrapeJornadaCategorias,
  scrapeJornadaCategoria,
  scrapeJornadaCategoriaSimple,
  scrapeJornadaDetalle,
  scrapeJornadaDetalleSimple,
  scrapeJornada,
};
