/**
 * WhatsApp Web 账号信息自动提取模块
 * 
 * 功能：
 * 1. 自动从 localStorage 提取手机号码
 * 2. 自动从 IndexedDB 提取昵称和头像
 * 3. 自动发送提取到的信息到主进程进行更新和持久化
 * 
 * @version 5.0.0 - 生产就绪版 (Stable)
 */

(function WhatsAppProfileAutoExtractor() {
    'use strict';

    const CONFIG = {
        checkInterval: 3000,
        maxAttempts: 20,     // 最多尝试次数
        startTime: 5000,     // 页面加载后等待 5 秒再开始
        debug: false         // 关闭调试日志
    };

    let attempts = 0;
    let extracted = false;
    let checkTimer = null;

    function log(...args) {
        if (CONFIG.debug) {
            console.log('[ProfileExtractor]', ...args);
        }
    }

    // 获取带+号的号码，用于显示和发送
    function getPhoneFromLocalStorage() {
        try {
            const lastWid = localStorage.getItem('last-wid-md');
            if (lastWid) {
                const cleaned = lastWid.replace(/^["']|["']$/g, '');
                const match = cleaned.match(/^(\d+)/);
                if (match) return '+' + match[1];
            }
        } catch (e) { }
        return null;
    }

    // 获取纯数字号码，用于 IndexedDB 查询
    function getRawPhone() {
        const lastWid = localStorage.getItem('last-wid-md');
        if (lastWid) {
            const cleaned = lastWid.replace(/^["']|["']$/g, '');
            const match = cleaned.match(/^(\d+)/);
            if (match) return match[1];
        }
        return null;
    }

    function getFromModelStorage() {
        return new Promise((resolve) => {
            const result = { profileName: null, avatarUrl: null };
            const rawPhone = getRawPhone();

            if (!rawPhone) {
                resolve(result);
                return;
            }

            try {
                const request = indexedDB.open('model-storage');

                request.onsuccess = (event) => {
                    const db = event.target.result;
                    let pendingTx = 2;

                    const checkDone = () => {
                        pendingTx--;
                        if (pendingTx <= 0) {
                            db.close();
                            resolve(result);
                        }
                    };

                    // 1. 获取昵称 (contact store)
                    if (db.objectStoreNames.contains('contact')) {
                        const tx = db.transaction(['contact'], 'readonly');
                        const store = tx.objectStore('contact');
                        store.getAll().onsuccess = (e) => {
                            const contacts = e.target.result || [];
                            for (const contact of contacts) {
                                if (!contact || !contact.id) continue;
                                const contactId = contact.id._serialized || contact.id;
                                // 模糊匹配：只要 ID 包含号码即可
                                if (typeof contactId === 'string' && contactId.includes(rawPhone)) {
                                    if (contact.pushname) result.profileName = contact.pushname;
                                    break;
                                }
                            }
                            checkDone();
                        };
                        tx.oncomplete = null;
                        tx.onerror = checkDone;
                    } else { checkDone(); }

                    // 2. 获取头像 (profile-pic-thumb store)
                    if (db.objectStoreNames.contains('profile-pic-thumb')) {
                        const tx = db.transaction(['profile-pic-thumb'], 'readonly');
                        const store = tx.objectStore('profile-pic-thumb');
                        store.getAll().onsuccess = (e) => {
                            const pics = e.target.result || [];
                            const targetId = rawPhone + '@c.us';

                            for (const pic of pics) {
                                if (!pic || !pic.id) continue;
                                const picId = pic.id._serialized || pic.id;

                                // 优先精确匹配，其次模糊匹配
                                const matchExact = picId === targetId;
                                const matchInclude = typeof picId === 'string' && picId.includes(rawPhone);

                                if (matchExact || matchInclude) {
                                    const url = pic.eurl || pic.imgFull || pic.img;
                                    if (url) {
                                        result.avatarUrl = url;
                                        break;
                                    }
                                }
                            }
                            checkDone();
                        };
                        tx.oncomplete = null;
                        tx.onerror = checkDone;
                    } else { checkDone(); }
                };

                request.onerror = () => resolve(result);
            } catch (e) { resolve(result); }
        });
    }

    function getAvatarFromPage() {
        try {
            const rawPhone = getRawPhone();
            const imgs = document.querySelectorAll('img[src*="pps.whatsapp.net"]');
            for (const img of imgs) {
                if (rawPhone && img.src.includes(rawPhone)) return img.src;
            }
        } catch (e) { }
        return null;
    }

    async function sendToMainProcess(data) {
        const accountId = window.ACCOUNT_ID || 'unknown';
        const payload = { accountId, ...data };
        if (window.electronAPI?.invoke) {
            await window.electronAPI.invoke('view:update-profile', payload);
            return true;
        }
        return false;
    }

    async function tryExtract() {
        attempts++;
        if (extracted || attempts > CONFIG.maxAttempts) {
            if (checkTimer) clearInterval(checkTimer);
            return;
        }

        // 检查是否已登录
        const chatList = document.querySelector('[data-testid="chat-list"]') ||
            document.querySelector('#pane-side');
        if (!chatList) return;

        const phoneNumber = getPhoneFromLocalStorage();
        if (!phoneNumber) return;

        const idbResult = await getFromModelStorage();
        let avatarUrl = idbResult.avatarUrl || getAvatarFromPage();

        const result = {
            profileName: idbResult.profileName,
            phoneNumber: phoneNumber,
            avatarUrl: avatarUrl
        };

        // 只要有号码就尝试更新
        if (result.phoneNumber) {
            const hasAvatar = !!result.avatarUrl;
            const sent = await sendToMainProcess(result);

            // 成功条件：发送成功 且 (有头像 或者 尝试超过5次)
            // 这样保证尽量获取到头像，如果真没有也不死循环
            if (sent && (hasAvatar || attempts > 5)) {
                extracted = true;
                if (checkTimer) clearInterval(checkTimer);
            }
        }
    }

    function start() {
        // 延迟启动，避免与页面加载竞争 IndexedDB 资源
        setTimeout(() => {
            checkTimer = setInterval(tryExtract, CONFIG.checkInterval);
        }, CONFIG.startTime);
    }

    if (document.readyState === 'complete') {
        start();
    } else {
        window.addEventListener('load', start);
    }

})();
