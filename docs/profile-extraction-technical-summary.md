# WhatsApp Web 账号信息无感知自动提取技术总结

本文档总结了无需用户操作、在后台自动提取 WhatsApp Web 当前登录账号信息（手机号码、昵称、头像）的技术实现方案。

## 1. 核心目标
实现完全无感知的账号信息提取，并在应用重启时自动更新，确保侧边栏显示的账号信息与 WhatsApp 保持一致。

## 2. 技术方案概述

摒弃了不稳定的 DOM 解析方案（模拟点击头像打开面板），转而采用直接读取 WhatsApp Web 本地存储（localStorage 和 IndexedDB）的底层方案。

### 2.1 数据来源

| 信息类型 | 数据源 | 存储位置 | 关键字段/逻辑 |
| :--- | :--- | :--- | :--- |
| **手机号码** | localStorage | Key: `last-wid-md` | 值格式为 `"手机号:41@c.us"`，通过正则提取纯数字号码。 |
| **昵称** | IndexedDB | DB: `model-storage`<br>Store: `contact` | 遍历记录，查找 `id` 包含手机号的记录，读取 `pushname` 字段。 |
| **头像** | IndexedDB | DB: `model-storage`<br>Store: `profile-pic-thumb` | 遍历记录，查找 `id` 包含手机号的记录，优先读取 `eurl`，其次 `imgFull`。 |

## 3. 详细提取逻辑

### 3.1 手机号码提取
WhatsApp Web 将当前登录用户的 ID 存储在浏览器的 `localStorage` 中，这是最可靠的号码来源。

```javascript
function getPhoneFromLocalStorage() {
  const lastWid = localStorage.getItem('last-wid-md');
  if (lastWid) {
    // 移除引号并提取数字部分
    const cleaned = lastWid.replace(/^["']|["']$/g, '');
    const match = cleaned.match(/^(\d+)/);
    if (match) return '+' + match[1]; // 返回 +37254001111 格式
  }
  return null;
}
```

### 3.2 昵称与头像提取 (IndexedDB)
WhatsApp 使用 IndexedDB (`model-storage`) 存储联系人和头像缓存。我们通过非阻塞的方式读取这些数据。

**关键策略：**
1. **延迟启动**：页面加载后等待 5-8 秒，确保 IndexedDB 数据已从服务器同步。
2. **模糊匹配**：由于 ID 后缀可能变化（如 `@c.us` 或 `@lid`），使用 `id.includes(phoneNumber)` 进行匹配最稳健。

```javascript
// 伪代码示例
const request = indexedDB.open('model-storage');
request.onsuccess = (e) => {
  const db = e.target.result;
  
  // 1. 获取昵称
  const contactStore = db.transaction(['contact'], 'readonly').objectStore('contact');
  contactStore.getAll().onsuccess = (e) => {
    const contacts = e.target.result;
    const myContact = contacts.find(c => c.id._serialized.includes(myPhoneNumber));
    if (myContact) profileName = myContact.pushname;
  };

  // 2. 获取头像
  const picStore = db.transaction(['profile-pic-thumb'], 'readonly').objectStore('profile-pic-thumb');
  picStore.getAll().onsuccess = (e) => {
    const pics = e.target.result;
    // 查找 ID 匹配的头像记录
    const myPic = pics.find(p => p.id._serialized.includes(myPhoneNumber));
    if (myPic) avatarUrl = myPic.eurl || myPic.imgFull;
  };
};
```

## 4. 数据更新与持久化流程

1.  **注入与执行**：
    *   `preload-view.js` 在 WhatsApp 页面加载完成后，注入 `whatsapp-profile-autoextract.js`。
    *   脚本在后台静默运行，每 3 秒检查一次。

2.  **IPC 通信**：
    *   提取成功后，通过 `electronAPI.invoke('view:update-profile', payload)` 将数据发送给主进程。

3.  **持久化保存**：
    *   主进程 (`AccountIPCHandlers.js`) 接收数据。
    *   更新内存中的 `ViewState`（实时更新 UI）。
    *   调用 `AccountManager.updateAccount()` 将最新的昵称、头像和号码写入硬盘的 `accounts.json` 文件。

## 5. 解决的关键问题

*   **号码重复显示**：发现 `sidebar.js` 原生支持号码显示，移除了冗余的 `accountProfileOverlay.js` 逻辑，解决了 UI 上显示两个号码的问题。
*   **头像不显示**：
    *   修复了 ID 匹配逻辑（之前过于严格，未考虑到 `@c.us` 后缀匹配）。
    *   优先使用 `eurl` 字段，解决了部分头像链接失效的问题。
*   **无感知体验**：完全移除模拟点击头像打开面板的逻辑，用户使用过程中不会受到任何干扰。
