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

// this is an example config file

// Import the worker script
importScripts("https://www.unpkg.com/@solutas/zephyr@0.0.2/lib/zephyrWorker.js");

// Define your configuration, including resources to cache
const config = { 
    rules: [
        {
            test: '.*\\/api\\/getProducts$',
            method: 'POST',
            key: '$payload',
            cache: '1440', // 1 day in minutes
            invalidate: '' // Optional - cron syntax e.g., every morning at 1am
        },
        {
            test: '.*\\.(png|jpg|js)$',
            method: 'GET',
            key: '$path',
            cache: 1, // 1h 30min in minutes
            invalidate: '' // Optional - cron syntax e.g., every morning at 1am
        },        
    ]
};


// Initialize the worker with the configuration
if (initZephyr) {
    initZephyr(config);
} else {
    console.error("Zephyr worker initialization function not found.");
}
