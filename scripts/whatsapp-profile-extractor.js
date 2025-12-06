/**
 * WhatsApp Web 账号信息提取脚本
 * 请先手动打开个人资料面板（点击左上角头像），然后运行此脚本
 * 
 * @version 1.4.4
 */

(function () {
    console.log('=== WhatsApp Profile Extractor v1.4.4 ===');
    console.log('正在从当前页面提取信息...\n');

    const result = {
        profileName: null,
        phoneNumber: null,
        avatarUrl: null
    };

    // 图标名称列表（需要排除的）
    const iconNames = ['pencil', 'edit', 'phone', 'copy', 'check', 'close', 'back', 'menu',
        'arrow', 'search', 'attach', 'send', 'mic', 'emoji', 'gif', 'sticker',
        'refreshed', 'default-user', 'status', 'camera'];

    // 收集所有 span 文本
    const allSpans = document.querySelectorAll('span');
    const textList = [];

    allSpans.forEach((span, index) => {
        const text = span.textContent?.trim();
        const hasOnlyText = span.childNodes.length === 1 && span.childNodes[0].nodeType === Node.TEXT_NODE;
        if (text && text.length > 0 && text.length < 100) {
            textList.push({
                text,
                index,
                element: span,
                hasOnlyText,
                hasDir: span.hasAttribute('dir')
            });
        }
    });

    console.log('找到 span 数量:', textList.length);

    // 查找 "姓名" 标签的索引
    let nameIndex = -1;
    for (let i = 0; i < textList.length; i++) {
        if (textList[i].text === '姓名' || textList[i].text === 'Name') {
            nameIndex = i;
            console.log('找到 "姓名" 在索引:', i);
            break;
        }
    }

    // 查找昵称：在 "姓名" 之后的第一个有效文本
    if (nameIndex >= 0) {
        for (let i = nameIndex + 1; i < Math.min(nameIndex + 5, textList.length); i++) {
            const item = textList[i];
            const text = item.text;

            // 跳过标签
            if (['状态', 'Status', 'About', '姓名', 'Name', '电话号码', 'Phone number'].includes(text)) {
                continue;
            }

            // 排除图标名称
            const isIcon = iconNames.some(icon => text.toLowerCase().includes(icon));
            if (isIcon) continue;

            // 电话号码必须以 + 开头且至少 8 位，否则可能是昵称
            // "9911" 这种短数字应该被当作昵称
            const isPhone = /^\+\d{7,}$/.test(text.replace(/[\s-]/g, ''));
            if (isPhone) continue;

            // 找到有效的昵称
            if (item.hasDir || item.hasOnlyText) {
                result.profileName = text;
                console.log('✅ 找到昵称:', result.profileName);
                break;
            }
        }
    }

    // 查找电话号码（必须以 + 开头）
    for (const item of textList) {
        const cleanPhone = item.text.replace(/[\s-]/g, '');
        if (/^\+\d{7,15}$/.test(cleanPhone)) {
            result.phoneNumber = cleanPhone;
            console.log('✅ 找到号码:', result.phoneNumber);
            break;
        }
    }

    // 查找头像
    const avatarImages = document.querySelectorAll('img[src*="pps.whatsapp.net"]');
    for (const img of avatarImages) {
        if (img.src && img.width > 50) {
            result.avatarUrl = img.src;
            console.log('✅ 找到头像');
            break;
        }
    }

    if (!result.avatarUrl) {
        const anyAvatar = document.querySelector('img[src*="pps.whatsapp.net"]');
        if (anyAvatar && anyAvatar.src) {
            result.avatarUrl = anyAvatar.src;
            console.log('✅ 找到头像(备选)');
        }
    }

    // 显示结果
    console.log('\n========== 提取结果 ==========');
    console.log('昵称:', result.profileName || '❌ 未找到');
    console.log('号码:', result.phoneNumber || '❌ 未找到');
    console.log('头像:', result.avatarUrl ? '✅ 已获取' : '❌ 未找到');
    console.log('================================\n');

    // 发送到主进程
    if (result.profileName || result.phoneNumber || result.avatarUrl) {
        const accountId = window.ACCOUNT_ID || 'unknown';
        const payload = { accountId, ...result };

        console.log('📋 提取的数据:');
        console.log(JSON.stringify(payload, null, 2));

        if (window.electronAPI && window.electronAPI.invoke) {
            window.electronAPI.invoke('view:update-profile', payload)
                .then(() => console.log('✅ 已发送到主进程'))
                .catch(e => console.log('⚠️ 发送失败:', e.message));
        } else {
            console.log('💡 请重启应用后重试');
        }
    }

    return result;
})();
