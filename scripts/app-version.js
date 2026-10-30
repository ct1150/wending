export function stampAppVersion(html, version) {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Invalid application version');
  return html.replace(/(<meta name="application-version" content=")[^"]*(" \/>)/, (_, before, after) => before + version + after);
}
