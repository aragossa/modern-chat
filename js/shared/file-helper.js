/**
 * FileHelper - 统一文件访问助手
 * ==========================================
 * 所有文件访问统一走 files.modern-chat.top/list.php。
 *
 * 重要：Web 前端不调用 /src/api/api.php / /src/api/api-pc.php（这些是外部 API 接口）。
 *
 * 用法：
 *   FileHelper.init(CONFIG.vkey);
 *   const url = FileHelper.getFileUrl('uploads/images/photo.jpg');
 *   // → 'https://files.modern-chat.top/list.php?file=uploads%2Fimages%2Fphoto.jpg&vkey=xxx'
 *   const url2 = await FileHelper.getSignedUrl('uploads/audio/voice.mp3');
 *   // → 同上（getSignedUrl 现在只是 getFileUrl 的异步包装，保持兼容性）
 */
var FileHelper = (function() {
    'use strict';

    var _vkey = '';

    /**
     * 判断是否是 IndexedDB 本地文件 ID
     * 这些 ID 不走 list.php，直接从本地缓存加载
     */
    function isLocalFileId(filePath) {
        if (!filePath) return false;
        return filePath.indexOf('Picture_') === 0
            || filePath.indexOf('Video_') === 0
            || filePath.indexOf('Audio_') === 0
            || filePath.indexOf('File_') === 0;
    }

    /**
     * 初始化：设置 vkey
     * @param {string} vkey - 用户认证密钥（从登录响应或页面 CONFIG 获取）
     */
    function init(vkey) {
        if (vkey) {
            _vkey = vkey;
        }
    }

    /**
     * 获取 vkey（如果未初始化，尝试从全局 CONFIG 读取）
     */
    function getVkey() {
        if (!_vkey) {
            // 尝试从页面配置自动获取
            if (typeof CHAT_CONFIG !== 'undefined' && CHAT_CONFIG.vkey) {
                _vkey = CHAT_CONFIG.vkey;
            } else if (typeof MOBILE_CHAT_CONFIG !== 'undefined' && MOBILE_CHAT_CONFIG.vkey) {
                _vkey = MOBILE_CHAT_CONFIG.vkey;
            } else if (typeof ADMIN_CONFIG !== 'undefined' && ADMIN_CONFIG.vkey) {
                _vkey = ADMIN_CONFIG.vkey;
            } else if (typeof window.CONFIG !== 'undefined' && window.CONFIG.vkey) {
                _vkey = window.CONFIG.vkey;
            }
        }
        return _vkey;
    }

    /**
     * 获取文件访问 URL（同步，适用于 img/audio/video src 属性）
     *
     * 机制：直接构建 files.modern-chat.top/list.php 签名 URL。
     * 使用 CHAT_CONFIG 中的 vkey，在 JS 端构建带 token 的完整 URL，
     * 不再通过 /src/api/api.php 中转（/src/api/api.php 是外部 API，Web 页面不应调用）。
     *
     * 注意：所有文件访问统一通过 list.php，无论是 src 属性加载还是 fetch/XHR 调用。
     *
     * @param {string} filePath - 文件相对路径或完整 URL
     * @returns {string} 可直接用于 src/href 的 URL
     */
    function getFileUrl(filePath) {
        if (!filePath) return '';

        // IndexedDB 本地文件 ID → 直接返回
        if (isLocalFileId(filePath)) {
            return filePath;
        }

        // 如果是 files.modern-chat.top 的正确 URL → 直接使用
        if (filePath.indexOf('files.modern-chat.top') !== -1) {
            return filePath;
        }

        // 如果是 /src/files/proxy_file.php 代理 URL → 重写为 list.php 直接 URL
        if (filePath.indexOf('/src/files/proxy_file.php') !== -1) {
            var proxyUrl = filePath.replace(/^https?:\/\/[^\/]+\/proxy_file\.php/, 'https://files.modern-chat.top/list.php');
            return proxyUrl;
        }

        // 如果是完整的 http(s) URL → 直接使用
        if (filePath.indexOf('http://') === 0 || filePath.indexOf('https://') === 0) {
            return filePath;
        }
        // 清理路径
        var cleanPath = filePath.replace(/\\/g, '/');
        // 去掉可能的开头斜杠
        if (cleanPath.charAt(0) === '/') {
            cleanPath = cleanPath.substring(1);
        }
        
        // 去掉可能的域名前缀（防止旧数据中的绝对URL）
        try {
            var urlObj = new URL(filePath, window.location.href);
            // 如果解析出的是同域或已知域名的路径，提取 pathname 部分
            if (urlObj.hostname && urlObj.pathname && urlObj.pathname !== '/') {
                cleanPath = urlObj.pathname.replace(/^\//, '');
                // 去掉开头的 test/ 或其他子目录前缀（上传目录残留）
                cleanPath = cleanPath.replace(/^(test|uploads|www)\//, '');
            }
        } catch(e) {}

        // 路径格式: upload_id/stored_name → 拆分为 id + file 参数
        var vkey = getVkey();
        var slashPos = cleanPath.indexOf('/');
        if (slashPos > 0) {
            var uploadId = cleanPath.substring(0, slashPos);
            var storedName = cleanPath.substring(slashPos + 1);
            return 'https://files.modern-chat.top/list.php'
                + '?id=' + encodeURIComponent(uploadId)
                + '&file=' + encodeURIComponent(storedName)
                + '&vkey=' + encodeURIComponent(vkey || '');
        }

        // 没有 / — 回退：只用 file 参数
        return 'https://files.modern-chat.top/list.php'
            + '?file=' + encodeURIComponent(cleanPath)
            + '&vkey=' + encodeURIComponent(vkey || '');
    }

    /**
     * 获取文件访问 URL（异步，兼容旧代码的 Promise 接口）
     * 
     * 与 getFileUrl() 行为完全一致 — 统一走 files.modern-chat.top/list.php。
     * 保留此方法仅为向后兼容旧代码中的 await FileHelper.getSignedUrl() 调用。
     *
     * @param {string} filePath - 文件相对路径或完整 URL
     * @returns {Promise<string>}
     */
    function getSignedUrl(filePath) {
        return Promise.resolve(getFileUrl(filePath));
    }

    /**
     * 清除缓存的 token（无操作，保留向后兼容）
     */
    function clearTokenCache() {
        // 直接 list.php 模式无需缓存管理
    }

    /**
     * 批量预加载 URL（无操作，保留向后兼容）
     * @param {string[]} filePaths
     * @returns {Promise<void>}
     */
    function preloadSignedUrls(filePaths) {
        return Promise.resolve();
    }

    // ═══════════════════════════════════════
    // 公开 API
    // ═══════════════════════════════════════
    return {
        init: init,
        getVkey: getVkey,
        getFileUrl: getFileUrl,
        getSignedUrl: getSignedUrl,
        clearTokenCache: clearTokenCache,
        preloadSignedUrls: preloadSignedUrls,
        isLocalFileId: isLocalFileId
    };
})();
