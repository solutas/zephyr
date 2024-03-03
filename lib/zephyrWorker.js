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

// Refactor storeResponseInIndexedDB to use the new key generation logic
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

// Refactor getResponseFromIndexedDB to use the new key generation logic
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
  const db = await openIndexedDB(); // Use your openIndexedDB function to get the database instance
  const transaction = db.transaction('responses', 'readonly'); // Adjust 'responses' if your object store has a different name
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

// Updated function to initialize Zephyr with fetch event listener
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



// // Function to open IndexedDB
// async function openIndexedDB() {
//   return new Promise((resolve, reject) => {
//     const request = indexedDB.open('zephyr-cache-db', 1);

//     request.onerror = event => {
//       console.error('IndexedDB error:', request.error);
//       reject(request.error);
//     };

//     request.onupgradeneeded = event => {
//       const db = event.target.result;
//       if (!db.objectStoreNames.contains('responses')) {
//         db.createObjectStore('responses', { keyPath: 'url' });
//       }
//     };

//     request.onsuccess = event => {
//       resolve(event.target.result);
//     };
//   });
// }
// function guessContentType(url) {
//   const extension = url.split('.').pop().split(/\#|\?/)[0].toLowerCase();
//   const mimeTypes = {
//     'jpg': 'image/jpeg',
//     'jpeg': 'image/jpeg',
//     'png': 'image/png',
//     'gif': 'image/gif',
//     'webp': 'image/webp',
//     'svg': 'image/svg+xml',
//     'css': 'text/css',
//     'html': 'text/html',
//     'js': 'application/javascript',
//     'json': 'application/json',
//     'txt': 'text/plain',
//     // Add other file extensions and MIME types as needed
//   };
//   return mimeTypes[extension] || 'application/octet-stream'; // Default to binary stream if unknown
// }

// async function storeResponseInIndexedDB(request, response, ttl) {
//   const db = await openIndexedDB();

//   // Clone the response and prepare the record outside the transaction to minimize the transaction's open time.
//   const bodyPromise = response.clone().arrayBuffer();
//   let headers = {};
//   response.headers.forEach((value, key) => {
//     headers[key] = value;
//   });

//   // Ensure content-type is set
//   if (!headers['content-type']) {
//     headers['content-type'] = guessContentType(request.url);
//   }

//   // Wait for the body outside of the transaction to avoid transaction inactivity.
//   const body = await bodyPromise;

//   const record = {
//     url: request.url,
//     body: body,
//     headers: headers,
//     validUntil: Date.now() + ttl * 60000 // Convert minutes to milliseconds
//   };

//   // Perform the database operations inside a tight transaction scope
//   return new Promise((resolve, reject) => {
//     const tx = db.transaction('responses', 'readwrite');
//     const store = tx.objectStore('responses');
//     store.put(record);

//     tx.oncomplete = () => resolve();
//     tx.onerror = () => reject(tx.error);
//   });
// }


// async function logAllRecordsAndKeysFromStore() {
//   const db = await openIndexedDB(); // Use your openIndexedDB function to get the database instance
//   const transaction = db.transaction('responses', 'readonly'); // Adjust 'responses' if your object store has a different name
//   const store = transaction.objectStore('responses');
  
//   const recordsRequest = store.getAll(); // This gets all records from the store
//   const keysRequest = store.getAllKeys(); // This gets all keys from the store

//   return new Promise((resolve, reject) => {
//     recordsRequest.onerror = (event) => {
//       console.error('Error fetching records:', recordsRequest.error);
//       reject(recordsRequest.error);
//     };

//     keysRequest.onerror = (event) => {
//       console.error('Error fetching keys:', keysRequest.error);
//       reject(keysRequest.error);
//     };

//     transaction.oncomplete = (event) => {
//       const records = recordsRequest.result;
//       const keys = keysRequest.result;
//       if (records.length === 0 || keys.length === 0) {
//         console.log('No records or keys found in the store.');
//       } else {
//         const data = records.map((record, index) => ({ key: keys[index], ...record }));
//         console.table(data); // Log the keys and records in a table format
//       }
//       resolve();
//     };
//   });
// }


// async function getRecord(url) {
//   const db = await openIndexedDB();
//   const transaction = db.transaction('responses', 'readonly');
//   const store = transaction.objectStore('responses');
//   const request = store.get(url);

//   return new Promise((resolve, reject) => {
//     request.onerror = (event) => {
//       console.error('Error retrieving record:', request.error);
//       reject(request.error);
//     };

//     request.onsuccess = (event) => {
//       if (request.result) {
//         resolve(request.result);
//       } else {
//         console.log('No record found for URL:', url);
//         resolve(null);
//       }
//     };
//   });
// }

// async function getResponseFromIndexedDB(request) {
  
//   const record = await getRecord(request.url);


//   // Check not only for the record but also for its essential properties
//   if (!record || typeof record.body === 'undefined' || typeof record.headers === 'undefined' || typeof record.validUntil === 'undefined') {
//     console.log("Cache miss or invalid record for URL:", request.url);
//     console.log(record)
//     return null; // Cache entry is missing, invalid, or expired
//   }

//   console.log("%cCache hit for URL:%c %s", "background: green; color: yellow; font-size: large", "color: yellow; font-size: medium", request.url);


  
//   if (Date.now() > record.validUntil) {
//     console.log("%cRecord expired for URL:%c %s", "background: red; color: yellow; font-size: large", "color: yellow; font-size: medium", request.url);    
//     return null; // The record is expired
//   }

//   const contentType = record.headers['content-type'] || 'application/octet-stream'; // Fallback to binary stream
//   const blob = new Blob([record.body], { type: contentType });

//   return new Response(blob, {
//     status: 200,
//     statusText: 'OK',
//     headers: record.headers
//   });
// }

// // Updated function to initialize Zephyr with fetch event listener
// function initZephyr(config) {
//   self.addEventListener('install', (event) => {
//     self.skipWaiting(); // Force the waiting service worker to become the active service worker.
//   });

//   self.addEventListener('activate', event => {    
//     clients.claim();
//   });

//   self.addEventListener('fetch', event => {
//     const request = event.request;
//     const url = new URL(request.url);
//     const zephyrDebug = url.searchParams.get('zephyrDebug');

//     if (zephyrDebug === 'true') {
//       console.log('Zephyr Debug Mode Activated');
//       logAllRecordsAndKeysFromStore().then(() => {
//         console.log('Logged all records and keys from store.');
//       }).catch(error => {
//         console.error('Error logging records and keys:', error);
//       });
//     }

//     const matchingRule = config.rules.find(rule => {
//       const regex = new RegExp(rule.test);
//       return regex.test(request.url) && (!rule.method || rule.method === request.method);
//     });

    
//     if (matchingRule) {      
//       event.respondWith(
//         getResponseFromIndexedDB(request).then(response => {
//           if (response) {
//             return response;
//           } else {
//             return fetch(request).then((networkResponse) => {
//               storeResponseInIndexedDB(request, networkResponse.clone(), parseInt(matchingRule.cache, 10));
//               return networkResponse;
//             });
//           }
//         })
//       );
//     }
//   });
// }

