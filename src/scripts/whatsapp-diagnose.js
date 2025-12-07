/**
 * 检查 profile-pic-thumb 的完整数据结构
 */
(async function () {
    console.log('=== 检查头像数据 ===\n');

    const phoneNumber = localStorage.getItem('last-wid-md')?.replace(/^["']|["']$/g, '').match(/^(\d+)/)?.[1];
    console.log('当前用户号码:', phoneNumber);

    const request = indexedDB.open('model-storage');

    request.onsuccess = (event) => {
        const db = event.target.result;

        if (db.objectStoreNames.contains('profile-pic-thumb')) {
            const tx = db.transaction(['profile-pic-thumb'], 'readonly');
            const store = tx.objectStore('profile-pic-thumb');
            store.getAll().onsuccess = (e) => {
                const pics = e.target.result || [];
                console.log('共', pics.length, '条头像记录\n');

                for (const pic of pics) {
                    if (!pic) continue;
                    const picId = pic.id?._serialized || pic.id;

                    // 打印所有字段
                    if (phoneNumber && picId.includes(phoneNumber)) {
                        console.log('✓ 找到当前用户的头像记录:');
                        console.log('  ID:', picId);
                        console.log('  所有字段:', Object.keys(pic).join(', '));
                        console.log('  完整数据:', JSON.stringify(pic, null, 2));
                    }
                }
            };
        }

        setTimeout(() => db.close(), 1000);
    };
})();
