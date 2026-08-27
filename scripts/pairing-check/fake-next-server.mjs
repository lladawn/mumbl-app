// Minimal stand-in for next/server. src/server/http.js only ever calls
// NextResponse.json(data, init), which is a plain Response with a JSON body.
export const NextResponse = {
  json(data, init) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
    });
  },
};
