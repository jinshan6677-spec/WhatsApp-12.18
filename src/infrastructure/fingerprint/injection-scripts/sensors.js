/**
 * Sensor API Protection Script
 * @module infrastructure/fingerprint/injection-scripts/sensors
 * **Validates: Requirements 17.1, 17.2, 17.3, 17.4**
 */
'use strict';
const { NativeWrapper } = require('./core/native-wrapper');

class SensorSpoofError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SensorSpoofError';
    this.code = code;
    this.details = details;
  }
}

class SensorSpoof {
  static _defaultConfig = {
    mode: 'disable',
    noiseSeed: 12345,
    noiseLevel: 'medium',
    motion: {
      acceleration: { x: 0, y: 0, z: 0 },
      accelerationIncludingGravity: { x: 0, y: -9.8, z: 0 },
      rotationRate: { alpha: 0, beta: 0, gamma: 0 },
      interval: 16
    },
    orientation: { alpha: 0, beta: 0, gamma: 0, absolute: false }
  };

  static _originalMethods = {};
  static _appliedConfig = null;
  static _eventListeners = { devicemotion: [], deviceorientation: [] };
  static _rngState = null;

  static _createSeededRNG(seed) {
    let state = seed;
    return function() {
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), state | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  static _getNoiseScale(level) {
    switch (level) {
      case 'low': return 0.01;
      case 'medium': return 0.05;
      case 'high': return 0.1;
      default: return 0.05;
    }
  }

  static _applyNoise(value) {
    if (!SensorSpoof._rngState) return value;
    const scale = SensorSpoof._getNoiseScale(SensorSpoof._appliedConfig.noiseLevel);
    const noise = (SensorSpoof._rngState() * 2 - 1) * scale;
    return value + noise;
  }

  static apply(config = {}) {
    const mergedConfig = { 
      ...SensorSpoof._defaultConfig, 
      ...config,
      motion: { ...SensorSpoof._defaultConfig.motion, ...(config.motion || {}) },
      orientation: { ...SensorSpoof._defaultConfig.orientation, ...(config.orientation || {}) }
    };

    if (!['disable', 'noise', 'real'].includes(mergedConfig.mode)) {
      throw new SensorSpoofError(`Invalid mode: ${mergedConfig.mode}`, 'INVALID_MODE', { mode: mergedConfig.mode });
    }
    if (!['low', 'medium', 'high'].includes(mergedConfig.noiseLevel)) {
      throw new SensorSpoofError(`Invalid noiseLevel: ${mergedConfig.noiseLevel}`, 'INVALID_NOISE_LEVEL', { noiseLevel: mergedConfig.noiseLevel });
    }

    SensorSpoof._appliedConfig = mergedConfig;
    if (mergedConfig.mode === 'noise') {
      SensorSpoof._rngState = SensorSpoof._createSeededRNG(mergedConfig.noiseSeed);
    }

    const results = { success: true, spoofed: [], failed: [] };
    if (mergedConfig.mode === 'real') return results;

    try { SensorSpoof._spoofDeviceMotionEvent(); results.spoofed.push('DeviceMotionEvent'); }
    catch (e) { results.failed.push({ api: 'DeviceMotionEvent', error: e.message }); results.success = false; }

    try { SensorSpoof._spoofDeviceOrientationEvent(); results.spoofed.push('DeviceOrientationEvent'); }
    catch (e) { results.failed.push({ api: 'DeviceOrientationEvent', error: e.message }); results.success = false; }

    try { SensorSpoof._interceptEventListeners(); results.spoofed.push('EventListeners'); }
    catch (e) { results.failed.push({ api: 'EventListeners', error: e.message }); }

    return results;
  }

  static _createFakeMotionEvent() {
    const config = SensorSpoof._appliedConfig;
    const m = config.motion;
    const isNoise = config.mode === 'noise';
    const applyN = (v) => isNoise ? SensorSpoof._applyNoise(v) : v;

    return {
      type: 'devicemotion',
      acceleration: { get x() { return applyN(m.acceleration.x); }, get y() { return applyN(m.acceleration.y); }, get z() { return applyN(m.acceleration.z); } },
      accelerationIncludingGravity: { get x() { return applyN(m.accelerationIncludingGravity.x); }, get y() { return applyN(m.accelerationIncludingGravity.y); }, get z() { return applyN(m.accelerationIncludingGravity.z); } },
      rotationRate: { get alpha() { return applyN(m.rotationRate.alpha); }, get beta() { return applyN(m.rotationRate.beta); }, get gamma() { return applyN(m.rotationRate.gamma); } },
      interval: m.interval, bubbles: false, cancelable: false, defaultPrevented: false, isTrusted: true, timeStamp: Date.now()
    };
  }

  static _createFakeOrientationEvent() {
    const config = SensorSpoof._appliedConfig;
    const o = config.orientation;
    const isNoise = config.mode === 'noise';
    const applyN = (v) => isNoise ? SensorSpoof._applyNoise(v) : v;

    return {
      type: 'deviceorientation',
      get alpha() { return applyN(o.alpha); }, get beta() { return applyN(o.beta); }, get gamma() { return applyN(o.gamma); },
      absolute: o.absolute, bubbles: false, cancelable: false, defaultPrevented: false, isTrusted: true, timeStamp: Date.now()
    };
  }

  static _spoofDeviceMotionEvent() {
    if (typeof window === 'undefined') return;
    const Original = window.DeviceMotionEvent;
    if (Original) SensorSpoof._originalMethods.DeviceMotionEvent = Original;
    const config = SensorSpoof._appliedConfig;

    if (config.mode === 'disable') {
      const Disabled = function() { throw new DOMException('DeviceMotionEvent is disabled', 'NotAllowedError'); };
      Object.defineProperty(Disabled, 'name', { value: 'DeviceMotionEvent', writable: false, enumerable: false, configurable: true });
      Disabled.toString = function() { return 'function DeviceMotionEvent() { [native code] }'; };
      try { Object.defineProperty(window, 'DeviceMotionEvent', { value: Disabled, writable: true, enumerable: false, configurable: true }); }
      catch (e) { window.DeviceMotionEvent = Disabled; }
      return;
    }

    if (Original) {
      const Spoofed = NativeWrapper.wrap(Original, function(original, args) { return new original(...args); }, { name: 'DeviceMotionEvent', length: 1 });
      try { Object.defineProperty(window, 'DeviceMotionEvent', { value: Spoofed, writable: true, enumerable: false, configurable: true }); }
      catch (e) { window.DeviceMotionEvent = Spoofed; }
    }
  }

  static _spoofDeviceOrientationEvent() {
    if (typeof window === 'undefined') return;
    const Original = window.DeviceOrientationEvent;
    if (Original) SensorSpoof._originalMethods.DeviceOrientationEvent = Original;
    const config = SensorSpoof._appliedConfig;

    if (config.mode === 'disable') {
      const Disabled = function() { throw new DOMException('DeviceOrientationEvent is disabled', 'NotAllowedError'); };
      Object.defineProperty(Disabled, 'name', { value: 'DeviceOrientationEvent', writable: false, enumerable: false, configurable: true });
      Disabled.toString = function() { return 'function DeviceOrientationEvent() { [native code] }'; };
      try { Object.defineProperty(window, 'DeviceOrientationEvent', { value: Disabled, writable: true, enumerable: false, configurable: true }); }
      catch (e) { window.DeviceOrientationEvent = Disabled; }
      return;
    }

    if (Original) {
      const Spoofed = NativeWrapper.wrap(Original, function(original, args) { return new original(...args); }, { name: 'DeviceOrientationEvent', length: 1 });
      try { Object.defineProperty(window, 'DeviceOrientationEvent', { value: Spoofed, writable: true, enumerable: false, configurable: true }); }
      catch (e) { window.DeviceOrientationEvent = Spoofed; }
    }
  }

  static _interceptEventListeners() {
    if (typeof window === 'undefined') return;
    const config = SensorSpoof._appliedConfig;
    const origAdd = window.addEventListener;
    const origRemove = window.removeEventListener;
    SensorSpoof._originalMethods.addEventListener = origAdd;
    SensorSpoof._originalMethods.removeEventListener = origRemove;

    const wrappedAdd = NativeWrapper.wrap(origAdd, function(original, args, thisArg) {
      const [type, listener, options] = args;
      if (type === 'devicemotion' || type === 'deviceorientation') {
        if (config.mode === 'disable') return;
        if (config.mode === 'noise') {
          const wrapped = function() {
            const fake = type === 'devicemotion' ? SensorSpoof._createFakeMotionEvent() : SensorSpoof._createFakeOrientationEvent();
            if (typeof listener === 'function') listener.call(thisArg, fake);
            else if (listener && typeof listener.handleEvent === 'function') listener.handleEvent(fake);
          };
          SensorSpoof._eventListeners[type].push({ original: listener, wrapped, options });
          return original.call(thisArg, type, wrapped, options);
        }
      }
      return original.call(thisArg, type, listener, options);
    }, { name: 'addEventListener', length: 2 });

    const wrappedRemove = NativeWrapper.wrap(origRemove, function(original, args, thisArg) {
      const [type, listener, options] = args;
      if ((type === 'devicemotion' || type === 'deviceorientation') && config.mode === 'noise') {
        const listeners = SensorSpoof._eventListeners[type];
        const idx = listeners.findIndex(item => item.original === listener);
        if (idx !== -1) {
          const wrapped = listeners[idx].wrapped;
          listeners.splice(idx, 1);
          return original.call(thisArg, type, wrapped, options);
        }
      }
      return original.call(thisArg, type, listener, options);
    }, { name: 'removeEventListener', length: 2 });

    try {
      Object.defineProperty(window, 'addEventListener', { value: wrappedAdd, writable: true, enumerable: true, configurable: true });
      Object.defineProperty(window, 'removeEventListener', { value: wrappedRemove, writable: true, enumerable: true, configurable: true });
    } catch (e) {
      window.addEventListener = wrappedAdd;
      window.removeEventListener = wrappedRemove;
    }
  }

  static getAppliedConfig() {
    return SensorSpoof._appliedConfig ? { ...SensorSpoof._appliedConfig } : null;
  }

  static restore() {
    const results = { restored: [], failed: [] };
    if (typeof window === 'undefined') return results;

    if (SensorSpoof._originalMethods.DeviceMotionEvent) {
      try { window.DeviceMotionEvent = SensorSpoof._originalMethods.DeviceMotionEvent; results.restored.push('DeviceMotionEvent'); }
      catch (e) { results.failed.push({ api: 'DeviceMotionEvent', error: e.message }); }
    }
    if (SensorSpoof._originalMethods.DeviceOrientationEvent) {
      try { window.DeviceOrientationEvent = SensorSpoof._originalMethods.DeviceOrientationEvent; results.restored.push('DeviceOrientationEvent'); }
      catch (e) { results.failed.push({ api: 'DeviceOrientationEvent', error: e.message }); }
    }
    if (SensorSpoof._originalMethods.addEventListener) {
      try { window.addEventListener = SensorSpoof._originalMethods.addEventListener; results.restored.push('addEventListener'); }
      catch (e) { results.failed.push({ api: 'addEventListener', error: e.message }); }
    }
    if (SensorSpoof._originalMethods.removeEventListener) {
      try { window.removeEventListener = SensorSpoof._originalMethods.removeEventListener; results.restored.push('removeEventListener'); }
      catch (e) { results.failed.push({ api: 'removeEventListener', error: e.message }); }
    }

    SensorSpoof._originalMethods = {};
    SensorSpoof._appliedConfig = null;
    SensorSpoof._eventListeners = { devicemotion: [], deviceorientation: [] };
    SensorSpoof._rngState = null;
    return results;
  }

  static fromFingerprintConfig(fingerprintConfig) {
    if (!fingerprintConfig) return { ...SensorSpoof._defaultConfig };
    const sensorsConfig = fingerprintConfig.sensors || {};
    return {
      mode: sensorsConfig.mode || SensorSpoof._defaultConfig.mode,
      noiseSeed: fingerprintConfig.noiseSeed?.value || SensorSpoof._defaultConfig.noiseSeed,
      noiseLevel: sensorsConfig.noiseLevel || SensorSpoof._defaultConfig.noiseLevel,
      motion: sensorsConfig.motion ? { ...SensorSpoof._defaultConfig.motion, ...sensorsConfig.motion } : SensorSpoof._defaultConfig.motion,
      orientation: sensorsConfig.orientation ? { ...SensorSpoof._defaultConfig.orientation, ...sensorsConfig.orientation } : SensorSpoof._defaultConfig.orientation
    };
  }

  static verify(expectedConfig) {
    const result = { valid: true, checks: {} };
    const appliedConfig = SensorSpoof.getAppliedConfig();
    result.checks.configApplied = { expected: true, actual: appliedConfig !== null, pass: appliedConfig !== null };
    if (!appliedConfig) { result.valid = false; return result; }

    if (expectedConfig.mode !== undefined) {
      result.checks.mode = { expected: expectedConfig.mode, actual: appliedConfig.mode, pass: appliedConfig.mode === expectedConfig.mode };
      if (!result.checks.mode.pass) result.valid = false;
    }
    if (expectedConfig.noiseLevel !== undefined) {
      result.checks.noiseLevel = { expected: expectedConfig.noiseLevel, actual: appliedConfig.noiseLevel, pass: appliedConfig.noiseLevel === expectedConfig.noiseLevel };
      if (!result.checks.noiseLevel.pass) result.valid = false;
    }

    if (typeof window !== 'undefined' && appliedConfig.mode === 'disable') {
      try { new window.DeviceMotionEvent('devicemotion'); result.checks.motionDisabled = { expected: 'throws', actual: 'did not throw', pass: false }; result.valid = false; }
      catch (e) { result.checks.motionDisabled = { expected: 'throws', actual: 'throws', pass: true }; }
      try { new window.DeviceOrientationEvent('deviceorientation'); result.checks.orientationDisabled = { expected: 'throws', actual: 'did not throw', pass: false }; result.valid = false; }
      catch (e) { result.checks.orientationDisabled = { expected: 'throws', actual: 'throws', pass: true }; }
    }
    return result;
  }

  static generateInjectionScript(config) {
    const mc = { ...SensorSpoof._defaultConfig, ...config, motion: { ...SensorSpoof._defaultConfig.motion, ...(config.motion || {}) }, orientation: { ...SensorSpoof._defaultConfig.orientation, ...(config.orientation || {}) } };
    return "(function(){'use strict';const config=" + JSON.stringify(mc) + ";if(config.mode==='real')return;if(typeof window==='undefined')return;let rngState=config.noiseSeed;function seededRandom(){rngState=(rngState+0x6D2B79F5)|0;let t=Math.imul(rngState^(rngState>>>15),rngState|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}function getNoiseScale(l){return l==='low'?0.01:l==='high'?0.1:0.05;}function applyNoise(v){return v+(seededRandom()*2-1)*getNoiseScale(config.noiseLevel);}const listenerMappings={devicemotion:[],deviceorientation:[]};const origAdd=window.addEventListener,origRemove=window.removeEventListener;if(config.mode==='disable'){const DM=function(){throw new DOMException('DeviceMotionEvent is disabled','NotAllowedError');};Object.defineProperty(DM,'name',{value:'DeviceMotionEvent'});DM.toString=function(){return'function DeviceMotionEvent() { [native code] }';};const DO=function(){throw new DOMException('DeviceOrientationEvent is disabled','NotAllowedError');};Object.defineProperty(DO,'name',{value:'DeviceOrientationEvent'});DO.toString=function(){return'function DeviceOrientationEvent() { [native code] }';};try{Object.defineProperty(window,'DeviceMotionEvent',{value:DM,writable:true,configurable:true});Object.defineProperty(window,'DeviceOrientationEvent',{value:DO,writable:true,configurable:true});}catch(e){window.DeviceMotionEvent=DM;window.DeviceOrientationEvent=DO;}window.addEventListener=function(t,l,o){if(t==='devicemotion'||t==='deviceorientation')return;return origAdd.call(this,t,l,o);};Object.defineProperty(window.addEventListener,'name',{value:'addEventListener'});window.addEventListener.toString=function(){return'function addEventListener() { [native code] }';};return;}if(config.mode==='noise'){window.addEventListener=function(t,l,o){if(t==='devicemotion'||t==='deviceorientation'){const w=function(){const m=config.motion,or=config.orientation,n=config.mode==='noise';const f=t==='devicemotion'?{type:'devicemotion',acceleration:{x:n?applyNoise(m.acceleration.x):m.acceleration.x,y:n?applyNoise(m.acceleration.y):m.acceleration.y,z:n?applyNoise(m.acceleration.z):m.acceleration.z},accelerationIncludingGravity:{x:n?applyNoise(m.accelerationIncludingGravity.x):m.accelerationIncludingGravity.x,y:n?applyNoise(m.accelerationIncludingGravity.y):m.accelerationIncludingGravity.y,z:n?applyNoise(m.accelerationIncludingGravity.z):m.accelerationIncludingGravity.z},rotationRate:{alpha:n?applyNoise(m.rotationRate.alpha):m.rotationRate.alpha,beta:n?applyNoise(m.rotationRate.beta):m.rotationRate.beta,gamma:n?applyNoise(m.rotationRate.gamma):m.rotationRate.gamma},interval:m.interval,bubbles:false,cancelable:false,isTrusted:true,timeStamp:Date.now()}:{type:'deviceorientation',alpha:n?applyNoise(or.alpha):or.alpha,beta:n?applyNoise(or.beta):or.beta,gamma:n?applyNoise(or.gamma):or.gamma,absolute:or.absolute,bubbles:false,cancelable:false,isTrusted:true,timeStamp:Date.now()};if(typeof l==='function')l.call(this,f);else if(l&&typeof l.handleEvent==='function')l.handleEvent(f);};listenerMappings[t].push({original:l,wrapped:w,options:o});return origAdd.call(this,t,w,o);}return origAdd.call(this,t,l,o);};Object.defineProperty(window.addEventListener,'name',{value:'addEventListener'});window.addEventListener.toString=function(){return'function addEventListener() { [native code] }';};window.removeEventListener=function(t,l,o){if(t==='devicemotion'||t==='deviceorientation'){const m=listenerMappings[t],i=m.findIndex(function(x){return x.original===l;});if(i!==-1){const w=m[i].wrapped;m.splice(i,1);return origRemove.call(this,t,w,o);}}return origRemove.call(this,t,l,o);};Object.defineProperty(window.removeEventListener,'name',{value:'removeEventListener'});window.removeEventListener.toString=function(){return'function removeEventListener() { [native code] }';};}})();";
  }
}

module.exports = { SensorSpoof, SensorSpoofError };
