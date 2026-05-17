export default defineNuxtConfig({
  devtools: { enabled: true },
  nitro: {
    devProxy: { '/api': 'http://localhost:3000' },
  },
});
