# Zephyr
Zephyr is a lightweight service worker library designed to provide efficient caching strategies for web applications. It offers a simple yet powerful way to cache network requests and responses using IndexedDB, enabling offline access and performance optimization.

⚠️ **Please note that Zephyr is currently under development and may not be suitable for production use. Use at your own risk.**


## Installation

You can either install Zephyr via npm:

```
npm install @solutas/zephyr --save
```
or load the installer via CDN

## Setup

To integrate Zephyr into your web application, follow these steps:

1. Create the `zephyrConfig.js` file to your root directory of the project.
2. Add the following code to your HTML file, preferably before the closing </body> tag or use include the ```zephyrInstall.js``` script from lib, to register the service worker:

```html
<!-- in your head section -->
<script type="module" src="https://www.unpkg.com/@solutas/zephyr@0.0.3/lib/zephrInstall.js"></script>
```

or you can manually load the web worker like this (or copy the file when isntalled via npm):

```javascript
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
```

## Configuration
In the `zephyrConfig.js` file, define your caching rules and configuration. Zephyr uses regular expressions (regex) for pattern matching in the rules. Here are some examples:

- `.*\\/api\\/getProducts$`: Matches any URL ending with `/api/getProducts`.
- `.*\\.(png|jpg|js)$`: Matches any URL ending with `.png`, `.jpg`, or `.js`.
- `^https?://example.com/api/.*\\.json$`: Matches any JSON file under the `/api` path on `example.com`.
- `.*\\.json$`: Matches any JSON file.


```javascript

// either use cdn or copy the worker to your public site somewhere, while the zephyrConfig.js file must be in root
// this can be anywhere
importScripts("https://www.unpkg.com/@solutas/zephyr@0.0.3/lib/zephyrWorker.js");

// Define your configuration, including resources to cache
const config = { 
    rules: [
        {
            test: '.*\\/api\\/graphqlapi',
            method: 'POST',
            cache: '1440', // 1 day in minutes
        },
        {
            test: '.*\\.(png|jpg|js)$',
            method: 'GET',
            key: '$path',
            cache: 90, // 1 hour 30 minutes in minutes
        },        
    ]
};

// Initialize the worker with the configuration
if (initZephyr) {
    initZephyr(config);
} else {
    console.error("Zephyr worker initialization function not found.");
}
```

Replace the example rules with your specific caching requirements.

## Debug
You can add ```?zephyrDebug=true``` to the url to get some more debug information in the developer console.

## What It Does
Zephyr intercepts network requests made by your web application and caches responses based on the defined rules in zephyrConfig.js. This allows for faster subsequent loads of resources and enables offline access to cached content.
Zephyr can also cache POST requests. It will take the hash of the payload as key to differenciate. Please be careful not to save sensitive data.

## GitHub Issues
For inquiries, bug reports, and support, please use GitHub Issues: [Zephyr Issues](https://github.com/solutas/zephyr/issues)


## License

Zephyr is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

© 2019-2024 SOLUTAS GmbH. All Rights Reserved.