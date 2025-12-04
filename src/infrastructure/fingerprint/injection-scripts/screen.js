'use strict';

class ScreenSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ScreenSpoofError';
    this.code = code;
    this.details = details;
  }
}

class ScreenSpoof {
  static _defaultConfig = {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: 1
  };

  static _originalDescriptors = null;
  static _appliedConfig = null;

  static apply(config = {}) {
    const c = {
      width: config.screen?.width ?? ScreenSpoof._defaultConfig.width,
      height: config.screen?.height ?? ScreenSpoof._defaultConfig.height,
      availWidth: config.screen?.availWidth ?? (config.screen?.width ?? ScreenSpoof._defaultConfig.availWidth),
      availHeight: config.screen?.availHeight ?? (config.screen?.height ?? ScreenSpoof._defaultConfig.availHeight),
      colorDepth: config.screen?.colorDepth ?? ScreenSpoof._defaultConfig.colorDepth,
      pixelDepth: config.screen?.pixelDepth ?? ScreenSpoof._defaultConfig.pixelDepth,
      devicePixelRatio: config.devicePixelRatio ?? ScreenSpoof._defaultConfig.devicePixelRatio
    };

    ScreenSpoof._appliedConfig = c;

    const w = typeof window !== 'undefined' ? window : null;
    if (!w || !w.screen) return false;

    ScreenSpoof._originalDescriptors = ScreenSpoof._originalDescriptors || {};
    const props = ['width', 'height', 'availWidth', 'availHeight', 'colorDepth', 'pixelDepth'];
    for (const p of props) {
      try {
        if (!ScreenSpoof._originalDescriptors[p]) {
          ScreenSpoof._originalDescriptors[p] = Object.getOwnPropertyDescriptor(w.screen, p);
        }
        Object.defineProperty(w.screen, p, { get: () => c[p], enumerable: true, configurable: true });
      } catch (e) {}
    }

    try {
      if (!ScreenSpoof._originalDescriptors['devicePixelRatio']) {
        ScreenSpoof._originalDescriptors['devicePixelRatio'] = Object.getOwnPropertyDescriptor(w, 'devicePixelRatio');
      }
      Object.defineProperty(w, 'devicePixelRatio', { get: () => c.devicePixelRatio, enumerable: true, configurable: true });
    } catch (e) {}

    return true;
  }

  static restore() {
    const w = typeof window !== 'undefined' ? window : null;
    if (!w || !w.screen || !ScreenSpoof._originalDescriptors) return false;

    const props = ['width', 'height', 'availWidth', 'availHeight', 'colorDepth', 'pixelDepth'];
    for (const p of props) {
      const desc = ScreenSpoof._originalDescriptors[p];
      try {
        if (desc) Object.defineProperty(w.screen, p, desc);
      } catch (e) {}
    }

    const dpr = ScreenSpoof._originalDescriptors['devicePixelRatio'];
    try {
      if (dpr) Object.defineProperty(w, 'devicePixelRatio', dpr);
    } catch (e) {}

    ScreenSpoof._appliedConfig = null;
    return true;
  }

  static verify(expected) {
    const w = typeof window !== 'undefined' ? window : null;
    const result = { valid: true, checks: {} };
    if (!w || !w.screen) { result.valid = false; return result; }

    const c = {
      width: expected?.screen?.width ?? ScreenSpoof._defaultConfig.width,
      height: expected?.screen?.height ?? ScreenSpoof._defaultConfig.height,
      availWidth: expected?.screen?.availWidth ?? (expected?.screen?.width ?? ScreenSpoof._defaultConfig.availWidth),
      availHeight: expected?.screen?.availHeight ?? (expected?.screen?.height ?? ScreenSpoof._defaultConfig.availHeight),
      colorDepth: expected?.screen?.colorDepth ?? ScreenSpoof._defaultConfig.colorDepth,
      pixelDepth: expected?.screen?.pixelDepth ?? ScreenSpoof._defaultConfig.pixelDepth,
      devicePixelRatio: expected?.devicePixelRatio ?? ScreenSpoof._defaultConfig.devicePixelRatio
    };

    function check(name, actual, expectedVal) {
      const pass = actual === expectedVal;
      result.checks[name] = { expected: expectedVal, actual, pass };
      if (!pass) result.valid = false;
    }

    check('width', w.screen.width, c.width);
    check('height', w.screen.height, c.height);
    check('availWidth', w.screen.availWidth, c.availWidth);
    check('availHeight', w.screen.availHeight, c.availHeight);
    check('colorDepth', w.screen.colorDepth, c.colorDepth);
    check('pixelDepth', w.screen.pixelDepth, c.pixelDepth);
    check('devicePixelRatio', w.devicePixelRatio, c.devicePixelRatio);

    return result;
  }

  static generateInjectionScript(hardwareConfig = {}) {
    const c = {
      width: hardwareConfig?.screen?.width ?? ScreenSpoof._defaultConfig.width,
      height: hardwareConfig?.screen?.height ?? ScreenSpoof._defaultConfig.height,
      availWidth: hardwareConfig?.screen?.availWidth ?? (hardwareConfig?.screen?.width ?? ScreenSpoof._defaultConfig.availWidth),
      availHeight: hardwareConfig?.screen?.availHeight ?? (hardwareConfig?.screen?.height ?? ScreenSpoof._defaultConfig.availHeight),
      colorDepth: hardwareConfig?.screen?.colorDepth ?? ScreenSpoof._defaultConfig.colorDepth,
      pixelDepth: hardwareConfig?.screen?.pixelDepth ?? ScreenSpoof._defaultConfig.pixelDepth,
      devicePixelRatio: hardwareConfig?.devicePixelRatio ?? ScreenSpoof._defaultConfig.devicePixelRatio
    };

    return `
(function(){'use strict';
  try {
    var w = window;
    if (!w || !w.screen) return;

    // 1. Try to override properties on the screen instance
    try {
      Object.defineProperty(w.screen,'width',{get:function(){return ${c.width};},configurable:true,enumerable:true});
      Object.defineProperty(w.screen,'height',{get:function(){return ${c.height};},configurable:true,enumerable:true});
      Object.defineProperty(w.screen,'availWidth',{get:function(){return ${c.availWidth};},configurable:true,enumerable:true});
      Object.defineProperty(w.screen,'availHeight',{get:function(){return ${c.availHeight};},configurable:true,enumerable:true});
      Object.defineProperty(w.screen,'colorDepth',{get:function(){return ${c.colorDepth};},configurable:true,enumerable:true});
      Object.defineProperty(w.screen,'pixelDepth',{get:function(){return ${c.pixelDepth};},configurable:true,enumerable:true});
    } catch(e) {}

    // 2. Try to override properties on Screen.prototype (stronger fallback)
    try {
      if (window.Screen && window.Screen.prototype) {
        var proto = window.Screen.prototype;
        Object.defineProperty(proto,'width',{get:function(){return ${c.width};},configurable:true,enumerable:true});
        Object.defineProperty(proto,'height',{get:function(){return ${c.height};},configurable:true,enumerable:true});
        Object.defineProperty(proto,'availWidth',{get:function(){return ${c.availWidth};},configurable:true,enumerable:true});
        Object.defineProperty(proto,'availHeight',{get:function(){return ${c.availHeight};},configurable:true,enumerable:true});
        Object.defineProperty(proto,'colorDepth',{get:function(){return ${c.colorDepth};},configurable:true,enumerable:true});
        Object.defineProperty(proto,'pixelDepth',{get:function(){return ${c.pixelDepth};},configurable:true,enumerable:true});
      }
    } catch(e) {}

    // 3. Spoof window properties to match screen resolution (often checked by tests)
    try {
      Object.defineProperty(w,'innerWidth',{get:function(){return ${c.width};},configurable:true,enumerable:true});
      Object.defineProperty(w,'innerHeight',{get:function(){return ${c.height};},configurable:true,enumerable:true});
      Object.defineProperty(w,'outerWidth',{get:function(){return ${c.width};},configurable:true,enumerable:true});
      Object.defineProperty(w,'outerHeight',{get:function(){return ${c.height};},configurable:true,enumerable:true});
      Object.defineProperty(w,'devicePixelRatio',{get:function(){return ${c.devicePixelRatio};},configurable:true,enumerable:true});
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
    __mockScreen.width = ${c.width};
    __mockScreen.height = ${c.height};
    __mockScreen.availWidth = ${c.availWidth};
    __mockScreen.availHeight = ${c.availHeight};
    __mockScreen.colorDepth = ${c.colorDepth};
    __mockScreen.pixelDepth = ${c.pixelDepth};
    
    // Use Proxy as fallback for dynamic access
    var __prox = new Proxy(__sc, {
      get: function(t, p, r) {
        if (p === 'width') return ${c.width};
        if (p === 'height') return ${c.height};
        if (p === 'availWidth') return ${c.availWidth};
        if (p === 'availHeight') return ${c.availHeight};
        if (p === 'colorDepth') return ${c.colorDepth};
        if (p === 'pixelDepth') return ${c.pixelDepth};
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
       Object.defineProperty(window.screen, 'width', { value: ${c.width}, configurable: true });
       Object.defineProperty(window.screen, 'height', { value: ${c.height}, configurable: true });
    } catch(e2) {}
  }
  try {
    if (window.visualViewport) {
      Object.defineProperty(window.visualViewport,'scale',{get:function(){return 1;},configurable:true,enumerable:true});
      Object.defineProperty(window.visualViewport,'width',{get:function(){return ${c.width};},configurable:true,enumerable:true});
      Object.defineProperty(window.visualViewport,'height',{get:function(){return ${c.height};},configurable:true,enumerable:true});
    }
  } catch(e) {}
  try {
    var _origMatchMedia = window.matchMedia;
    if (typeof _origMatchMedia === 'function') {
      var __width = ${c.width};
      var __height = ${c.height};
      var __dppx = ${c.devicePixelRatio};
      var __dpi = __dppx * 96;

      window.matchMedia = wrapNative(_origMatchMedia, function(orig, args, thisArg) {
        var q = String(args[0] || '');
        // Skip complex queries with comma (list of media queries)
        if (q.indexOf(',') >= 0) return orig.call(thisArg, q);

        var mql = orig.call(thisArg, q);
        var res = null;

        function evalFeature(qStr) {
          var ok = true; var found = false;
          var rxDW = /\(\s*(min|max)?-?device-width\s*:\s*([0-9]*\.?[0-9]+)\s*px\s*\)/ig;
          var rxDH = /\(\s*(min|max)?-?device-height\s*:\s*([0-9]*\.?[0-9]+)\s*px\s*\)/ig;
          var rxDppx = /\(\s*(min|max)?-?resolution\s*:\s*([0-9]*\.?[0-9]+)\s*dppx\s*\)/ig;
          var rxDpi = /\(\s*(min|max)?-?resolution\s*:\s*([0-9]*\.?[0-9]+)\s*dpi\s*\)/ig;

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
`.trim();
  }
}

module.exports = {
  ScreenSpoof,
  ScreenSpoofError
};

