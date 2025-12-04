(function() {
  'use strict';
  
  // Fingerprint Injection Script
  // Generated at: 2025-12-04T16:10:45.685Z
  
  // Native function wrapper utility
  const wrapNative = (function() {
    return function(originalFn, wrapperFn, options) {
      options = options || {};
      const wrapped = function() {
        return wrapperFn.call(this, originalFn, arguments, this);
      };
      
      Object.defineProperty(wrapped, 'name', {
        value: options.name || originalFn.name,
        configurable: true
      });
      
      Object.defineProperty(wrapped, 'length', {
        value: options.length !== undefined ? options.length : originalFn.length,
        configurable: true
      });
      
      const nativeString = 'function ' + (options.name || originalFn.name) + '() { [native code] }';
      wrapped.toString = function() { return nativeString; };
      wrapped.toSource = function() { return nativeString; };
      
      return wrapped;
    };
  })();

// === NAVIGATOR SPOOFING ===
  
(function() {
  'use strict';
  
  // Navigator spoofing configuration
  const config = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    appVersion: "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    platform: "Win32",
    vendor: "Google Inc.",
    product: "Gecko",
    productSub: "20030107",
    appName: "Netscape",
    appCodeName: "Mozilla",
    hardwareConcurrency: 4,
    deviceMemory: 8,
    maxTouchPoints: 0,
    language: "en-US",
    languages: ["en-US","en"],
    webdriver: false,
    doNotTrack: null,
    globalPrivacyControl: undefined
  };
  
  const navigatorProto = Object.getPrototypeOf(navigator);
  
  // Helper to create native-looking getter
  function createGetter(name, value) {
    const getter = function() { return value; };
    Object.defineProperty(getter, 'name', {
      value: 'get ' + name,
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeStr = 'function get ' + name + '() { [native code] }';
    getter.toString = function() { return nativeStr; };
    return getter;
  }
  
  // Spoof simple properties
  const simpleProps = [
    'userAgent', 'appVersion', 'platform', 'vendor', 'product',
    'productSub', 'appName', 'appCodeName', 'hardwareConcurrency',
    'deviceMemory', 'maxTouchPoints', 'language', 'doNotTrack',
    'globalPrivacyControl', 'webdriver'
  ];
  
  for (const prop of simpleProps) {
    if (config[prop] !== undefined) {
      try {
        Object.defineProperty(navigatorProto, prop, {
          get: createGetter(prop, config[prop]),
          set: undefined,
          enumerable: true,
          configurable: true
        });
      } catch (e) {
        // Property may not be configurable
      }
    }
  }
  
  // Spoof languages (frozen array)
  try {
    const frozenLanguages = Object.freeze([...config.languages]);
    Object.defineProperty(navigatorProto, 'languages', {
      get: createGetter('languages', frozenLanguages),
      set: undefined,
      enumerable: true,
      configurable: true
    });
  } catch (e) {
    // Property may not be configurable
  }

  // Fallback: define properties directly on the navigator instance
  try {
    for (const prop of simpleProps) {
      if (config[prop] !== undefined) {
        try {
          Object.defineProperty(navigator, prop, {
            get: createGetter(prop, config[prop]),
            set: undefined,
            enumerable: true,
            configurable: true
          });
        } catch (_) {}
      }
    }
    try {
      const frozenLanguages2 = Object.freeze([...config.languages]);
      Object.defineProperty(navigator, 'languages', {
        get: createGetter('languages', frozenLanguages2),
        set: undefined,
        enumerable: true,
        configurable: true
      });
    } catch (_) {}
  } catch (_) {}

  
})();

// === BROWSERBEHAVIOR SPOOFING ===
  
(function() {
  'use strict';
  
  const config = {"browser":{"type":"chrome","version":"120.0.0.0","majorVersion":120},"userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36","acceptLanguage":"en-US,en;q=0.9","platform":"Windows","mobile":false,"emulateChrome":true,"cleanElectronTraces":true,"hideAutomation":true};
  
  // Emulate window.chrome for Chrome browser (Req 28.1)
  if (config.emulateChrome && config.browser.type === 'chrome') {
    const createRuntime = function() {
      return {
        OnInstalledReason: {
          CHROME_UPDATE: 'chrome_update',
          INSTALL: 'install',
          SHARED_MODULE_UPDATE: 'shared_module_update',
          UPDATE: 'update'
        },
        OnRestartRequiredReason: {
          APP_UPDATE: 'app_update',
          OS_UPDATE: 'os_update',
          PERIODIC: 'periodic'
        },
        PlatformArch: {
          ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64',
          X86_32: 'x86-32', X86_64: 'x86-64'
        },
        PlatformNaclArch: {
          ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64',
          X86_32: 'x86-32', X86_64: 'x86-64'
        },
        PlatformOs: {
          ANDROID: 'android', CROS: 'cros', LINUX: 'linux',
          MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win'
        },
        RequestUpdateCheckStatus: {
          NO_UPDATE: 'no_update', THROTTLED: 'throttled',
          UPDATE_AVAILABLE: 'update_available'
        },
        connect: function() { return undefined; },
        sendMessage: function() { return undefined; },
        id: undefined
      };
    };
    
    const csi = function() {
      return {
        startE: Date.now(), onloadT: Date.now(),
        pageT: Math.random() * 1000, tran: 15
      };
    };
    Object.defineProperty(csi, 'name', { value: 'csi' });
    csi.toString = function() { return 'function csi() { [native code] }'; };
    
    const loadTimes = function() {
      const now = Date.now() / 1000;
      return {
        commitLoadTime: now, connectionInfo: 'h2',
        finishDocumentLoadTime: now, finishLoadTime: now,
        firstPaintAfterLoadTime: 0, firstPaintTime: now,
        navigationType: 'Other', npnNegotiatedProtocol: 'h2',
        requestTime: now, startLoadTime: now,
        wasAlternateProtocolAvailable: false,
        wasFetchedViaSpdy: true, wasNpnNegotiated: true
      };
    };
    Object.defineProperty(loadTimes, 'name', { value: 'loadTimes' });
    loadTimes.toString = function() { return 'function loadTimes() { [native code] }'; };
    
    const chromeObj = {
      app: {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getDetails: function() { return null; },
        getIsInstalled: function() { return false; },
        runningState: function() { return 'cannot_run'; }
      },
      csi: csi,
      loadTimes: loadTimes,
      runtime: createRuntime()
    };
    
    try {
      Object.defineProperty(window, 'chrome', {
        value: chromeObj, writable: true, enumerable: true, configurable: true
      });
    } catch (e) { window.chrome = chromeObj; }
  }
  
  // Clean Electron traces (Req 28.3, 28.10)
  if (config.cleanElectronTraces) {
    const electronProps = ['process', 'require', '__dirname', '__filename', 'module', 'exports', 'Buffer', 'global'];
    for (const prop of electronProps) {
      try {
        if (prop in window) delete window[prop];
      } catch (e) {
        try {
          Object.defineProperty(window, prop, {
            get: function() { return undefined; },
            enumerable: false, configurable: true
          });
        } catch (e2) {}
      }
    }
    
    // Clean Electron IPC bridges
    const ipcBridges = ['electronAPI', 'electron', 'ipcRenderer', 'remote', 'shell', 'contextBridge'];
    for (const bridge of ipcBridges) {
      try { if (bridge in window) delete window[bridge]; } catch (e) {}
    }
  }
  
  // Hide automation flags
  if (config.hideAutomation) {
    const automationProps = [
      'cdc_adoQpoasnfa76pfcZLmcfl_Array', 'cdc_adoQpoasnfa76pfcZLmcfl_Promise',
      '__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_function',
      '__driver_unwrapped', '__webdriver_unwrapped', '__selenium_unwrapped',
      '_Selenium_IDE_Recorder', '_selenium', 'calledSelenium',
      '$chrome_asyncScriptInfo', '__nightmare', '__phantomas', '_phantom',
      'phantom', 'callPhantom', '__puppeteer_evaluation_script__'
    ];
    
    for (const prop of automationProps) {
      try { if (prop in window) delete window[prop]; } catch (e) {}
    }
    
    // Hide navigator.webdriver
    try {
      Object.defineProperty(navigator, 'webdriver', {
        get: function() { return undefined; },
        enumerable: true, configurable: true
      });
    } catch (e) {}
    
    // Clean document automation properties
    if (typeof document !== 'undefined') {
      try {
        const keys = Object.keys(document);
        for (const key of keys) {
          if (key.startsWith('$cdc_') || key.startsWith('cdc_')) {
            delete document[key];
          }
        }
      } catch (e) {}
    }
  }
})();

// === WEBGL SPOOFING ===
  
(function() {
  'use strict';
  
  // WebGL spoofing configuration
  const config = {
    mode: "custom",
    vendor: "Google Inc. (Intel)",
    renderer: "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    unmaskedVendor: "Google Inc. (Intel)",
    unmaskedRenderer: "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    extensions: null,
    shaderPrecision: null,
    imageNoise: true,
    noiseLevel: "medium",
    noiseDistribution: "uniform",
    seed: 1793819144
  };
  
  // Skip if mode is 'off' or 'real'
  if (config.mode === 'off' || config.mode === 'real') {
    return;
  }
  
  // WebGL constants
  const VENDOR = 0x1F00;
  const RENDERER = 0x1F01;
  const UNMASKED_VENDOR_WEBGL = 0x9245;
  const UNMASKED_RENDERER_WEBGL = 0x9246;
  
  // Mulberry32 PRNG for deterministic noise
  function createSeededRNG(seed) {
    let state = seed >>> 0;
    return function() {
      let t = state += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  
  // Get noise scale based on level
  function getNoiseScale(level) {
    switch (level) {
      case 'off': return 0;
      case 'low': return 0.5;
      case 'medium': return 2;
      case 'high': return 5;
      default: return 2;
    }
  }
  
  // Create noise generator
  let rng = createSeededRNG(config.seed);
  const noiseScale = getNoiseScale(config.noiseLevel);
  
  // Generate noise value
  function getNoise() {
    if (config.noiseLevel === 'off') return 0;
    
    let noise;
    if (config.noiseDistribution === 'gaussian') {
      const u1 = Math.max(rng(), 1e-10);
      const u2 = rng();
      noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    } else {
      noise = rng() * 2 - 1;
    }
    return noise * noiseScale;
  }
  
  // Reset RNG for deterministic results
  function resetRNG() {
    rng = createSeededRNG(config.seed);
  }
  
  // Apply noise to pixel data
  function applyNoiseToPixels(pixels) {
    if (!config.imageNoise || config.noiseLevel === 'off') return;
    
    resetRNG();
    for (let i = 0; i < pixels.length; i += 4) {
      const noise = getNoise();
      pixels[i] = Math.max(0, Math.min(255, Math.round(pixels[i] + noise)));
      pixels[i + 1] = Math.max(0, Math.min(255, Math.round(pixels[i + 1] + noise)));
      pixels[i + 2] = Math.max(0, Math.min(255, Math.round(pixels[i + 2] + noise)));
    }
  }
  
  // Helper to create native-looking function
  function createNativeFunction(name, length, fn) {
    Object.defineProperty(fn, 'name', {
      value: name,
      writable: false,
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(fn, 'length', {
      value: length,
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeStr = 'function ' + name + '() { [native code] }';
    fn.toString = function() { return nativeStr; };
    return fn;
  }
  
  // Resolve global scope for both window and worker
  const scope = (typeof window !== 'undefined') ? window : (typeof self !== 'undefined' ? self : globalThis);
  
  // Helper to safely get prototype
  function getProto(cls) {
    try { return cls.prototype; } catch(e) { return null; }
  }

  // Spoof getParameter for both WebGL contexts
  function spoofGetParameter(contextName) {
    const targetClass = scope[contextName];
    if (typeof targetClass === 'undefined') return;
    
    const proto = targetClass.prototype;
    const originalGetParameter = proto.getParameter;
    
    proto.getParameter = createNativeFunction('getParameter', 1, function(pname) {
      // Standard Vendor/Renderer
      if (pname === 0x1F00 && config.vendor) return config.vendor; // VENDOR
      if (pname === 0x1F01 && config.renderer) return config.renderer; // RENDERER
      
      // Unmasked Vendor/Renderer (WEBGL_debug_renderer_info)
      // Use unmaskedVendor if available, otherwise fall back to vendor
      if (pname === 0x9245 || pname === 37445) {
        return config.unmaskedVendor || config.vendor || originalGetParameter.apply(this, arguments);
      }
      // Use unmaskedRenderer if available, otherwise fall back to renderer
      if (pname === 0x9246 || pname === 37446) {
        return config.unmaskedRenderer || config.renderer || originalGetParameter.apply(this, arguments);
      }
      
      return originalGetParameter.apply(this, arguments);
    });
  }

  // Handle OffscreenCanvas specifically if it exists
  if (typeof scope.OffscreenCanvas !== 'undefined') {
    try {
      const originalGetContext = scope.OffscreenCanvas.prototype.getContext;
      scope.OffscreenCanvas.prototype.getContext = createNativeFunction('getContext', 1, function(type, options) {
        const ctx = originalGetContext.call(this, type, options);
        if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) {
          // Ensure the context is spoofed (it should be if it shares prototype, but we force check)
          try {
             // We can't easily wrap methods on the instance if they are already wrapped on prototype
             // But we can check if the prototype wrapper applied.
             // Usually WebGLRenderingContext is shared.
          } catch(e) {}
        }
        return ctx;
      });
    } catch(e) {}
  }
  
  // Spoof getSupportedExtensions
  function spoofGetSupportedExtensions(contextName) {
    if (typeof scope[contextName] === 'undefined' || !config.extensions) return;
    
    const proto = scope[contextName].prototype;
    const originalGetSupportedExtensions = proto.getSupportedExtensions;
    
    proto.getSupportedExtensions = createNativeFunction('getSupportedExtensions', 0, function() {
      const exts = [...config.extensions];
      // Ensure WEBGL_debug_renderer_info is present if we are spoofing unmasked values
      if (config.unmaskedVendor || config.unmaskedRenderer) {
        if (!exts.includes('WEBGL_debug_renderer_info')) {
          exts.push('WEBGL_debug_renderer_info');
        }
      }
      return exts;
    });
  }
  
  // Spoof getExtension for WEBGL_debug_renderer_info and others
  function spoofGetExtension(contextName) {
    if (typeof scope[contextName] === 'undefined') return;
    const proto = scope[contextName].prototype;
    const originalGetExtension = proto.getExtension;
    proto.getExtension = createNativeFunction('getExtension', 1, function(name) {
      const n = String(name);
      if (n === 'WEBGL_debug_renderer_info' || n === 'webkit_WEBGL_debug_renderer_info') {
        return { 
          UNMASKED_VENDOR_WEBGL: 0x9245, 
          UNMASKED_RENDERER_WEBGL: 0x9246 
        };
      }
      return originalGetExtension.apply(this, arguments);
    });
  }
  
  // Spoof readPixels with noise
  function spoofReadPixels(contextName) {
    if (typeof scope[contextName] === 'undefined') return;
    
    const proto = scope[contextName].prototype;
    const originalReadPixels = proto.readPixels;
    
    proto.readPixels = createNativeFunction('readPixels', 7, function(x, y, width, height, format, type, pixels) {
      const result = originalReadPixels.apply(this, arguments);
      if (pixels && (pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray)) {
        applyNoiseToPixels(pixels);
      }
      return result;
    });
  }
  
  // Apply spoofing to both WebGL contexts
  spoofGetParameter('WebGLRenderingContext');
  spoofGetParameter('WebGL2RenderingContext');
  spoofGetSupportedExtensions('WebGLRenderingContext');
  spoofGetSupportedExtensions('WebGL2RenderingContext');
  spoofGetExtension('WebGLRenderingContext');
  spoofGetExtension('WebGL2RenderingContext');
  spoofReadPixels('WebGLRenderingContext');
  spoofReadPixels('WebGL2RenderingContext');
})();

// === CANVAS SPOOFING ===
  
(function() {
  'use strict';
  
  // Canvas spoofing configuration
  const config = {
    mode: "noise",
    noiseLevel: "medium",
    noiseDistribution: "uniform",
    seed: 4185939325
  };
  
  // Skip if mode is 'off' or 'real'
  if (config.mode === 'off' || config.mode === 'real') {
    return;
  }
  
  // Mulberry32 PRNG for deterministic noise
  function createSeededRNG(seed) {
    let state = seed >>> 0;
    return function() {
      let t = state += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  
  // Get noise scale based on level
  function getNoiseScale(level) {
    switch (level) {
      case 'off': return 0;
      case 'low': return 0.5;
      case 'medium': return 2;
      case 'high': return 5;
      default: return 2;
    }
  }
  
  // Create noise generator
  const rng = createSeededRNG(config.seed);
  const noiseScale = getNoiseScale(config.noiseLevel);
  
  // Generate noise value
  function getNoise() {
    if (config.noiseLevel === 'off') return 0;
    
    let noise;
    if (config.noiseDistribution === 'gaussian') {
      const u1 = Math.max(rng(), 1e-10);
      const u2 = rng();
      noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    } else {
      noise = rng() * 2 - 1;
    }
    return noise * noiseScale;
  }
  
  // Apply noise to ImageData
  function applyNoiseToImageData(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = getNoise();
      data[i] = Math.max(0, Math.min(255, Math.round(data[i] + noise)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1] + noise)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2] + noise)));
    }
    return imageData;
  }
  
  // Helper to create native-looking function
  function createNativeFunction(name, length, fn) {
    Object.defineProperty(fn, 'name', {
      value: name,
      writable: false,
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(fn, 'length', {
      value: length,
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeStr = 'function ' + name + '() { [native code] }';
    fn.toString = function() { return nativeStr; };
    return fn;
  }
  
  // Spoof toDataURL
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = createNativeFunction('toDataURL', 0, function() {
    const canvas = this;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyNoiseToImageData(imageData);
        ctx.putImageData(imageData, 0, 0);
      } catch (e) {
        // Tainted canvas, return original
      }
    }
    return originalToDataURL.apply(canvas, arguments);
  });
  
  // Spoof toBlob
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = createNativeFunction('toBlob', 1, function(callback) {
    const canvas = this;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyNoiseToImageData(imageData);
        ctx.putImageData(imageData, 0, 0);
      } catch (e) {
        // Tainted canvas, call original
      }
    }
    return originalToBlob.apply(canvas, arguments);
  });
  
  // Spoof getImageData
  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = createNativeFunction('getImageData', 4, function(sx, sy, sw, sh) {
    const imageData = originalGetImageData.apply(this, arguments);
    applyNoiseToImageData(imageData);
    return imageData;
  });
})();

// === FONTS SPOOFING ===
  
(function() {
  'use strict';
  
  // Font spoofing configuration
  const config = {
    mode: "custom",
    list: ["Arial","Helvetica","Times New Roman","Verdana","Georgia"],
    seed: 86205228
  };
  
  // Skip if mode is 'system'
  if (config.mode === 'system') {
    return;
  }
  
  // Base fonts (generic families)
  const BASE_FONTS = ['monospace', 'sans-serif', 'serif'];
  
  // Normalize font name for comparison
  function normalizeFontName(fontName) {
    if (!fontName || typeof fontName !== 'string') return '';
    return fontName.replace(/['"]/g, '').trim().toLowerCase();
  }
  
  // Check if font is in allowed list
  function isFontAllowed(fontFamily) {
    const normalized = normalizeFontName(fontFamily);
    return config.list.some(function(f) {
      return normalizeFontName(f) === normalized;
    });
  }
  
  // Parse font-family string
  function parseFontFamily(fontFamily) {
    if (!fontFamily || typeof fontFamily !== 'string') return [];
    return fontFamily.split(',').map(function(font) {
      return font.replace(/['"]/g, '').trim();
    }).filter(function(font) { return font.length > 0; });
  }
  
  // Extract font-family from CSS font string
  function extractFontFamily(fontString) {
    if (!fontString || typeof fontString !== 'string') return 'sans-serif';
    var sizeMatch = fontString.match(/(\d+(?:\.\d+)?(?:px|pt|em|rem|%|vh|vw|vmin|vmax|ex|ch|cm|mm|in|pc))/i);
    if (sizeMatch) {
      var afterSize = fontString.substring(fontString.indexOf(sizeMatch[0]) + sizeMatch[0].length);
      var family = afterSize.replace(/^\/[\d.]+/, '').trim();
      return family || 'sans-serif';
    }
    return fontString;
  }
  
  // Helper to create native-looking function
  function createNativeFunction(name, length, fn) {
    Object.defineProperty(fn, 'name', {
      value: name,
      writable: false,
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(fn, 'length', {
      value: length,
      writable: false,
      enumerable: false,
      configurable: true
    });
    var nativeStr = 'function ' + name + '() { [native code] }';
    fn.toString = function() { return nativeStr; };
    return fn;
  }
  
  // Spoof document.fonts.check
  if (document.fonts && document.fonts.check) {
    var originalCheck = document.fonts.check.bind(document.fonts);
    document.fonts.check = createNativeFunction('check', 1, function(font, text) {
      var fontFamily = extractFontFamily(font);
      var fonts = parseFontFamily(fontFamily);
      
      for (var i = 0; i < fonts.length; i++) {
        var fontName = fonts[i];
        if (BASE_FONTS.indexOf(fontName.toLowerCase()) !== -1) {
          continue;
        }
        if (isFontAllowed(fontName)) {
          return originalCheck(font, text);
        }
      }
      
      // Check if only generic families
      var hasNonGeneric = fonts.some(function(f) {
        return BASE_FONTS.indexOf(f.toLowerCase()) === -1;
      });
      
      if (hasNonGeneric) {
        return false;
      }
      
      return originalCheck(font, text);
    });
  }
  
  // Spoof document.fonts.load
  if (document.fonts && document.fonts.load) {
    var originalLoad = document.fonts.load.bind(document.fonts);
    document.fonts.load = createNativeFunction('load', 1, function(font, text) {
      var fontFamily = extractFontFamily(font);
      var fonts = parseFontFamily(fontFamily);
      
      for (var i = 0; i < fonts.length; i++) {
        var fontName = fonts[i];
        if (BASE_FONTS.indexOf(fontName.toLowerCase()) !== -1) {
          continue;
        }
        if (isFontAllowed(fontName)) {
          return originalLoad(font, text);
        }
      }
      
      // Font not allowed, return empty resolved promise
      return Promise.resolve([]);
    });
  }
})();

// === CLIENTRECTS SPOOFING ===
  
(function() {
  'use strict';
  
  // ClientRects spoofing configuration
  const config = {
    mode: "noise",
    noiseLevel: "low",
    seed: 1428880210
  };
  
  // Skip if mode is 'off'
  if (config.mode === 'off') {
    return;
  }
  
  // Mulberry32 PRNG for deterministic noise
  function createSeededRNG(seed) {
    let state = seed >>> 0;
    return function() {
      let t = state += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  
  // Get noise scale based on level
  function getNoiseScale(level) {
    switch (level) {
      case 'off': return 0;
      case 'low': return 0.001;
      case 'medium': return 0.005;
      case 'high': return 0.01;
      default: return 0.001;
    }
  }
  
  const noiseScale = getNoiseScale(config.noiseLevel);
  
  // Element noise cache
  const elementNoiseCache = new WeakMap();
  
  // Hash element for consistent noise
  function hashElement(element) {
    let hash = 0;
    const tagName = element.tagName || '';
    for (let i = 0; i < tagName.length; i++) {
      hash = ((hash << 5) - hash) + tagName.charCodeAt(i);
      hash = hash & hash;
    }
    const id = element.id || '';
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    const className = element.className || '';
    const classStr = typeof className === 'string' ? className : className.toString();
    for (let i = 0; i < classStr.length; i++) {
      hash = ((hash << 5) - hash) + classStr.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Get or create noise for element
  function getElementNoise(element) {
    if (noiseScale === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    if (elementNoiseCache.has(element)) {
      return elementNoiseCache.get(element);
    }
    
    const elementHash = hashElement(element);
    const elementSeed = (config.seed + elementHash) >>> 0;
    const rng = createSeededRNG(elementSeed);
    
    const noise = {
      x: (rng() * 2 - 1) * noiseScale,
      y: (rng() * 2 - 1) * noiseScale,
      width: (rng() * 2 - 1) * noiseScale,
      height: (rng() * 2 - 1) * noiseScale
    };
    
    elementNoiseCache.set(element, noise);
    return noise;
  }
  
  // Create noisy DOMRect
  function createNoisyDOMRect(rect, noise) {
    const x = rect.x + noise.x;
    const y = rect.y + noise.y;
    const width = rect.width + noise.width;
    const height = rect.height + noise.height;
    
    return {
      x: x,
      y: y,
      width: width,
      height: height,
      top: y,
      right: x + width,
      bottom: y + height,
      left: x,
      toJSON: function() {
        return {
          x: this.x, y: this.y, width: this.width, height: this.height,
          top: this.top, right: this.right, bottom: this.bottom, left: this.left
        };
      }
    };
  }
  
  // Helper to create native-looking function
  function createNativeFunction(name, length, fn) {
    Object.defineProperty(fn, 'name', {
      value: name,
      writable: false,
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(fn, 'length', {
      value: length,
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeStr = 'function ' + name + '() { [native code] }';
    fn.toString = function() { return nativeStr; };
    return fn;
  }
  
  // Spoof getBoundingClientRect
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = createNativeFunction('getBoundingClientRect', 0, function() {
    const originalRect = originalGetBoundingClientRect.apply(this, arguments);
    const noise = getElementNoise(this);
    return createNoisyDOMRect(originalRect, noise);
  });
  
  // Spoof getClientRects
  const originalGetClientRects = Element.prototype.getClientRects;
  Element.prototype.getClientRects = createNativeFunction('getClientRects', 0, function() {
    const originalRects = originalGetClientRects.apply(this, arguments);
    const baseNoise = getElementNoise(this);
    
    const noisyRects = [];
    for (let i = 0; i < originalRects.length; i++) {
      const rectNoise = {
        x: baseNoise.x + (i * 0.0001),
        y: baseNoise.y + (i * 0.0001),
        width: baseNoise.width,
        height: baseNoise.height
      };
      noisyRects.push(createNoisyDOMRect(originalRects[i], rectNoise));
    }
    
    // Create DOMRectList-like object
    const rectList = {
      length: noisyRects.length,
      item: function(index) {
        return index >= 0 && index < noisyRects.length ? noisyRects[index] : null;
      }
    };
    
    for (let i = 0; i < noisyRects.length; i++) {
      rectList[i] = noisyRects[i];
    }
    
    rectList[Symbol.iterator] = function* () {
      for (let i = 0; i < noisyRects.length; i++) {
        yield noisyRects[i];
      }
    };
    
    return rectList;
  });
})();

// === TIMEZONE SPOOFING ===
  
(function() {
  'use strict';
  
  // Timezone spoofing configuration
  const config = {
    mode: "custom",
    name: "America/New_York",
    offset: -300
  };
  
  // Skip if mode is 'real'
  if (config.mode === 'real') {
    return;
  }
  
  // Helper to create native-looking function
  function createNativeFunction(name, length, fn) {
    Object.defineProperty(fn, 'name', {
      value: name,
      writable: false,
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(fn, 'length', {
      value: length,
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeStr = 'function ' + name + '() { [native code] }';
    fn.toString = function() { return nativeStr; };
    return fn;
  }
  
  // Spoof Date.prototype.getTimezoneOffset (Req 11.1)
  const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
  Date.prototype.getTimezoneOffset = createNativeFunction('getTimezoneOffset', 0, function() {
    // Return negated offset (getTimezoneOffset returns positive for west of UTC)
    return -config.offset;
  });
  
  // Spoof Intl.DateTimeFormat (Req 11.2, 11.3)
  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat !== 'undefined') {
    const OriginalDateTimeFormat = Intl.DateTimeFormat;
    
    const SpoofedDateTimeFormat = function(locales, options) {
      const mergedOptions = Object.assign({}, options);
      
      // Only set timezone if not explicitly provided
      if (!mergedOptions.timeZone) {
        mergedOptions.timeZone = config.name;
      }
      
      return new OriginalDateTimeFormat(locales, mergedOptions);
    };
    
    // Make constructor appear native
    Object.defineProperty(SpoofedDateTimeFormat, 'name', {
      value: 'DateTimeFormat',
      writable: false,
      enumerable: false,
      configurable: true
    });
    
    Object.defineProperty(SpoofedDateTimeFormat, 'length', {
      value: 0,
      writable: false,
      enumerable: false,
      configurable: true
    });
    
    SpoofedDateTimeFormat.toString = function() {
      return 'function DateTimeFormat() { [native code] }';
    };
    
    // Copy static methods
    SpoofedDateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf;
    
    // Set prototype
    SpoofedDateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
    
    // Replace Intl.DateTimeFormat
    Object.defineProperty(Intl, 'DateTimeFormat', {
      value: SpoofedDateTimeFormat,
      writable: true,
      enumerable: false,
      configurable: true
    });
  }
})();

// === GEOLOCATION SPOOFING ===
  
(function() {
  'use strict';
  
  // Geolocation spoofing configuration
  const config = {
    mode: "custom",
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 100,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  };
  
  // Skip if mode is 'real' or geolocation not available
  if (config.mode === 'real' || typeof navigator === 'undefined' || !navigator.geolocation) {
    return;
  }
  
  // Watch tracking
  let watchIdCounter = 1;
  const watchCallbacks = new Map();
  const watchIntervals = new Map();
  
  // Helper to create native-looking function
  function createNativeFunction(name, length, fn) {
    Object.defineProperty(fn, 'name', {
      value: name,
      writable: false,
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(fn, 'length', {
      value: length,
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeStr = 'function ' + name + '() { [native code] }';
    fn.toString = function() { return nativeStr; };
    return fn;
  }
  
  // Create position object
  function createPosition() {
    const coords = Object.freeze({
      latitude: config.latitude,
      longitude: config.longitude,
      accuracy: config.accuracy,
      altitude: config.altitude,
      altitudeAccuracy: config.altitudeAccuracy,
      heading: config.heading,
      speed: config.speed
    });
    
    return Object.freeze({
      coords: coords,
      timestamp: Date.now()
    });
  }
  
  // Create error object
  function createError(code, message) {
    return Object.freeze({
      code: code,
      message: message,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    });
  }
  
  const geolocation = navigator.geolocation;
  const originalGetCurrentPosition = geolocation.getCurrentPosition;
  const originalWatchPosition = geolocation.watchPosition;
  const originalClearWatch = geolocation.clearWatch;
  
  // Spoof getCurrentPosition (Req 12.4)
  geolocation.getCurrentPosition = createNativeFunction('getCurrentPosition', 1, 
    function(successCallback, errorCallback, options) {
      if (config.mode === 'deny') {
        if (typeof errorCallback === 'function') {
          setTimeout(function() {
            errorCallback(createError(1, 'User denied Geolocation'));
          }, 0);
        }
        return;
      }
      
      if (typeof successCallback === 'function') {
        setTimeout(function() {
          successCallback(createPosition());
        }, 0);
      }
    }
  );
  
  // Spoof watchPosition (Req 12.5)
  geolocation.watchPosition = createNativeFunction('watchPosition', 1,
    function(successCallback, errorCallback, options) {
      const watchId = watchIdCounter++;
      
      if (config.mode === 'deny') {
        if (typeof errorCallback === 'function') {
          setTimeout(function() {
            errorCallback(createError(1, 'User denied Geolocation'));
          }, 0);
        }
        return watchId;
      }
      
      watchCallbacks.set(watchId, { success: successCallback, error: errorCallback });
      
      if (typeof successCallback === 'function') {
        setTimeout(function() {
          successCallback(createPosition());
        }, 0);
        
        const updateInterval = (options && options.maximumAge) || 5000;
        const intervalId = setInterval(function() {
          if (!watchCallbacks.has(watchId)) {
            clearInterval(intervalId);
            return;
          }
          successCallback(createPosition());
        }, updateInterval);
        
        watchIntervals.set(watchId, intervalId);
      }
      
      return watchId;
    }
  );
  
  // Spoof clearWatch
  geolocation.clearWatch = createNativeFunction('clearWatch', 1,
    function(watchId) {
      watchCallbacks.delete(watchId);
      const intervalId = watchIntervals.get(watchId);
      if (intervalId) {
        clearInterval(intervalId);
        watchIntervals.delete(watchId);
      }
    }
  );
})();

// === MEDIADEVICES SPOOFING ===
  
(function() {
  'use strict';
  
  // Media devices spoofing configuration
  const config = {
    mode: "fake",
    seed: 1353333248,
    devices: [{"kind":"audioinput","label":"Default Audio Device"},{"kind":"audiooutput","label":"Default Audio Output"},{"kind":"videoinput","label":"Default Camera"}]
  };
  
  // Skip if mode is 'real'
  if (config.mode === 'real') {
    return;
  }
  
  // Check if mediaDevices exists
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return;
  }
  
  // Mulberry32 PRNG for deterministic device IDs
  let rngState = config.seed >>> 0;
  
  function seededRandom() {
    let t = rngState += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  
  function resetRNG() {
    rngState = config.seed >>> 0;
  }
  
  // Generate deterministic device ID (Req 15.4)
  function generateDeviceId(index, kind) {
    resetRNG();
    for (let i = 0; i <= index; i++) {
      seededRandom();
    }
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const part = Math.floor(seededRandom() * 0xFFFFFFFF)
        .toString(16)
        .padStart(8, '0');
      parts.push(part);
    }
    return parts.join('');
  }
  
  // Generate deterministic group ID
  function generateGroupId(kind) {
    resetRNG();
    const kindOffset = kind === 'audioinput' ? 100 : 
                       kind === 'audiooutput' ? 200 : 300;
    for (let i = 0; i < kindOffset; i++) {
      seededRandom();
    }
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const part = Math.floor(seededRandom() * 0xFFFFFFFF)
        .toString(16)
        .padStart(8, '0');
      parts.push(part);
    }
    return parts.join('');
  }
  
  // Generic device labels (Req 15.5)
  const genericLabels = {
    audioinput: ['Default Audio Device', 'Microphone', 'Internal Microphone', 'Built-in Microphone'],
    audiooutput: ['Default Audio Output', 'Speakers', 'Internal Speakers', 'Built-in Speakers'],
    videoinput: ['Default Camera', 'Webcam', 'Integrated Camera', 'Built-in Camera']
  };
  
  function getGenericLabel(kind, index) {
    const labels = genericLabels[kind] || ['Unknown Device'];
    return labels[index % labels.length];
  }
  
  // Create fake MediaDeviceInfo object (Req 15.3)
  function createFakeDevice(deviceConfig, index) {
    const kind = deviceConfig.kind || 'audioinput';
    const label = deviceConfig.label || getGenericLabel(kind, index);
    const deviceId = deviceConfig.deviceId || generateDeviceId(index, kind);
    const groupId = deviceConfig.groupId || generateGroupId(kind);
    
    const device = {
      deviceId: deviceId,
      kind: kind,
      label: label,
      groupId: groupId,
      toJSON: function() {
        return {
          deviceId: this.deviceId,
          kind: this.kind,
          label: this.label,
          groupId: this.groupId
        };
      }
    };
    
    // Make toJSON appear native
    Object.defineProperty(device.toJSON, 'name', {
      value: 'toJSON',
      writable: false,
      enumerable: false,
      configurable: true
    });
    const nativeStr = 'function toJSON() { [native code] }';
    device.toJSON.toString = function() { return nativeStr; };
    
    return device;
  }
  
  // Store original method
  const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
  
  // Create spoofed enumerateDevices (Req 15.1)
  function spoofedEnumerateDevices() {
    // If mode is 'hide', return empty array (Req 15.2)
    if (config.mode === 'hide') {
      return Promise.resolve([]);
    }
    
    // Mode is 'fake' - return fake devices
    const fakeDevices = config.devices.map(function(deviceConfig, index) {
      return createFakeDevice(deviceConfig, index);
    });
    
    return Promise.resolve(fakeDevices);
  }
  
  // Make the function appear native
  Object.defineProperty(spoofedEnumerateDevices, 'name', {
    value: 'enumerateDevices',
    writable: false,
    enumerable: false,
    configurable: true
  });
  Object.defineProperty(spoofedEnumerateDevices, 'length', {
    value: 0,
    writable: false,
    enumerable: false,
    configurable: true
  });
  const nativeEnumerateStr = 'function enumerateDevices() { [native code] }';
  spoofedEnumerateDevices.toString = function() { return nativeEnumerateStr; };
  
  // Replace the method
  try {
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
      value: spoofedEnumerateDevices,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } catch (e) {
    navigator.mediaDevices.enumerateDevices = spoofedEnumerateDevices;
  }
})();

// === WEBRTC SPOOFING ===
  
(function() {
  'use strict';
  
  // WebRTC protection configuration
  const config = {"mode":"replace","publicIP":"auto","localIP":"192.168.1.100","whitelist":[],"enableFallback":true,"fallbackTimeout":5000,"dropNonRelay":false,"forceRelay":false};
  
  // IP patterns
  const ipPatterns = {
    privateIPv4: /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/,
    sdpCandidate: /candidate:(\S+) (\d+) (udp|tcp) (\d+) (\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}) (\d+)/gi
  };
  
  // Check whitelist
  function isWhitelisted(origin) {
    if (!config.whitelist || config.whitelist.length === 0) return false;
    return config.whitelist.some(pattern => {
      if (pattern === origin) return true;
      if (pattern.startsWith('*.')) {
        const domain = pattern.slice(2);
        return origin.endsWith(domain) || origin.endsWith('.' + domain);
      }
      try {
        const url = new URL(origin);
        return url.hostname === pattern || url.hostname.endsWith('.' + pattern);
      } catch (e) {
        return false;
      }
    });
  }
  
  // Filter SDP
  function filterSDP(sdp) {
    if (!sdp) return sdp;
    let filtered = sdp;
    
    // Replace private IPs in candidate lines
    filtered = filtered.replace(
      /candidate:(\S+) (\d+) (\S+) (\d+) (\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}) (\d+)/g,
      function(match, f, c, p, pr, ip, port) {
        if (ipPatterns.privateIPv4.test(ip)) {
          return 'candidate:' + f + ' ' + c + ' ' + p + ' ' + pr + ' ' + config.localIP + ' ' + port;
        }
        if (config.publicIP && config.publicIP !== 'auto') {
          return 'candidate:' + f + ' ' + c + ' ' + p + ' ' + pr + ' ' + config.publicIP + ' ' + port;
        }
        return match;
      }
    );
    
    // Replace IPs in c= lines
    filtered = filtered.replace(
      /c=IN IP4 (\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g,
      function(match, ip) {
        if (ipPatterns.privateIPv4.test(ip)) {
          return 'c=IN IP4 ' + config.localIP;
        }
        if (config.publicIP && config.publicIP !== 'auto') {
          return 'c=IN IP4 ' + config.publicIP;
        }
        return match;
      }
    );
    
    return filtered;
  }

  
  // Filter ICE candidate
  function filterICECandidate(candidate) {
    if (!candidate || !candidate.candidate) return candidate;
    const match = candidate.candidate.match(/candidate:\S+ \d+ \S+ \d+ (\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}) \d+/);
    if (match) {
      const ip = match[1];
      let newIP = ip;
      if (ipPatterns.privateIPv4.test(ip)) {
        newIP = config.localIP;
      } else if (config.publicIP && config.publicIP !== 'auto') {
        newIP = config.publicIP;
      }
      if (newIP !== ip) {
        return {
          candidate: candidate.candidate.replace(ip, newIP),
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment
        };
      }
    }
    return candidate;
  }
  
  // Store original
  const OriginalRTCPeerConnection = window.RTCPeerConnection;
  
  if (config.mode === 'disable') {
    // Disable mode
    const DisabledRTC = function() {
      throw new DOMException('RTCPeerConnection is disabled', 'NotSupportedError');
    };
    Object.defineProperty(DisabledRTC, 'name', { value: 'RTCPeerConnection' });
    DisabledRTC.toString = function() { return 'function RTCPeerConnection() { [native code] }'; };
    window.RTCPeerConnection = DisabledRTC;
    if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = DisabledRTC;
  } else if (config.mode === 'replace' && OriginalRTCPeerConnection) {
    // Replace mode
    const WrappedRTC = function(configuration, constraints) {
      if (isWhitelisted(window.location.origin)) {
        return new OriginalRTCPeerConnection(configuration, constraints);
      }
      
      const pc = new OriginalRTCPeerConnection(configuration, constraints);
      
      // Wrap setLocalDescription
      const origSetLocal = pc.setLocalDescription.bind(pc);
      pc.setLocalDescription = function(desc) {
        if (desc && desc.sdp) {
          desc = new RTCSessionDescription({ type: desc.type, sdp: filterSDP(desc.sdp) });
        }
        return origSetLocal(desc);
      };
      
      // Wrap createOffer
      const origOffer = pc.createOffer.bind(pc);
      pc.createOffer = function(opts) {
        return origOffer(opts).then(function(offer) {
          return new RTCSessionDescription({ type: offer.type, sdp: filterSDP(offer.sdp) });
        });
      };
      
      // Wrap createAnswer
      const origAnswer = pc.createAnswer.bind(pc);
      pc.createAnswer = function(opts) {
        return origAnswer(opts).then(function(answer) {
          return new RTCSessionDescription({ type: answer.type, sdp: filterSDP(answer.sdp) });
        });
      };

      
      // Intercept ICE candidates
      const origAddListener = pc.addEventListener.bind(pc);
      pc.addEventListener = function(type, listener, options) {
        if (type === 'icecandidate') {
          const wrapped = function(event) {
            if (event.candidate) {
              const filtered = filterICECandidate(event.candidate);
              if (filtered === null) return;
              listener.call(this, { ...event, candidate: filtered });
            } else {
              listener.call(this, event);
            }
          };
          return origAddListener(type, wrapped, options);
        }
        return origAddListener(type, listener, options);
      };
      
      // Handle onicecandidate
      let _handler = null;
      Object.defineProperty(pc, 'onicecandidate', {
        get: function() { return _handler; },
        set: function(h) {
          if (typeof h === 'function') {
            _handler = function(event) {
              if (event.candidate) {
                const filtered = filterICECandidate(event.candidate);
                if (filtered === null) return;
                h.call(this, { ...event, candidate: filtered });
              } else {
                h.call(this, event);
              }
            };
          } else {
            _handler = h;
          }
        }
      });
      
      return pc;
    };
    
    WrappedRTC.prototype = OriginalRTCPeerConnection.prototype;
    Object.defineProperty(WrappedRTC, 'name', { value: 'RTCPeerConnection' });
    WrappedRTC.toString = function() { return 'function RTCPeerConnection() { [native code] }'; };
    window.RTCPeerConnection = WrappedRTC;
    if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = WrappedRTC;
  }
  // 'real' mode: no changes needed
})();

// === SCREEN SPOOFING ===
  (function(){'use strict';
  try {
    var w = window;
    if (!w || !w.screen) return;

    // 1. Try to override properties on the screen instance
    try {
      Object.defineProperty(w.screen,'width',{get:function(){return 1920;},configurable:true,enumerable:true});
      Object.defineProperty(w.screen,'height',{get:function(){return 1080;},configurable:true,enumerable:true});
      Object.defineProperty(w.screen,'availWidth',{get:function(){return 1920;},configurable:true,enumerable:true});
      Object.defineProperty(w.screen,'availHeight',{get:function(){return 1080;},configurable:true,enumerable:true});
      Object.defineProperty(w.screen,'colorDepth',{get:function(){return 24;},configurable:true,enumerable:true});
      Object.defineProperty(w.screen,'pixelDepth',{get:function(){return 24;},configurable:true,enumerable:true});
    } catch(e) {}

    // 2. Try to override properties on Screen.prototype (stronger fallback)
    try {
      if (window.Screen && window.Screen.prototype) {
        var proto = window.Screen.prototype;
        Object.defineProperty(proto,'width',{get:function(){return 1920;},configurable:true,enumerable:true});
        Object.defineProperty(proto,'height',{get:function(){return 1080;},configurable:true,enumerable:true});
        Object.defineProperty(proto,'availWidth',{get:function(){return 1920;},configurable:true,enumerable:true});
        Object.defineProperty(proto,'availHeight',{get:function(){return 1080;},configurable:true,enumerable:true});
        Object.defineProperty(proto,'colorDepth',{get:function(){return 24;},configurable:true,enumerable:true});
        Object.defineProperty(proto,'pixelDepth',{get:function(){return 24;},configurable:true,enumerable:true});
      }
    } catch(e) {}

    // 3. Spoof window properties to match screen resolution (often checked by tests)
    try {
      Object.defineProperty(w,'innerWidth',{get:function(){return 1920;},configurable:true,enumerable:true});
      Object.defineProperty(w,'innerHeight',{get:function(){return 1080;},configurable:true,enumerable:true});
      Object.defineProperty(w,'outerWidth',{get:function(){return 1920;},configurable:true,enumerable:true});
      Object.defineProperty(w,'outerHeight',{get:function(){return 1080;},configurable:true,enumerable:true});
      Object.defineProperty(w,'devicePixelRatio',{get:function(){return 1;},configurable:true,enumerable:true});
    } catch(e) {}

  } catch(e) {}
  // 1. Try to override window.screen directly (most effective if allowed)
  try {
    // Forcefully try to delete existing screen property
    try { delete window.screen; } catch(e) {}
    
    var __sc = window.screen || {};
    // Create a complete mock screen object
    var __mockScreen = {};
    
    // Copy properties from original if possible, or defaults
    for (var p in __sc) {
      try { __mockScreen[p] = __sc[p]; } catch(e) {}
    }
    
    // Override key properties
    __mockScreen.width = 1920;
    __mockScreen.height = 1080;
    __mockScreen.availWidth = 1920;
    __mockScreen.availHeight = 1080;
    __mockScreen.colorDepth = 24;
    __mockScreen.pixelDepth = 24;
    
    // Use Proxy as fallback for dynamic access
    var __prox = new Proxy(__sc, {
      get: function(t, p, r) {
        if (p === 'width') return 1920;
        if (p === 'height') return 1080;
        if (p === 'availWidth') return 1920;
        if (p === 'availHeight') return 1080;
        if (p === 'colorDepth') return 24;
        if (p === 'pixelDepth') return 24;
        return Reflect.get(t, p, r);
      }
    });

    Object.defineProperty(window, 'screen', {
      get: function() { return __prox; },
      configurable: true,
      enumerable: true
    });
  } catch(e) {
    // Fallback to defineProperty on instance if window.screen replacement failed
    try {
       Object.defineProperty(window.screen, 'width', { value: 1920, configurable: true });
       Object.defineProperty(window.screen, 'height', { value: 1080, configurable: true });
    } catch(e2) {}
  }
  try {
    if (window.visualViewport) {
      Object.defineProperty(window.visualViewport,'scale',{get:function(){return 1;},configurable:true,enumerable:true});
      Object.defineProperty(window.visualViewport,'width',{get:function(){return 1920;},configurable:true,enumerable:true});
      Object.defineProperty(window.visualViewport,'height',{get:function(){return 1080;},configurable:true,enumerable:true});
    }
  } catch(e) {}
  try {
    var _origMatchMedia = window.matchMedia;
    if (typeof _origMatchMedia === 'function') {
      var __width = 1920;
      var __height = 1080;
      var __dppx = 1;
      var __dpi = __dppx * 96;

      window.matchMedia = wrapNative(_origMatchMedia, function(orig, args, thisArg) {
        var q = String(args[0] || '');
        // Skip complex queries with comma (list of media queries)
        if (q.indexOf(',') >= 0) return orig.call(thisArg, q);

        var mql = orig.call(thisArg, q);
        var res = null;

        function evalFeature(qStr) {
          var ok = true; var found = false;
          var rxDW = /(s*(min|max)?-?device-widths*:s*([0-9]*.?[0-9]+)s*pxs*)/ig;
          var rxDH = /(s*(min|max)?-?device-heights*:s*([0-9]*.?[0-9]+)s*pxs*)/ig;
          var rxDppx = /(s*(min|max)?-?resolutions*:s*([0-9]*.?[0-9]+)s*dppxs*)/ig;
          var rxDpi = /(s*(min|max)?-?resolutions*:s*([0-9]*.?[0-9]+)s*dpis*)/ig;

          var m;
          while ((m = rxDW.exec(qStr))) {
            found = true; var type = (m[1]||'').toLowerCase(); var val = parseFloat(m[2]);
            if (type === 'min') ok = ok && (__width >= val); else if (type === 'max') ok = ok && (__width <= val); else ok = ok && (__width === val);
          }
          while ((m = rxDH.exec(qStr))) {
            found = true; var typeH = (m[1]||'').toLowerCase(); var valH = parseFloat(m[2]);
            if (typeH === 'min') ok = ok && (__height >= valH); else if (typeH === 'max') ok = ok && (__height <= valH); else ok = ok && (__height === valH);
          }
          while ((m = rxDppx.exec(qStr))) {
            found = true; var typeX = (m[1]||'').toLowerCase(); var valX = parseFloat(m[2]);
            if (typeX === 'min') ok = ok && (__dppx >= valX); else if (typeX === 'max') ok = ok && (__dppx <= valX); else ok = ok && (__dppx === valX);
          }
          while ((m = rxDpi.exec(qStr))) {
            found = true; var typeD = (m[1]||'').toLowerCase(); var valD = parseFloat(m[2]);
            if (typeD === 'min') ok = ok && (__dpi >= valD); else if (typeD === 'max') ok = ok && (__dpi <= valD); else ok = ok && (__dpi === valD);
          }
          return { found: found, pass: ok };
        }

        var r = evalFeature(q);
        if (r.found) res = r.pass;

        if (res !== null) {
          try { Object.defineProperty(mql, 'matches', { get: function(){ return res; }, configurable: true }); } catch(e) {}
          try { mql.matches = res; } catch(e) {}
        }
        return mql;
      }, { name: 'matchMedia', length: 1 });
      window.matchMedia.toString = function(){ return 'function matchMedia() { [native code] }'; };
    }
  } catch(e) {}
})();

// Fingerprint injection complete
})();

// === WORKER INTERCEPTOR ===
(function() {
  'use strict';
  
  const __workerConfig__ = {"userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36","hardware":{"screen":{"width":1920,"height":1080},"devicePixelRatio":1,"cpuCores":4,"deviceMemory":8},"os":{"platform":"Win32","type":"Windows"},"navigator":{"language":"en-US","languages":["en-US","en"]},"webgl":{"mode":"custom","vendor":"Google Inc. (Intel)","renderer":"ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)"}};
  const __workerInjectionScript__ = "(function() { 'use strict'; const wrapNative = (function() { return function(originalFn, wrapperFn, options) { options = options || {}; const wrapped = function() { return wrapperFn.call(this, originalFn, arguments, this); }; Object.defineProperty(wrapped, 'name', { value: options.name || originalFn.name, configurable: true }); Object.defineProperty(wrapped, 'length', { value: options.length !== undefined ? options.length : originalFn.length, configurable: true }); const nativeString = 'function ' + (options.name || originalFn.name) + '() { [native code] }'; wrapped.toString = function() { return nativeString; }; wrapped.toSource = function() { return nativeString; }; return wrapped; }; })(); (function() { 'use strict'; const config = { userAgent: \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\", appVersion: \"5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\", platform: \"Win32\", vendor: \"Google Inc.\", product: \"Gecko\", productSub: \"20030107\", appName: \"Netscape\", appCodeName: \"Mozilla\", hardwareConcurrency: 4, deviceMemory: 8, maxTouchPoints: 0, language: \"en-US\", languages: [\"en-US\",\"en\"], webdriver: false, doNotTrack: null, globalPrivacyControl: undefined }; const navigatorProto = Object.getPrototypeOf(navigator); function createGetter(name, value) { const getter = function() { return value; }; Object.defineProperty(getter, 'name', { value: 'get ' + name, writable: false, enumerable: false, configurable: true }); const nativeStr = 'function get ' + name + '() { [native code] }'; getter.toString = function() { return nativeStr; }; return getter; } const simpleProps = [ 'userAgent', 'appVersion', 'platform', 'vendor', 'product', 'productSub', 'appName', 'appCodeName', 'hardwareConcurrency', 'deviceMemory', 'maxTouchPoints', 'language', 'doNotTrack', 'globalPrivacyControl', 'webdriver' ]; for (const prop of simpleProps) { if (config[prop] !== undefined) { try { Object.defineProperty(navigatorProto, prop, { get: createGetter(prop, config[prop]), set: undefined, enumerable: true, configurable: true }); } catch (e) { } } } try { const frozenLanguages = Object.freeze([...config.languages]); Object.defineProperty(navigatorProto, 'languages', { get: createGetter('languages', frozenLanguages), set: undefined, enumerable: true, configurable: true }); } catch (e) { } try { for (const prop of simpleProps) { if (config[prop] !== undefined) { try { Object.defineProperty(navigator, prop, { get: createGetter(prop, config[prop]), set: undefined, enumerable: true, configurable: true }); } catch (_) {} } } try { const frozenLanguages2 = Object.freeze([...config.languages]); Object.defineProperty(navigator, 'languages', { get: createGetter('languages', frozenLanguages2), set: undefined, enumerable: true, configurable: true }); } catch (_) {} } catch (_) {} })(); (function() { 'use strict'; const config = { mode: \"custom\", vendor: \"Google Inc. (Intel)\", renderer: \"ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)\", unmaskedVendor: \"Google Inc. (Intel)\", unmaskedRenderer: \"ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)\", extensions: null, shaderPrecision: null, imageNoise: true, noiseLevel: \"medium\", noiseDistribution: \"uniform\", seed: 979555455 }; if (config.mode === 'off' || config.mode === 'real') { return; } const VENDOR = 0x1F00; const RENDERER = 0x1F01; const UNMASKED_VENDOR_WEBGL = 0x9245; const UNMASKED_RENDERER_WEBGL = 0x9246; function createSeededRNG(seed) { let state = seed >>> 0; return function() { let t = state += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; } function getNoiseScale(level) { switch (level) { case 'off': return 0; case 'low': return 0.5; case 'medium': return 2; case 'high': return 5; default: return 2; } } let rng = createSeededRNG(config.seed); const noiseScale = getNoiseScale(config.noiseLevel); function getNoise() { if (config.noiseLevel === 'off') return 0; let noise; if (config.noiseDistribution === 'gaussian') { const u1 = Math.max(rng(), 1e-10); const u2 = rng(); noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); } else { noise = rng() * 2 - 1; } return noise * noiseScale; } function resetRNG() { rng = createSeededRNG(config.seed); } function applyNoiseToPixels(pixels) { if (!config.imageNoise || config.noiseLevel === 'off') return; resetRNG(); for (let i = 0; i < pixels.length; i += 4) { const noise = getNoise(); pixels[i] = Math.max(0, Math.min(255, Math.round(pixels[i] + noise))); pixels[i + 1] = Math.max(0, Math.min(255, Math.round(pixels[i + 1] + noise))); pixels[i + 2] = Math.max(0, Math.min(255, Math.round(pixels[i + 2] + noise))); } } function createNativeFunction(name, length, fn) { Object.defineProperty(fn, 'name', { value: name, writable: false, enumerable: false, configurable: true }); Object.defineProperty(fn, 'length', { value: length, writable: false, enumerable: false, configurable: true }); const nativeStr = 'function ' + name + '() { [native code] }'; fn.toString = function() { return nativeStr; }; return fn; } const scope = (typeof window !== 'undefined') ? window : (typeof self !== 'undefined' ? self : globalThis); function getProto(cls) { try { return cls.prototype; } catch(e) { return null; } } function spoofGetParameter(contextName) { const targetClass = scope[contextName]; if (typeof targetClass === 'undefined') return; const proto = targetClass.prototype; const originalGetParameter = proto.getParameter; proto.getParameter = createNativeFunction('getParameter', 1, function(pname) { if (pname === 0x1F00 && config.vendor) return config.vendor; if (pname === 0x1F01 && config.renderer) return config.renderer; if (pname === 0x9245 || pname === 37445) { return config.unmaskedVendor || config.vendor || originalGetParameter.apply(this, arguments); } if (pname === 0x9246 || pname === 37446) { return config.unmaskedRenderer || config.renderer || originalGetParameter.apply(this, arguments); } return originalGetParameter.apply(this, arguments); }); } if (typeof scope.OffscreenCanvas !== 'undefined') { try { const originalGetContext = scope.OffscreenCanvas.prototype.getContext; scope.OffscreenCanvas.prototype.getContext = createNativeFunction('getContext', 1, function(type, options) { const ctx = originalGetContext.call(this, type, options); if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) { try { } } catch(e) {} })(); })();";
  const __pageOrigin__ = (function(){ try { return window.location.origin; } catch (e) { return ''; } })();
  
  if (typeof Worker !== 'undefined') {
    const OriginalWorker = Worker;
    
    window.Worker = function(scriptURL, options) {
      let processedURL = scriptURL;
      
      if (typeof scriptURL === 'string' || scriptURL instanceof URL) {
        const urlString = scriptURL instanceof URL ? scriptURL.href : scriptURL;
        let absUrl = urlString; try { absUrl = new URL(urlString, __pageOrigin__).href; } catch (e) {}
        const injectedScript = __workerInjectionScript__ + '\n\nimportScripts("' + absUrl + '");';
        const blob = new Blob([injectedScript], { type: 'application/javascript' });
        processedURL = URL.createObjectURL(blob);
      }
      
      return new OriginalWorker(processedURL, options);
    };
    
    Object.defineProperty(window.Worker, 'name', { value: 'Worker', configurable: true });
    Object.defineProperty(window.Worker, 'length', { value: 1, configurable: true });
    window.Worker.toString = function() { return 'function Worker() { [native code] }'; };
    window.Worker.prototype = OriginalWorker.prototype;
  }
  
  if (typeof SharedWorker !== 'undefined') {
    const OriginalSharedWorker = SharedWorker;
    
    window.SharedWorker = function(scriptURL, options) {
      let processedURL = scriptURL;
      
      if (typeof scriptURL === 'string' || scriptURL instanceof URL) {
        const urlString = scriptURL instanceof URL ? scriptURL.href : scriptURL;
        let absUrl = urlString; try { absUrl = new URL(urlString, __pageOrigin__).href; } catch (e) {}
        const injectedScript = __workerInjectionScript__ + '\n\nimportScripts("' + absUrl + '");';
        const blob = new Blob([injectedScript], { type: 'application/javascript' });
        processedURL = URL.createObjectURL(blob);
      }
      
      return new OriginalSharedWorker(processedURL, options);
    };
    
    Object.defineProperty(window.SharedWorker, 'name', { value: 'SharedWorker', configurable: true });
    Object.defineProperty(window.SharedWorker, 'length', { value: 1, configurable: true });
    window.SharedWorker.toString = function() { return 'function SharedWorker() { [native code] }'; };
    window.SharedWorker.prototype = OriginalSharedWorker.prototype;
  }
})();

// === IFRAME PROTECTION ===
/**
 * Fingerprint Injection Script for iframes
 * Generated at: 2025-12-04T16:10:45.692Z
 */

(function() {
  'use strict';
  
  const __fingerprintConfig__ = {"userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36","hardware":{"screen":{"width":1920,"height":1080},"devicePixelRatio":1,"cpuCores":4,"deviceMemory":8},"os":{"platform":"Win32","type":"Windows"},"navigator":{"language":"en-US","languages":["en-US","en"]},"webgl":{"mode":"custom","vendor":"Google Inc. (Intel)","renderer":"ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)"}};
  const __sameOriginOnly__ = true;
  const __injectionScript__ = "(function() { 'use strict'; const wrapNative = (function() { return function(originalFn, wrapperFn, options) { options = options || {}; const wrapped = function() { return wrapperFn.call(this, originalFn, arguments, this); }; Object.defineProperty(wrapped, 'name', { value: options.name || originalFn.name, configurable: true }); Object.defineProperty(wrapped, 'length', { value: options.length !== undefined ? options.length : originalFn.length, configurable: true }); const nativeString = 'function ' + (options.name || originalFn.name) + '() { [native code] }'; wrapped.toString = function() { return nativeString; }; wrapped.toSource = function() { return nativeString; }; return wrapped; }; })(); (function() { 'use strict'; const config = { userAgent: \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\", appVersion: \"5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\", platform: \"Win32\", vendor: \"Google Inc.\", product: \"Gecko\", productSub: \"20030107\", appName: \"Netscape\", appCodeName: \"Mozilla\", hardwareConcurrency: 4, deviceMemory: 8, maxTouchPoints: 0, language: \"en-US\", languages: [\"en-US\",\"en\"], webdriver: false, doNotTrack: null, globalPrivacyControl: undefined }; const navigatorProto = Object.getPrototypeOf(navigator); function createGetter(name, value) { const getter = function() { return value; }; Object.defineProperty(getter, 'name', { value: 'get ' + name, writable: false, enumerable: false, configurable: true }); const nativeStr = 'function get ' + name + '() { [native code] }'; getter.toString = function() { return nativeStr; }; return getter; } const simpleProps = [ 'userAgent', 'appVersion', 'platform', 'vendor', 'product', 'productSub', 'appName', 'appCodeName', 'hardwareConcurrency', 'deviceMemory', 'maxTouchPoints', 'language', 'doNotTrack', 'globalPrivacyControl', 'webdriver' ]; for (const prop of simpleProps) { if (config[prop] !== undefined) { try { Object.defineProperty(navigatorProto, prop, { get: createGetter(prop, config[prop]), set: undefined, enumerable: true, configurable: true }); } catch (e) { } } } try { const frozenLanguages = Object.freeze([...config.languages]); Object.defineProperty(navigatorProto, 'languages', { get: createGetter('languages', frozenLanguages), set: undefined, enumerable: true, configurable: true }); } catch (e) { } try { for (const prop of simpleProps) { if (config[prop] !== undefined) { try { Object.defineProperty(navigator, prop, { get: createGetter(prop, config[prop]), set: undefined, enumerable: true, configurable: true }); } catch (_) {} } } try { const frozenLanguages2 = Object.freeze([...config.languages]); Object.defineProperty(navigator, 'languages', { get: createGetter('languages', frozenLanguages2), set: undefined, enumerable: true, configurable: true }); } catch (_) {} } catch (_) {} })(); (function() { 'use strict'; const config = { mode: \"noise\", noiseLevel: \"medium\", noiseDistribution: \"uniform\", seed: 3800635663 }; if (config.mode === 'off' || config.mode === 'real') { return; } function createSeededRNG(seed) { let state = seed >>> 0; return function() { let t = state += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; } function getNoiseScale(level) { switch (level) { case 'off': return 0; case 'low': return 0.5; case 'medium': return 2; case 'high': return 5; default: return 2; } } const rng = createSeededRNG(config.seed); const noiseScale = getNoiseScale(config.noiseLevel); function getNoise() { if (config.noiseLevel === 'off') return 0; let noise; if (config.noiseDistribution === 'gaussian') { const u1 = Math.max(rng(), 1e-10); const u2 = rng(); noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); } else { noise = rng() * 2 - 1; } return noise * noiseScale; } function applyNoiseToImageData(imageData) { const data = imageData.data; for (let i = 0; i < data.length; i += 4) { const noise = getNoise(); data[i] = Math.max(0, Math.min(255, Math.round(data[i] + noise))); data[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1] + noise))); data[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2] + noise))); } return imageData; } function createNativeFunction(name, length, fn) { Object.defineProperty(fn, 'name', { value: name, writable: false, enumerable: false, configurable: true }); Object.defineProperty(fn, 'length', { value: length, writable: false, enumerable: false, configurable: true }); const nativeStr = 'function ' + name + '() { [native code] }'; fn.toString = function() { return nativeStr; }; return fn; } const originalToDataURL = HTMLCanvasElement.prototype.toDataURL; HTMLCanvasElement.prototype.toDataURL = createNativeFunction('toDataURL', 0, function() { const canvas = this; const ctx = canvas.getContext('2d'); if (ctx) { try { const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); applyNoiseToImageData(imageData); ctx.putImageData(imageData, 0, 0); } catch (e) { } } return originalToDataURL.apply(canvas, arguments); }); const originalToBlob = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob = createNativeFunction('toBlob', 1, function(callback) { const canvas = this; const ctx = canvas.getContext('2d'); if (ctx) { try { const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); applyNoiseToImageData(imageData); ctx.putImageData(imageData, 0, 0); } catch (e) { } } return originalToBlob.apply(canvas, arguments); }); const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData; CanvasRenderingContext2D.prototype.getImageData = createNativeFunction('getImageData', 4, function(sx, sy, sw, sh) { const imageData = originalGetImageData.apply(this, arguments); applyNoiseToImageData(imageData); return imageData; }); })(); (function() { 'use strict'; const config = { mode: \"custom\", vendor: \"Google Inc. (Intel)\", renderer: \"ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)\", unmaskedVendor: \"Google Inc. (Intel)\", unmaskedRenderer: \"ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)\", extensions: null, shaderPrecision: null, imageNoise: true, noiseLevel: \"medium\", noiseDistribution: \"uniform\", seed: 1623318383 }; if (config.mode === 'off' || config.mode === 'real') { return; } const VENDOR = 0x1F00; const RENDERER = 0x1F01; const UNMASKED_VENDOR_WEBGL = 0x9245; const UNMASKED_RENDERER_WEBGL = 0x9246; function createSeededRNG(seed) { let state = seed >>> 0; return function() { let t = state += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; } function getNoiseScale(level) { switch (level) { case 'off': return 0; case 'low': return 0.5; case 'medium': return 2; case 'high': return 5; default: return 2; } } let rng = createSeededRNG(config.seed); const noiseScale = getNoiseScale(config.noiseLevel); function getNoise() { if (config.noiseLevel === 'off') return 0; let noise; if (config.noiseDistribution === 'gaussian') { const u1 = Math.max(rng(), 1e-10); const u2 = rng(); noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); } else { noise = rng() * 2 - 1; } return noise * noiseScale; } function resetRNG() { rng = createSeededRNG(config.seed); } function applyNoiseToPixels(pixels) { if (!config.imageNoise || config.noiseLevel === 'off') return; resetRNG(); for (let i = 0; i < pixels.length; i += 4) { const noise = getNoise(); pixels[i] = Math.max(0, Math.min(255, Math.round(pixels[i] + noise))); pixels[i + 1] = Math.max(0, Math.min(255, Math.round(pixels[i + 1] + noise))); pixels[i + 2] = Math.max(0, Math.min(255, Math.round(pixels[i + 2] + noise))); } } function createNativeFunction(name, length, fn) { Object.defineProperty(fn, 'name', { value: name, writable: false, enumerable: false, configurable: true }); Object.defineProperty(fn, 'length', { value: length, writable: false, enumerable: false, configurable: true }); const nativeStr = 'function ' + name + '() { [native code] }'; fn.toString = function() { return nativeStr; }; return fn; } const scope = (typeof window !== 'undefined') ? window : (typeof self !== 'undefined' ? self : globalThis); function getProto(cls) { try { return cls.prototype; } catch(e) { return null; } } function spoofGetParameter(contextName) { const targetClass = scope[contextName]; if (typeof targetClass === 'undefined') return; const proto = targetClass.prototype; const originalGetParameter = proto.getParameter; proto.getParameter = createNativeFunction('getParameter', 1, function(pname) { if (pname === 0x1F00 && config.vendor) return config.vendor; if (pname === 0x1F01 && config.renderer) return config.renderer; if (pname === 0x9245 || pname === 37445) { return config.unmaskedVendor || config.vendor || originalGetParameter.apply(this, arguments); } if (pname === 0x9246 || pname === 37446) { return config.unmaskedRenderer || config.renderer || originalGetParameter.apply(this, arguments); } return originalGetParameter.apply(this, arguments); }); } if (typeof scope.OffscreenCanvas !== 'undefined') { try { const originalGetContext = scope.OffscreenCanvas.prototype.getContext; scope.OffscreenCanvas.prototype.getContext = createNativeFunction('getContext', 1, function(type, options) { const ctx = originalGetContext.call(this, type, options); if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) { try { }).filter(function(font) { return font.length > 0; }); } function extractFontFamily(fontString) { if (!fontString || typeof fontString !== 'string') return 'sans-serif'; var sizeMatch = fontString.match(/(\\d+(?:\\.\\d+)?(?:px|pt|em|rem|%|vh|vw|vmin|vmax|ex|ch|cm|mm|in|pc))/i); if (sizeMatch) { var afterSize = fontString.substring(fontString.indexOf(sizeMatch[0]) + sizeMatch[0].length); var family = afterSize.replace(/^\\/[\\d.]+/, '').trim(); return family || 'sans-serif'; } return fontString; } function createNativeFunction(name, length, fn) { Object.defineProperty(fn, 'name', { value: name, writable: false, enumerable: false, configurable: true }); Object.defineProperty(fn, 'length', { value: length, writable: false, enumerable: false, configurable: true }); var nativeStr = 'function ' + name + '() { [native code] }'; fn.toString = function() { return nativeStr; }; return fn; } if (document.fonts && document.fonts.check) { var originalCheck = document.fonts.check.bind(document.fonts); document.fonts.check = createNativeFunction('check', 1, function(font, text) { var fontFamily = extractFontFamily(font); var fonts = parseFontFamily(fontFamily); for (var i = 0; i < fonts.length; i++) { var fontName = fonts[i]; if (BASE_FONTS.indexOf(fontName.toLowerCase()) !== -1) { continue; } if (isFontAllowed(fontName)) { return originalCheck(font, text); } } var hasNonGeneric = fonts.some(function(f) { return BASE_FONTS.indexOf(f.toLowerCase()) === -1; }); if (hasNonGeneric) { return false; } return originalCheck(font, text); }); } if (document.fonts && document.fonts.load) { var originalLoad = document.fonts.load.bind(document.fonts); document.fonts.load = createNativeFunction('load', 1, function(font, text) { var fontFamily = extractFontFamily(font); var fonts = parseFontFamily(fontFamily); for (var i = 0; i < fonts.length; i++) { var fontName = fonts[i]; if (BASE_FONTS.indexOf(fontName.toLowerCase()) !== -1) { continue; } if (isFontAllowed(fontName)) { return originalLoad(font, text); } } return Promise.resolve([]); }); } })(); (function() { 'use strict'; const config = {\"mode\":\"replace\",\"publicIP\":\"auto\",\"localIP\":\"192.168.1.100\",\"whitelist\":[],\"enableFallback\":true,\"fallbackTimeout\":5000,\"dropNonRelay\":false,\"forceRelay\":false}; const ipPatterns = { privateIPv4: /^(10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|192\\.168\\.|127\\.)/, sdpCandidate: /candidate:(\\S+) (\\d+) (udp|tcp) (\\d+) (\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}) (\\d+)/gi }; function isWhitelisted(origin) { if (!config.whitelist || config.whitelist.length === 0) return false; return config.whitelist.some(pattern => { if (pattern === origin) return true; if (pattern.startsWith('*.')) { const domain = pattern.slice(2); return origin.endsWith(domain) || origin.endsWith('.' + domain); } try { const url = new URL(origin); return url.hostname === pattern || url.hostname.endsWith('.' + pattern); } catch (e) { return false; } }); } function filterSDP(sdp) { if (!sdp) return sdp; let filtered = sdp; filtered = filtered.replace( /candidate:(\\S+) (\\d+) (\\S+) (\\d+) (\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}) (\\d+)/g, function(match, f, c, p, pr, ip, port) { if (ipPatterns.privateIPv4.test(ip)) { return 'candidate:' + f + ' ' + c + ' ' + p + ' ' + pr + ' ' + config.localIP + ' ' + port; } if (config.publicIP && config.publicIP !== 'auto') { return 'candidate:' + f + ' ' + c + ' ' + p + ' ' + pr + ' ' + config.publicIP + ' ' + port; } return match; } ); filtered = filtered.replace( /c=IN IP4 (\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})/g, function(match, ip) { if (ipPatterns.privateIPv4.test(ip)) { return 'c=IN IP4 ' + config.localIP; } if (config.publicIP && config.publicIP !== 'auto') { return 'c=IN IP4 ' + config.publicIP; } return match; } ); return filtered; } function filterICECandidate(candidate) { if (!candidate || !candidate.candidate) return candidate; const match = candidate.candidate.match(/candidate:\\S+ \\d+ \\S+ \\d+ (\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}) \\d+/); if (match) { const ip = match[1]; let newIP = ip; if (ipPatterns.privateIPv4.test(ip)) { newIP = config.localIP; } else if (config.publicIP && config.publicIP !== 'auto') { newIP = config.publicIP; } if (newIP !== ip) { return { candidate: candidate.candidate.replace(ip, newIP), sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex, usernameFragment: candidate.usernameFragment }; } } return candidate; } const OriginalRTCPeerConnection = window.RTCPeerConnection; if (config.mode === 'disable') { const DisabledRTC = function() { throw new DOMException('RTCPeerConnection is disabled', 'NotSupportedError'); }; Object.defineProperty(DisabledRTC, 'name', { value: 'RTCPeerConnection' }); DisabledRTC.toString = function() { return 'function RTCPeerConnection() { [native code] }'; }; window.RTCPeerConnection = DisabledRTC; if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = DisabledRTC; } else if (config.mode === 'replace' && OriginalRTCPeerConnection) { const WrappedRTC = function(configuration, constraints) { if (isWhitelisted(window.location.origin)) { return new OriginalRTCPeerConnection(configuration, constraints); } const pc = new OriginalRTCPeerConnection(configuration, constraints); const origSetLocal = pc.setLocalDescription.bind(pc); pc.setLocalDescription = function(desc) { if (desc && desc.sdp) { desc = new RTCSessionDescription({ type: desc.type, sdp: filterSDP(desc.sdp) }); } return origSetLocal(desc); }; const origOffer = pc.createOffer.bind(pc); pc.createOffer = function(opts) { return origOffer(opts).then(function(offer) { return new RTCSessionDescription({ type: offer.type, sdp: filterSDP(offer.sdp) }); }); }; const origAnswer = pc.createAnswer.bind(pc); pc.createAnswer = function(opts) { return origAnswer(opts).then(function(answer) { return new RTCSessionDescription({ type: answer.type, sdp: filterSDP(answer.sdp) }); }); }; const origAddListener = pc.addEventListener.bind(pc); pc.addEventListener = function(type, listener, options) { if (type === 'icecandidate') { const wrapped = function(event) { if (event.candidate) { const filtered = filterICECandidate(event.candidate); if (filtered === null) return; listener.call(this, { ...event, candidate: filtered }); } else { listener.call(this, event); } }; return origAddListener(type, wrapped, options); } return origAddListener(type, listener, options); }; let _handler = null; Object.defineProperty(pc, 'onicecandidate', { get: function() { return _handler; }, set: function(h) { if (typeof h === 'function') { _handler = function(event) { if (event.candidate) { const filtered = filterICECandidate(event.candidate); if (filtered === null) return; h.call(this, { ...event, candidate: filtered }); } else { h.call(this, event); } }; } else { _handler = h; } } }); return pc; }; WrappedRTC.prototype = OriginalRTCPeerConnection.prototype; Object.defineProperty(WrappedRTC, 'name', { value: 'RTCPeerConnection' }); WrappedRTC.toString = function() { return 'function RTCPeerConnection() { [native code] }'; }; window.RTCPeerConnection = WrappedRTC; if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = WrappedRTC; } })(); (function() { 'use strict'; const config = { mode: \"noise\", noiseLevel: \"low\", seed: 3685366011 }; if (config.mode === 'off') { return; } function createSeededRNG(seed) { let state = seed >>> 0; return function() { let t = state += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; } function getNoiseScale(level) { switch (level) { case 'off': return 0; case 'low': return 0.001; case 'medium': return 0.005; case 'high': return 0.01; default: return 0.001; } } const noiseScale = getNoiseScale(config.noiseLevel); const elementNoiseCache = new WeakMap(); function hashElement(element) { let hash = 0; const tagName = element.tagName || ''; for (let i = 0; i < tagName.length; i++) { hash = ((hash << 5) - hash) + tagName.charCodeAt(i); hash = hash & hash; } const id = element.id || ''; for (let i = 0; i < id.length; i++) { hash = ((hash << 5) - hash) + id.charCodeAt(i); hash = hash & hash; } const className = element.className || ''; const classStr = typeof className === 'string' ? className : className.toString(); for (let i = 0; i < classStr.length; i++) { hash = ((hash << 5) - hash) + classStr.charCodeAt(i); hash = hash & hash; } return Math.abs(hash); } function getElementNoise(element) { if (noiseScale === 0) { return { x: 0, y: 0, width: 0, height: 0 }; } if (elementNoiseCache.has(element)) { return elementNoiseCache.get(element); } const elementHash = hashElement(element); const elementSeed = (config.seed + elementHash) >>> 0; const rng = createSeededRNG(elementSeed); const noise = { x: (rng() * 2 - 1) * noiseScale, y: (rng() * 2 - 1) * noiseScale, width: (rng() * 2 - 1) * noiseScale, height: (rng() * 2 - 1) * noiseScale }; elementNoiseCache.set(element, noise); return noise; } function createNoisyDOMRect(rect, noise) { const x = rect.x + noise.x; const y = rect.y + noise.y; const width = rect.width + noise.width; const height = rect.height + noise.height; return { x: x, y: y, width: width, height: height, top: y, right: x + width, bottom: y + height, left: x, toJSON: function() { return { x: this.x, y: this.y, width: this.width, height: this.height, top: this.top, right: this.right, bottom: this.bottom, left: this.left }; } }; } function createNativeFunction(name, length, fn) { Object.defineProperty(fn, 'name', { value: name, writable: false, enumerable: false, configurable: true }); Object.defineProperty(fn, 'length', { value: length, writable: false, enumerable: false, configurable: true }); const nativeStr = 'function ' + name + '() { [native code] }'; fn.toString = function() { return nativeStr; }; return fn; } const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect; Element.prototype.getBoundingClientRect = createNativeFunction('getBoundingClientRect', 0, function() { const originalRect = originalGetBoundingClientRect.apply(this, arguments); const noise = getElementNoise(this); return createNoisyDOMRect(originalRect, noise); }); const originalGetClientRects = Element.prototype.getClientRects; Element.prototype.getClientRects = createNativeFunction('getClientRects', 0, function() { const originalRects = originalGetClientRects.apply(this, arguments); const baseNoise = getElementNoise(this); const noisyRects = []; for (let i = 0; i < originalRects.length; i++) { const rectNoise = { x: baseNoise.x + (i * 0.0001), y: baseNoise.y + (i * 0.0001), width: baseNoise.width, height: baseNoise.height }; noisyRects.push(createNoisyDOMRect(originalRects[i], rectNoise)); } const rectList = { length: noisyRects.length, item: function(index) { return index >= 0 && index < noisyRects.length ? noisyRects[index] : null; } }; for (let i = 0; i < noisyRects.length; i++) { rectList[i] = noisyRects[i]; } rectList[Symbol.iterator] = function* () { for (let i = 0; i < noisyRects.length; i++) { yield noisyRects[i]; } }; return rectList; }); })(); (function() { 'use strict'; const config = { mode: \"custom\", name: \"America/New_York\", offset: -300 }; if (config.mode === 'real') { return; } function createNativeFunction(name, length, fn) { Object.defineProperty(fn, 'name', { value: name, writable: false, enumerable: false, configurable: true }); Object.defineProperty(fn, 'length', { value: length, writable: false, enumerable: false, configurable: true }); const nativeStr = 'function ' + name + '() { [native code] }'; fn.toString = function() { return nativeStr; }; return fn; } const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset; Date.prototype.getTimezoneOffset = createNativeFunction('getTimezoneOffset', 0, function() { return -config.offset; }); if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat !== 'undefined') { const OriginalDateTimeFormat = Intl.DateTimeFormat; const SpoofedDateTimeFormat = function(locales, options) { const mergedOptions = Object.assign({}, options); if (!mergedOptions.timeZone) { mergedOptions.timeZone = config.name; } return new OriginalDateTimeFormat(locales, mergedOptions); }; Object.defineProperty(SpoofedDateTimeFormat, 'name', { value: 'DateTimeFormat', writable: false, enumerable: false, configurable: true }); Object.defineProperty(SpoofedDateTimeFormat, 'length', { value: 0, writable: false, enumerable: false, configurable: true }); SpoofedDateTimeFormat.toString = function() { return 'function DateTimeFormat() { [native code] }'; }; SpoofedDateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf; SpoofedDateTimeFormat.prototype = OriginalDateTimeFormat.prototype; Object.defineProperty(Intl, 'DateTimeFormat', { value: SpoofedDateTimeFormat, writable: true, enumerable: false, configurable: true }); } })(); (function() { 'use strict'; const config = { mode: \"custom\", latitude: 40.7128, longitude: -74.006, accuracy: 100, altitude: null, altitudeAccuracy: null, heading: null, speed: null }; if (config.mode === 'real' || typeof navigator === 'undefined' || !navigator.geolocation) { return; } let watchIdCounter = 1; const watchCallbacks = new Map(); const watchIntervals = new Map(); function createNativeFunction(name, length, fn) { Object.defineProperty(fn, 'name', { value: name, writable: false, enumerable: false, configurable: true }); Object.defineProperty(fn, 'length', { value: length, writable: false, enumerable: false, configurable: true }); const nativeStr = 'function ' + name + '() { [native code] }'; fn.toString = function() { return nativeStr; }; return fn; } function createPosition() { const coords = Object.freeze({ latitude: config.latitude, longitude: config.longitude, accuracy: config.accuracy, altitude: config.altitude, altitudeAccuracy: config.altitudeAccuracy, heading: config.heading, speed: config.speed }); return Object.freeze({ coords: coords, timestamp: Date.now() }); } function createError(code, message) { return Object.freeze({ code: code, message: message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); } const geolocation = navigator.geolocation; const originalGetCurrentPosition = geolocation.getCurrentPosition; const originalWatchPosition = geolocation.watchPosition; const originalClearWatch = geolocation.clearWatch; geolocation.getCurrentPosition = createNativeFunction('getCurrentPosition', 1, function(successCallback, errorCallback, options) { if (config.mode === 'deny') { if (typeof errorCallback === 'function') { setTimeout(function() { errorCallback(createError(1, 'User denied Geolocation')); }, 0); } return; } if (typeof successCallback === 'function') { setTimeout(function() { successCallback(createPosition()); }, 0); } } ); geolocation.watchPosition = createNativeFunction('watchPosition', 1, function(successCallback, errorCallback, options) { const watchId = watchIdCounter++; if (config.mode === 'deny') { if (typeof errorCallback === 'function') { setTimeout(function() { errorCallback(createError(1, 'User denied Geolocation')); }, 0); } return watchId; } watchCallbacks.set(watchId, { success: successCallback, error: errorCallback }); if (typeof successCallback === 'function') { setTimeout(function() { successCallback(createPosition()); }, 0); const updateInterval = (options && options.maximumAge) || 5000; const intervalId = setInterval(function() { if (!watchCallbacks.has(watchId)) { clearInterval(intervalId); return; } successCallback(createPosition()); }, updateInterval); watchIntervals.set(watchId, intervalId); } return watchId; } ); geolocation.clearWatch = createNativeFunction('clearWatch', 1, function(watchId) { watchCallbacks.delete(watchId); const intervalId = watchIntervals.get(watchId); if (intervalId) { clearInterval(intervalId); watchIntervals.delete(watchId); } } ); })(); (function() { 'use strict'; const config = { mode: \"fake\", seed: 2121315016, devices: [{\"kind\":\"audioinput\",\"label\":\"Default Audio Device\"},{\"kind\":\"audiooutput\",\"label\":\"Default Audio Output\"},{\"kind\":\"videoinput\",\"label\":\"Default Camera\"}] }; if (config.mode === 'real') { return; } if (typeof navigator === 'undefined' || !navigator.mediaDevices) { return; } let rngState = config.seed >>> 0; function seededRandom() { let t = rngState += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; } function resetRNG() { rngState = config.seed >>> 0; } function generateDeviceId(index, kind) { resetRNG(); for (let i = 0; i <= index; i++) { seededRandom(); } const parts = []; for (let i = 0; i < 4; i++) { const part = Math.floor(seededRandom() * 0xFFFFFFFF) .toString(16) .padStart(8, '0'); parts.push(part); } return parts.join(''); } function generateGroupId(kind) { resetRNG(); const kindOffset = kind === 'audioinput' ? 100 : kind === 'audiooutput' ? 200 : 300; for (let i = 0; i < kindOffset; i++) { seededRandom(); } const parts = []; for (let i = 0; i < 4; i++) { const part = Math.floor(seededRandom() * 0xFFFFFFFF) .toString(16) .padStart(8, '0'); parts.push(part); } return parts.join(''); } const genericLabels = { audioinput: ['Default Audio Device', 'Microphone', 'Internal Microphone', 'Built-in Microphone'], audiooutput: ['Default Audio Output', 'Speakers', 'Internal Speakers', 'Built-in Speakers'], videoinput: ['Default Camera', 'Webcam', 'Integrated Camera', 'Built-in Camera'] }; function getGenericLabel(kind, index) { const labels = genericLabels[kind] || ['Unknown Device']; return labels[index % labels.length]; } function createFakeDevice(deviceConfig, index) { const kind = deviceConfig.kind || 'audioinput'; const label = deviceConfig.label || getGenericLabel(kind, index); const deviceId = deviceConfig.deviceId || generateDeviceId(index, kind); const groupId = deviceConfig.groupId || generateGroupId(kind); const device = { deviceId: deviceId, kind: kind, label: label, groupId: groupId, toJSON: function() { return { deviceId: this.deviceId, kind: this.kind, label: this.label, groupId: this.groupId }; } }; Object.defineProperty(device.toJSON, 'name', { value: 'toJSON', writable: false, enumerable: false, configurable: true }); const nativeStr = 'function toJSON() { [native code] }'; device.toJSON.toString = function() { return nativeStr; }; return device; } const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices; function spoofedEnumerateDevices() { if (config.mode === 'hide') { return Promise.resolve([]); } const fakeDevices = config.devices.map(function(deviceConfig, index) { return createFakeDevice(deviceConfig, index); }); return Promise.resolve(fakeDevices); } Object.defineProperty(spoofedEnumerateDevices, 'name', { value: 'enumerateDevices', writable: false, enumerable: false, configurable: true }); Object.defineProperty(spoofedEnumerateDevices, 'length', { value: 0, writable: false, enumerable: false, configurable: true }); const nativeEnumerateStr = 'function enumerateDevices() { [native code] }'; spoofedEnumerateDevices.toString = function() { return nativeEnumerateStr; }; try { Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: spoofedEnumerateDevices, writable: true, enumerable: true, configurable: true }); } catch (e) { navigator.mediaDevices.enumerateDevices = spoofedEnumerateDevices; } })(); (function() { 'use strict'; const config = { mode: \"privacy\", charging: true, level: 1, chargingTime: 0, dischargingTime: Infinity }; if (config.mode === 'real') { return; } if (typeof navigator === 'undefined') { return; } const originalGetBattery = navigator.getBattery; const eventListeners = { chargingchange: [], chargingtimechange: [], dischargingtimechange: [], levelchange: [] }; const fakeBatteryManager = { get charging() { return config.charging; }, get level() { return config.level; }, get chargingTime() { return config.chargingTime; }, get dischargingTime() { return config.dischargingTime; }, onchargingchange: null, onchargingtimechange: null, ondischargingtimechange: null, onlevelchange: null, addEventListener: function(type, listener, options) { if (eventListeners[type]) { eventListeners[type].push({ listener: listener, options: options }); } }, removeEventListener: function(type, listener, options) { if (eventListeners[type]) { const index = eventListeners[type].findIndex( function(item) { return item.listener === listener; } ); if (index !== -1) { eventListeners[type].splice(index, 1); } } }, dispatchEvent: function(event) { return true; } }; ['addEventListener', 'removeEventListener', 'dispatchEvent'].forEach(function(methodName) { const method = fakeBatteryManager[methodName]; Object.defineProperty(method, 'name', { value: methodName, writable: false, enumerable: false, configurable: true }); const nativeStr = 'function ' + methodName + '() { [native code] }'; method.toString = function() { return nativeStr; }; }); function spoofedGetBattery() { if (config.mode === 'disable') { return Promise.reject(new DOMException( 'Battery Status API is disabled', 'NotAllowedError' )); } return Promise.resolve(fakeBatteryManager); } Object.defineProperty(spoofedGetBattery, 'name', { value: 'getBattery', writable: false, enumerable: false, configurable: true }); Object.defineProperty(spoofedGetBattery, 'length', { value: 0, writable: false, enumerable: false, configurable: true }); const nativeGetBatteryStr = 'function getBattery() { [native code] }'; spoofedGetBattery.toString = function() { return nativeGetBatteryStr; }; try { Object.defineProperty(navigator, 'getBattery', { value: spoofedGetBattery, writable: true, enumerable: true, configurable: true }); } catch (e) { navigator.getBattery = spoofedGetBattery; } })(); (function(){'use strict';const config={\"mode\":\"disable\",\"noiseSeed\":12345,\"noiseLevel\":\"medium\",\"motion\":{\"acceleration\":{\"x\":0,\"y\":0,\"z\":0},\"accelerationIncludingGravity\":{\"x\":0,\"y\":-9.8,\"z\":0},\"rotationRate\":{\"alpha\":0,\"beta\":0,\"gamma\":0},\"interval\":16},\"orientation\":{\"alpha\":0,\"beta\":0,\"gamma\":0,\"absolute\":false}};if(config.mode==='real')return;if(typeof window==='undefined')return;let rngState=config.noiseSeed;function seededRandom(){rngState=(rngState+0x6D2B79F5)|0;let t=Math.imul(rngState^(rngState>>>15),rngState|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}function getNoiseScale(l){return l==='low'?0.01:l==='high'?0.1:0.05;}function applyNoise(v){return v+(seededRandom()*2-1)*getNoiseScale(config.noiseLevel);}const listenerMappings={devicemotion:[],deviceorientation:[]};const origAdd=window.addEventListener,origRemove=window.removeEventListener;if(config.mode==='disable'){const DM=function(){throw new DOMException('DeviceMotionEvent is disabled','NotAllowedError');};Object.defineProperty(DM,'name',{value:'DeviceMotionEvent'});DM.toString=function(){return'function DeviceMotionEvent() { [native code] }';};const DO=function(){throw new DOMException('DeviceOrientationEvent is disabled','NotAllowedError');};Object.defineProperty(DO,'name',{value:'DeviceOrientationEvent'});DO.toString=function(){return'function DeviceOrientationEvent() { [native code] }';};try{Object.defineProperty(window,'DeviceMotionEvent',{value:DM,writable:true,configurable:true});Object.defineProperty(window,'DeviceOrientationEvent',{value:DO,writable:true,configurable:true});}catch(e){window.DeviceMotionEvent=DM;window.DeviceOrientationEvent=DO;}window.addEventListener=function(t,l,o){if(t==='devicemotion'||t==='deviceorientation')return;return origAdd.call(this,t,l,o);};Object.defineProperty(window.addEventListener,'name',{value:'addEventListener'});window.addEventListener.toString=function(){return'function addEventListener() { [native code] }';};return;}if(config.mode==='noise'){window.addEventListener=function(t,l,o){if(t==='devicemotion'||t==='deviceorientation'){const w=function(){const m=config.motion,or=config.orientation,n=config.mode==='noise';const f=t==='devicemotion'?{type:'devicemotion',acceleration:{x:n?applyNoise(m.acceleration.x):m.acceleration.x,y:n?applyNoise(m.acceleration.y):m.acceleration.y,z:n?applyNoise(m.acceleration.z):m.acceleration.z},accelerationIncludingGravity:{x:n?applyNoise(m.accelerationIncludingGravity.x):m.accelerationIncludingGravity.x,y:n?applyNoise(m.accelerationIncludingGravity.y):m.accelerationIncludingGravity.y,z:n?applyNoise(m.accelerationIncludingGravity.z):m.accelerationIncludingGravity.z},rotationRate:{alpha:n?applyNoise(m.rotationRate.alpha):m.rotationRate.alpha,beta:n?applyNoise(m.rotationRate.beta):m.rotationRate.beta,gamma:n?applyNoise(m.rotationRate.gamma):m.rotationRate.gamma},interval:m.interval,bubbles:false,cancelable:false,isTrusted:true,timeStamp:Date.now()}:{type:'deviceorientation',alpha:n?applyNoise(or.alpha):or.alpha,beta:n?applyNoise(or.beta):or.beta,gamma:n?applyNoise(or.gamma):or.gamma,absolute:or.absolute,bubbles:false,cancelable:false,isTrusted:true,timeStamp:Date.now()};if(typeof l==='function')l.call(this,f);else if(l&&typeof l.handleEvent==='function')l.handleEvent(f);};listenerMappings[t].push({original:l,wrapped:w,options:o});return origAdd.call(this,t,w,o);}return origAdd.call(this,t,l,o);};Object.defineProperty(window.addEventListener,'name',{value:'addEventListener'});window.addEventListener.toString=function(){return'function addEventListener() { [native code] }';};window.removeEventListener=function(t,l,o){if(t==='devicemotion'||t==='deviceorientation'){const m=listenerMappings[t],i=m.findIndex(function(x){return x.original===l;});if(i!==-1){const w=m[i].wrapped;m.splice(i,1);return origRemove.call(this,t,w,o);}}return origRemove.call(this,t,l,o);};Object.defineProperty(window.removeEventListener,'name',{value:'removeEventListener'});window.removeEventListener.toString=function(){return'function removeEventListener() { [native code] }';};}})(); (function() { 'use strict'; const config = { mode: \"minimal\", voices: [{\"name\":\"Google US English\",\"lang\":\"en-US\",\"localService\":false,\"default\":true},{\"name\":\"Google UK English Female\",\"lang\":\"en-GB\",\"localService\":false,\"default\":false}] }; if (config.mode === 'system') { return; } if (typeof window === 'undefined' || !window.speechSynthesis) { return; } const synthesis = window.speechSynthesis; function createFakeVoice(voiceConfig) { return Object.freeze({ voiceURI: voiceConfig.voiceURI || voiceConfig.name || 'Unknown', name: voiceConfig.name || 'Unknown Voice', lang: voiceConfig.lang || 'en-US', localService: voiceConfig.localService !== undefined ? voiceConfig.localService : false, default: voiceConfig.default !== undefined ? voiceConfig.default : false }); } const fakeVoices = config.voices.map(createFakeVoice); const originalGetVoices = synthesis.getVoices; function spoofedGetVoices() { return fakeVoices.slice(); } Object.defineProperty(spoofedGetVoices, 'name', { value: 'getVoices', writable: false, enumerable: false, configurable: true }); Object.defineProperty(spoofedGetVoices, 'length', { value: 0, writable: false, enumerable: false, configurable: true }); const nativeGetVoicesStr = 'function getVoices() { [native code] }'; spoofedGetVoices.toString = function() { return nativeGetVoicesStr; }; try { Object.defineProperty(synthesis, 'getVoices', { value: spoofedGetVoices, writable: true, enumerable: true, configurable: true }); } catch (e) { synthesis.getVoices = spoofedGetVoices; } let storedHandler = null; try { Object.defineProperty(synthesis, 'onvoiceschanged', { get: function() { return storedHandler; }, set: function(handler) { storedHandler = handler; if (typeof handler === 'function') { setTimeout(function() { try { handler.call(synthesis, new Event('voiceschanged')); } catch (e) { } }, 0); } }, enumerable: true, configurable: true }); } catch (e) { } const originalAddEventListener = synthesis.addEventListener; if (originalAddEventListener) { synthesis.addEventListener = function(type, listener, options) { if (type === 'voiceschanged' && typeof listener === 'function') { setTimeout(function() { try { listener.call(synthesis, new Event('voiceschanged')); } catch (e) { } }, 0); } return originalAddEventListener.call(this, type, listener, options); }; Object.defineProperty(synthesis.addEventListener, 'name', { value: 'addEventListener', writable: false, enumerable: false, configurable: true }); const nativeAddEventStr = 'function addEventListener() { [native code] }'; synthesis.addEventListener.toString = function() { return nativeAddEventStr; }; } })(); (function() { 'use strict'; const config = { mode: \"custom\", permissions: {\"geolocation\":\"prompt\",\"notifications\":\"denied\",\"push\":\"denied\",\"midi\":\"prompt\",\"camera\":\"prompt\",\"microphone\":\"prompt\",\"background-fetch\":\"prompt\",\"background-sync\":\"prompt\",\"persistent-storage\":\"prompt\",\"ambient-light-sensor\":\"prompt\",\"accelerometer\":\"prompt\",\"gyroscope\":\"prompt\",\"magnetometer\":\"prompt\",\"clipboard-read\":\"prompt\",\"clipboard-write\":\"granted\",\"payment-handler\":\"prompt\",\"idle-detection\":\"prompt\",\"periodic-background-sync\":\"prompt\",\"screen-wake-lock\":\"prompt\",\"nfc\":\"prompt\",\"display-capture\":\"prompt\"} }; if (config.mode === 'real') { return; } if (typeof navigator === 'undefined' || !navigator.permissions) { return; } const permissions = navigator.permissions; const permissionStatuses = {}; function createFakePermissionStatus(name, state) { const eventListeners = { change: [] }; let currentState = state; let onchangeHandler = null; const permissionStatus = { get name() { return name; }, get state() { return currentState; }, get status() { return currentState; }, get onchange() { return onchangeHandler; }, set onchange(handler) { onchangeHandler = handler; }, addEventListener: function(type, listener, options) { if (type === 'change' && typeof listener === 'function') { eventListeners.change.push({ listener: listener, options: options }); } }, removeEventListener: function(type, listener, options) { if (type === 'change') { const index = eventListeners.change.findIndex(function(item) { return item.listener === listener; }); if (index !== -1) { eventListeners.change.splice(index, 1); } } }, dispatchEvent: function(event) { if (event.type === 'change') { if (typeof onchangeHandler === 'function') { try { onchangeHandler.call(permissionStatus, event); } catch (e) {} } eventListeners.change.forEach(function(item) { try { item.listener.call(permissionStatus, event); } catch (e) {} }); } return true; } }; ['addEventListener', 'removeEventListener', 'dispatchEvent'].forEach(function(methodName) { const method = permissionStatus[methodName]; Object.defineProperty(method, 'name', { value: methodName, writable: false, enumerable: false, configurable: true }); const nativeStr = 'function ' + methodName + '() { [native code] }'; method.toString = function() { return nativeStr; }; }); return permissionStatus; } const originalQuery = permissions.query; function spoofedQuery(descriptor) { if (!descriptor || typeof descriptor !== 'object') { return Promise.reject(new TypeError('Invalid permission descriptor')); } const permissionName = descriptor.name; if (!permissionName) { return Promise.reject(new TypeError('Permission name is required')); } const state = config.permissions[permissionName] || 'prompt'; if (!permissionStatuses[permissionName]) { permissionStatuses[permissionName] = createFakePermissionStatus(permissionName, state); } return Promise.resolve(permissionStatuses[permissionName]); } Object.defineProperty(spoofedQuery, 'name', { value: 'query', writable: false, enumerable: false, configurable: true }); Object.defineProperty(spoofedQuery, 'length', { value: 1, writable: false, enumerable: false, configurable: true }); const nativeQueryStr = 'function query() { [native code] }'; spoofedQuery.toString = function() { return nativeQueryStr; }; try { Object.defineProperty(permissions, 'query', { value: spoofedQuery, writable: true, enumerable: true, configurable: true }); } catch (e) { permissions.query = spoofedQuery; } })(); (function() { 'use strict'; const config = { mode: \"fake\", quota: 10737418240, usage: 0, usageDetails: {} }; if (config.mode === 'real') { return; } if (typeof navigator === 'undefined' || !navigator.storage) { return; } const storage = navigator.storage; const originalEstimate = storage.estimate; function spoofedEstimate() { const estimate = { quota: config.quota, usage: config.usage }; if (config.usageDetails && Object.keys(config.usageDetails).length > 0) { estimate.usageDetails = Object.assign({}, config.usageDetails); } return Promise.resolve(estimate); } Object.defineProperty(spoofedEstimate, 'name', { value: 'estimate', writable: false, enumerable: false, configurable: true }); Object.defineProperty(spoofedEstimate, 'length', { value: 0, writable: false, enumerable: false, configurable: true }); const nativeEstimateStr = 'function estimate() { [native code] }'; spoofedEstimate.toString = function() { return nativeEstimateStr; }; try { Object.defineProperty(storage, 'estimate', { value: spoofedEstimate, writable: true, enumerable: true, configurable: true }); } catch (e) { storage.estimate = spoofedEstimate; } })(); (function() { 'use strict'; const config = { mode: \"custom\", effectiveType: \"4g\", downlink: 10, rtt: 50, saveData: false, type: \"wifi\" }; if (config.mode === 'real') { return; } if (typeof navigator === 'undefined') { return; } if (config.mode === 'disable') { try { Object.defineProperty(navigator, 'connection', { get: function() { return undefined; }, enumerable: true, configurable: true }); } catch (e) { try { delete navigator.connection; } catch (e2) {} } return; } const eventListeners = { change: [] }; let onchangeHandler = null; const fakeConnection = { get effectiveType() { return config.effectiveType; }, get downlink() { return config.downlink; }, get rtt() { return config.rtt; }, get saveData() { return config.saveData; }, get type() { return config.type; }, get downlinkMax() { return config.downlink * 1.5; }, get onchange() { return onchangeHandler; }, set onchange(handler) { onchangeHandler = handler; }, addEventListener: function(type, listener, options) { if (type === 'change' && typeof listener === 'function') { eventListeners.change.push({ listener: listener, options: options }); } }, removeEventListener: function(type, listener, options) { if (type === 'change') { const index = eventListeners.change.findIndex(function(item) { return item.listener === listener; }); if (index !== -1) { eventListeners.change.splice(index, 1); } } }, dispatchEvent: function(event) { if (event.type === 'change') { if (typeof onchangeHandler === 'function') { try { onchangeHandler.call(fakeConnection, event); } catch (e) {} } eventListeners.change.forEach(function(item) { try { item.listener.call(fakeConnection, event); } catch (e) {} }); } return true; } }; ['addEventListener', 'removeEventListener', 'dispatchEvent'].forEach(function(methodName) { const method = fakeConnection[methodName]; Object.defineProperty(method, 'name', { value: methodName, writable: false, enumerable: false, configurable: true }); const nativeStr = 'function ' + methodName + '() { [native code] }'; method.toString = function() { return nativeStr; }; }); try { Object.defineProperty(navigator, 'connection', { get: function() { return fakeConnection; }, enumerable: true, configurable: true }); } catch (e) { if (config.emulateChrome && config.browser.type === 'chrome') { const createRuntime = function() { return { OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' }, OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' }, PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' }, PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' }, PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' }, RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' }, connect: function() { return undefined; }, sendMessage: function() { return undefined; }, id: undefined }; }; const csi = function() { return { startE: Date.now(), onloadT: Date.now(), pageT: Math.random() * 1000, tran: 15 }; }; Object.defineProperty(csi, 'name', { value: 'csi' }); csi.toString = function() { return 'function csi() { [native code] }'; }; const loadTimes = function() { const now = Date.now() / 1000; return { commitLoadTime: now, connectionInfo: 'h2', finishDocumentLoadTime: now, finishLoadTime: now, firstPaintAfterLoadTime: 0, firstPaintTime: now, navigationType: 'Other', npnNegotiatedProtocol: 'h2', requestTime: now, startLoadTime: now, wasAlternateProtocolAvailable: false, wasFetchedViaSpdy: true, wasNpnNegotiated: true }; }; Object.defineProperty(loadTimes, 'name', { value: 'loadTimes' }); loadTimes.toString = function() { return 'function loadTimes() { [native code] }'; }; const chromeObj = { app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }, getDetails: function() { return null; }, getIsInstalled: function() { return false; }, runningState: function() { return 'cannot_run'; } }, csi: csi, loadTimes: loadTimes, runtime: createRuntime() }; try { Object.defineProperty(window, 'chrome', { value: chromeObj, writable: true, enumerable: true, configurable: true }); } catch (e) { window.chrome = chromeObj; } } if (config.cleanElectronTraces) { const electronProps = ['process', 'require', '__dirname', '__filename', 'module', 'exports', 'Buffer', 'global']; for (const prop of electronProps) { try { if (prop in window) delete window[prop]; } catch (e) { try { Object.defineProperty(window, prop, { get: function() { return undefined; }, enumerable: false, configurable: true }); } catch (e2) {} } } const ipcBridges = ['electronAPI', 'electron', 'ipcRenderer', 'remote', 'shell', 'contextBridge']; for (const bridge of ipcBridges) { try { if (bridge in window) delete window[bridge]; } catch (e) {} } } if (config.hideAutomation) { const automationProps = [ 'cdc_adoQpoasnfa76pfcZLmcfl_Array', 'cdc_adoQpoasnfa76pfcZLmcfl_Promise', '__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_function', '__driver_unwrapped', '__webdriver_unwrapped', '__selenium_unwrapped', '_Selenium_IDE_Recorder', '_selenium', 'calledSelenium', '$chrome_asyncScriptInfo', '__nightmare', '__phantomas', '_phantom', 'phantom', 'callPhantom', '__puppeteer_evaluation_script__' ]; for (const prop of automationProps) { try { if (prop in window) delete window[prop]; } catch (e) {} } try { Object.defineProperty(navigator, 'webdriver', { get: function() { return undefined; }, enumerable: true, configurable: true }); } catch (e) {} if (typeof document !== 'undefined') { try { const keys = Object.keys(document); for (const key of keys) { if (key.startsWith('$cdc_') || key.startsWith('cdc_')) { delete document[key]; } } } catch (e) {} } } })(); (function(){'use strict'; try { var w = window; if (!w || !w.screen) return; try { Object.defineProperty(w.screen,'width',{get:function(){return 1920;},configurable:true,enumerable:true}); Object.defineProperty(w.screen,'height',{get:function(){return 1080;},configurable:true,enumerable:true}); Object.defineProperty(w.screen,'availWidth',{get:function(){return 1920;},configurable:true,enumerable:true}); Object.defineProperty(w.screen,'availHeight',{get:function(){return 1080;},configurable:true,enumerable:true}); Object.defineProperty(w.screen,'colorDepth',{get:function(){return 24;},configurable:true,enumerable:true}); Object.defineProperty(w.screen,'pixelDepth',{get:function(){return 24;},configurable:true,enumerable:true}); } catch(e) {} try { if (window.Screen && window.Screen.prototype) { var proto = window.Screen.prototype; Object.defineProperty(proto,'width',{get:function(){return 1920;},configurable:true,enumerable:true}); Object.defineProperty(proto,'height',{get:function(){return 1080;},configurable:true,enumerable:true}); Object.defineProperty(proto,'availWidth',{get:function(){return 1920;},configurable:true,enumerable:true}); Object.defineProperty(proto,'availHeight',{get:function(){return 1080;},configurable:true,enumerable:true}); Object.defineProperty(proto,'colorDepth',{get:function(){return 24;},configurable:true,enumerable:true}); Object.defineProperty(proto,'pixelDepth',{get:function(){return 24;},configurable:true,enumerable:true}); } } catch(e) {} try { Object.defineProperty(w,'innerWidth',{get:function(){return 1920;},configurable:true,enumerable:true}); Object.defineProperty(w,'innerHeight',{get:function(){return 1080;},configurable:true,enumerable:true}); Object.defineProperty(w,'outerWidth',{get:function(){return 1920;},configurable:true,enumerable:true}); Object.defineProperty(w,'outerHeight',{get:function(){return 1080;},configurable:true,enumerable:true}); Object.defineProperty(w,'devicePixelRatio',{get:function(){return 1;},configurable:true,enumerable:true}); } catch(e) {} } catch(e) {} try { try { delete window.screen; } catch(e) {} var __sc = window.screen || {}; var __mockScreen = {}; for (var p in __sc) { try { __mockScreen[p] = __sc[p]; } catch(e) {} } __mockScreen.width = 1920; __mockScreen.height = 1080; __mockScreen.availWidth = 1920; __mockScreen.availHeight = 1080; __mockScreen.colorDepth = 24; __mockScreen.pixelDepth = 24; var __prox = new Proxy(__sc, { get: function(t, p, r) { if (p === 'width') return 1920; if (p === 'height') return 1080; if (p === 'availWidth') return 1920; if (p === 'availHeight') return 1080; if (p === 'colorDepth') return 24; if (p === 'pixelDepth') return 24; return Reflect.get(t, p, r); } }); Object.defineProperty(window, 'screen', { get: function() { return __prox; }, configurable: true, enumerable: true }); } catch(e) { try { Object.defineProperty(window.screen, 'width', { value: 1920, configurable: true }); Object.defineProperty(window.screen, 'height', { value: 1080, configurable: true }); } catch(e2) {} } try { if (window.visualViewport) { Object.defineProperty(window.visualViewport,'scale',{get:function(){return 1;},configurable:true,enumerable:true}); Object.defineProperty(window.visualViewport,'width',{get:function(){return 1920;},configurable:true,enumerable:true}); Object.defineProperty(window.visualViewport,'height',{get:function(){return 1080;},configurable:true,enumerable:true}); } } catch(e) {} try { var _origMatchMedia = window.matchMedia; if (typeof _origMatchMedia === 'function') { var __width = 1920; var __height = 1080; var __dppx = 1; var __dpi = __dppx * 96; window.matchMedia = wrapNative(_origMatchMedia, function(orig, args, thisArg) { var q = String(args[0] || ''); if (q.indexOf(',') >= 0) return orig.call(thisArg, q); var mql = orig.call(thisArg, q); var res = null; function evalFeature(qStr) { var ok = true; var found = false; var rxDW = /(s*(min|max)?-?device-widths*:s*([0-9]*.?[0-9]+)s*pxs*)/ig; var rxDH = /(s*(min|max)?-?device-heights*:s*([0-9]*.?[0-9]+)s*pxs*)/ig; var rxDppx = /(s*(min|max)?-?resolutions*:s*([0-9]*.?[0-9]+)s*dppxs*)/ig; var rxDpi = /(s*(min|max)?-?resolutions*:s*([0-9]*.?[0-9]+)s*dpis*)/ig; var m; while ((m = rxDW.exec(qStr))) { found = true; var type = (m[1]||'').toLowerCase(); var val = parseFloat(m[2]); if (type === 'min') ok = ok && (__width >= val); else if (type === 'max') ok = ok && (__width <= val); else ok = ok && (__width === val); } while ((m = rxDH.exec(qStr))) { found = true; var typeH = (m[1]||'').toLowerCase(); var valH = parseFloat(m[2]); if (typeH === 'min') ok = ok && (__height >= valH); else if (typeH === 'max') ok = ok && (__height <= valH); else ok = ok && (__height === valH); } while ((m = rxDppx.exec(qStr))) { found = true; var typeX = (m[1]||'').toLowerCase(); var valX = parseFloat(m[2]); if (typeX === 'min') ok = ok && (__dppx >= valX); else if (typeX === 'max') ok = ok && (__dppx <= valX); else ok = ok && (__dppx === valX); } while ((m = rxDpi.exec(qStr))) { found = true; var typeD = (m[1]||'').toLowerCase(); var valD = parseFloat(m[2]); if (typeD === 'min') ok = ok && (__dpi >= valD); else if (typeD === 'max') ok = ok && (__dpi <= valD); else ok = ok && (__dpi === valD); } return { found: found, pass: ok }; } var r = evalFeature(q); if (r.found) res = r.pass; if (res !== null) { try { Object.defineProperty(mql, 'matches', { get: function(){ return res; }, configurable: true }); } catch(e) {} try { mql.matches = res; } catch(e) {} } return mql; }, { name: 'matchMedia', length: 1 }); window.matchMedia.toString = function(){ return 'function matchMedia() { [native code] }'; }; } } catch(e) {} })(); })();";
  
  /**
   * Check if iframe is same-origin
   */
  function isSameOrigin(iframe) {
    try {
      // Accessing contentWindow.location will throw for cross-origin
      const iframeOrigin = iframe.contentWindow.location.origin;
      return iframeOrigin === window.location.origin;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Inject fingerprint into iframe
   */
  function injectIntoIframe(iframe) {
    if (__sameOriginOnly__ && !isSameOrigin(iframe)) {
      return false;
    }
    
    try {
      const iframeWindow = iframe.contentWindow;
      if (!iframeWindow) return false;
      
      // Check if already injected
      if (iframeWindow.__fingerprintInjected__) return true;

      // Create and execute script in iframe context
      const script = iframeWindow.document.createElement('script');
      script.textContent = __injectionScript__;
      
      // Insert at the beginning of head or body
      const target = iframeWindow.document.head || iframeWindow.document.body || iframeWindow.document.documentElement;
      if (target) {
        target.insertBefore(script, target.firstChild);
        iframeWindow.__fingerprintInjected__ = true;
        return true;
      }
    } catch (error) {
      // console.warn('[FingerprintInjector] Failed to inject into iframe:', error.message);
    }
    return false;
  }

  // 1. Intercept document.createElement
  // This helps catch iframes created via script before they are inserted
  try {
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName, options) {
      const element = originalCreateElement.call(document, tagName, options);
      if (tagName && String(tagName).toLowerCase() === 'iframe') {
        // Try to inject immediately if possible, or setup listeners
        try {
          element.addEventListener('load', function() { injectIntoIframe(element); });
        } catch (e) {}
      }
      return element;
    };
  } catch (e) {}

  // 2. Intercept Node.prototype methods to catch synchronous insertion
  try {
    const originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function(child) {
      const result = originalAppendChild.call(this, child);
      if (child && child.nodeName === 'IFRAME') {
        injectIntoIframe(child);
      }
      return result;
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function(newNode, referenceNode) {
      const result = originalInsertBefore.call(this, newNode, referenceNode);
      if (newNode && newNode.nodeName === 'IFRAME') {
        injectIntoIframe(newNode);
      }
      return result;
    };
  } catch (e) {}
  
  // 3. Intercept property access on iframes to catch late access
  try {
    const iframeProto = HTMLIFrameElement.prototype;
    const originalContentWindow = Object.getOwnPropertyDescriptor(iframeProto, 'contentWindow');
    const originalContentDocument = Object.getOwnPropertyDescriptor(iframeProto, 'contentDocument');

    if (originalContentWindow && originalContentWindow.get) {
      Object.defineProperty(iframeProto, 'contentWindow', {
        get: function() {
          const win = originalContentWindow.get.call(this);
          try {
            if (win && !win.__fingerprintInjected__) {
              injectIntoIframe(this);
            }
          } catch (e) {}
          return win;
        },
        configurable: true,
        enumerable: true
      });
    }
    
    if (originalContentDocument && originalContentDocument.get) {
       Object.defineProperty(iframeProto, 'contentDocument', {
        get: function() {
          const doc = originalContentDocument.get.call(this);
          try {
            if (doc && doc.defaultView && !doc.defaultView.__fingerprintInjected__) {
               injectIntoIframe(this);
            }
          } catch (e) {}
          return doc;
        },
        configurable: true,
        enumerable: true
      });
    }
  } catch(e) {}

  
  /**
   * Process all existing iframes
   */
  function processExistingIframes() {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(function(iframe) {
      if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        injectIntoIframe(iframe);
      } else {
        iframe.addEventListener('load', function() {
          injectIntoIframe(iframe);
        }, { once: true });
      }
    });
  }
  
  /**
   * Observe for new iframes
   */
  function observeNewIframes() {
    if (typeof MutationObserver === 'undefined') return;
    
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeName === 'IFRAME') {
            if (node.contentDocument && node.contentDocument.readyState === 'complete') {
              injectIntoIframe(node);
            } else {
              node.addEventListener('load', function() {
                injectIntoIframe(node);
              }, { once: true });
            }
          }
          // Also check for iframes in added subtrees
          if (node.querySelectorAll) {
            node.querySelectorAll('iframe').forEach(function(iframe) {
              if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                injectIntoIframe(iframe);
              } else {
                iframe.addEventListener('load', function() {
                  injectIntoIframe(iframe);
                }, { once: true });
              }
            });
          }
        });
      });
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      processExistingIframes();
      observeNewIframes();
    });
  } else {
    processExistingIframes();
    observeNewIframes();
  }
})();