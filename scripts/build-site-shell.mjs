import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// This is a static rendering step. Published pages need no template fetch or
// client-side shell mount; application startup can query its controls directly.
const root = fileURLToPath(new URL('../', import.meta.url));
const webRoot = path.join(root, 'apps/web');
const publicRoot = path.join(webRoot, 'public');
const partialRoot = path.join(webRoot, 'legacy/site');
const version = 299;
const pages = [
  { file: 'instrument.html', type: 'instrument', active: 'instrument', volume: true, footer: true, styles: ['style.css', 'vendor/ui/upic-ui.css?v=97', 'ui-controls.css', 'transport-indicator.css?v=256', 'envion-view.css?v=256'] },
  { file: 'about.html', type: 'public', active: 'about', volume: true, footer: true, styles: ['style.css', 'ui-controls.css', 'about.css'] },
  { file: 'upic/marketplace/index.html', type: 'public', active: 'marketplace', volume: true, footer: true, styles: ['style.css', 'vendor/ui/upic-ui.css?v=97', 'ui-controls.css', 'marketplace.css'] },
  { file: 'credits.html', type: 'technology', volume: true, footer: true, styles: ['style.css', 'ui-controls.css'] },
  { file: 'visual-lab.html', type: 'lab', styles: ['visual-lab.css'] },
  { file: 'audio-lab.html', type: 'lab', styles: ['visual-lab.css', 'audio-lab.css'] },
  { file: 'av-lab.html', type: 'lab', styles: ['visual-lab.css', 'audio-lab.css', 'av-lab.css'] },
  { file: 'mapping-lab.html', type: 'lab', styles: ['mapping-lab.css'] },
];

const partials = Object.fromEntries(await Promise.all(
  ['header', 'footer', 'volume', 'home-trending', 'intro'].map(async name => [name, (await readFile(path.join(partialRoot, name + '.html'), 'utf8')).trim()]),
));
const pageEntryScript = (await readFile(path.join(partialRoot, 'page-entry.js'), 'utf8')).trim();
function region(name, content) {
  return `<!-- site-shell:${name}:start -->\n${content}\n<!-- site-shell:${name}:end -->`;
}
function replaceRegion(html, name, content, legacy) {
  const marked = new RegExp(`<!-- site-shell:${name}:start -->[\\s\\S]*?<!-- site-shell:${name}:end -->`);
  if (marked.test(html)) return html.replace(marked, () => region(name, content));
  if (!legacy?.test(html)) throw new Error(`Missing ${name} region`);
  return html.replace(legacy, () => region(name, content));
}
function header(page) {
  const isSiteNavigation = page.type === 'lab' || page.type === 'technology';
  const fields = {
    headerClass: isSiteNavigation ? 'site-navigation' : page.type === 'instrument' ? 'market-header trending-header' : 'market-header',
    headerLabel: page.type === 'instrument' ? '$AV navigation and trending markets' : '$AV navigation',
    brandClass: isSiteNavigation ? 'upic-brand site-navigation-brand' : 'upic-brand',
    brandImage: page.type === 'instrument'
      ? '<img id="upic-mark" alt="" width="125" height="173" decoding="async" hidden><span id="upic-mark-fallback">U</span>'
      : '<img src="upic-logo-transparent.svg?v=116" alt="" width="125" height="173" decoding="async" draggable="false">',
    instrumentCurrent: page.active === 'instrument' ? ' aria-current="page"' : '',
    marketplaceCurrent: page.active === 'marketplace' ? ' aria-current="page"' : '',
    aboutCurrent: page.active === 'about' ? ' aria-current="page"' : '',
    volume: page.volume ? partials.volume : '',
    trending: page.type === 'instrument' ? partials['home-trending'] : '',
  };
  return partials.header.replace(/\{\{(\w+)\}\}/g, (_, key) => fields[key]);
}
function prepareTechnologyDocument(html) {
  if (/<head\b/.test(html)) return html;
  const main = html.match(/<main\b[\s\S]*?<\/main>/)?.[0];
  if (!main) throw new Error('Missing technology content');
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<meta name="theme-color" content="#000000">\n<title>$AV Technology</title>\n<link rel="preload" href="fonts/Unifont/Unifont-ui.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="icon" type="image/svg+xml" href="upic-favicon.svg?v=116" sizes="any">\n</head>\n<body class="credits-page">\n<header class="site-navigation"></header>\n' + main.replace('<main class="credits-page">', '<main class="credits-content">') + '\n</body>\n</html>\n';
}
for (const page of pages) {
  const file = path.join(publicRoot, page.file);
  let html = await readFile(file, 'utf8');
  if (page.type === 'technology') html = prepareTechnologyDocument(html);
  if (html.includes('<!-- site-shell:intro:start -->')) {
    html = replaceRegion(html, 'intro', partials.intro);
  } else {
    // Migrate the homepage's original curtain before adding the shared one.
    html = html.replace(/<div class="site-intro"[^>]*>[\s\S]*?<\/div>/, '');
    html = html.replace(/<body\b[^>]*>/, match => match + '\n' + region('intro', partials.intro));
  }
  html = replaceRegion(html, 'header', header(page), /<header\b[^>]*>[\s\S]*?<\/header>/);
  if (page.type === 'lab') {
    // The navigation is one header; the lab's transport/actions are another.
    html = html.replace(/<!-- site-shell:header:end -->(\s*)<header>/, '<!-- site-shell:header:end -->$1<header class="lab-toolbar-header">');
  }
  if (page.footer) {
    if (html.includes('<!-- site-shell:footer:start -->') || /<footer class="site-footer"/.test(html)) {
      html = replaceRegion(html, 'footer', partials.footer, /<footer class="site-footer"[\s\S]*?<\/footer>/);
    } else html = html.replace('</body>', region('footer', partials.footer) + '\n</body>');
  }
  // Stylesheet order is deliberate: common controls, page layout, typography,
  // then shared navigation. Each page declares only the styles it uses.
  const styles = ['foundation.css', ...page.styles, 'typography.css', 'shared-navigation.css', 'intro.css']
    .map(href => `<link rel="stylesheet" href="${href.includes('?') ? href : href + '?v=' + version}">`).join('\n');
  if (html.includes('<!-- site-shell:styles:start -->')) {
    html = replaceRegion(html, 'styles', styles);
  } else {
    html = html.replace(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*>\s*/g, '');
    html = html.replace('</head>', region('styles', styles) + '\n</head>');
  }
  // Inline the tiny arrival decision before styles/body paint. It must not wait
  // for page modules or introduce another network request during startup.
  const entry = `<script>\n${pageEntryScript}\n</script>`;
  if (html.includes('<!-- site-shell:entry:start -->')) {
    html = replaceRegion(html, 'entry', entry);
  } else {
    html = html.replace('<!-- site-shell:styles:start -->', region('entry', entry) + '\n<!-- site-shell:styles:start -->');
  }
  const sharedScripts = `<script type="module" src="shared-header.js?v=${version}"></script>`;
  if (html.includes('<!-- site-shell:scripts:start -->')) {
    html = replaceRegion(html, 'scripts', sharedScripts);
  } else {
    html = html.replace(/<script\b[^>]*\bsrc=["'](?:footer-prices|shared-header|wallet-connect)\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/g, '');
    html = html.replace('</body>', region('scripts', sharedScripts) + '\n</body>');
  }
  if (page.type === 'instrument') html = html.replace(/src="app\.js\?v=\d+"/, `src="app.js?v=${version}"`);
  await writeFile(file, html);
}
console.log(`Rendered shared shell for ${pages.length} static pages.`);
