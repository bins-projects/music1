importScripts("./pack-precache.js");

const CACHE_NAME = `prepflow-pwa-v11-dosage-lab-${self.PREPFLOW_PACK_PRECACHE.version}`;

const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./question-reference-rules.js",
  "./generic-pack-catalog.css",
  "./canonical-question-types.css",
  "./dosage-home-link.css",
  "./dosage-lab-prototype.html",
  "./dosage-lab-home.css",
  "./dosage-lab-run.html",
  "./dosage-lab.css",
  "./dosage-lab.js",
  "./dosage-how-to.html",
  "./dosage-engine.js",
  "./dosage-engine-clinical-pools.js",
  "./dosage-engine-expanded-clinical.js",
  "./dosage-engine-rate-expansion.js",
  "./dosage-families.js",
  "./images/dosage-lab/dosage-lab-classroom.png",
  "./images/dosage-lab/home-screen.png",
  "./images/dosage-lab/home-screen-mobile.webp",
  "./images/dosage-lab/home-screen-portrait.svg",
  "./quiz-builder-screen.css",
  "./study-modules.css",
  "./quiz-builder-hit-area-hotfix.css",
  "./quiz-reading-screen.css",
  "./data/pack-catalog.json",
  "./data/study-modules.json",
  "./data/study-modules/pharm-test-review-matched-2026.prepflow-module.json",
  "./data/study-modules/pharm-test-review-related-expanded-2026.prepflow-module.json",
  "./data/study-modules/pharm-test-prediction-50-2026.prepflow-module.json",
  "./drug-reference.css",
  "./drug-reference.js",
  "./drug-reference-batch-loader.js",
  "./mobile-portrait.css",
  "./mobile-portrait.js",
  "./mobile-quiz-builder.js",
  "./mobile-quiz-flow.js",
  "./images/drug-reference/prepflow-medication-room-reference-station.png",
  "./images/home-hospital/prepflow-mobile-home-background.png",
  "./images/quiz-builder/prepflow-mobile-quiz-builder-background.png",
  "./images/quiz-builder/prepflow-mobile-chapter-clipboard.png",
  "./images/quiz-builder/books/fundamentals-closed.png",
  "./images/quiz-builder/books/medsurg-closed.png",
  "./images/quiz-builder/books/pediatrics-closed.png",
  "./images/quiz-builder/books/pharm-closed.png",
  "./images/quiz-builder/books/quizbook-transparent.png",
  "./manifest.webmanifest",
  "./icons/prepflow-192.png",
  "./icons/prepflow-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([
      ...APP_FILES,
      ...self.PREPFLOW_PACK_PRECACHE.urls,
    ]))
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }

        return response;
      })
      .catch(async () => {
        const exact = await caches.match(event.request);
        if (exact) return exact;
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});
