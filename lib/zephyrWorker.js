/*******************************************************************************
 * Copyright 2019-2024 SOLUTAS GmbH. All Rights Reserved.                      *
 *                                                                             *
 * Paradieshofstrasse 117, 4054 Basel, Switzerland                             *
 * http://www.solutas.ch | info@solutas.ch                                     *
 *                                                                             *
 * All Rights Reserved.                                                        *
 * --------------------------------------------------------------------------- *
 *                                                                             *
 * Unauthorized copying of this file, via any medium is strictly prohibited    *
 * Proprietary and confidential                                                *
 ********************************************************************************/


// Function to create a hash from a string (in this case, the request payload)
async function hashPayload(payload) {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Function to generate a cache key based on the request
async function generateCacheKey(request) {
  let key = request.url;
  if (request.method === 'POST') {
    const payload = await request.clone().text();
    const payloadHash = await hashPayload(payload);
    key += `-${payloadHash}`;
  }
  return key;
}

// Function to open IndexedDB
async function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('zephyr-cache-db', 1);

    request.onerror = event => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('responses')) {
        db.createObjectStore('responses', { keyPath: 'url' });
      }
    };

    request.onsuccess = event => {
      resolve(event.target.result);
    };
  });
}

function guessContentType(url) {
  const extension = url.split('.').pop().split(/\#|\?/)[0].toLowerCase();
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'css': 'text/css',
    'html': 'text/html',
    'js': 'application/javascript',
    'json': 'application/json',
    'txt': 'text/plain',
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

async function storeResponseInIndexedDB(request, response, ttl) {
  const db = await openIndexedDB();
  const bodyPromise = response.clone().arrayBuffer();
  let headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  if (!headers['content-type']) {
    headers['content-type'] = guessContentType(request.url);
  }

  const body = await bodyPromise;
  const key = await generateCacheKey(request);

  const record = {
    url: key,
    body: body,
    headers: headers,
    validUntil: Date.now() + ttl * 60000
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('responses', 'readwrite');
    const store = tx.objectStore('responses');
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getResponseFromIndexedDB(request) {
  const db = await openIndexedDB();
  const key = await generateCacheKey(request);
  const transaction = db.transaction('responses', 'readonly');
  const store = transaction.objectStore('responses');
  const requestDB = store.get(key);

  return new Promise((resolve, reject) => {
    requestDB.onerror = (event) => {
      console.error('Error retrieving record:', requestDB.error);
      reject(requestDB.error);
    };

    requestDB.onsuccess = (event) => {
      const record = requestDB.result;
      if (!record || typeof record.body === 'undefined' || typeof record.headers === 'undefined' || typeof record.validUntil === 'undefined' || Date.now() > record.validUntil) {
        console.log("%cRecord expired or not found for URL:%c %s", "background: red; color: yellow; font-size: large", "color: yellow; font-size: medium", request.url);    
        resolve(null);
      } else {
        const contentType = record.headers['content-type'] || 'application/octet-stream';
        const blob = new Blob([record.body], { type: contentType });
        resolve(new Response(blob, {
          status: 200,
          statusText: 'OK',
          headers: record.headers
        }));
      }
    };
  });
}

async function logAllRecordsAndKeysFromStore() {
  const db = await openIndexedDB();
  const transaction = db.transaction('responses', 'readonly');
  const store = transaction.objectStore('responses');
  
  const recordsRequest = store.getAll(); // This gets all records from the store
  const keysRequest = store.getAllKeys(); // This gets all keys from the store

  return new Promise((resolve, reject) => {
    recordsRequest.onerror = (event) => {
      console.error('Error fetching records:', recordsRequest.error);
      reject(recordsRequest.error);
    };

    keysRequest.onerror = (event) => {
      console.error('Error fetching keys:', keysRequest.error);
      reject(keysRequest.error);
    };

    transaction.oncomplete = (event) => {
      const records = recordsRequest.result;
      const keys = keysRequest.result;
      if (records.length === 0 || keys.length === 0) {
        console.log('No records or keys found in the store.');
      } else {
        const data = records.map((record, index) => ({ key: keys[index], ...record }));
        console.table(data); // Log the keys and records in a table format
      }
      resolve();
    };
  });
}

// initialize Zephyr with fetch event listener
function initZephyr(config) {
  self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force the waiting service worker to become the active service worker.
  });

  self.addEventListener('activate', event => {
    clients.claim();
  });

  self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    const zephyrDebug = url.searchParams.get('zephyrDebug');

    if (zephyrDebug === 'true') {
      console.log('Zephyr Debug Mode Activated');
      logAllRecordsAndKeysFromStore().then(() => {
        console.log('Logged all records and keys from store.');
      }).catch(error => {
        console.error('Error logging records and keys:', error);
      });
    }

    const matchingRule = config.rules.find(rule => {
      const regex = new RegExp(rule.test);
      return regex.test(request.url) && (!rule.method || rule.method === request.method);
    });

    if (matchingRule) {
      event.respondWith(
        getResponseFromIndexedDB(request).then(response => {
          if (response) {
            console.log("%cCache hit for URL:%c %s", "background: green; color: yellow; font-size: large", "color: yellow; font-size: medium", request.url);
            return response;
          } else {
            return fetch(request).then((networkResponse) => {
              storeResponseInIndexedDB(request, networkResponse.clone(), parseInt(matchingRule.cache, 10));
              return networkResponse;
            });
          }
        })
      );
    }
  });
}