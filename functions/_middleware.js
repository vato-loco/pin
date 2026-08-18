// Draait vóór alle routes die in _routes.json staan.
//
// Pages serveert alles wat in de output-map staat, en _redirects kent geen
// 404-status. Ontwikkelbestanden afschermen kan daarom alleen hier. Ze bevatten
// geen sleutels — het API Key staat als secret op het Pages-project en nooit in
// de repo — maar ze horen niet bij de site.
const NIET_SERVEREN = [
  /^\/wrangler\.jsonc$/,
  /^\/package(-lock)?\.json$/,
  /^\/PINAPI\.md$/,
  /^\/tools\//,
  /^\/test\//,
];

export const onRequest = (context) => {
  const pad = new URL(context.request.url).pathname;
  if (NIET_SERVEREN.some((re) => re.test(pad))) {
    return new Response('Not found', { status: 404 });
  }
  return context.next();
};
