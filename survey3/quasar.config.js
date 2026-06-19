/* eslint-env node */

// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file

// .env in process.env laden, damit APP_VERSION/APP_UPDATED u.a. aus .env in den
// Build uebernommen werden (sonst greifen nur die Fallbacks unten).
import "dotenv/config";
import { configure } from "quasar/wrappers";

export default configure(function (/* ctx */) {
  return {
    // https://v2.quasar.dev/quasar-cli-vite/boot-files
    boot: ["db", "i18n", "axios", "errorHandler", "confirm", "cypressStore"],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#css
    css: ["app.sass"],

    // https://github.com/quasarframework/quasar/tree/dev/extras
    extras: [
      "roboto-font",
      "material-icons",
    ],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#build
    build: {
      env: {
        LOG_LEVEL: process.env.LOG_LEVEL || 'warn',
        APP_NAME: process.env.APP_NAME || 'surveyBEST',
        APP_VERSION: process.env.APP_VERSION || 'v1.11.1',
        APP_UPDATED: process.env.APP_UPDATED || '2026-06-19'
      },

      target: {
        browser: ['es2022', 'firefox115', 'chrome115', 'safari14'],
        node: 'node18'
      },

      vueRouterMode: "hash",
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#devserver
    devServer: {
      https: false,
      port: 8088,
      open: true,
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#framework
    framework: {
      config: {},
      plugins: ["Notify", "Dialog"],
    },

    animations: [],

    // https://v2.quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
    pwa: {
      workboxMode: "GenerateSW",
      // skipWaiting/clientsClaim: neuer Service-Worker aktiviert sofort und
      // übernimmt die Seite -> nach einem Deploy genügt ein Reload (kein
      // manuelles Cache-Leeren). cleanupOutdatedCaches entfernt alte Caches.
      workboxOptions: { cleanupOutdatedCaches: true, skipWaiting: true, clientsClaim: true },

      manifest: {
        name: "surveyBEST",
        short_name: "surveyBEST",
        description: "A Quasar Project",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#027be3",
        icons: [
          {
            src: "icons/icon-128x128.png",
            sizes: "128x128",
            type: "image/png",
          },
          {
            src: "icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-256x256.png",
            sizes: "256x256",
            type: "image/png",
          },
          {
            src: "icons/icon-384x384.png",
            sizes: "384x384",
            type: "image/png",
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-cordova-apps/configuring-cordova
    cordova: {},

    // https://v2.quasar.dev/quasar-cli-vite/developing-capacitor-apps/configuring-capacitor
    capacitor: {
      hideSplashscreen: true,
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/configuring-electron
    electron: {
      bundler: "packager",

      packager: {},

      builder: {
        appId: "survey3",
      },
    },
  };
});
