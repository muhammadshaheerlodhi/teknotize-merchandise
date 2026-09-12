// Lists every link on a rendered page and reports its local HTTP status.
const base = 'http://127.0.0.1:9292';
const page = process.argv[2] || '/';

const html = await (await fetch(base + page)).text();
const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
const unique = [...new Set(hrefs)];

for (const href of unique) {
  if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    console.log(`skip   ${href}`);
    continue;
  }
  if (/^https?:\/\//.test(href) && !href.startsWith(base)) {
    console.log(`extern ${href}`);
    continue;
  }
  try {
    const res = await fetch(href.startsWith('http') ? href : base + href, { redirect: 'follow' });
    console.log(`${String(res.status).padEnd(6)} ${href}`);
  } catch (e) {
    console.log(`ERR    ${href}  (${e.message})`);
  }
}
