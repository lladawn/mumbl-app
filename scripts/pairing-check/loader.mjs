const FAKES = {
  "/src/server/supabase.js": "./fake-supabase.mjs",
  "/src/server/auth.js": "./fake-auth.mjs",
};

export async function resolve(specifier, context, next) {
  if (specifier === "next/server") {
    return { url: new URL("./fake-next-server.mjs", import.meta.url).href, format: "module", shortCircuit: true };
  }
  let r;
  try {
    r = await next(specifier, context);
  } catch (err) {
    // The repo imports extensionlessly ("../../src/server/http") because Next's
    // bundler resolves that; plain Node ESM will not. Retry with .js so the
    // SHIPPED files can be imported unmodified.
    if (err?.code === "ERR_MODULE_NOT_FOUND" && /^[./]/.test(specifier) && !/\.[a-z]+$/.test(specifier)) {
      r = await next(`${specifier}.js`, context);
    } else {
      throw err;
    }
  }
  for (const [suffix, fake] of Object.entries(FAKES)) {
    if (r.url.endsWith(suffix)) return { ...r, url: new URL(fake, import.meta.url).href, shortCircuit: true };
  }
  return r;
}
