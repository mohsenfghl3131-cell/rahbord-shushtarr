export default {
  async fetch(request, env) {
    if (!env.APP || typeof env.APP.fetch !== "function") {
      return new Response("Application service binding is not configured", { status: 503 });
    }
    return env.APP.fetch(request);
  },
};
