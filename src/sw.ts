import { defaultCache } from "@serwist/next/worker";
import {
  Serwist,
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
  StaleWhileRevalidate,
  ExpirationPlugin,
  CacheableResponsePlugin,
  type SerwistOptions,
} from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: SerwistOptions["precacheEntries"];
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Auth endpoints — never cache
    {
      matcher: /\/auth\/callback/,
      handler: new NetworkOnly(),
      method: "GET",
    },
    {
      matcher: /\/api\/.*auth/,
      handler: new NetworkOnly(),
      method: "GET",
    },

    // API data — network first, fall back to cache
    {
      matcher: /\/api\//,
      handler: new NetworkFirst({
        cacheName: "api-data",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60, // 1 hour
          }),
        ],
      }),
      method: "GET",
    },

    // Photos/images — cache first with expiration
    {
      matcher: /\.(?:png|jpg|jpeg|webp|gif|svg|ico)$/i,
      handler: new CacheFirst({
        cacheName: "images",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          }),
        ],
      }),
      method: "GET",
    },

    // Video — cache first with tighter limits (iOS 50MB cap)
    {
      matcher: /\.(?:mp4|webm)$/i,
      handler: new CacheFirst({
        cacheName: "video",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 5,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          }),
        ],
      }),
      method: "GET",
    },

    // Static assets (JS, CSS, fonts) — stale while revalidate
    {
      matcher: /\.(?:js|css|woff2?|ttf|eot)$/i,
      handler: new StaleWhileRevalidate({
        cacheName: "static-assets",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          }),
        ],
      }),
      method: "GET",
    },

    // Default cache from Serwist for Next.js pages
    ...defaultCache,
  ],
});

serwist.addEventListeners();
