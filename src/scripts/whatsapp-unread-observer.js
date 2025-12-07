/**
 * WhatsApp Web Unread Count Observer (DOM-based)
 * 
 * Monitors the chat list in the DOM to count unread messages.
 * EXCLUDES MUTED CHATS based on icon/label detection.
 */

(function WhatsAppUnreadObserver() {
    'use strict';

    const CONFIG = {
        scanInterval: 2000,    // Fallback polling
        debounceTime: 300      // Debounce for mutation observer
    };

    let lastCount = -1;
    let debounceTimer = null;
    let observer = null;
    let retryTimer = null;

    /**
     * Checks if a chat row is muted.
     * Uses multiple heuristics to detect the muted status.
     */
    function isRowMuted(row) {
        try {
            // 1. Selector check (Standard indicators)
            const mutedSelectors = [
                '[data-icon="muted"]',
                '[data-testid="muted"]',
                '[data-icon="volume-off"]',
                '[aria-label*="muted" i]', // Case insensitive
                '[aria-label*="静音" i]'
            ];

            if (row.querySelector(mutedSelectors.join(','))) {
                return true;
            }

            // 2. Row aria-label check
            const rowLabel = row.getAttribute('aria-label') || '';
            if (rowLabel.match(/muted|静音/i)) {
                return true;
            }

            // 3. SVG Path Heuristic (Last resort)
            // Look for SVGs that *look* like the muted icon (crossed out speaker)
            // This is brittle but effective if classes change.
            // WhatsApp Muted icon usually has a path for the cross.
            // Use specific known partial paths or assume if we see a 'volume' related icon that isn't sound, it's mute?
            // Actually, let's look for a specific container characteristic often found near the time.

            // Checking for the specific SVG content is risky. 
            // Let's stick to the selectors which cover 99% of cases.

            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * Calculate unread count by scanning DOM elements
     */
    function calculateUnreadFromDOM() {
        try {
            const paneSide = document.getElementById('pane-side');
            const searchRoot = paneSide || document;

            // Find all unread badges
            const elements = searchRoot.querySelectorAll('[aria-label*="unread"], [aria-label*="未读"]');

            const rowsProcessed = new Set();
            let totalCount = 0;

            elements.forEach(el => {
                const label = el.getAttribute('aria-label');
                if (!label) return;

                // 1. Must be in a chat row
                const row = el.closest('[role="row"]');
                if (!row) return;

                // Avoid duplicates (avatar badge + text badge)
                if (rowsProcessed.has(row)) return;
                rowsProcessed.add(row);

                // 2. CHECK IF MUTED (The user reported issue here)
                // If it is muted, we SKIP adding to count.
                if (isRowMuted(row)) {
                    // console.log('Skipping muted chat:', row);
                    return;
                }

                // 3. Parse Count
                // Matches: "5 unread", "5 unread messages", "5 条未读"
                const match = label.match(/(\d+)\s*(?:unread|条未读)/i);

                if (match) {
                    totalCount += parseInt(match[1], 10);
                } else {
                    // Handle single "dot" unread indicators
                    if ((label.toLowerCase().includes('unread') || label.includes('未读')) && !label.match(/\d/)) {
                        totalCount += 1;
                    }
                }
            });

            return totalCount;
        } catch (error) {
            console.error('[UnreadObserver] DOM calculation error:', error);
            return 0;
        }
    }

    async function sendUnreadCount(count) {
        const accountId = window.ACCOUNT_ID || 'unknown';
        if (window.electronAPI?.invoke) {
            try {
                const safeCount = Math.max(0, count);
                await window.electronAPI.invoke('view:update-unread-count', {
                    accountId,
                    unreadCount: safeCount
                });
            } catch (error) {
                // Ignore errors
            }
        }
    }

    function checkAndNotify() {
        const currentCount = calculateUnreadFromDOM();

        if (currentCount !== lastCount) {
            lastCount = currentCount;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                sendUnreadCount(currentCount);
            }, CONFIG.debounceTime);
        }
    }

    function startObserving() {
        const paneSide = document.getElementById('pane-side');

        if (paneSide) {
            // console.log('[UnreadObserver] Observer attached');
            if (observer) observer.disconnect();

            observer = new MutationObserver(() => {
                checkAndNotify();
            });

            observer.observe(paneSide, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['aria-label', 'data-icon']
            });

            checkAndNotify();
        } else {
            retryTimer = setTimeout(startObserving, 2000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving);
    } else {
        startObserving();
    }

    window.addEventListener('unload', () => {
        if (observer) observer.disconnect();
        if (retryTimer) clearTimeout(retryTimer);
        if (debounceTimer) clearTimeout(debounceTimer);
    });

})();
