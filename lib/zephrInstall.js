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


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./zephyrConfig.js', {scope: "/"})
      .then(registration => {
        console.log('Zephyr worker registered:', registration);
      })
      .catch(error => {
        console.error('Zephyr worker registration failed:', error);
      });
  });
}
