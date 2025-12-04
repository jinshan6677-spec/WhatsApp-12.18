# Content Script Modular Architecture

This directory contains the refactored, modular version of the WhatsApp translation content script.

## Overview

The original `contentScript.js` (3416 lines) has been split into focused, maintainable modules:

## Module Structure

### 1. ContentScriptCore.js (Core Module)
**Responsibilities:**
- System initialization and lifecycle management
- Configuration loading and management
- Contact ID detection and management
- Utility functions (Chinese detection, similarity calculation, HTML entity decoding)

**Key Methods:**
- `init()` - Initialize the translation system
- `waitForWhatsApp()` - Wait for WhatsApp Web to load
- `loadConfig()` - Load translation configuration
- `getCurrentContactId()` - Get current chat contact ID
- `getContactConfig()` - Get contact-specific configuration
- `isChinese()` - Detect if text is primarily Chinese
- `calculateSimilarity()` - Calculate text similarity for reverse translation

### 2. MessageTranslator.js (Message Translation Module)
**Responsibilities:**
- Translating received messages in chat window
- Handling new message detection
- Managing existing message translation
- Periodic message checking

**Key Methods:**
- `handleNewMessage()` - Process and translate new messages
- `translateMessage()` - Translate a single message
- `translateExistingMessages()` - Translate all existing messages
- `startPeriodicCheck()` - Start periodic message checking
- `cleanupInvisibleTranslations()` - Remove translations outside viewport

### 3. InputBoxTranslator.js (Input Box Translation Module)
**Responsibilities:**
- Translating text before sending
- Managing translate button
- Realtime translation preview
- Reverse translation verification
- Language detection for chat

**Key Methods:**
- `initInputBoxTranslation()` - Initialize input box translation
- `addTranslateButton()` - Add floating translate button
- `translateInputBox()` - Translate input box content
- `detectChatLanguage()` - Detect language used by chat partner
- `setInputBoxText()` - Set translated text to input box
- `showInputBoxReverseTranslation()` - Show reverse translation verification
- `setupRealtimeTranslation()` - Setup realtime translation preview

### 4. TranslationUI.js (UI Components Module)
**Responsibilities:**
- Displaying translation results
- Showing toasts and alerts
- Managing realtime preview
- Injecting styles

**Key Methods:**
- `displayTranslation()` - Display translation result in message
- `displayError()` - Display error message
- `showToast()` - Show non-blocking toast notification
- `showChineseBlockAlert()` - Show Chinese block warning
- `createRealtimePreview()` - Create realtime preview element
- `showRealtimePreview()` - Show/update realtime preview
- `hideRealtimePreview()` - Hide realtime preview
- `injectStyles()` - Inject CSS styles

### 5. DOMObserver.js (DOM Observation Module)
**Responsibilities:**
- Observing message additions
- Detecting chat switches
- Managing Chinese input blocking
- Monitoring DOM changes

**Key Methods:**
- `observeMessages()` - Observe new messages
- `observeChatSwitch()` - Observe chat window switches
- `setupChineseBlock()` - Setup multi-layer Chinese blocking
- `shouldBlockChinese()` - Check if Chinese should be blocked
- `cleanupChineseBlock()` - Cleanup Chinese blocking resources

### 6. index.js (Integration Module)
**Responsibilities:**
- Integrating all modules
- Maintaining backward compatibility
- Exposing global API
- Initializing the system

**Key Features:**
- Creates instances of all modules
- Coordinates module interactions
- Exposes `window.WhatsAppTranslation` for backward compatibility
- Provides global helper functions

## Benefits of Modular Architecture

1. **Maintainability**: Each module has a single, clear responsibility
2. **Testability**: Modules can be tested independently
3. **Reusability**: Components can be reused in other contexts
4. **Readability**: Smaller files are easier to understand
5. **Collaboration**: Multiple developers can work on different modules
6. **Debugging**: Issues are easier to isolate and fix

## File Size Comparison

| File | Lines | Purpose |
|------|-------|---------|
| Original contentScript.js | 3416 | Monolithic implementation |
| ContentScriptCore.js | ~350 | Core functionality |
| MessageTranslator.js | ~200 | Message translation |
| InputBoxTranslator.js | ~400 | Input box translation |
| TranslationUI.js | ~350 | UI components |
| DOMObserver.js | ~300 | DOM observation |
| index.js | ~150 | Integration |
| **Total** | **~1750** | **Modular implementation** |

## Integration

The modular structure is designed to be integrated in several ways:

### Option 1: Build System (Recommended)
Use a bundler (webpack, rollup, etc.) to combine modules into a single file:
```bash
# Example with webpack
webpack --entry ./src/translation/content-script/index.js --output contentScript.bundle.js
```

### Option 2: Script Tags
Load modules in order via script tags:
```html
<script src="ContentScriptCore.js"></script>
<script src="TranslationUI.js"></script>
<script src="MessageTranslator.js"></script>
<script src="InputBoxTranslator.js"></script>
<script src="DOMObserver.js"></script>
<script src="index.js"></script>
```

### Option 3: ES6 Modules
If the environment supports ES6 modules, use import/export.

## Backward Compatibility

The modular version maintains full backward compatibility with the original:
- `window.WhatsAppTranslation` is still exposed
- All public methods remain available
- Configuration structure is unchanged
- Event handling is preserved

## Testing

Each module can be tested independently:

```javascript
// Example: Testing ContentScriptCore
const core = new ContentScriptCore();
await core.init();
assert(core.initialized === true);
assert(core.config !== null);
```

## Future Enhancements

The modular structure enables:
1. Easy addition of new translation engines
2. Plugin system for custom features
3. Better error handling and recovery
4. Performance optimizations per module
5. A/B testing of different implementations

## Migration Notes

- Original `contentScript.js` is preserved for reference
- New modular files are in `src/translation/content-script/`
- No changes to external APIs or configuration
- All existing functionality is maintained
- Settings panel code remains in original file (can be extracted later)
