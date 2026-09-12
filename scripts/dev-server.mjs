// Local Shopify-compatible theme renderer.
// Dev-only harness: renders the real Liquid theme so template, schema and
// section wiring errors surface before the theme reaches Shopify.
import express from 'express';
import { Liquid, Tag, Value } from 'liquidjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

// Shopify writes a leading /* ... */ banner into the JSON files it manages, so
// theme JSON is not strictly valid JSON and must be stripped before parsing.
export const parseThemeJson = (text) => JSON.parse(text.replace(/^\s*\/\*[\s\S]*?\*\//, ''));

export const errors = [];
const fail = (where, message) => {
  errors.push(`${where}: ${message}`);
};

/* ---------------------------------------------------------------- locales */

let locale = {};
try {
  locale = parseThemeJson(read('locales/en.default.json'));
} catch (e) {
  fail('locales/en.default.json', `invalid JSON - ${e.message}`);
}

const translate = (key) => {
  const value = String(key)
    .split('.')
    .reduce((acc, part) => (acc == null ? undefined : acc[part]), locale);
  if (typeof value === 'string') return value;
  fail('translation', `missing key "${key}"`);
  return `translation missing: ${key}`;
};

/* --------------------------------------------------------------- settings */

const schemaDefaults = () => {
  const out = {};
  let groups;
  try {
    groups = parseThemeJson(read('config/settings_schema.json'));
  } catch (e) {
    fail('config/settings_schema.json', `invalid JSON - ${e.message}`);
    return out;
  }
  for (const group of groups) {
    for (const setting of group.settings || []) {
      if (setting.id !== undefined && setting.default !== undefined) {
        out[setting.id] = setting.default;
      }
    }
  }
  return out;
};

let savedSettings = {};
try {
  savedSettings = parseThemeJson(read('config/settings_data.json')).current || {};
} catch (e) {
  fail('config/settings_data.json', `invalid JSON - ${e.message}`);
}

const settings = { ...schemaDefaults(), ...savedSettings };

/* ------------------------------------------------------- section schemas */

const SCHEMA_RE = /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/;

const sectionSchema = (type) => {
  const file = `sections/${type}.liquid`;
  if (!exists(file)) {
    fail('sections', `missing file for section type "${type}" (${file})`);
    return null;
  }
  const match = SCHEMA_RE.exec(read(file));
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    fail(file, `invalid {% schema %} JSON - ${e.message}`);
    return {};
  }
};

const defaultsFor = (settingsList = []) => {
  const out = {};
  for (const setting of settingsList) {
    if (setting.id !== undefined && setting.default !== undefined) {
      out[setting.id] = setting.default;
    }
  }
  return out;
};

/* ------------------------------------------------------------- stub data */

const routes = {
  root_url: '/',
  collections_url: '/collections',
  all_products_collection_url: '/collections/all',
  cart_url: '/cart',
  cart_add_url: '/cart/add',
  cart_change_url: '/cart/change',
  search_url: '/search',
  account_url: '/account',
  account_login_url: '/account/login',
  account_register_url: '/account/register',
  account_logout_url: '/account/logout',
  account_addresses_url: '/account/addresses',
  account_recover_url: '/account/recover',
  cart_clear_url: '/cart/clear',
  predictive_search_url: '/search/suggest',
  product_recommendations_url: '/recommendations/products',
};

const pageHandles = fs
  .readdirSync(path.join(ROOT, 'templates'))
  .filter((f) => f.startsWith('page.') && f.endsWith('.json'))
  .map((f) => f.slice('page.'.length, -'.json'.length));

const pages = Object.fromEntries(
  pageHandles.map((handle) => [
    handle,
    { handle, title: handle, url: `/pages/${handle}`, content: '' },
  ])
);

const shop = {
  name: 'Teknotize Merchandise',
  description: 'Athlete merchandise built for teams.',
  url: 'http://127.0.0.1:9292',
  money_format: '${{amount}}',
  email: 'hello@teknotize.test',
  address: {},
};

const cart = { item_count: 0, items: [], total_price: 0, empty: true, note: '' };

/* --------------------------------------------------------------- filters */

const assetUrl = (name) => `/assets/${String(name).replace(/^.*\//, '')}`;

const imageUrl = (input) => {
  if (!input) return '';
  if (typeof input === 'string') return assetUrl(input);
  if (input.src) return assetUrl(input.src);
  return '';
};

const attrs = (options = {}) =>
  Object.entries(options)
    .map(([key, value]) => ` ${key.replace(/_/g, '-')}="${String(value)}"`)
    .join('');

const engine = new Liquid({
  root: [path.join(ROOT, 'snippets'), path.join(ROOT, 'sections'), ROOT],
  extname: '.liquid',
  strictFilters: true,
  strictVariables: false,
  jsTruthy: true,
});

engine.registerFilter('asset_url', assetUrl);
engine.registerFilter('asset_img_url', imageUrl);
engine.registerFilter('image_url', imageUrl);
engine.registerFilter('img_url', imageUrl);
engine.registerFilter('file_url', assetUrl);
engine.registerFilter('stylesheet_tag', (url) => `<link rel="stylesheet" href="${url}">`);
engine.registerFilter('script_tag', (url) => `<script src="${url}"></script>`);
engine.registerFilter('image_tag', (url, ...rest) => {
  const options = typeof rest[0] === 'object' && rest[0] !== null ? rest[0] : {};
  return `<img src="${url || ''}"${attrs(options)}>`;
});
engine.registerFilter('video_tag', (video, ...rest) => {
  const options = typeof rest[0] === 'object' && rest[0] !== null ? rest[0] : {};
  const { image_size, ...htmlOptions } = options;
  const sources = (video && video.sources) || [];
  const src = sources.length ? sources[0].url : video && video.src ? assetUrl(video.src) : '';
  return `<video${attrs(htmlOptions)}><source src="${src}" type="video/mp4"></video>`;
});
engine.registerFilter('external_video_tag', (video, ...rest) => {
  const options = typeof rest[0] === 'object' && rest[0] !== null ? rest[0] : {};
  return `<iframe${attrs(options)} src="${(video && video.src) || ''}"></iframe>`;
});
engine.registerFilter('placeholder_svg_tag', (_name, className = '') =>
  `<svg class="${className}" viewBox="0 0 100 100" role="presentation"><rect width="100" height="100" fill="#222"/></svg>`
);
engine.registerFilter('money', (value) => `$${(Number(value || 0) / 100).toFixed(2)}`);
engine.registerFilter('money_with_currency', (value) => `$${(Number(value || 0) / 100).toFixed(2)} USD`);
engine.registerFilter('money_without_trailing_zeros', (value) => `$${Math.round(Number(value || 0) / 100)}`);
engine.registerFilter('t', translate);
engine.registerFilter('handleize', (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
engine.registerFilter('handle', (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
engine.registerFilter('format_address', (address) => `<p>${(address && address.address1) || ''}</p>`);
engine.registerFilter('format_code', (value) => String(value ?? ''));
engine.registerFilter('default_errors', () => '');
engine.registerFilter('default_pagination', () => '');
engine.registerFilter('within', (url) => url);
engine.registerFilter('link_to', (label, url) => `<a href="${url}">${label}</a>`);
engine.registerFilter('payment_type_svg_tag', () => '');
engine.registerFilter('weight_with_unit', (v) => `${v} kg`);
engine.registerFilter('highlight', (v) => v);
engine.registerFilter('camelize', (v) => String(v));
engine.registerFilter('customer_login_link', (v) => v);
engine.registerFilter('inline_asset_content', () => '');

/* ------------------------------------------------------------------ tags */

engine.registerTag('schema', {
  parse(token, remaining) {
    while (remaining.length) {
      const next = remaining.shift();
      if (next.name === 'endschema') return;
    }
  },
  render() {
    return '';
  },
});

for (const name of ['stylesheet', 'javascript']) {
  engine.registerTag(name, {
    parse(token, remaining) {
      this.tokens = [];
      while (remaining.length) {
        const next = remaining.shift();
        if (next.name === `end${name}`) return;
        this.tokens.push(next);
      }
    },
    render() {
      return '';
    },
  });
}

engine.registerTag('layout', {
  parse() {},
  render() {
    return '';
  },
});

engine.registerTag('form', {
  parse(token, remaining) {
    this.templates = [];
    const stream = this.liquid.parser
      .parseStream(remaining)
      .on('template', (tpl) => this.templates.push(tpl))
      .on('tag:endform', function () {
        this.stop();
      })
      .on('end', () => {
        throw new Error(`tag ${token.getText()} not closed`);
      });
    stream.start();
  },
  *render(ctx, emitter) {
    emitter.write('<form method="post" action="#">');
    ctx.push({ form: { errors: null, posted_successfully: false } });
    yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    ctx.pop();
    emitter.write('</form>');
  },
});

engine.registerTag('paginate', {
  parse(token, remaining) {
    this.templates = [];
    const stream = this.liquid.parser
      .parseStream(remaining)
      .on('template', (tpl) => this.templates.push(tpl))
      .on('tag:endpaginate', function () {
        this.stop();
      })
      .on('end', () => {
        throw new Error(`tag ${token.getText()} not closed`);
      });
    stream.start();
  },
  *render(ctx, emitter) {
    ctx.push({
      paginate: { pages: 1, current_page: 1, items: 0, parts: [], previous: null, next: null },
    });
    yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    ctx.pop();
  },
});

/* -------------------------------------------------------- section render */

const renderSection = async (key, config, globals) => {
  const type = config.type;
  const schema = sectionSchema(type);
  if (schema === null) {
    return `<!-- missing section: ${type} -->`;
  }

  const blockOrder = config.block_order || Object.keys(config.blocks || {});
  const blockSchemas = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));

  const blocks = blockOrder.map((blockId) => {
    const block = (config.blocks || {})[blockId] || {};
    const blockSchema = blockSchemas[block.type];
    if (!blockSchema) {
      fail(`templates (section "${key}")`, `block type "${block.type}" is not defined in sections/${type}.liquid schema`);
    }
    return {
      id: blockId,
      type: block.type,
      settings: { ...defaultsFor(blockSchema && blockSchema.settings), ...(block.settings || {}) },
      shopify_attributes: `data-block="${blockId}"`,
    };
  });

  const section = {
    id: key,
    type,
    settings: { ...defaultsFor(schema.settings), ...(config.settings || {}) },
    blocks,
    blocks_count: blocks.length,
    index: 1,
    index0: 0,
    location: 'template',
    shopify_attributes: `data-section="${key}"`,
  };

  const source = read(`sections/${type}.liquid`);
  try {
    // Shopify keeps global objects visible inside {% render %} but isolates
    // variables assigned by the caller, which is what renderOptions.globals does.
    const html = await engine.parseAndRender(source, { section }, { globals });
    return `<div id="shopify-section-${key}" class="shopify-section">${html}</div>`;
  } catch (e) {
    fail(`sections/${type}.liquid`, e.message.split('\n')[0]);
    return `<!-- render error in ${type}: ${e.message} -->`;
  }
};

const renderSectionGroup = async (name, globals) => {
  const file = `sections/${name}.json`;
  if (!exists(file)) {
    fail('layout', `section group "${name}" not found (${file})`);
    return '';
  }
  let group;
  try {
    group = parseThemeJson(read(file));
  } catch (e) {
    fail(file, `invalid JSON - ${e.message}`);
    return '';
  }
  const order = group.order || Object.keys(group.sections || {});
  const parts = [];
  for (const key of order) {
    const config = (group.sections || {})[key];
    if (!config) {
      fail(file, `order lists "${key}" but it is not defined in sections`);
      continue;
    }
    parts.push(await renderSection(key, config, globals));
  }
  return parts.join('\n');
};

engine.registerTag('sections', {
  parse(token) {
    this.value = new Value(token.args, this.liquid);
  },
  *render(ctx, emitter) {
    const name = yield this.value.value(ctx);
    emitter.write(yield renderSectionGroup(name, ctx.globals));
  },
});

engine.registerTag('section', {
  parse(token) {
    this.value = new Value(token.args, this.liquid);
  },
  *render(ctx, emitter) {
    const name = yield this.value.value(ctx);
    emitter.write(yield renderSection(name, { type: name }, ctx.globals));
  },
});

/* ------------------------------------------------------------- templates */

const baseGlobals = (templateName, suffix, extra = {}) => ({
  settings,
  routes,
  shop,
  cart,
  pages,
  collections: {},
  linklists: {},
  images: {},
  all_products: {},
  customer: null,
  template: { name: templateName, suffix: suffix || null, directory: null },
  request: { path: extra.path || '/', locale: { iso_code: 'en' }, page_type: templateName, origin: shop.url, design_mode: false },
  localization: { available_countries: [], available_languages: [], country: { iso_code: 'US' }, language: { iso_code: 'en' } },
  canonical_url: shop.url + (extra.path || '/'),
  page_title: extra.title || shop.name,
  page_description: shop.description,
  content_for_header: '<!-- content_for_header -->',
  current_tags: null,
  current_page: 1,
  powered_by_link: '',
  ...extra.objects,
});

const renderTemplate = async (templateName, suffix, extra = {}) => {
  const jsonFile = suffix
    ? `templates/${templateName}.${suffix}.json`
    : `templates/${templateName}.json`;
  const liquidFile = suffix
    ? `templates/${templateName}.${suffix}.liquid`
    : `templates/${templateName}.liquid`;

  const globals = baseGlobals(templateName, suffix, extra);
  let contentForLayout = '';

  if (exists(jsonFile)) {
    let template;
    try {
      template = parseThemeJson(read(jsonFile));
    } catch (e) {
      fail(jsonFile, `invalid JSON - ${e.message}`);
      return { html: '', file: jsonFile };
    }
    const order = template.order || Object.keys(template.sections || {});
    if (!order.length) {
      fail(jsonFile, 'template has no sections in "order" - page body will be empty');
    }
    const parts = [];
    for (const key of order) {
      const config = (template.sections || {})[key];
      if (!config) {
        fail(jsonFile, `order lists "${key}" but it is not defined in "sections"`);
        continue;
      }
      parts.push(await renderSection(key, config, globals));
    }
    contentForLayout = parts.join('\n');
  } else if (exists(liquidFile)) {
    try {
      contentForLayout = await engine.parseAndRender(read(liquidFile), {}, { globals });
    } catch (e) {
      fail(liquidFile, e.message.split('\n')[0]);
    }
  } else {
    fail('templates', `no template file found for "${templateName}${suffix ? '.' + suffix : ''}"`);
  }

  try {
    const html = await engine.parseAndRender(
      read('layout/theme.liquid'),
      { content_for_layout: contentForLayout },
      { globals }
    );
    return { html, file: jsonFile };
  } catch (e) {
    fail('layout/theme.liquid', e.message.split('\n')[0]);
    return { html: contentForLayout, file: jsonFile };
  }
};

/* ---------------------------------------------------------------- routing */

const resolve = (urlPath) => {
  if (urlPath === '/' || urlPath === '') return { name: 'index' };
  const page = urlPath.match(/^\/pages\/([^/]+)\/?$/);
  if (page) {
    const handle = page[1];
    const suffix = exists(`templates/page.${handle}.json`) ? handle : null;
    return {
      name: 'page',
      suffix,
      objects: { page: { handle, title: handle, content: '<p>Page content</p>', url: urlPath } },
    };
  }
  if (/^\/collections\/?$/.test(urlPath)) return { name: 'list-collections' };
  if (/^\/collections\//.test(urlPath)) {
    return {
      name: 'collection',
      objects: {
        collection: {
          handle: 'all', title: 'All', products: [], all_products_count: 0,
          products_count: 0, description: '', filters: [], sort_options: [], url: urlPath,
        },
      },
    };
  }
  if (/^\/products\//.test(urlPath)) {
    return {
      name: 'product',
      objects: {
        product: {
          title: 'Sample Product', handle: 'sample', price: 4500, compare_at_price: null,
          available: true, description: '', images: [], media: [], featured_image: null,
          variants: [{ id: 1, title: 'Default', price: 4500, available: true }],
          selected_or_first_available_variant: { id: 1, title: 'Default', price: 4500, available: true },
          options_with_values: [], url: urlPath, tags: [], type: '', vendor: 'Teknotize',
        },
      },
    };
  }
  const account = urlPath.match(/^\/account(?:\/([a-z_]+))?\/?$/);
  if (account) {
    const map = {
      undefined: 'customers/account',
      login: 'customers/login',
      register: 'customers/register',
      addresses: 'customers/addresses',
      reset_password: 'customers/reset_password',
      activate_account: 'customers/activate_account',
      orders: 'customers/order',
    };
    const name = map[account[1]];
    if (name) {
      return {
        name,
        objects: {
          customer: {
            first_name: 'Sam', last_name: 'Rivera', name: 'Sam Rivera',
            email: 'sam@example.com', orders: [], orders_count: 0,
            addresses: [], addresses_count: 0, default_address: null,
          },
          order: { name: '#1001', created_at: '2026-01-01', line_items: [], total_price: 0, financial_status: 'paid', fulfillment_status: 'fulfilled', shipping_address: {}, billing_address: {} },
          form: { errors: null },
        },
      };
    }
  }
  if (urlPath === '/cart') return { name: 'cart' };
  if (urlPath === '/search') return { name: 'search', objects: { search: { performed: false, results: [], results_count: 0, terms: '' } } };
  if (urlPath === '/blogs') return { name: 'blog', objects: { blog: { title: 'Blog', articles: [], url: '/blogs' } } };
  return null;
};

/* ----------------------------------------------------------------- server */

const app = express();

app.get('/assets/theme.css', async (_req, res) => {
  try {
    const css = await engine.parseAndRender(read('assets/theme.css.liquid'), { settings });
    res.type('text/css').send(css);
  } catch (e) {
    fail('assets/theme.css.liquid', e.message.split('\n')[0]);
    res.status(500).type('text/css').send(`/* ${e.message} */`);
  }
});

app.use('/assets', express.static(path.join(ROOT, 'assets')));

app.get('/__errors', (_req, res) => res.json({ count: errors.length, errors }));

app.use(async (req, res) => {
  const route = resolve(req.path);
  if (!route) {
    const { html } = await renderTemplate('404', null, { path: req.path, title: 'Not found' });
    return res.status(404).send(html);
  }
  const { html } = await renderTemplate(route.name, route.suffix, {
    path: req.path,
    objects: route.objects,
  });
  res.send(html);
});

export { renderTemplate, resolve, pageHandles, app };

if (process.argv[1] && process.argv[1].endsWith('dev-server.mjs')) {
  const port = Number(process.env.PORT || 9292);
  app.listen(port, () => {
    console.log(`Theme preview running at http://127.0.0.1:${port}`);
  });
}
