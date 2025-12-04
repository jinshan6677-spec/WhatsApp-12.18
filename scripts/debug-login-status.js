#!/usr/bin/env node

/**
 * Debug script for login status detection
 * Run this to check what selectors are available in WhatsApp Web
 */

console.log('='.repeat(80));
console.log('Login Status Detection Debug Script');
console.log('='.repeat(80));
console.log();

console.log('To debug the login status detection:');
console.log();
console.log('1. Open the application and an account');
console.log('2. Open DevTools (View > Toggle Developer Tools)');
console.log('3. Switch to the Console tab');
console.log('4. Paste and run this code:');
console.log();
console.log('```javascript');
console.log(`
// Check for QR code
const qrCode = document.querySelector('canvas[aria-label*="QR"]') || 
               document.querySelector('canvas[aria-label*="Code"]') ||
               document.querySelector('canvas[aria-label*="code"]');
console.log('QR Code element:', qrCode);
console.log('QR Code visible:', qrCode && qrCode.offsetParent !== null);

// Check for chat pane
const chatPane = document.querySelector('[data-testid="chat-list"]') ||
                document.querySelector('#pane-side') ||
                document.querySelector('div[id="pane-side"]');
console.log('Chat Pane element:', chatPane);
console.log('Chat Pane visible:', chatPane && chatPane.offsetParent !== null);

// Check for chat items
const chatItems = document.querySelectorAll('[data-testid="cell-frame-container"]');
console.log('Chat Items count:', chatItems.length);

// Check for app container
const appContainer = document.querySelector('#app');
console.log('App Container:', appContainer);

// Summary
console.log('\\n=== SUMMARY ===');
console.log('Has QR Code:', !!qrCode);
console.log('QR Code Visible:', qrCode && qrCode.offsetParent !== null);
console.log('Has Chat Pane:', !!chatPane);
console.log('Chat Pane Visible:', chatPane && chatPane.offsetParent !== null);
console.log('Has Chat Items:', chatItems.length > 0);
console.log('Is Logged In:', (chatPane && chatPane.offsetParent !== null) || chatItems.length > 0);
`);
console.log('```');
console.log();

console.log('5. Check the console output to see which elements are found');
console.log('6. If "Is Logged In" is true but UI still shows "加载中...", check:');
console.log('   - Are the events being sent? (Check main process logs)');
console.log('   - Are the events being received? (Check renderer logs)');
console.log('   - Is the status being updated? (Check sidebar.js logs)');
console.log();

console.log('Expected Console Logs:');
console.log('- Main process: "Account XXX is logged in" or "Account XXX showing QR code"');
console.log('- Renderer: "[Sidebar] handleLoginStatusChanged for XXX"');
console.log('- Renderer: "[Sidebar] handleViewReady for XXX"');
console.log();

console.log('If you don\'t see these logs:');
console.log('1. The events are not being sent from ViewManager');
console.log('2. The events are not being received by the renderer');
console.log('3. The event handlers are not registered correctly');
console.log();

console.log('='.repeat(80));
