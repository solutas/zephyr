# Zephyr
Zephyr is a lightweight service worker library designed to provide efficient caching strategies for web applications. It offers a simple yet powerful way to cache network requests and responses using IndexedDB, enabling offline access and performance optimization.

⚠️ **Please note that Zephyr is currently under development and may not be suitable for production use. Use at your own risk.**


## Installation

To integrate Zephyr into your web application, follow these steps:

1. Add the `zephyrConfig.js` file to your root directory of the project.
2. Add the following code to your HTML file, preferably before the closing </body> tag or use include the ```zephyrInstall.js``` script from lib, to register the service worker:

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

// you can also point to the CDN version or where ever it is located
importScripts("./lib/zephyrWorker.js");

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


## What It Does
Zephyr intercepts network requests made by your web application and caches responses based on the defined rules in zephyrConfig.js. This allows for faster subsequent loads of resources and enables offline access to cached content.


## GitHub Issues
For inquiries, bug reports, and support, please use GitHub Issues: [Zephyr Issues](https://github.com/solutas/zephyr/issues)


## License

Zephyr is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

© 2019-2024 SOLUTAS GmbH. All Rights Reserved.