        // 扫码登录功能
        let scannerStream = null;
        let currentScanUrl = '';
        let currentQid = '';
        let currentIpAddress = '';
        
        // 显示扫码登录模态框
        function showScanLoginModal() {
            const modal = document.getElementById('scan-modal');
            modal.style.display = 'flex';
            initScanner();
        }
        
        // 关闭扫码登录模态框
        function closeScanModal() {
            const modal = document.getElementById('scan-modal');
            modal.style.display = 'none';
            stopScanner();
        }
        
        // 初始化扫码器
        async function initScanner() {
            try {
                // 请求相机权限，使用后置相机，并优化参数
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1920 }, // 提高分辨率
                        height: { ideal: 1080 },
                        focusMode: 'continuous',
                        exposureMode: 'continuous',
                        whiteBalanceMode: 'continuous'
                    }
                });
                
                scannerStream = stream;
                const video = document.getElementById('qr-video');
                video.srcObject = stream;
                await video.play();
                
                // 立即开始扫描
                startScanning(video);
            } catch (error) {
                console.error('相机访问失败:', error);
                const hint = document.getElementById('scan-hint');
                hint.textContent = '相机访问失败，请检查权限设置';
                hint.style.color = '#ff4757';
            }
        }
        
        // 停止扫码器
        function stopScanner() {
            if (scannerStream) {
                scannerStream.getTracks().forEach(track => track.stop());
                scannerStream = null;
            }
        }
        
        // 开始扫描
        function startScanning(video) {
            // 创建canvas元素并添加到DOM中
            const canvas = document.createElement('canvas');
            canvas.style.display = 'none'; // 隐藏canvas元素
            canvas.id = 'scan-canvas';
            document.body.appendChild(canvas);
            
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            // 设置扫码提示
            const hint = document.getElementById('scan-hint');
            hint.textContent = '正在扫描二维码...';
            hint.style.color = '#4caf50';
            
            // 降低canvas分辨率以提高处理速度
            const scale = 0.5; // 缩小到原来的一半
            
            function scanFrame() {
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    // 确保canvas尺寸与视频尺寸匹配
                    canvas.width = video.videoWidth * scale;
                    canvas.height = video.videoHeight * scale;
                    
                    // 绘制缩放后的图像
                    ctx.drawImage(
                        video, 
                        0, 0, video.videoWidth, video.videoHeight, 
                        0, 0, canvas.width, canvas.height
                    );
                    
                    try {
                        // 获取图像数据
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        
                        // 检查jsQR库是否已加载
                        if (typeof jsQR === 'undefined') {
                            // jsQR库未加载，尝试加载
                            hint.textContent = '二维码库加载中...';
                            hint.style.color = '#ff9800';
                            
                            // 尝试加载jsQR库
                            loadJsQR().then(() => {
                                // 加载成功，继续扫描
                                requestAnimationFrame(scanFrame);
                            }).catch(error => {
                                console.error('加载jsQR库失败:', error);
                                hint.textContent = '二维码库加载失败';
                                hint.style.color = '#ff4757';
                                // 继续尝试扫描
                                requestAnimationFrame(scanFrame);
                            });
                            return;
                        }
                        
                        // 1. 首先应用背景转换预处理（简化版，提高速度）
                        const processedImageData = fastPreprocess(imageData);
                        
                        // 2. 使用处理后的图像尝试识别二维码
                        const code = jsQR(processedImageData.data, processedImageData.width, processedImageData.height, {
                            inversionAttempts: 'both'
                        });
                        
                        if (code) {
                            // 扫描成功，更新提示
                            hint.textContent = '扫描成功！';
                            hint.style.color = '#4caf50';
                            // 处理扫描结果
                            handleScanResult(code.data);
                            // 移除canvas元素
                            document.body.removeChild(canvas);
                        } else {
                            // 继续扫描
                            requestAnimationFrame(scanFrame);
                        }
                    } catch (error) {
                        console.error('扫描错误:', error);
                        // 继续扫描
                        requestAnimationFrame(scanFrame);
                    }
                } else {
                    requestAnimationFrame(scanFrame);
                }
            }
            
            // 开始扫描循环
            requestAnimationFrame(scanFrame);
        }
        
        // 快速预处理函数，提高实时性
        function fastPreprocess(imageData) {
            const data = imageData.data;
            
            // 1. 颜色反转：将白色二维码黑色背景转换为标准的黑色二维码白色背景
            for (let i = 0; i < data.length; i += 4) {
                // 反转RGB值
                data[i] = 255 - data[i];     // R
                data[i + 1] = 255 - data[i + 1]; // G
                data[i + 2] = 255 - data[i + 2]; // B
            }
            
            // 2. 快速二值化处理
            const threshold = 128;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const brightness = (r + g + b) / 3;
                
                if (brightness < threshold) {
                    // 转换为黑色
                    data[i] = 0;
                    data[i + 1] = 0;
                    data[i + 2] = 0;
                } else {
                    // 转换为白色
                    data[i] = 255;
                    data[i + 1] = 255;
                    data[i + 2] = 255;
                }
            }
            
            return imageData;
        }
        
        // 增强的图像预处理，支持背景转换和黑色背景
        function simplePreprocess(imageData) {
            const data = imageData.data;
            const width = imageData.width;
            const height = imageData.height;
            
            // 1. 颜色反转：将白色二维码黑色背景转换为标准的黑色二维码白色背景
            for (let i = 0; i < data.length; i += 4) {
                // 反转RGB值
                data[i] = 255 - data[i];     // R
                data[i + 1] = 255 - data[i + 1]; // G
                data[i + 2] = 255 - data[i + 2]; // B
            }
            
            // 2. 高斯模糊降噪
            const blurredData = gaussianBlur(data, width, height);
            
            // 3. 边缘增强
            const edgeEnhancedData = edgeEnhance(blurredData, width, height);
            
            // 4. 自适应阈值二值化处理：根据局部区域自动调整阈值
            adaptiveThreshold(edgeEnhancedData, width, height);
            
            // 5. 增强对比度
            const contrast = 3.0; // 进一步增加对比度以提高清晰度
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // 应用对比度调整
                data[i] = Math.min(255, Math.max(0, (r - 128) * contrast + 128));
                data[i + 1] = Math.min(255, Math.max(0, (g - 128) * contrast + 128));
                data[i + 2] = Math.min(255, Math.max(0, (b - 128) * contrast + 128));
            }
            
            return imageData;
        }
        
        // 高斯模糊降噪
        function gaussianBlur(data, width, height) {
            const kernel = [
                [1, 2, 1],
                [2, 4, 2],
                [1, 2, 1]
            ];
            const kernelSum = 16;
            
            const blurredData = new Uint8ClampedArray(data);
            
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    let r = 0, g = 0, b = 0;
                    
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const pixelIndex = ((y + ky) * width + (x + kx)) * 4;
                            r += data[pixelIndex] * kernel[ky + 1][kx + 1];
                            g += data[pixelIndex + 1] * kernel[ky + 1][kx + 1];
                            b += data[pixelIndex + 2] * kernel[ky + 1][kx + 1];
                        }
                    }
                    
                    const pixelIndex = (y * width + x) * 4;
                    blurredData[pixelIndex] = r / kernelSum;
                    blurredData[pixelIndex + 1] = g / kernelSum;
                    blurredData[pixelIndex + 2] = b / kernelSum;
                }
            }
            
            return blurredData;
        }
        
        // 边缘增强
        function edgeEnhance(data, width, height) {
            const kernel = [
                [-1, -1, -1],
                [-1, 9, -1],
                [-1, -1, -1]
            ];
            
            const enhancedData = new Uint8ClampedArray(data);
            
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    let r = 0, g = 0, b = 0;
                    
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const pixelIndex = ((y + ky) * width + (x + kx)) * 4;
                            r += data[pixelIndex] * kernel[ky + 1][kx + 1];
                            g += data[pixelIndex + 1] * kernel[ky + 1][kx + 1];
                            b += data[pixelIndex + 2] * kernel[ky + 1][kx + 1];
                        }
                    }
                    
                    const pixelIndex = (y * width + x) * 4;
                    enhancedData[pixelIndex] = Math.min(255, Math.max(0, r));
                    enhancedData[pixelIndex + 1] = Math.min(255, Math.max(0, g));
                    enhancedData[pixelIndex + 2] = Math.min(255, Math.max(0, b));
                }
            }
            
            return enhancedData;
        }
        
        // 自适应阈值二值化
        function adaptiveThreshold(data, width, height) {
            const blockSize = 15;
            const constant = 10;
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let sum = 0;
                    let count = 0;
                    
                    // 计算局部区域的平均值
                    for (let ky = -Math.floor(blockSize/2); ky <= Math.floor(blockSize/2); ky++) {
                        for (let kx = -Math.floor(blockSize/2); kx <= Math.floor(blockSize/2); kx++) {
                            const nx = x + kx;
                            const ny = y + ky;
                            
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const pixelIndex = (ny * width + nx) * 4;
                                const r = data[pixelIndex];
                                const g = data[pixelIndex + 1];
                                const b = data[pixelIndex + 2];
                                sum += (r + g + b) / 3;
                                count++;
                            }
                        }
                    }
                    
                    const mean = sum / count;
                    const threshold = mean - constant;
                    
                    // 二值化处理
                    const pixelIndex = (y * width + x) * 4;
                    const r = data[pixelIndex];
                    const g = data[pixelIndex + 1];
                    const b = data[pixelIndex + 2];
                    const brightness = (r + g + b) / 3;
                    
                    if (brightness < threshold) {
                        // 转换为黑色
                        data[pixelIndex] = 0;
                        data[pixelIndex + 1] = 0;
                        data[pixelIndex + 2] = 0;
                    } else {
                        // 转换为白色
                        data[pixelIndex] = 255;
                        data[pixelIndex + 1] = 255;
                        data[pixelIndex + 2] = 255;
                    }
                }
            }
        }
        
        // 处理扫描结果
        function handleScanResult(result) {
            if (!result) return;
            
            console.log('扫描到的二维码内容:', result);
            
            // 检查是否是本站的扫码登录链接
            const domain = window.location.host;
            console.log('当前域名:', domain);
            
            if (result.includes(domain) && result.includes('scan_login.php')) {
                // 解析URL获取qid
                try {
                    const url = new URL(result);
                    const qid = url.searchParams.get('qid');
                    
                    console.log('解析到的qid:', qid);
                    
                    if (qid) {
                        currentScanUrl = result;
                        currentQid = qid;
                        
                        const deviceType = detectDeviceType();
                        
                        // 扫描后立即更新状态为scanned（使用vkey）
                        updateScanStatus(qid, 'scan', deviceType);
                        
                        // 显示确认登录对话框
                        console.log('显示确认登录对话框');
                        showConfirmModal();
                        
                        // 停止扫描
                        console.log('停止扫描');
                        closeScanModal();
                    } else {
                        console.log('未解析到qid');
                    }
                } catch (error) {
                    console.error('URL解析错误:', error);
                    alert('二维码格式错误，请扫描正确的登录二维码');
                }
            } else {
                console.log('不是本站的扫码登录链接');
                alert('不是本站的扫码登录链接');
            }
        }
        
        // 显示确认登录模态框
        function showConfirmModal() {
            const modal = document.getElementById('confirm-modal');
            const message = document.getElementById('confirm-message');
            const confirmBtn = modal.querySelector('button[onclick="confirmLogin()"]');
            
            // 设置倒计时初始值
            let countdown = 6;
            
            // 禁用确认按钮
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
            confirmBtn.style.cursor = 'not-allowed';
            
            // 显示加载中状态
            message.innerHTML = `确定要在PC网页端登录吗？<br><br>正在获取登录IP地址...<br><br><small>请等待 ${countdown} 秒后点击确认</small>`;
            modal.style.display = 'flex';
            
            // 从服务器获取扫码登录的IP地址
            fetch(`/src/admin/get_scan_ip.php?qid=${currentQid}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('网络请求失败: ' + response.status);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        currentIpAddress = data.ip_address;
                        message.innerHTML = `确定要在PC网页端登录吗？<br><br>登录IP地址: <strong>${currentIpAddress}</strong><br><br><small>请等待 ${countdown} 秒后点击确认</small>`;
                    } else {
                        currentIpAddress = '获取IP失败';
                        message.innerHTML = `确定要在PC网页端登录吗？<br><br>登录IP地址: <strong>${currentIpAddress}</strong><br><br><small>请等待 ${countdown} 秒后点击确认</small>`;
                    }
                })
                .catch(error => {
                    console.error('获取IP地址失败:', error);
                    currentIpAddress = '获取IP失败';
                    message.innerHTML = `确定要在PC网页端登录吗？<br><br>登录IP地址: <strong>${currentIpAddress}</strong><br><br><small>请等待 ${countdown} 秒后点击确认</small>`;
                });
            
            // 倒计时功能
            const countdownInterval = setInterval(() => {
                countdown--;
                message.innerHTML = `确定要在PC网页端登录吗？<br><br>登录IP地址: <strong>${currentIpAddress}</strong><br><br><small>请等待 ${countdown} 秒后点击确认</small>`;
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    // 启用确认按钮
                    confirmBtn.disabled = false;
                    confirmBtn.style.opacity = '1';
                    confirmBtn.style.cursor = 'pointer';
                    message.innerHTML = `确定要在PC网页端登录吗？<br><br>登录IP地址: <strong>${currentIpAddress}</strong>`;
                }
            }, 1000);
        }
        
        // 更新扫码状态（统一使用vkey认证）
        async function updateScanStatus(qid, action, deviceType) {
            try {
                // 先获取当前用户的 vkey
                const vkeyResponse = await fetch('/src/user/vkey_manager.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        'action': 'get'
                    })
                });
                
                const vkeyResult = await vkeyResponse.json();
                if (!vkeyResult.success || !vkeyResult.vkey) {
                    console.error('获取vkey失败:', vkeyResult.message || '未知错误');
                    // 即使获取vkey失败，也继续显示确认登录对话框（用户已经扫描了二维码）
                    if (action === 'scan') {
                        console.log('获取vkey失败，但继续显示确认登录对话框');
                    }
                    return;
                }
                
                const vkey = vkeyResult.vkey;
                
                // 发送状态更新请求
                const response = await fetch('/src/auth/scan_login.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        'qid': qid,
                        'action': action,
                        'vkey': vkey,
                        'source': '/src/chat/mobilechat.php',
                        'app': deviceType
                    })
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    console.error('更新扫描状态失败:', data.message);
                    // 即使更新状态失败，也继续显示确认登录对话框（用户已经扫描了二维码）
                    if (action === 'scan') {
                        console.log('更新扫描状态失败，但继续显示确认登录对话框');
                    }
                } else {
                    console.log('更新扫描状态成功:', action);
                }
            } catch (error) {
                console.error('更新扫描状态失败:', error);
                // 即使更新状态失败，也继续显示确认登录对话框（用户已经扫描了二维码）
                if (action === 'scan') {
                    console.log('更新扫描状态失败，但继续显示确认登录对话框');
                }
            }
        }
        
        // 确认登录
        function confirmLogin() {
            const modal = document.getElementById('confirm-modal');
            modal.style.display = 'none';
            
            // 发送登录请求
            sendLoginRequest();
        }
        
        // 拒绝登录
        function rejectLogin() {
            const modal = document.getElementById('confirm-modal');
            modal.style.display = 'none';
            
            const deviceType = detectDeviceType();
            
            // 发送拒绝登录请求，更新状态为rejected（使用vkey）
            updateScanStatus(currentQid, 'reject', deviceType);
        }
        
        // 检测设备类型
        function detectDeviceType() {
            const userAgent = navigator.userAgent.toLowerCase();
            
            if (userAgent.includes('android')) {
                return 'Android';
            } else if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ios')) {
                return 'IOS';
            } else if (userAgent.includes('harmonyos') || userAgent.includes('huawei')) {
                return 'HarmonyOS';
            } else {
                return 'Unknown';
            }
        }
        
        // 发送登录请求
        async function sendLoginRequest() {
            try {
                const deviceType = detectDeviceType();
                
                // 先获取当前用户的 vkey
                const vkeyResponse = await fetch('/src/user/vkey_manager.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        'action': 'get'
                    })
                });
                
                const vkeyResult = await vkeyResponse.json();
                if (!vkeyResult.success || !vkeyResult.vkey) {
                    alert('获取密钥失败，请重试');
                    return;
                }
                
                const vkey = vkeyResult.vkey;
                
                const response = await fetch('/src/auth/scan_login.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        'qid': currentQid,
                        'vkey': vkey,
                        'source': '/src/chat/mobilechat.php',
                        'app': deviceType
                    })
                });
                
                // 检查响应状态
                if (!response.ok) {
                    throw new Error('网络请求失败: ' + response.status);
                }
                
                const result = await response.json();
                
                if (result.success) {
                    // 创建设备会话
                    createDeviceSession(result.user);
                    
                    // 显示登录成功提示
                    showSuccessModal();
                } else {
                    alert(result.message || '登录失败');
                }
            } catch (error) {
                console.error('发送登录请求失败:', error);
                // 检查是否已经成功登录
                // 如果用户已经在页面上，说明登录可能已经成功，只是网络请求有问题
                if (document.getElementById('menu-panel')) {
                    // 用户已经在聊天页面，可能登录成功了
                    console.log('用户已在聊天页面，可能登录成功');
                    // 不显示错误消息，而是显示成功提示
                    showSuccessModal();
                } else {
                    // 用户不在聊天页面，显示错误消息
                    alert('登录失败，请稍后重试');
                }
            }
        }
        
        // 创建设备会话
        async function createDeviceSession(user) {
            if (!user || !user.id) {
                console.log('创建设备会话失败: 用户信息无效');
                return;
            }
            
            try {
                const response = await fetch('/src/api/api-pc.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        resource: 'device_session',
                        action: 'create',
                        data: {
                            user_id: user.id,
                            device_type: 'Web',
                            device_name: 'Web Browser'
                        }
                    })
                });
                
                const result = await response.json();
                if (result.success && result.data && result.data.session_token) {
                    // 保存会话token
                    localStorage.setItem('session_token', result.data.session_token);
                    console.log('网页端设备会话创建成功:', result.data.session_token);
                    
                    // 启动会话定时检查
                    startSessionCheck();
                } else {
                    console.log('创建设备会话失败:', result.message || '未知错误');
                }
            } catch (e) {
                console.log('创建设备会话失败:', e);
            }
        }
        
        // 会话检查定时器
        let sessionCheckTimer = null;
        
        // 启动会话定时检查
        function startSessionCheck() {
            stopSessionCheck();
            sessionCheckTimer = setInterval(verifySession, 30000); // 每30秒检查一次
        }
        
        // 停止会话检查
        function stopSessionCheck() {
            if (sessionCheckTimer) {
                clearInterval(sessionCheckTimer);
                sessionCheckTimer = null;
            }
        }
        
        // 验证会话
        async function verifySession() {
            const sessionToken = localStorage.getItem('session_token');
            if (!sessionToken) return;
            
            try {
                const response = await fetch('/src/api/api-pc.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        resource: 'device_session',
                        action: 'verify',
                        data: {
                            session_token: sessionToken
                        }
                    })
                });
                
                const result = await response.json();
                if (!result.success) {
                    // 会话无效，退出登录
                    logout(result.message || '会话已失效');
                }
            } catch (e) {
                console.log('会话验证失败:', e);
            }
        }
        
        // 退出登录
        function logout(reason) {
            localStorage.removeItem('session_token');
            localStorage.removeItem('login_user');
            localStorage.removeItem('access_key');
            
            // 保存退出原因
            if (reason) {
                localStorage.setItem('logout_reason', reason);
            }
            
            // 刷新页面回到登录状态
            window.location.reload();
        }
        
        // 关闭成功提示
        function closeSuccessModal() {
            const modal = document.getElementById('success-modal');
            modal.style.display = 'none';
        }
        
        // 加载jsQR库
        function loadJsQR() {
            if (typeof jsQR !== 'undefined') {
                return Promise.resolve();
            }
            
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = './js/jsQR.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        // 页面加载完成后加载jsQR库并初始化@功能
        document.addEventListener('DOMContentLoaded', () => {
            loadJsQR().catch(error => {
                console.error('加载jsQR库失败:', error);
            });
            
            // 初始化@提及功能
            initMentionFeature();
        });
        // 检查群聊是否被封禁
        let isGroupBanned = false;
        
        // @提及功能相关变量
        let mentionListVisible = false;
        let currentMentions = [];
        let selectedMentionIndex = -1;
        let groupMembers = [];
        
        // 获取群聊成员列表
        async function getGroupMembers(groupId) {
            try {
                const response = await fetch(`/src/groups/get_group_members.php?group_id=${groupId}`);
                const data = await response.json();
                if (data.success) {
                    return data.members;
                }
                return [];
            } catch (error) {
                console.error('获取群成员失败:', error);
                return [];
            }
        }
        
        // 初始化群聊成员
        async function initGroupMembers() {
            const chatType = MOBILE_CHAT_CONFIG.chatType;
            const groupId = MOBILE_CHAT_CONFIG.selectedId;
            
            if (chatType === 'group') {
                groupMembers = await getGroupMembers(groupId);
            }
        }
        
        // 初始化@提及功能
        function initMentionFeature() {
            const input = document.getElementById('message-input');
            const mentionList = document.getElementById('mention-list');
            
            if (!input || !mentionList) return;
            
            // 初始化群成员
            initGroupMembers();
            
            // 输入事件监听
            input.addEventListener('input', handleMentionInput);
            
            // 按键事件监听
            input.addEventListener('keydown', handleMentionKeydown);
            
            // 点击外部关闭提及列表
            document.addEventListener('click', (e) => {
                if (!input.contains(e.target) && !mentionList.contains(e.target)) {
                    hideMentionList();
                }
            });
        }
        
        // 处理输入事件，检测@符号
        function handleMentionInput(e) {
            const input = e.target;
            const cursorPos = input.selectionStart;
            const text = input.value;
            
            // 查找@符号的位置
            const atIndex = text.lastIndexOf('@', cursorPos - 1);
            
            // 检查@符号是否在有效位置
            if (atIndex !== -1) {
                // 检查@符号后是否有空格或其他分隔符
                const nextChar = text.charAt(atIndex + 1);
                if (!nextChar || nextChar.match(/\s|$/) || nextChar === '@') {
                    // 显示提及列表
                    showMentionList(input, atIndex + 1);
                }
            } else {
                // 没有@符号，隐藏提及列表
                hideMentionList();
            }
        }
        
        // 显示提及列表
        function showMentionList(input, startIndex) {
            const mentionList = document.getElementById('mention-list');
            const chatType = MOBILE_CHAT_CONFIG.chatType;
            
            // 只有群聊才显示提及列表
            if (chatType !== 'group') {
                hideMentionList();
                return;
            }
            
            // 准备成员数据，添加"全体成员"作为第一个选项
            const mentionOptions = [
                { id: 'all', username: '全体成员', is_all: true }
            ];
            
            // 添加群成员
            groupMembers.forEach(member => {
                mentionOptions.push({
                    id: member.id,
                    username: member.username,
                    nickname: member.nickname || '',
                    avatar: member.avatar
                });
            });
            
            // 渲染提及列表
            mentionList.innerHTML = mentionOptions.map((member, index) => {
                const isAll = member.is_all;
                return `
                    <div class="mention-item" data-id="${member.id}" data-username="${member.username}" data-is-all="${isAll}">
                        <div class="mention-avatar">
                            ${isAll ? '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>' : member.avatar ? `<img src="${member.avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : member.username.charAt(0).toUpperCase()}
                        </div>
                        <div class="mention-info">
                            <div class="mention-username ${isAll ? 'mention-all' : ''}">${member.username}</div>
                            ${member.nickname ? `<div class="mention-nickname">${member.nickname}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
            // 显示列表
            mentionList.style.display = 'block';
            mentionListVisible = true;
            selectedMentionIndex = -1;
            
            // 添加点击事件
            mentionList.querySelectorAll('.mention-item').forEach(item => {
                item.addEventListener('click', () => {
                    selectMention(item, input, startIndex);
                });
            });
        }
        
        // 隐藏提及列表
        function hideMentionList() {
            const mentionList = document.getElementById('mention-list');
            mentionList.style.display = 'none';
            mentionListVisible = false;
            selectedMentionIndex = -1;
        }
        
        // 处理按键事件
        function handleMentionKeydown(e) {
            const mentionList = document.getElementById('mention-list');
            const items = mentionList.querySelectorAll('.mention-item');
            
            if (!mentionListVisible) return;
            
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    selectedMentionIndex = Math.max(0, selectedMentionIndex - 1);
                    updateSelectedMention(items);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    selectedMentionIndex = Math.min(items.length - 1, selectedMentionIndex + 1);
                    updateSelectedMention(items);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selectedMentionIndex >= 0 && selectedMentionIndex < items.length) {
                        const input = document.getElementById('message-input');
                        const cursorPos = input.selectionStart;
                        const atIndex = input.value.lastIndexOf('@', cursorPos - 1);
                        selectMention(items[selectedMentionIndex], input, atIndex + 1);
                    }
                    break;
                case 'Escape':
                    hideMentionList();
                    break;
            }
        }
        
        // 更新选中的提及项
        function updateSelectedMention(items) {
            items.forEach((item, index) => {
                if (index === selectedMentionIndex) {
                    item.classList.add('active');
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.classList.remove('active');
                }
            });
        }
        
        // 选择提及项
        function selectMention(item, input, startIndex) {
            const username = item.dataset.username;
            const isAll = item.dataset.isAll === 'true';
            const mentionText = isAll ? `@全体成员 ` : `@${username} `;
            
            const value = input.value;
            const cursorPos = input.selectionStart;
            
            // 替换@符号及其后的内容为选中的用户名
            const newValue = value.substring(0, startIndex - 1) + mentionText + value.substring(cursorPos);
            input.value = newValue;
            
            // 设置光标位置
            const newCursorPos = startIndex - 1 + mentionText.length;
            input.setSelectionRange(newCursorPos, newCursorPos);
            input.focus();
            
            // 隐藏提及列表
            hideMentionList();
        }
        
        // 切换聊天时重新初始化群成员并重置@提及标记
        function switchChat(chatType, chatId) {
            if (chatType === 'group') {
                initGroupMembers();
                
                // 重置@提及标记
                fetch(`/src/chat/reset_mention.php?chat_type=group&chat_id=${chatId}`)
                    .catch(error => {
                        console.error('重置@提及标记失败:', error);
                    });
            }
        }
        
        // 启用所有群聊操作
        function enableGroupOperations() {
            const inputArea = document.querySelector('.input-area');
            if (inputArea) {
                inputArea.style.display = 'block';
            }
        }
        
        function checkGroupBanStatus(groupId) {
            return fetch(`/src/groups/check_group_ban.php?group_id=${groupId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.banned) {
                        isGroupBanned = true;
                        showGroupBanModal(data.group_name, data.reason, data.ban_end);
                        disableGroupOperations();
                    } else {
                        isGroupBanned = false;
                        enableGroupOperations();
                    }
                    return data.banned;
                })
                .catch(error => {
                    console.error('检查群聊封禁状态失败:', error);
                    // 出错时默认启用群聊操作
                    enableGroupOperations();
                    return false;
                });
        }
        
        // 显示群聊封禁弹窗
        function showGroupBanModal(groupName, reason, banEnd) {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: white;
                padding: 30px;
                border-radius: 12px;
                width: 90%;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            `;
            
            modalContent.innerHTML = `
                <div style="font-size: 64px; margin-bottom: 20px; color: #ff4757;">🚫</div>
                <h3 style="margin-bottom: 15px; color: #333; font-size: 18px;">群聊已被封禁</h3>
                <div style="margin-bottom: 25px; color: #666; font-size: 14px;">
                    <p>此群 <strong>${groupName}</strong> 已被封禁</p>
                    <p style="margin: 10px 0;">原因：${reason}</p>
                    <p>预计解封时长：${banEnd ? new Date(banEnd).toLocaleString() : '永久'}</p>
                    <p style="color: #ff4757; margin-top: 15px;">群聊被封禁期间，无法使用任何群聊功能</p>
                </div>
                <button onclick="document.body.removeChild(modal); window.location.href='/src/chat/chat.php'" style="
                    padding: 12px 30px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 14px;
                    transition: background-color 0.2s;
                ">确定</button>
            `;
            
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
        }
        
        // 禁用所有群聊操作
        function disableGroupOperations() {
            const inputArea = document.querySelector('.input-area');
            if (inputArea) {
                inputArea.style.display = 'none';
            }
        }
        
        // 显示聊天列表（主界面）
        function showChatList() {
            window.location.href = '/src/chat/mobilechat.php';
        }
        
        // 聊天类型切换
        document.querySelectorAll('.chat-type-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const chatType = this.dataset.chatType;
                
                // 更新标签状态
                document.querySelectorAll('.chat-type-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // 切换聊天列表
                document.getElementById('friends-list').style.display = chatType === 'friend' ? 'block' : 'none';
                document.getElementById('groups-list').style.display = chatType === 'group' ? 'block' : 'none';
                
                // 重新加载页面
                window.location.href = `/src/chat/mobilechat.php?chat_type=${chatType}`;
            });
        });
        
        // 等待DOM加载完成后绑定事件
        document.addEventListener('DOMContentLoaded', function() {
            // 聊天列表点击事件
            document.querySelectorAll('.chat-item[data-friend-id], .chat-item[data-group-id]').forEach(item => {
                item.addEventListener('click', function(e) {
                    // 如果点击的是菜单按钮或菜单选项，不触发聊天切换
                    if (e.target.closest('.chat-item-menu-btn') || e.target.closest('.friend-menu-item')) {
                        return;
                    }
                    
                    if (this.dataset.friendId) {
                        const friendId = this.dataset.friendId;
                        window.location.href = `/src/chat/mobilechat.php?chat_type=friend&id=${friendId}`;
                    } else if (this.dataset.groupId) {
                        const groupId = this.dataset.groupId;
                        window.location.href = `/src/chat/mobilechat.php?chat_type=group&id=${groupId}`;
                    }
                });
            });
            
            // 为好友菜单选项添加点击事件冒泡阻止
            document.addEventListener('click', function(e) {
                if (e.target.classList.contains('friend-menu-item')) {
                    e.stopPropagation();
                }
            });
        });
        
        // 好友菜单功能
        function toggleFriendMenu(event, friendId, friendName) {
            event.stopPropagation();
            
            // 关闭所有其他菜单，并重置所有chat-item的z-index
            document.querySelectorAll('.friend-menu').forEach(menu => {
                menu.style.display = 'none';
            });
            document.querySelectorAll('.chat-item').forEach(item => {
                item.style.zIndex = '';
            });
            
            // 切换当前菜单
            const menu = document.getElementById(`friend-menu-${friendId}`);
            if (menu) {
                const isOpening = menu.style.display !== 'block';
                menu.style.display = isOpening ? 'block' : 'none';
                
                // 如果是打开菜单，提高当前项的z-index
                if (isOpening) {
                    const chatItem = menu.closest('.chat-item');
                    if (chatItem) {
                        chatItem.style.zIndex = '1000';
                    }
                }
            }
        }
        
        // 群聊菜单功能
        function toggleGroupMenu(event, groupId, groupName) {
            event.stopPropagation();
            
            // 关闭所有其他菜单，并重置所有chat-item的z-index
            document.querySelectorAll('.friend-menu').forEach(menu => {
                menu.style.display = 'none';
            });
            document.querySelectorAll('.chat-item').forEach(item => {
                item.style.zIndex = '';
            });
            
            // 切换当前菜单
            const menu = document.getElementById(`group-menu-${groupId}`);
            if (menu) {
                const isOpening = menu.style.display !== 'block';
                menu.style.display = isOpening ? 'block' : 'none';
                
                // 如果是打开菜单，提高当前项的z-index
                if (isOpening) {
                    const chatItem = menu.closest('.chat-item');
                    if (chatItem) {
                        chatItem.style.zIndex = '1000';
                    }
                }
            }
        }
        
        // 删除好友功能
        function deleteFriend(friendId, friendName) {
            // 创建更美观的确认对话框
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Microsoft YaHei', Tahoma, Geneva, Verdana, sans-serif;
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: var(--modal-bg);
                color: var(--text-color);
                border-radius: 8px;
                padding: 25px;
                width: 90%;
                max-width: 400px;
                box-shadow: 0 4px 20px var(--shadow-color);
            `;
            
            // 标题
            const title = document.createElement('h3');
            title.style.cssText = `
                margin-bottom: 20px;
                color: var(--text-color);
                font-size: 18px;
                font-weight: 600;
                text-align: center;
            `;
            title.textContent = '删除好友';
            
            // 内容
            const content = document.createElement('div');
            content.style.cssText = `
                margin-bottom: 25px;
                color: var(--text-secondary);
                font-size: 14px;
                text-align: center;
                line-height: 1.6;
            `;
            content.innerHTML = `
                <p>确定要删除好友 <strong>${friendName}</strong> 吗？</p>
                <p style="margin-top: 15px; color: var(--text-desc); font-size: 12px;">删除后将无法恢复，请谨慎操作</p>
            `;
            
            // 按钮容器
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 15px;
                justify-content: center;
            `;
            
            // 取消按钮
            const cancelBtn = document.createElement('button');
            cancelBtn.style.cssText = `
                flex: 1;
                padding: 12px;
                background: var(--bg-color);
                color: var(--text-color);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
            `;
            cancelBtn.textContent = '取消';
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            // 确定删除按钮
            const confirmBtn = document.createElement('button');
            confirmBtn.style.cssText = `
                flex: 1;
                padding: 12px;
                background: #ff4757;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                z-index: 99999;
                position: relative;
            `;
            confirmBtn.textContent = '确定删除';
            confirmBtn.addEventListener('click', () => {
                // 发送删除好友请求
                fetch(`/src/friends/delete_friend.php?friend_id=${friendId}`, {
                    method: 'POST',
                    credentials: 'include'
                })
                .then(response => response.json())
                .then(data => {
                    document.body.removeChild(modal);
                    
                    if (data.success) {
                        // 使用局部刷新而不是整个页面刷新
                        showNotification('好友删除成功', 'success');
                        
                        // 移除好友列表项
                        const friendItem = document.querySelector(`[data-friend-id="${friendId}"]`);
                        if (friendItem) {
                            friendItem.remove();
                        }
                        
                        // 如果当前正在与该好友聊天，切换到第一个好友或显示提示
                        if (window.location.search.includes(`id=${friendId}`) && window.location.search.includes('chat_type=friend')) {
                            // 获取第一个好友项
                            const firstFriendItem = document.querySelector('[data-friend-id]:not([data-friend-id="${friendId}"])');
                            if (firstFriendItem) {
                                const firstFriendId = firstFriendItem.getAttribute('data-friend-id');
                                window.location.href = `?chat_type=friend&id=${firstFriendId}`;
                            } else {
                                // 没有其他好友，显示提示
                                window.location.href = '?';
                            }
                        }
                    } else {
                        showNotification('删除好友失败：' + data.message, 'error');
                    }
                })
                .catch(error => {
                    document.body.removeChild(modal);
                    console.error('删除好友失败:', error);
                    showNotification('删除好友失败，请稍后重试', 'error');
                });
            });
            
            // 组装弹窗
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(confirmBtn);
            modalContent.appendChild(title);
            modalContent.appendChild(content);
            modalContent.appendChild(buttonContainer);
            modal.appendChild(modalContent);
            
            // 添加到页面
            document.body.appendChild(modal);
        }
        
        // 显示通知函数
        function showNotification(message, type = 'success') {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#4caf50' : '#ff4757'};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10001;
                font-family: 'Microsoft YaHei', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 14px;
                transition: all 0.3s ease;
            `;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            // 3秒后自动消失
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 300);
            }, 3000);
        }
        
        // 显示警告信息
        function showWarning(message) {
            const warningContainer = document.getElementById('warning-container');
            const warningElement = document.createElement('div');
            warningElement.style.cssText = `
                background: #ff4d4f;
                color: white;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 10px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                animation: slideIn 0.3s ease-out;
                font-size: 14px;
                line-height: 1.4;
            `;
            warningElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>${message}</div>
                    <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 16px; cursor: pointer; margin-left: 10px;">×</button>
                </div>
            `;
            warningContainer.appendChild(warningElement);
            
            // 5秒后自动消失
            setTimeout(() => {
                warningElement.style.animation = 'slideOut 0.3s ease-in forwards';
                setTimeout(() => {
                    warningElement.remove();
                }, 300);
            }, 5000);
        }
        
        // 点击页面其他地方关闭菜单
        document.addEventListener('click', function() {
            document.querySelectorAll('.friend-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        });
        
        // 设置弹窗功能
        function openSettingsModal() {
            // 加载设置
            loadSettings();
            // 显示设置弹窗
            document.getElementById('settings-modal').style.display = 'flex';
        }
        
        function closeSettingsModal() {
            // 保存设置
            saveSettings();
            // 关闭设置弹窗
            document.getElementById('settings-modal').style.display = 'none';
        }
        
        // 退出登录函数
        function logout() {
            if (confirm('确定要退出登录吗？')) {
                // 发送退出登录请求到服务器
                fetch('/src/auth/logout.php', {
                    method: 'POST',
                    credentials: 'include'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // 只清除设置数据，不清除文件数据
                        localStorage.removeItem('setting-link-popup');
                        // 重定向到登录页面
                        window.location.href = '/src/auth/login.php';
                    } else {
                        // 退出失败，显示错误信息
                        showNotification(data.message || '退出登录失败', 'error');
                    }
                })
                .catch(error => {
                    console.error('退出登录请求失败:', error);
                    // 即使请求失败，也尝试直接跳转
                    localStorage.removeItem('setting-link-popup');
                    window.location.href = '/src/auth/login.php';
                });
            }
        }
        
        // 加载设置
        async function loadSettings() {
            try {
                // 检查indexedDBManager是否存在
                if (typeof indexedDBManager === 'undefined' || !indexedDBManager.getSettings) {
                    throw new Error('IndexedDB manager not available');
                }

                // 从IndexedDB加载设置
                const settings = await indexedDBManager.getSettings();
                const linkPopup = settings['setting-link-popup'] !== false;
                const audio3d = settings['setting-3d-audio'] === true;

                
                // 设置开关状态
                const linkPopupEl = document.getElementById('setting-link-popup');
                if (linkPopupEl) linkPopupEl.checked = linkPopup;
                
                const audio3dEl = document.getElementById('setting-3d-audio');
                if (audio3dEl) audio3dEl.checked = audio3d;

            } catch (error) {
                console.error('加载设置失败:', error);
                // 从localStorage迁移设置到IndexedDB
                const linkPopup = localStorage.getItem('setting-link-popup') === 'false' ? false : true;
                const audio3d = localStorage.getItem('setting-3d-audio') === 'true' ? true : false;

                
                // 设置开关状态
                const linkPopupEl = document.getElementById('setting-link-popup');
                if (linkPopupEl) linkPopupEl.checked = linkPopup;
                
                const audio3dEl = document.getElementById('setting-3d-audio');
                if (audio3dEl) audio3dEl.checked = audio3d;

                
                // 保存到IndexedDB
                if (typeof saveSettings === 'function') {
                    await saveSettings();
                }
            }
        }
        
        // 保存设置
        async function saveSettings() {
            try {
                // 获取开关状态
                const linkPopup = document.getElementById('setting-link-popup').checked;
                const audio3d = document.getElementById('setting-3d-audio').checked;
                
                // 保存到IndexedDB
                await indexedDBManager.saveSettings({
                    'setting-link-popup': linkPopup,
                    'setting-3d-audio': audio3d
                });
                
                // 应用设置
                applySettings();
            } catch (error) {
                console.error('保存设置失败:', error);
                // 降级到localStorage
                const linkPopup = document.getElementById('setting-link-popup').checked;
                const audio3d = document.getElementById('setting-3d-audio').checked;
                localStorage.setItem('setting-link-popup', linkPopup);
                localStorage.setItem('setting-3d-audio', audio3d);

            }
        }
        
        // 清除文件缓存
        function clearFileCache() {
            if (confirm('确定要清除所有文件缓存吗？此操作不可恢复。')) {
                try {
                    // 获取文件索引
                    const fileIndex = JSON.parse(localStorage.getItem('fileIndex') || '[]');
                    
                    // 清除所有文件数据
                    fileIndex.forEach(fileId => {
                        localStorage.removeItem(fileId);
                    });
                    
                    // 清除文件索引
                    localStorage.removeItem('fileIndex');
                    
                    // 显示清除成功通知
                    showNotification('文件缓存已成功清除', 'success');
                } catch (error) {
                    console.error('清除文件缓存失败:', error);
                    showNotification('清除文件缓存失败，请稍后重试', 'error');
                }
            }
        }
        
        // 应用设置
        function applySettings() {
            // 这里可以添加应用设置的逻辑
            const linkPopup = localStorage.getItem('setting-link-popup') === 'true';
            const audio3d = localStorage.getItem('setting-3d-audio') === 'true';
            
            console.log('应用设置:', {
                linkPopup,
                audio3d
            });
            
            // 应用3D环绕音效设置
            if (typeof window.apply3DAudioSettings === 'function') {
                window.apply3DAudioSettings(audio3d);
            }
        }
        
        // 显示缓存查看器
        function showCacheViewer() {
            const modal = document.getElementById('cache-viewer-modal');
            modal.style.display = 'flex';
            
            // 加载缓存统计信息
            loadCacheStats();
        }
        
        // 关闭缓存查看器
        function closeCacheViewer() {
            const modal = document.getElementById('cache-viewer-modal');
            modal.style.display = 'none';
        }
        
        // 加载缓存统计信息
        async function loadCacheStats() {
            const statsContainer = document.getElementById('cache-stats');
            if (!statsContainer) return;
            
            // 解析缓存信息
            const cacheInfo = await parseCacheCookies();
            
            // 生成统计HTML
            let statsHtml = `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
                    <div style="background: #f0f8ff; padding: 6px 10px; border-radius: 4px; border-left: 2px solid #12b7f5; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #12b7f5; font-weight: 600;">音频</span>
                            <span style="font-weight: 600;">${cacheInfo.audio.count}</span>
                        </div>
                        <div style="font-size: 10px; color: #666; margin-top: 2px;">${formatFileSize(cacheInfo.audio.size)}</div>
                    </div>
                    
                    <div style="background: #f0fff4; padding: 6px 10px; border-radius: 4px; border-left: 2px solid #52c41a; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #52c41a; font-weight: 600;">视频</span>
                            <span style="font-weight: 600;">${cacheInfo.video.count}</span>
                        </div>
                        <div style="font-size: 10px; color: #666; margin-top: 2px;">${formatFileSize(cacheInfo.video.size)}</div>
                    </div>
                    
                    <div style="background: #fffbe6; padding: 6px 10px; border-radius: 4px; border-left: 2px solid #faad14; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #faad14; font-weight: 600;">图片</span>
                            <span style="font-weight: 600;">${cacheInfo.image.count}</span>
                        </div>
                        <div style="font-size: 10px; color: #666; margin-top: 2px;">${formatFileSize(cacheInfo.image.size)}</div>
                    </div>
                    
                    <div style="background: #fff2f0; padding: 6px 10px; border-radius: 4px; border-left: 2px solid #ff4d4f; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #ff4d4f; font-weight: 600;">其他</span>
                            <span style="font-weight: 600;">${cacheInfo.file.count}</span>
                        </div>
                        <div style="font-size: 10px; color: #666; margin-top: 2px;">${formatFileSize(cacheInfo.file.size)}</div>
                    </div>
                </div>
                <div style="margin-top: 8px; padding: 8px; background: #fafafa; border-radius: 4px; text-align: center; font-size: 13px;">
                    <div style="display: flex; justify-content: center; align-items: center; gap: 8px;">
                        <span style="font-weight: 600; color: #333;">总计: ${cacheInfo.total.count}</span>
                        <span style="font-size: 11px; color: #666;">${formatFileSize(cacheInfo.total.size)}</span>
                    </div>
                </div>
            `;
            
            statsContainer.innerHTML = statsHtml;
        }
        
        // 解析缓存信息（同时考虑localStorage和cookie）
        async function parseCacheCookies() {
            const cacheInfo = {
                audio: { count: 0, size: 0 },
                video: { count: 0, size: 0 },
                image: { count: 0, size: 0 },
                file: { count: 0, size: 0 },
                total: { count: 0, size: 0 }
            };
            
            try {
                // 只使用IndexedDBManager获取缓存统计信息，不再处理localStorage和cookie中的旧数据
                // 这样可以避免重复计算和统计错误
                const stats = await indexedDBManager.getCacheStats();
                
                // 更新缓存统计信息
                cacheInfo.audio.count = stats.byType.audio;
                cacheInfo.video.count = stats.byType.video;
                cacheInfo.image.count = stats.byType.image;
                cacheInfo.file.count = stats.byType.file;
                cacheInfo.total.count = stats.totalFiles;
                cacheInfo.total.size = stats.totalSize;
                
                // 更新每种类型的大小
                cacheInfo.audio.size = stats.byTypeSize?.audio || 0;
                cacheInfo.video.size = stats.byTypeSize?.video || 0;
                cacheInfo.image.size = stats.byTypeSize?.image || 0;
                cacheInfo.file.size = stats.byTypeSize?.file || 0;
            } catch (error) {
                console.error('获取缓存统计失败:', error);
            }
            
            return cacheInfo;
        }
        
        // 格式化文件大小
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        // 显示清空缓存确认弹窗
        async function showClearCacheConfirm() {
            const modal = document.getElementById('clear-cache-confirm-modal');
            const cacheSizeElement = document.getElementById('clear-cache-size');
            
            // 获取缓存总大小
            const cacheInfo = await parseCacheCookies();
            cacheSizeElement.textContent = formatFileSize(cacheInfo.total.size);
            
            modal.style.display = 'flex';
        }
        
        // 关闭清空缓存确认弹窗
        function closeClearCacheConfirm() {
            const modal = document.getElementById('clear-cache-confirm-modal');
            modal.style.display = 'none';
        }
        
        // 清空缓存
        async function clearCache() {
            // 1. 使用IndexedDBManager清除所有缓存
            try {
                await indexedDBManager.clearAllCache();
            } catch (e) {
                console.error('清除缓存失败:', e);
            }
            
            // 2. 清除所有缓存相关的cookie
            const cookies = document.cookie.split(';');
            
            cookies.forEach(cookie => {
                const cookieTrimmed = cookie.trim();
                // 检查是否是缓存相关的cookie（支持多种前缀）
                if (cookieTrimmed.startsWith('file_') || 
                    cookieTrimmed.startsWith('video_') || 
                    cookieTrimmed.startsWith('audio_') || 
                    cookieTrimmed.startsWith('Picture_') ||
                    cookieTrimmed.startsWith('Video_') ||
                    cookieTrimmed.startsWith('Audio_')) {
                    // 这是一个缓存文件的cookie，删除它
                    const cookieName = cookieTrimmed.split('=')[0];
                    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                }
            });
            
            // 关闭确认弹窗
            closeClearCacheConfirm();
            
            // 关闭缓存查看器
            closeCacheViewer();
            
            // 显示成功消息
            showNotification('缓存已清空', 'success');
        }
        
        // 初始化设置
        applySettings();
        
        // 文件上传和消息发送功能 - 只在聊天界面可用
        function initChatInput() {
            const fileInputBtn = document.getElementById('file-input-btn');
            const fileInput = document.getElementById('file-input');
            const sendBtn = document.getElementById('send-btn');
            const messageInput = document.getElementById('message-input');
            
            // 文件上传按钮
            if (fileInputBtn) {
                fileInputBtn.addEventListener('click', function() {
                    if (fileInput) {
                        fileInput.click();
                    } else {
                        console.error('File input element not found');
                    }
                });
            }
            
            // 文件选择事件处理
            if (fileInput) {
                fileInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        sendFile(file);
                    }
                });
            }
            
            // 发送按钮点击事件
            if (sendBtn) {
                sendBtn.addEventListener('click', sendMessage);
            }
            
            // 回车键发送消息
            if (messageInput) {
                messageInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });
                
                // 粘贴图片/截图支持
                messageInput.addEventListener('paste', function(e) {
                    const clipboardItems = e.clipboardData && e.clipboardData.items;
                    if (!clipboardItems) return;
                    
                    for (const item of clipboardItems) {
                        if (item.type.indexOf('image/') === 0) {
                            e.preventDefault();
                            const blob = item.getAsFile();
                            const screenshotFile = new File([blob], 'paste_' + Date.now() + '.png', { type: blob.type });
                            
                            // 通过 file-input 统一发送
                            if (fileInput) {
                                const dt = new DataTransfer();
                                dt.items.add(screenshotFile);
                                fileInput.files = dt.files;
                                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            return;
                        }
                    }
                });
            }
        }
        
        // 注意：initChatInput() 在 DOMContentLoaded 中调用，确保 DOM 就绪后注册事件
        
        // 链接检测函数
        function isLink(url) {
            const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
            return urlRegex.test(url);
        }
        
        // 创建链接弹窗（使用iframe）
        function createLinkPopup(url) {
            // 创建弹窗容器
            const popup = document.createElement('div');
            popup.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            `;
            
            // 创建弹窗内容
            const popupContent = document.createElement('div');
            popupContent.style.cssText = `
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 1000px;
                height: 80%;
                max-height: 800px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                resize: both;
                min-width: 300px;
                min-height: 200px;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                cursor: move;
            `;
            
            // 创建弹窗头部
            const popupHeader = document.createElement('div');
            popupHeader.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                cursor: move;
                user-select: none;
            `;
            
            // 实现弹窗拖拽功能
            let isDragging = false;
            let startX, startY, startLeft, startTop;
            
            // 鼠标按下事件
            popupHeader.onmousedown = function(e) {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                
                // 获取当前弹窗位置
                const rect = popupContent.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                
                // 添加鼠标移动和释放事件监听
                document.addEventListener('mousemove', drag);
                document.addEventListener('mouseup', stopDrag);
                
                // 防止选中文本
                e.preventDefault();
            };
            
            // 拖拽事件处理函数
            function drag(e) {
                if (!isDragging) return;
                
                // 计算移动距离
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                // 设置新位置
                popupContent.style.left = (startLeft + dx) + 'px';
                popupContent.style.top = (startTop + dy) + 'px';
                
                // 移除transform，因为我们现在使用left和top定位
                popupContent.style.transform = 'none';
            }
            
            // 停止拖拽事件
            function stopDrag() {
                isDragging = false;
                // 移除事件监听
                document.removeEventListener('mousemove', drag);
                document.removeEventListener('mouseup', stopDrag);
            }
            
            const popupTitle = document.createElement('h3');
            popupTitle.style.cssText = `
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            `;
            popupTitle.textContent = url;
            
            const closeBtn = document.createElement('button');
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.2s ease;
                cursor: pointer;
            `;
            closeBtn.innerHTML = '×';
            closeBtn.onclick = () => {
                document.body.removeChild(popup);
            };
            
            closeBtn.onmouseover = () => {
                closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            };
            
            closeBtn.onmouseout = () => {
                closeBtn.style.background = 'none';
            };
            
            popupHeader.appendChild(popupTitle);
            popupHeader.appendChild(closeBtn);
            
            // 创建iframe（不设置sandbox属性，允许携带cookie）
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.style.cssText = `
                flex: 1;
                border: none;
                width: 100%;
                height: calc(100% - 48px); /* 减去头部高度 */
                min-height: 0;
                cursor: default;
            `;
            
            // 组装弹窗
            popupContent.appendChild(popupHeader);
            popupContent.appendChild(iframe);
            popup.appendChild(popupContent);
            
            // 添加到页面
            document.body.appendChild(popup);
            
            return true;
        }
        
        // 显示反馈模态框
        function showFeedbackModal() {
            document.getElementById('feedback-modal').style.display = 'flex';
        }
        
        // 关闭反馈模态框
        function closeFeedbackModal() {
            document.getElementById('feedback-modal').style.display = 'none';
            // 重置表单
            document.getElementById('feedback-form').reset();
        }
        
        // 处理反馈表单提交
        document.getElementById('feedback-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            formData.append('action', 'submit_feedback');
            
            try {
                const response = await fetch('/src/admin/feedback-2.php', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('反馈提交成功，感谢您的反馈！');
                    closeFeedbackModal();
                } else {
                    alert(result.message || '提交失败，请稍后重试');
                }
            } catch (error) {
                console.error('提交反馈错误:', error);
                alert('网络错误，请稍后重试');
            }
        });
        
        // 处理链接点击事件
        function handleLinkClick(link) {
            // 检查设置是否开启了使用弹窗显示链接
            const linkPopup = localStorage.getItem('setting-link-popup') === 'false' ? false : true;
            
            if (linkPopup) {
                // 开启了弹窗显示链接，使用iframe弹窗
                createLinkPopup(link);
            } else {
                // 未开启弹窗显示链接，显示安全警告
                showSecurityWarning(link);
            }
        }
        
        // 切换消息操作菜单显示/隐藏
        function toggleMessageActions(button) {
            const actionMenu = button.nextElementSibling;
            // 关闭所有其他打开的菜单
            document.querySelectorAll('.message-action-menu').forEach(menu => {
                if (menu !== actionMenu) {
                    menu.style.display = 'none';
                }
            });
            // 切换当前菜单
            actionMenu.style.display = actionMenu.style.display === 'block' ? 'none' : 'block';
        }
        
        // 点击其他区域关闭消息操作菜单
        document.addEventListener('click', function(event) {
            if (!event.target.closest('.message-actions')) {
                document.querySelectorAll('.message-action-menu').forEach(menu => {
                    menu.style.display = 'none';
                });
            }
        });
        
        // 撤回消息
        function recallMessage(btn, messageId, chatType, chatId) {
            // 如果传入的是临时ID，尝试从DOM元素获取最新的真实ID
            if (messageId.startsWith('temp_') || messageId.startsWith('msg_')) {
                const messageElement = btn.closest('.message');
                if (messageElement && messageElement.dataset.messageId) {
                    // 如果DOM上的ID已经更新（不再是临时ID），则使用DOM上的ID
                    if (messageElement.dataset.messageId !== messageId) {
                        messageId = messageElement.dataset.messageId;
                    }
                }
            }
            
            if (!confirm('确定要撤回这条消息吗？')) {
                return;
            }

            console.log('调用撤回消息函数:', {btn, messageId, chatType, chatId});
            
            // 获取消息元素
            const messageElement = btn.closest('.message');
            if (!messageElement) {
                console.error('未找到消息元素');
                showNotification('未找到消息元素', 'error');
                return;
            }
            
            // 检查时间 (可选，服务器也会检查)
            if (messageElement.dataset.messageTime) {
                const messageTime = parseInt(messageElement.dataset.messageTime);
                const now = Date.now();
                const timeDiff = (now - messageTime) / 1000 / 60; // 转换为分钟
                if (timeDiff > 2) {
                    showNotification('消息已超过2分钟，无法撤回', 'error');
                    return;
                }
            }
            
            // 发送撤回请求到服务器
            const formData = new URLSearchParams();
            formData.append('action', 'recall');
            formData.append('message_id', messageId);
            formData.append('chat_type', chatType);
            if (chatType === 'friend') {
                formData.append('friend_id', chatId);
            } else {
                formData.append('group_id', chatId);
            }
            
            console.log('发送撤回请求:', formData.toString());
            fetch('/src/chat/recall_message.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                console.log('撤回请求响应:', data);
                if (data.success) {
                    // 撤回成功，更新消息显示为撤回状态
                    // 保留头像部分，只替换内容
                    const avatarHtml = messageElement.querySelector('.message-avatar').outerHTML;
                    messageElement.innerHTML = `
                        <div class='message-content'>
                            <div class='message-text' style='color: #999; font-style: italic;'>[消息已撤回]</div>
                        </div>
                        ${avatarHtml}
                    `;
                    showNotification('消息已撤回', 'success');
                } else {
                    showNotification('消息撤回失败: ' + (data.message || '未知错误'), 'error');
                }
            })
            .catch(error => {
                console.error('撤回消息失败:', error);
                showNotification('网络错误，消息撤回失败', 'error');
            });
        }
        
        // 显示安全警告
        function showSecurityWarning(link) {
            // 创建安全警告弹窗
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: white;
                padding: 30px;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            `;
            
            // 标题
            const title = document.createElement('h3');
            title.style.cssText = `
                margin-bottom: 20px;
                color: #ff4757;
                font-size: 18px;
            `;
            title.textContent = '安全警告';
            
            // 内容
            const content = document.createElement('div');
            content.style.cssText = `
                margin-bottom: 25px;
                color: #666;
                font-size: 14px;
                line-height: 1.6;
                text-align: left;
            `;
            
            // 截断过长的链接
            const truncatedLink = truncateLink(link, 50);
            
            content.innerHTML = `
                <p>您访问的链接未知，请仔细辨别后再访问</p>
                <p style="margin-top: 15px; font-weight: 600;">您将要访问：</p>
                <p style="background: #f5f5f5; padding: 10px; border-radius: 6px; word-break: break-all;">${truncatedLink}</p>
            `;
            
            // 按钮容器
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-top: 25px;
            `;
            
            // 取消按钮
            const cancelBtn = document.createElement('button');
            cancelBtn.style.cssText = `
                padding: 10px 25px;
                background: #f5f5f5;
                color: #333;
                border: 1px solid #ddd;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s ease;
            `;
            cancelBtn.textContent = '取消';
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            // 继续访问按钮
            const continueBtn = document.createElement('button');
            continueBtn.style.cssText = `
                padding: 10px 25px;
                background: #12b7f5;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s ease;
            `;
            continueBtn.textContent = '继续访问';
            continueBtn.addEventListener('click', () => {
                window.open(link, '_blank');
                document.body.removeChild(modal);
            });
            
            // 组装弹窗
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(continueBtn);
            modalContent.appendChild(title);
            modalContent.appendChild(content);
            modalContent.appendChild(buttonContainer);
            modal.appendChild(modalContent);
            
            // 添加到页面
            document.body.appendChild(modal);
        }
        
        // 截断过长的链接
        function truncateLink(link, maxLength) {
            if (link.length <= maxLength) {
                return link;
            }
            const halfLength = Math.floor(maxLength / 2);
            return link.substring(0, halfLength) + '...' + link.substring(link.length - halfLength);
        }
        
        // IndexedDB管理类，用于统一管理所有类型的缓存
        class IndexedDBManager {
            constructor() {
                this.dbName = 'chatfile';
                this.dbVersion = 2;
                this.db = null;
                this.stores = {
                    files: 'files',
                    settings: 'settings',
                    cache: 'cache'
                };
            }
            
            // 打开数据库
            openDB() {
                return new Promise((resolve, reject) => {
                    if (this.db) {
                        resolve(this.db);
                        return;
                    }
                    
                    const request = indexedDB.open(this.dbName, this.dbVersion);
                    
                    request.onerror = (event) => {
                        reject('IndexedDB打开失败: ' + event.target.error.message);
                    };
                    
                    request.onsuccess = (event) => {
                        this.db = event.target.result;
                        resolve(this.db);
                    };
                    
                    request.onupgradeneeded = (event) => {
                        const db = event.target.result;
                        
                        // 创建文件存储对象
                        if (!db.objectStoreNames.contains(this.stores.files)) {
                            const filesStore = db.createObjectStore(this.stores.files, { keyPath: 'id' });
                            filesStore.createIndex('type', 'type', { unique: false });
                            filesStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
                            filesStore.createIndex('size', 'size', { unique: false });
                        }
                        
                        // 创建设置存储对象
                        if (!db.objectStoreNames.contains(this.stores.settings)) {
                            const settingsStore = db.createObjectStore(this.stores.settings, { keyPath: 'key' });
                        }
                        
                        // 创建通用缓存存储对象
                        if (!db.objectStoreNames.contains(this.stores.cache)) {
                            const cacheStore = db.createObjectStore(this.stores.cache, { keyPath: 'key' });
                            cacheStore.createIndex('type', 'type', { unique: false });
                            cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
                        }
                    };
                });
            }
            
            // 保存文件到IndexedDB
            saveFile(fileData) {
                return new Promise((resolve, reject) => {
                    this.openDB().then(db => {
                        const transaction = db.transaction([this.stores.files], 'readwrite');
                        const objectStore = transaction.objectStore(this.stores.files);
                        
                        const request = objectStore.put(fileData);
                        
                        request.onerror = (event) => {
                            reject('文件保存失败: ' + event.target.error.message);
                        };
                        
                        transaction.oncomplete = () => {
                            resolve(fileData.id);
                        };
                    }).catch(error => {
                        reject(error);
                    });
                });
            }
            
            // 从IndexedDB获取文件
            getFile(fileId) {
                return new Promise((resolve, reject) => {
                    this.openDB().then(db => {
                        const transaction = db.transaction([this.stores.files], 'readonly');
                        const objectStore = transaction.objectStore(this.stores.files);
                        
                        const request = objectStore.get(fileId);
                        
                        request.onerror = (event) => {
                            reject('文件读取失败: ' + event.target.error.message);
                        };
                        
                        request.onsuccess = () => {
                            resolve(request.result);
                        };
                    }).catch(error => {
                        reject(error);
                    });
                });
            }
            
            // 从IndexedDB删除文件
            deleteFile(fileId) {
                return new Promise((resolve, reject) => {
                    this.openDB().then(db => {
                        const transaction = db.transaction([this.stores.files], 'readwrite');
                        const objectStore = transaction.objectStore(this.stores.files);
                        
                        const request = objectStore.delete(fileId);
                        
                        request.onerror = (event) => {
                            reject('文件删除失败: ' + event.target.error.message);
                        };
                        
                        transaction.oncomplete = () => {
                            resolve(true);
                        };
                    }).catch(error => {
                        reject(error);
                    });
                });
            }
            
            // 获取所有文件
            getAllFiles() {
                return new Promise((resolve, reject) => {
                    this.openDB().then(db => {
                        const transaction = db.transaction([this.stores.files], 'readonly');
                        const objectStore = transaction.objectStore(this.stores.files);
                        const files = [];
                        
                        objectStore.openCursor().onsuccess = (event) => {
                            const cursor = event.target.result;
                            if (cursor) {
                                files.push(cursor.value);
                                cursor.continue();
                            } else {
                                resolve(files);
                            }
                        };
                    }).catch(error => {
                        reject(error);
                    });
                });
            }
            
            // 保存设置到IndexedDB
            saveSetting(key, value) {
                return new Promise((resolve, reject) => {
                    this.openDB().then(db => {
                        const transaction = db.transaction([this.stores.settings], 'readwrite');
                        const objectStore = transaction.objectStore(this.stores.settings);
                        
                        const settingData = {
                            key: key,
                            value: value,
                            timestamp: new Date().toISOString()
                        };
                        
                        const request = objectStore.put(settingData);
                        
                        request.onerror = (event) => {
                            reject('设置保存失败: ' + event.target.error.message);
                        };
                        
                        transaction.oncomplete = () => {
                            resolve(true);
                        };
                    }).catch(error => {
                        reject(error);
                    });
                });
            }
            
            // 从IndexedDB获取设置
            getSetting(key, defaultValue = null) {
                return new Promise((resolve, reject) => {
                    this.openDB().then(db => {
                        const transaction = db.transaction([this.stores.settings], 'readonly');
                        const objectStore = transaction.objectStore(this.stores.settings);
                        
                        const request = objectStore.get(key);
                        
                        request.onerror = (event) => {
                            reject('设置读取失败: ' + event.target.error.message);
                        };
                        
                        request.onsuccess = () => {
                            resolve(request.result ? request.result.value : defaultValue);
                        };
                    }).catch(error => {
                        reject(error);
                    });
                });
            }
            
            // 保存通用缓存到IndexedDB
            saveCache(key, value, type = 'general') {
                return new Promise((resolve, reject) => {
                    this.openDB().then(db => {
                        const transaction = db.transaction([this.stores.cache], 'readwrite');
                        const objectStore = transaction.objectStore(this.stores.cache);
                        
                        const cacheData = {
                            key: key,
                            value: value,
                            type: type,
                            timestamp: new Date().toISOString()
                        };
                        
                        const request = objectStore.put(cacheData);
                        
                        request.onerror = (event) => {
                            reject('缓存保存失败: ' + event.target.error.message);
                        };
                        
                        transaction.oncomplete = () => {
                            resolve(true);
                        };
                    }).catch(error => {
                        reject(error);
                    });
                });
            }
            
            // 从IndexedDB获取通用缓存
            getCache(key) {
                return new Promise((resolve, reject) => {
                    this.openDB().then(db => {
                        const transaction = db.transaction([this.stores.cache], 'readonly');
                        const objectStore = transaction.objectStore(this.stores.cache);
                        
                        const request = objectStore.get(key);
                        
                        request.onerror = (event) => {
                            reject('缓存读取失败: ' + event.target.error.message);
                        };
                        
                        request.onsuccess = () => {
                            resolve(request.result ? request.result.value : null);
                        };
                    }).catch(error => {
                        reject(error);
                    });
                });
            }
            
            // 删除通用缓存
            deleteCache(key) {
                return new Promise((resolve, reject) => {
                    this.openDB().then(db => {
                        const transaction = db.transaction([this.stores.cache], 'readwrite');
                        const objectStore = transaction.objectStore(this.stores.cache);
                        
                        const request = objectStore.delete(key);
                        
                        request.onerror = (event) => {
                            reject('缓存删除失败: ' + event.target.error.message);
                        };
                        
                        transaction.oncomplete = () => {
                            resolve(true);
                        };
                    }).catch(error => {
                        reject(error);
                    });
                });
            }
            
            // 迁移数据从localStorage到IndexedDB
            migrateFromLocalStorage() {
                return new Promise((resolve, reject) => {
                    try {
                        // 迁移设置
                        const settingKeys = ['setting-link-popup'];
                        const migrationPromises = [];
                        
                        settingKeys.forEach(key => {
                            const value = localStorage.getItem(key);
                            if (value !== null) {
                                // 转换布尔值
                                let parsedValue = value;
                                if (value === 'true' || value === 'false') {
                                    parsedValue = value === 'true';
                                }
                                migrationPromises.push(this.saveSetting(key, parsedValue));
                            }
                        });
                        
                        // 迁移旧版文件数据
                        const localStorageKeys = Object.keys(localStorage);
                        localStorageKeys.forEach(key => {
                            if (key.startsWith('File_') || key.startsWith('Picture_') || key.startsWith('Video_') || key.startsWith('Audio_')) {
                                const fileData = localStorage.getItem(key);
                                if (fileData) {
                                    try {
                                        const parsedData = JSON.parse(fileData);
                                        if (parsedData.id && parsedData.name && parsedData.data) {
                                            migrationPromises.push(this.saveFile(parsedData));
                                        }
                                    } catch (e) {
                                        // 忽略无效数据
                                    }
                                }
                            }
                        });
                        
                        // 迁移fileIndex
                        const fileIndex = localStorage.getItem('fileIndex');
                        if (fileIndex) {
                            try {
                                const parsedIndex = JSON.parse(fileIndex);
                                migrationPromises.push(this.saveCache('fileIndex', parsedIndex, 'system'));
                            } catch (e) {
                                // 忽略无效数据
                            }
                        }
                        
                        Promise.all(migrationPromises).then(() => {
                            // 迁移完成后清除localStorage中的数据
                            settingKeys.forEach(key => localStorage.removeItem(key));
                            localStorageKeys.forEach(key => {
                                if (key.startsWith('File_') || key.startsWith('Picture_') || key.startsWith('Video_') || key.startsWith('Audio_')) {
                                    localStorage.removeItem(key);
                                }
                            });
                            localStorage.removeItem('fileIndex');
                            resolve(true);
                        }).catch(error => {
                            reject('迁移失败: ' + error.message);
                        });
                    } catch (error) {
                        reject('迁移过程中发生错误: ' + error.message);
                    }
                });
            }
            
            // 获取缓存统计信息
            getCacheStats() {
                return new Promise((resolve, reject) => {
                    this.getAllFiles().then(files => {
                        let totalSize = 0;
                        const stats = {
                            totalFiles: files.length,
                            totalSize: 0,
                            byType: {
                                image: 0,
                                video: 0,
                                audio: 0,
                                file: 0
                            },
                            byTypeSize: {
                                image: 0,
                                video: 0,
                                audio: 0,
                                file: 0
                            }
                        };
                        
                        files.forEach(file => {
                            totalSize += file.size;
                            if (file.type.startsWith('image/')) {
                                stats.byType.image++;
                                stats.byTypeSize.image += file.size;
                            } else if (file.type.startsWith('video/')) {
                                stats.byType.video++;
                                stats.byTypeSize.video += file.size;
                            } else if (file.type.startsWith('audio/')) {
                                stats.byType.audio++;
                                stats.byTypeSize.audio += file.size;
                            } else {
                                stats.byType.file++;
                                stats.byTypeSize.file += file.size;
                            }
                        });
                        
                        stats.totalSize = totalSize;
                        resolve(stats);
                    }).catch(error => {
                        reject('获取缓存统计失败: ' + error.message);
                    });
                });
            }
            
            // 清除所有缓存
            clearAllCache() {
                return new Promise((resolve, reject) => {
                    this.openDB().then(db => {
                        const storesToClear = [this.stores.files, this.stores.cache];
                        const clearPromises = [];
                        
                        storesToClear.forEach(storeName => {
                            const transaction = db.transaction([storeName], 'readwrite');
                            const objectStore = transaction.objectStore(storeName);
                            const request = objectStore.clear();
                            
                            clearPromises.push(new Promise((res, rej) => {
                                request.onerror = (event) => {
                                    rej('清除' + storeName + '失败: ' + event.target.error.message);
                                };
                                
                                transaction.oncomplete = () => {
                                    res(true);
                                };
                            }));
                        });
                        
                        Promise.all(clearPromises).then(() => {
                            resolve(true);
                        }).catch(error => {
                            reject('清除缓存失败: ' + error.message);
                        });
                    }).catch(error => {
                        reject('清除缓存过程中发生错误: ' + error.message);
                    });
                });
            }
            
            // 获取所有设置
            getSettings() {
                return new Promise((resolve, reject) => {
                    this.openDB().then(db => {
                        const transaction = db.transaction([this.stores.settings], 'readonly');
                        const objectStore = transaction.objectStore(this.stores.settings);
                        const settings = {};
                        
                        objectStore.openCursor().onsuccess = (event) => {
                            const cursor = event.target.result;
                            if (cursor) {
                                settings[cursor.value.key] = cursor.value.value;
                                cursor.continue();
                            } else {
                                resolve(settings);
                            }
                        };
                        
                        transaction.onerror = (event) => {
                            reject('读取设置失败: ' + event.target.error.message);
                        };
                    }).catch(error => {
                        reject(error);
                    });
                });
            }
            
            // 保存多个设置
            saveSettings(settings) {
                return new Promise((resolve, reject) => {
                    this.openDB().then(db => {
                        const transaction = db.transaction([this.stores.settings], 'readwrite');
                        const objectStore = transaction.objectStore(this.stores.settings);
                        const savePromises = [];
                        
                        Object.keys(settings).forEach(key => {
                            const settingData = {
                                key: key,
                                value: settings[key],
                                timestamp: new Date().toISOString()
                            };
                            
                            savePromises.push(new Promise((res, rej) => {
                                const request = objectStore.put(settingData);
                                request.onerror = (event) => {
                                    rej('保存设置失败: ' + event.target.error.message);
                                };
                                request.onsuccess = () => {
                                    res(true);
                                };
                            }));
                        });
                        
                        Promise.all(savePromises).then(() => {
                            resolve(true);
                        }).catch(error => {
                            reject(error);
                        });
                    }).catch(error => {
                        reject(error);
                    });
                });
            }
        }
        
        // 初始化IndexedDB管理器实例
        const indexedDBManager = new IndexedDBManager();
        
        // 页面加载时执行数据迁移
        window.addEventListener('load', () => {
            indexedDBManager.migrateFromLocalStorage().catch(error => {
                console.log('localStorage迁移失败:', error);
            });
        });
        
        // localStorage空间管理函数
        function getLocalStorageAvailableSpace() {
            // 尝试存储不同大小的数据，找出可用空间
            try {
                const testKey = '__test_storage_space__';
                let testData = '';
                const chunkSize = 1024 * 1024; // 1MB chunks
                let maxChunks = 100;
                let chunksWritten = 0;
                
                // 先删除可能存在的测试数据
                localStorage.removeItem(testKey);
                
                // 逐步增加数据大小，直到失败
                while (chunksWritten < maxChunks) {
                    try {
                        testData += 'x'.repeat(chunkSize);
                        localStorage.setItem(testKey, testData);
                        chunksWritten++;
                    } catch (e) {
                        break;
                    }
                }
                
                // 计算可用空间（MB）
                const availableSpace = chunksWritten * chunkSize;
                
                // 清理测试数据
                localStorage.removeItem(testKey);
                
                return availableSpace;
            } catch (error) {
                // 保守估计，返回1MB
                return 1024 * 1024;
            }
        }
        
        // 清理旧文件以释放空间
        function cleanupOldFiles(requiredSpace) {
            try {
                // 获取文件索引
                const fileIndex = JSON.parse(localStorage.getItem('fileIndex') || '[]');
                if (fileIndex.length === 0) {
                    return false;
                }
                
                // 获取所有文件的详细信息并按上传时间排序
                const files = [];
                for (const fileId of fileIndex) {
                    const fileData = localStorage.getItem(fileId);
                    if (fileData) {
                        try {
                            const parsedData = JSON.parse(fileData);
                            files.push({
                                id: fileId,
                                size: parsedData.size,
                                uploadedAt: new Date(parsedData.uploadedAt)
                            });
                        } catch (e) {
                            // 忽略无效文件
                        }
                    }
                }
                
                // 按上传时间排序，最旧的文件排在前面
                files.sort((a, b) => a.uploadedAt - b.uploadedAt);
                
                // 计算当前已用空间
                let currentSize = 0;
                for (const file of files) {
                    currentSize += file.size;
                }
                
                // 计算需要清理的空间
                let cleanedSize = 0;
                const filesToRemove = [];
                
                // 从最旧的文件开始清理，直到有足够空间
                for (const file of files) {
                    if (cleanedSize >= requiredSpace) {
                        break;
                    }
                    
                    filesToRemove.push(file.id);
                    cleanedSize += file.size;
                }
                
                // 执行清理
                for (const fileId of filesToRemove) {
                    localStorage.removeItem(fileId);
                    // 从索引中移除
                    const index = fileIndex.indexOf(fileId);
                    if (index > -1) {
                        fileIndex.splice(index, 1);
                    }
                }
                
                // 更新索引
                localStorage.setItem('fileIndex', JSON.stringify(fileIndex));
                
                return true;
            } catch (error) {
                return false;
            }
        }
        
        // 发送文件函数
        // localStorage文件存储管理
        function saveFileToCache(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        // 根据文件类型设置不同的前缀
                        let prefix = 'File_';
                        if (file.type.startsWith('image/')) {
                            prefix = 'Picture_';
                        } else if (file.type.startsWith('video/')) {
                            prefix = 'Video_';
                        } else if (file.type.startsWith('audio/')) {
                            prefix = 'Audio_';
                        }
                        
                        // 生成唯一文件ID，格式为：前缀 + 原始文件名 + 时间戳 + 随机字符串
                        const timestamp = Date.now();
                        const randomStr = Math.random().toString(36).substring(2, 11);
                        const fileId = prefix + file.name + '_' + timestamp + '_' + randomStr;
                        
                        // 准备文件数据
                        const fileData = {
                            id: fileId,
                            name: file.name,
                            size: file.size,
                            type: file.type,
                            data: e.target.result,
                            uploadedAt: new Date().toISOString()
                        };
                        
                        // 将文件数据存储到IndexedDB
                        indexedDBManager.saveFile(fileData)
                            .then(() => {
                                resolve(fileId);
                            })
                            .catch(error => {
                                reject('文件存储失败：' + error.message);
                            });
                    } catch (error) {
                        reject('文件存储失败：' + error.message);
                    }
                };
                reader.onerror = () => {
                    reject('文件读取失败');
                };
                reader.readAsDataURL(file);
            });
        }
        
        function getFileFromCache(fileId) {
            return new Promise((resolve, reject) => {
                indexedDBManager.getFile(fileId)
                    .then(fileData => {
                        resolve(fileData);
                    })
                    .catch(error => {
                        console.error('从IndexedDB获取文件失败：', error);
                        resolve(null);
                    });
            });
        }
        
        // 优化视频：降低分辨率、码率、帧率
        async function optimizeVideo(videoFile) {
            return new Promise((resolve, reject) => {
                const video = document.createElement('video');
                video.src = URL.createObjectURL(videoFile);
                video.preload = 'metadata';
                
                video.onloadedmetadata = async () => {
                    // 设置优化参数
                    const maxWidth = 854; // 降低分辨率到854px宽
                    const maxHeight = 480; // 降低分辨率到480px高
                    const frameRate = 15; // 降低帧率到15fps
                    const bitrate = 500000; // 降低码率到500kbps
                    
                    // 计算缩放比例
                    let width = video.videoWidth;
                    let height = video.videoHeight;
                    if (width > maxWidth || height > maxHeight) {
                        const aspectRatio = width / height;
                        if (aspectRatio > 1) {
                            width = maxWidth;
                            height = Math.round(maxWidth / aspectRatio);
                        } else {
                            height = maxHeight;
                            width = Math.round(maxHeight * aspectRatio);
                        }
                    }
                    
                    // 创建canvas用于视频帧绘制
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    // 创建MediaRecorder
                    const stream = canvas.captureStream(frameRate);
                    const recorder = new MediaRecorder(stream, {
                        mimeType: 'video/webm;codecs=vp9',
                        videoBitsPerSecond: bitrate
                    });
                    
                    const chunks = [];
                    recorder.ondataavailable = (e) => {
                        if (e.data.size > 0) {
                            chunks.push(e.data);
                        }
                    };
                    
                    recorder.onstop = () => {
                        const optimizedBlob = new Blob(chunks, { type: 'video/webm' });
                        const optimizedFile = new File([optimizedBlob], videoFile.name.replace(/\.[^/.]+$/, '.webm'), {
                            type: 'video/webm',
                            lastModified: Date.now()
                        });
                        URL.revokeObjectURL(video.src);
                        resolve(optimizedFile);
                    };
                    
                    recorder.onerror = (e) => {
                        URL.revokeObjectURL(video.src);
                        reject(new Error('视频优化失败: ' + e.error));
                    };
                    
                    // 开始录制
                    recorder.start();
                    
                    // 播放视频并绘制每一帧
                    video.play().catch(error => {
                        URL.revokeObjectURL(video.src);
                        reject(new Error('视频播放失败: ' + error.message));
                    });
                    
                    const drawFrame = () => {
                        if (!recorder.state || recorder.state === 'inactive') {
                            return;
                        }
                        
                        ctx.drawImage(video, 0, 0, width, height);
                        requestAnimationFrame(drawFrame);
                    };
                    
                    video.addEventListener('ended', () => {
                        recorder.stop();
                    });
                    
                    drawFrame();
                };
                
                video.onerror = (e) => {
                    URL.revokeObjectURL(video.src);
                    reject(new Error('视频加载失败: ' + e.error));
                };
            });
        }
        
        // 优化图片：降低分辨率、减少颜色信息、选择更优格式
        async function optimizeImage(imageFile) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.src = URL.createObjectURL(imageFile);
                
                img.onload = () => {
                    // 设置优化参数
                    const maxWidth = 1280;
                    const maxHeight = 720;
                    const quality = 0.7;
                    
                    // 计算缩放比例
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth || height > maxHeight) {
                        const aspectRatio = width / height;
                        if (aspectRatio > 1) {
                            width = maxWidth;
                            height = Math.round(maxWidth / aspectRatio);
                        } else {
                            height = maxHeight;
                            width = Math.round(maxHeight * aspectRatio);
                        }
                    }
                    
                    // 创建canvas用于图片绘制
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    // 绘制图片
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // 选择最优格式
                    const format = imageFile.type === 'image/png' && width < 500 ? 'png' : 'jpeg';
                    
                    // 转换为Blob
                    canvas.toBlob((blob) => {
                        const optimizedFile = new File([blob], imageFile.name.replace(/\.[^/.]+$/, `.${format}`), {
                            type: `image/${format}`,
                            lastModified: Date.now()
                        });
                        URL.revokeObjectURL(img.src);
                        resolve(optimizedFile);
                    }, `image/${format}`, quality);
                };
                
                img.onerror = (e) => {
                    URL.revokeObjectURL(img.src);
                    reject(new Error('图片加载失败: ' + e.error));
                };
            });
        }
        
        function sendFile(file, blobUrl = null) {
            const chatType = MOBILE_CHAT_CONFIG.chatType;
            const chatId = MOBILE_CHAT_CONFIG.selectedId;
            
            if (!chatId) {
                showNotification('请先选择聊天对象', 'error');
                return;
            }
            
            // 检查文件大小是否超过限制
            const uploadMaxConfig = MOBILE_CHAT_CONFIG.uploadMaxConfig;
            const maxFileSize = uploadMaxConfig * 1024 * 1024;
            if (file.size > maxFileSize) {
                const maxSizeMB = uploadMaxConfig.toFixed(1);
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
                showNotification(`文件太大，无法上传。文件大小：${fileSizeMB}MB，最大允许：${maxSizeMB}MB`, 'error');
                return;
            }
            
            // 创建上传进度 UI
            const messagesContainer = document.getElementById('messages-container');
            const uploadingMessage = document.createElement('div');
            uploadingMessage.className = 'message sent';
            
            const date = new Date();
            const formattedTime = `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日${date.getHours().toString().padStart(2, '0')}时${date.getMinutes().toString().padStart(2, '0')}分`;
            const timeHtml = `<div class='message-time'>${formattedTime}</div>`;
            
            uploadingMessage.innerHTML = `
                <div class='message-content'>
                    <div class='message-text'>
                        <div style='margin-bottom: 8px;'><strong>${file.name}</strong></div>
                        <div style='margin-bottom: 8px;'>文件大小：${(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                        <div style='margin-bottom: 5px;'>上传中：</div>
                        <div style='width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin-bottom: 5px;'>
                            <div id='upload-progress-bar' style='width: 0%; height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); transition: width 0.3s ease; border-radius: 4px;'></div>
                        </div>
                        <div style='display: flex; justify-content: space-between; font-size: 12px; color: #666;'>
                            <span id='upload-percentage'>0%</span>
                            <span id='upload-speed'>0 KB/s</span>
                        </div>
                    </div>
                    ${timeHtml}
                </div>
                <div class='message-avatar'>
                    (MOBILE_CHAT_CONFIG.hasAvatar ? '<img src="' + MOBILE_CHAT_CONFIG.userAvatar + '" alt="' + MOBILE_CHAT_CONFIG.username + '" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">' : MOBILE_CHAT_CONFIG.usernameShort)
                </div>
            `;
            messagesContainer.appendChild(uploadingMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            const progressBar = uploadingMessage.querySelector('#upload-progress-bar');
            const percentageText = uploadingMessage.querySelector('#upload-percentage');
            const speedText = uploadingMessage.querySelector('#upload-speed');
            const startTime = Date.now();
            
            function updateProgress(loaded, total) {
                const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
                progressBar.style.width = pct + '%';
                percentageText.textContent = pct + '%';
                const elapsed = (Date.now() - startTime) / 1000;
                if (elapsed > 0) {
                    const speedKB = (loaded / elapsed) / 1024;
                    speedText.textContent = speedKB >= 1024 ? (speedKB / 1024).toFixed(2) + ' MB/s' : speedKB.toFixed(0) + ' KB/s';
                }
            }
            
            function showUploadError(msg) {
                if (uploadingMessage.parentElement === messagesContainer) messagesContainer.removeChild(uploadingMessage);
                showNotification(msg, 'error');
            }
            
            function sendMessageWithFile(uploadResult) {
                const formData = new FormData();
                formData.append('chat_type', chatType);
                formData.append('message', '[文件]');
                formData.append('file_url', uploadResult.file_url);
                formData.append('file_name', uploadResult.file_name);
                formData.append('file_size', uploadResult.file_size || optimizedFile.size);
                formData.append('file_type', uploadResult.mime_type || optimizedFile.type);
                formData.append('upload_id', uploadResult.upload_id);
                if (chatType === 'friend') formData.append('friend_id', chatId);
                else formData.append('id', chatId);
                
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/src/chat/send_message.php', true);
                xhr.withCredentials = true;
                
                xhr.onload = function() {
                    if (xhr.status !== 200) return;
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data.warning) showWarning(data.warning);
                        if (data.banned) {
                            const banModal = document.getElementById('ban-notification-modal');
                            if (banModal) {
                                document.getElementById('ban-reason').textContent = data.ban_reason || '发送违禁词次数已达上限';
                                banModal.style.display = 'flex';
                                let countdown = 10;
                                const el = document.getElementById('ban-countdown');
                                if (el) {
                                    const iv = setInterval(() => { countdown--; el.textContent = countdown; if (countdown <= 0) { clearInterval(iv); window.location.href = '/src/auth/login.php'; } }, 1000);
                                }
                            } else setTimeout(() => { window.location.href = '/src/auth/login.php'; }, 3000);
                            return;
                        }
                        if (!data.success) { showNotification('消息发送失败', 'error'); return; }
                        if (data.data && data.data.is_duplicate) showNotification('文件重复，已秒传！', 'success');
                        
                        if (data.message && data.message.file_path) {
                            const serverPath = data.message.file_path;
                            if (data.message_id) messageElement.dataset.messageId = data.message_id;
                            ['[data-file-path]', '.message-image', '.video-element', '.audio-element', '.message-file'].forEach(sel => {
                                messageElement.querySelectorAll(sel).forEach(el => { el.setAttribute('data-file-path', serverPath); });
                            });
                            messageElement.querySelectorAll('.message-image').forEach(img => {
                                img.style.display = '';
                                img.src = (typeof FileHelper !== 'undefined') ? FileHelper.getFileUrl(serverPath) : serverPath;
                            });
                            messageElement.querySelectorAll('.video-element').forEach(v => {
                                v.setAttribute('data-file-url', (typeof FileHelper !== 'undefined') ? FileHelper.getFileUrl(serverPath) : serverPath);
                            });
                        }
                    } catch (e) { console.error('解析响应失败', e); }
                };
                xhr.send(formData);
            }
            
            (async () => {
                let optimizedFile = file;
                try {
                    if (file.type.startsWith('video/')) optimizedFile = await optimizeVideo(file);
                    else if (file.type.startsWith('image/')) optimizedFile = await optimizeImage(file);
                    
                    speedText.textContent = '上传中...';

                    // 直接 POST 到 /src/chat/send_message.php（session 认证，无需 /src/api/api.php）
                    var result = await new Promise(function(resolve, reject) {
                        var fd = new FormData();
                        fd.append('chat_type', chatType);
                        fd.append('message', '[文件]');
                        fd.append('file', optimizedFile);
                        if (chatType === 'friend') fd.append('friend_id', chatId);
                        else fd.append('id', chatId);

                        var xhr = new XMLHttpRequest();
                        xhr.open('POST', '/src/chat/send_message.php', true);
                        xhr.withCredentials = true;

                        xhr.upload.onprogress = function(e) {
                            if (e.lengthComputable) updateProgress(e.loaded, e.total);
                        };

                        xhr.onload = function() {
                            if (xhr.status !== 200) { reject(new Error('HTTP ' + xhr.status)); return; }
                            try { resolve(JSON.parse(xhr.responseText)); }
                            catch (e) { reject(new Error('响应解析失败')); }
                        };
                        xhr.onerror = function() { reject(new Error('网络错误')); };
                        xhr.send(fd);
                    });

                    updateProgress(optimizedFile.size, optimizedFile.size);

                    if (!result.success) throw new Error(result.message || '发送失败');

                    progressBar.style.width = '100%';
                    percentageText.textContent = '100%';

                    var msgInfo  = result.message || {};
                    var fileUrl  = msgInfo.file_path || '';
                    var fileName = msgInfo.original_name || optimizedFile.name;

                    if (fileName.startsWith('Audio_')) fileName = '语音消息.webm';
                    else fileName = fileName.replace(/^(Audio|Video|Picture|File)_.*?_/, '');

                    var messageData = {
                        id: result.message_id || ('msg_' + Date.now()),
                        sender_id: MOBILE_CHAT_CONFIG.userId, content: '',
                        file_path: fileUrl, file_name: fileName,
                        file_size: optimizedFile.size,
                        file_type: optimizedFile.type,
                        blob_url: blobUrl, type: 'file',
                        created_at: new Date().toISOString(),
                        status: 'sent', sender_name: MOBILE_CHAT_CONFIG.username,
                        sender_avatar: MOBILE_CHAT_CONFIG.userAvatar || ''
                    };

                    var messageEl = createMessageElement(messageData, chatType, chatId);
                    if (uploadingMessage.parentElement === messagesContainer)
                        messagesContainer.removeChild(uploadingMessage);
                    messagesContainer.appendChild(messageEl);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;

                    // 同步服务器返回的路径到 DOM
                    if (fileUrl && typeof FileHelper !== 'undefined') {
                        var resolvedUrl = FileHelper.getFileUrl(fileUrl);
                        if (result.message_id) messageEl.dataset.messageId = result.message_id;
                        ['[data-file-path]','.message-image','.video-element','.audio-element','.message-file'].forEach(function(sel){
                            messageEl.querySelectorAll(sel).forEach(function(el){ el.setAttribute('data-file-path',fileUrl); });
                        });
                        messageEl.querySelectorAll('.message-image').forEach(function(img){ img.style.display=''; img.src=resolvedUrl; });
                        messageEl.querySelectorAll('.video-element').forEach(function(v){ v.setAttribute('data-file-url',resolvedUrl); });
                    }

                    initChatVideos();

                    speedText.textContent = result.is_duplicate ? '秒传完成！' : '上传完成';
                    if (result.is_duplicate) showNotification('文件重复，已秒传！', 'success');

                    var fInput = document.getElementById('file-input');
                    if (fInput) fInput.value = '';
                } catch (error) {
                    console.error('文件上传失败:', error);
                    showUploadError('文件上传失败: ' + (error.message || '未知错误'));
                    const fileInput = document.getElementById('file-input');
                    if (fileInput) fileInput.value = '';
                }
            })();
        }
        
        function sendMessage() {
            const input = document.getElementById('message-input');
            let message = input.value.trim();
            
            if (message) {
                // 对消息内容进行HTML转义，确保HTML标签被显示而不是执行
                message = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
                
                // 如果转义后消息为空，不发送
                if (!message) {
                    showNotification('消息内容不能为空 <svg viewBox="0 0 24 24" width="14" height="14" fill="#f44336"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>', 'error');
                    return;
                }
                
                // 动态获取当前选中的聊天对象ID
                const chatType = MOBILE_CHAT_CONFIG.chatType;
                let chatId = null;
                
                // 查找当前选中的聊天列表项
                const activeChatItem = document.querySelector('.chat-item.active');
                if (activeChatItem) {
                    if (activeChatItem.dataset.friendId) {
                        chatType = 'friend';
                        chatId = activeChatItem.dataset.friendId;
                    } else if (activeChatItem.dataset.groupId) {
                        chatType = 'group';
                        chatId = activeChatItem.dataset.groupId;
                    }
                }
                
                // 如果没有找到选中的聊天对象，使用默认值
                if (!chatId) {
                    chatType = MOBILE_CHAT_CONFIG.chatType;
                    chatId = MOBILE_CHAT_CONFIG.selectedId;
                }
                
                if (!chatId) {
                    showNotification('请先选择聊天对象', 'error');
                    return;
                }
                
                // 检测消息是否包含链接
                const messageWithLinks = message.replace(/(https?:\/\/[^\s]+)/g, function(link) {
                    return `<a href="#" onclick="event.preventDefault(); handleLinkClick('${link}')" style="color: #12b7f5; text-decoration: underline;">${link}</a>`;
                });
                
                // 创建临时消息ID
                const tempMessageId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                
                // 格式化时间为 X年X月X日X时X分
                const date = new Date();
                const formattedTime = `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日${date.getHours().toString().padStart(2, '0')}时${date.getMinutes().toString().padStart(2, '0')}分`;
                
                // 创建消息元素
                const messagesContainer = document.getElementById('messages-container');
                const messageElement = document.createElement('div');
                messageElement.className = 'message sent';
                messageElement.dataset.messageId = tempMessageId;
                messageElement.dataset.chatType = chatType;
                messageElement.dataset.chatId = chatId;
                // 保存消息发送时间，用于撤回功能
                const messageTime = Date.now();
                messageElement.dataset.messageTime = messageTime;
                messageElement.innerHTML = `
                    <div class='message-content'>
                        <div class='message-text'>${messageWithLinks}</div>
                        <div class='message-time'>${formattedTime}</div>
                        <div class='message-actions'>
                            <div style='position: relative; z-index: 4000;'>
                                <button class='message-action-btn' onclick='toggleMessageActions(this)' style='width: 28px; height: 28px; font-size: 18px; background: rgba(0,0,0,0.1); border: none; border-radius: 50%; color: #333; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 1; transition: all 0.2s ease;'>⋮</button>
                                <div class='message-actions-menu' style='display: none; position: absolute; top: 100%; right: 0; background: white; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); padding: 8px 0; z-index: 5000; min-width: 100px;'>
                                    <button class='message-action-item' onclick='recallMessage(this, "${tempMessageId}", "${chatType}", "${chatId}")' style='width: 100%; text-align: left; padding: 8px 16px; border: none; background: transparent; cursor: pointer; transition: all 0.2s ease; color: #333;'>撤回消息</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class='message-avatar'>
                        (MOBILE_CHAT_CONFIG.hasAvatar ? '<img src="' + MOBILE_CHAT_CONFIG.userAvatar + '" alt="' + MOBILE_CHAT_CONFIG.username + '" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">' : MOBILE_CHAT_CONFIG.usernameShort)
                    </div>
                `;
                messagesContainer.appendChild(messageElement);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                
                // 发送消息到服务器
                const formData = new URLSearchParams();
                formData.append('message', message);
                formData.append('chat_type', chatType);
                if (chatType === 'friend') {
                    formData.append('friend_id', chatId);
                } else {
                    formData.append('id', chatId);
                }
                
                fetch('/src/chat/send_message.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    // 检查是否有警告信息
                    if (data.warning) {
                        showWarning(data.warning);
                    }
                    
                    // 检查是否被封禁
                    if (data.banned) {
                        // 显示封禁提示
                        const banModal = document.getElementById('ban-notification-modal');
                        if (banModal) {
                            document.getElementById('ban-reason').textContent = data.ban_reason || '发送违禁词次数已达上限，如有疑问请联系管理员！';
                            banModal.style.display = 'flex';
                            
                            // 10秒后自动退出登录
                            let countdown = 10;
                            const countdownElement = document.getElementById('ban-countdown');
                            if (countdownElement) {
                                const countdownInterval = setInterval(() => {
                                    countdown--;
                                    countdownElement.textContent = countdown;
                                    if (countdown <= 0) {
                                        clearInterval(countdownInterval);
                                        window.location.href = '/src/auth/login.php';
                                    }
                                }, 1000);
                            }
                        } else {
                            // 如果没有封禁弹窗，直接退出登录
                            setTimeout(() => {
                                window.location.href = '/src/auth/login.php';
                            }, 3000);
                        }
                        return;
                    }
                    
                    if (data.success && data.message_id) {
                        // 消息发送成功，更新临时消息的ID为真实ID
                        messageElement.dataset.messageId = data.message_id;
                    } else if (!data.success) {
                        // 发送失败，移除临时消息
                        messagesContainer.removeChild(messageElement);
                        // 显示错误消息
                        showNotification('发送消息失败：' + (data.message || '未知错误'), 'error');
                    }
                })
                .catch(error => {
                    console.error('发送消息失败:', error);
                    // 发送失败，移除临时消息
                    messagesContainer.removeChild(messageElement);
                    // 显示错误消息
                    showNotification('发送消息失败，请检查网络连接', 'error');
                });
                
                input.value = '';
            }
        }
        
        // 好友申请相关函数
        function showFriendRequests() {
            document.getElementById('friend-requests-modal').style.display = 'flex';
        }
        
        function closeFriendRequestsModal() {
            document.getElementById('friend-requests-modal').style.display = 'none';
        }
        

        
        // 初始化音频播放器
        function initAudioPlayers() {
            document.querySelectorAll('.custom-audio-player').forEach(player => {
                // 检查是否已经初始化
                if (player.classList.contains('initialized')) {
                    return;
                }
                
                // 标记为已初始化
                player.classList.add('initialized');
                
                const audio = player.querySelector('.audio-element');
                const playBtn = player.querySelector('.audio-play-btn');
                const progressBar = player.querySelector('.audio-progress-bar');
                const progress = player.querySelector('.audio-progress');
                const currentTimeEl = player.querySelector('.current-time');
                const durationEl = player.querySelector('.audio-duration');
                
                // 检查必要元素是否存在
                if (!audio || !playBtn || !progressBar || !progress || !currentTimeEl || !durationEl) {
                    return;
                }
                
                // 设置音频时长
                audio.addEventListener('loadedmetadata', function() {
                    durationEl.textContent = formatTime(audio.duration);
                });
                
                // 播放/暂停控制
                playBtn.addEventListener('click', function() {
                    if (audio.paused) {
                        audio.play();
                        playBtn.classList.add('playing');
                    } else {
                        audio.pause();
                        playBtn.classList.remove('playing');
                    }
                });
                
                // 更新进度条和时间
                audio.addEventListener('timeupdate', function() {
                    // 确保duration有效才计算进度
                    if (!isFinite(audio.duration) || isNaN(audio.duration) || audio.duration <= 0) {
                        return;
                    }
                    const progressPercent = (audio.currentTime / audio.duration) * 100;
                    progress.style.width = progressPercent + '%';
                    currentTimeEl.textContent = formatTime(audio.currentTime);
                });
                
                // 音频结束时重置
                audio.addEventListener('ended', function() {
                    playBtn.classList.remove('playing');
                    progress.style.width = '0%';
                    currentTimeEl.textContent = '0:00';
                });
                
                // 进度条点击跳转到指定位置
                progressBar.addEventListener('click', function(e) {
                    // 确保duration有效才允许跳转
                    if (!isFinite(audio.duration) || isNaN(audio.duration) || audio.duration <= 0) {
                        return;
                    }
                    const progressWidth = progressBar.clientWidth;
                    // 使用clientX和getBoundingClientRect获取准确的点击位置
                    const rect = progressBar.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const duration = audio.duration;
                    
                    audio.currentTime = (clickX / progressWidth) * duration;
                });
                
                // 进度条拖动功能
                let isDragging = false;
                
                const handleDragStart = (e) => {
                    isDragging = true;
                    updateProgressFromEvent(e);
                };
                
                const handleDragMove = (e) => {
                    if (!isDragging) return;
                    e.preventDefault(); // 防止触摸滚动
                    updateProgressFromEvent(e);
                };
                
                const handleDragEnd = () => {
                    isDragging = false;
                };
                
                const updateProgressFromEvent = (e) => {
                    if (!isFinite(audio.duration) || isNaN(audio.duration) || audio.duration <= 0) return;
                    
                    const progressWidth = progressBar.clientWidth;
                    const rect = progressBar.getBoundingClientRect();
                    
                    // 获取X坐标 (兼容鼠标和触摸)
                    let clientX;
                    if (e.type.startsWith('touch')) {
                        clientX = e.touches[0].clientX;
                    } else {
                        clientX = e.clientX;
                    }
                    
                    let clickX = clientX - rect.left;
                    
                    // 限制范围
                    clickX = Math.max(0, Math.min(clickX, progressWidth));
                    
                    const duration = audio.duration;
                    const newTime = (clickX / progressWidth) * duration;
                    
                    audio.currentTime = newTime;
                    
                    // 实时更新UI
                    const progressPercent = (newTime / duration) * 100;
                    progress.style.width = progressPercent + '%';
                    currentTimeEl.textContent = formatTime(newTime);
                };
                
                // 鼠标事件
                progressBar.addEventListener('mousedown', handleDragStart);
                document.addEventListener('mousemove', handleDragMove);
                document.addEventListener('mouseup', handleDragEnd);
                
                // 触摸事件
                progressBar.addEventListener('touchstart', handleDragStart, { passive: false });
                document.addEventListener('touchmove', handleDragMove, { passive: false });
                document.addEventListener('touchend', handleDragEnd);
                
                // 鼠标离开窗口
                document.addEventListener('mouseleave', handleDragEnd);
            });
        }

        // 初始化
        document.addEventListener('DOMContentLoaded', async function() {
            // 加载聊天记录
            loadChatHistory();
            
            // 初始化聊天视频，转换为Blob URL
            initChatVideos();
            
            // 初始化所有媒体
            await initChatMedia();
            
            // 如果是群聊，检查是否被封禁
            if (MOBILE_CHAT_CONFIG.chatType === 'group' && MOBILE_CHAT_CONFIG.selectedId) {
                checkGroupBanStatus(MOBILE_CHAT_CONFIG.selectedId);
            }
            
            // 为搜索按钮添加点击事件
            const searchButton = document.getElementById('search-user-button');
            if (searchButton) {
                searchButton.addEventListener('click', searchUser);
            }
            
            // 为搜索输入框添加回车键事件
            const searchInput = document.getElementById('search-user-input');
            if (searchInput) {
                searchInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        searchUser();
                    }
                });
            }
        });
        
        // 文件类型检测函数
        function getFileType(fileName) {
            const ext = fileName.toLowerCase().split('.').pop();
            const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
            const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
            const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'wma', 'm4a'];
            
            if (imageExts.includes(ext)) {
                return 'image';
            } else if (videoExts.includes(ext)) {
                return 'video';
            } else if (audioExts.includes(ext)) {
                return 'audio';
            } else {
                return 'file';
            }
        }
        
        // 文件请求重试计数器
        const fileRetryCounter = {};
        const MAX_RETRIES = 5;

        // 缓存控制标志 - 确保同一时间只有一个缓存进程在运行
        let isCaching = false;







        // 格式化文件大小
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        // 格式化下载速度
        function formatSpeed(kbPerSecond) {
            if (kbPerSecond === 0) return '0 KB/s';
            if (kbPerSecond >= 1024) return (kbPerSecond / 1024).toFixed(2) + ' MB/s';
            return kbPerSecond.toFixed(0) + ' KB/s';
        }

        // 下载面板控制功能
        function toggleDownloadPanel() {
            const panel = document.getElementById('download-panel');
            panel.classList.toggle('visible');
            downloadPanelVisible = panel.classList.contains('visible');
        }

        // 更新下载面板
        function updateDownloadPanel() {
            const tasksList = document.getElementById('download-tasks-list');
            
            if (downloadTasks.length === 0) {
                tasksList.innerHTML = '<div style="padding: 10px; text-align: center; color: #666;">暂无下载任务</div>';
                return;
            }

            let html = '';
            for (const task of downloadTasks) {
                // 根据文件类型选择图标
                let fileIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
                if (task.fileType === 'image') fileIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
                else if (task.fileType === 'audio') fileIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                else if (task.fileType === 'video') fileIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

                // 状态文本
                let statusText = '';
                switch (task.status) {
                    case DownloadStatus.PENDING: statusText = '等待下载'; break;
                    case DownloadStatus.DOWNLOADING: statusText = '下载中'; break;
                    case DownloadStatus.PAUSED: statusText = '已暂停'; break;
                    case DownloadStatus.COMPLETED: statusText = '已完成'; break;
                    case DownloadStatus.FAILED: statusText = '下载失败'; break;
                    case DownloadStatus.CANCELED: statusText = '已取消'; break;
                }

                html += `
                    <div class="download-task" data-task-id="${task.id}">
                        <div class="download-task-header">
                            <div class="download-file-icon">${fileIcon}</div>
                            <div class="download-file-info">
                                <div class="download-file-name">${task.fileName}</div>
                                <div class="download-file-meta">${statusText}</div>
                            </div>
                        </div>
                        <div class="download-progress-container">
                            <div class="download-progress-bar" style="width: ${task.progress}%"></div>
                        </div>
                        <div class="download-progress-info">
                            <span>${formatFileSize(task.downloadedSize)} / ${formatFileSize(task.fileSize)}</span>
                            <span>${formatSpeed(task.speed)}</span>
                        </div>
                        <div class="download-controls">
                            ${task.status === DownloadStatus.DOWNLOADING ? `
                                <button class="download-control-btn" onclick="pauseDownload('${task.id}')">暂停</button>
                            ` : ''}
                            ${(task.status === DownloadStatus.PENDING || task.status === DownloadStatus.PAUSED || task.status === DownloadStatus.FAILED) ? `
                                <button class="download-control-btn primary" onclick="startDownload('${task.id}')">开始</button>
                            ` : ''}
                            ${task.status === DownloadStatus.COMPLETED ? `
                                <button class="download-control-btn primary" onclick="openDownloadedFile('${task.id}')">打开</button>
                            ` : ''}
                            <button class="download-control-btn danger" onclick="deleteDownloadTask('${task.id}')">删除</button>
                        </div>
                    </div>
                `;
            }

            tasksList.innerHTML = html;
        }

        // 开始下载
        function startDownload(taskId) {
            const task = downloadTasks.find(t => t.id === taskId);
            if (!task) return;

            // 更新任务状态为下载中
            updateDownloadStatus(taskId, DownloadStatus.DOWNLOADING);
            
            // 如果是第一次下载，确保chunks数组初始化
            if (!task.chunks) {
                task.chunks = [];
            }
            
            console.log(`开始下载: ${task.fileName}，已下载${task.downloadedSize}字节`);
            
            // 开始下载
            downloadFile(task);
        }

        // 暂停下载
        function pauseDownload(taskId) {
            const task = downloadTasks.find(t => t.id === taskId);
            if (!task) return;
            
            // 取消当前的fetch请求
            if (task.abortController) {
                task.abortController.abort();
                task.abortController = null;
            }
            
            updateDownloadStatus(taskId, DownloadStatus.PAUSED);
        }

        // 打开已下载文件
        function openDownloadedFile(taskId) {
            const task = downloadTasks.find(t => t.id === taskId);
            if (!task) return;

            // 这里可以添加打开文件的逻辑，比如使用window.open或创建a标签下载
            window.open(task.filePath, '_blank');
        }
        
        // 将DataURL转换为Blob对象
        function dataURLToBlob(dataURL) {
            const parts = dataURL.split(';base64,');
            const contentType = parts[0].split(':')[1];
            const raw = window.atob(parts[1]);
            const rawLength = raw.length;
            const uInt8Array = new Uint8Array(rawLength);
            
            for (let i = 0; i < rawLength; ++i) {
                uInt8Array[i] = raw.charCodeAt(i);
            }
            
            return new Blob([uInt8Array], { type: contentType });
        }
        
        // 下载Blob对象
        function downloadBlob(blob, fileName) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }

        // 主下载函数
        async function downloadFile(task) {
            // 检查任务状态，如果不是下载中，直接返回
            if (task.status !== DownloadStatus.DOWNLOADING) {
                return;
            }
            
            try {
                // 检查是否是localStorage文件，支持多种前缀
                if (task.filePath && (task.filePath.startsWith('Picture_') || task.filePath.startsWith('Video_') || task.filePath.startsWith('Audio_') || task.filePath.startsWith('File_'))) {
                    // 从localStorage获取文件数据
                    const fileData = localStorage.getItem(task.filePath);
                    if (fileData) {
                        const fileInfo = JSON.parse(fileData);
                        // 创建Blob对象
                        const blob = dataURLToBlob(fileInfo.data);
                        
                        // 更新任务状态为已完成
                        updateDownloadStatus(task.id, DownloadStatus.COMPLETED);
                        updateDownloadProgress(task.id, blob.size, blob.size);
                        
                        // 触发文件下载
                        downloadBlob(blob, task.fileName);
                        
                        // 更新下载面板
                        updateDownloadPanel();
                        return;
                    }
                }
                
                // 对于服务器文件，使用 FileHelper 构建安全 URL
                let downloadUrl = (typeof FileHelper !== 'undefined')
                    ? FileHelper.getFileUrl(task.filePath)
                    : task.filePath;
                
                // 创建AbortController用于取消请求
                task.abortController = new AbortController();
                
                // 设置请求选项，支持断点续传
                const fetchOptions = {
                    mode: 'cors',
                    signal: task.abortController.signal
                };
                
                // 只有非音乐文件才使用credentials
                if (task.fileType !== 'audio') {
                    fetchOptions.credentials = 'include';
                }
                
                // 设置请求头
                const headers = {};
                // 如果已经有部分下载，设置Range头
                if (task.downloadedSize > 0) {
                    headers.Range = `bytes=${task.downloadedSize}-`;
                    console.log(`继续下载: ${task.fileName}，从${task.downloadedSize}字节开始`);
                }
                
                // 添加headers到fetchOptions
                fetchOptions.headers = headers;
                
                // 尝试从服务器下载
                const response = await fetch(downloadUrl, fetchOptions);

                if (response.ok || response.status === 206) { // 206是部分内容
                    // 服务器返回成功，开始下载
                    const isPartial = response.status === 206;
                    const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
                    const contentLength = isPartial ? totalSize + task.downloadedSize : totalSize;
                    
                    // 如果是第一次下载，设置总大小
                    if (!isPartial) {
                        task.fileSize = contentLength;
                        // 重置chunks数组，确保只包含本次下载的内容
                        task.chunks = [];
                    }
                    
                    const reader = response.body.getReader();
                    let receivedLength = task.downloadedSize;
                    
                    // 下载循环
                    while (true) {
                        // 检查任务状态，如果已暂停，退出循环
                        if (task.status !== DownloadStatus.DOWNLOADING) {
                            console.log(`下载已暂停: ${task.fileName}`);
                            break;
                        }
                        
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        // 将下载的chunk添加到任务的chunks数组
                        task.chunks.push(value);
                        receivedLength += value.length;
                        
                        // 更新下载进度
                        updateDownloadProgress(task.id, receivedLength, contentLength);
                    }
                    
                    // 检查是否完成下载
                    if (receivedLength >= contentLength) {
                        console.log(`下载完成: ${task.fileName}`);
                        // 合并所有chunk
                        const blob = new Blob(task.chunks);
                        
                        // 保存文件到浏览器
                        saveFileToBrowser(blob, task.fileName);
                        
                        // 更新任务状态
                        updateDownloadStatus(task.id, DownloadStatus.COMPLETED);
                        
                        // 清理资源
                        task.abortController = null;
                        task.chunks = [];
                    } else {
                        console.log(`下载暂停: ${task.fileName}，已下载${receivedLength}/${contentLength}字节`);
                        // 下载暂停，保留已下载的chunks
                        task.abortController = null;
                    }
                } else if (response.status === 404) {
                    // 服务器返回404，尝试从缓存获取
                    console.log('服务器返回404，尝试从缓存获取文件');
                    
                    // 尝试使用缓存获取文件
                    const cachedResponse = await fetch(task.filePath, {
                        credentials: 'include',
                        cache: 'force-cache',
                        signal: task.abortController.signal
                    });
                    
                    if (cachedResponse.ok) {
                        const blob = await cachedResponse.blob();
                        saveFileToBrowser(blob, task.fileName);
                        updateDownloadStatus(task.id, DownloadStatus.COMPLETED);
                    } else {
                        // 缓存也没有，下载失败
                        updateDownloadStatus(task.id, DownloadStatus.FAILED);
                    }
                    
                    // 清理资源
                    task.abortController = null;
                    task.chunks = [];
                } else {
                    // 其他错误
                    console.error(`下载错误: ${response.status} ${response.statusText}`);
                    updateDownloadStatus(task.id, DownloadStatus.FAILED);
                    
                    // 清理资源
                    task.abortController = null;
                    task.chunks = [];
                }
            } catch (error) {
                console.error('下载错误:', error);
                // 如果是abort错误，不更新状态为失败，保持暂停状态
                if (error.name === 'AbortError') {
                    console.log(`下载已取消: ${task.fileName}`);
                    // 保持暂停状态
                    updateDownloadStatus(task.id, DownloadStatus.PAUSED);
                } else {
                    updateDownloadStatus(task.id, DownloadStatus.FAILED);
                    // 清理资源
                    task.chunks = [];
                }
                
                // 清理资源
                task.abortController = null;
            }
        }

        // 保存文件到浏览器
        function saveFileToBrowser(blob, fileName) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }

        // 切换媒体操作菜单显示
        function toggleMediaActionsMenu(event, button) {
            event.stopPropagation();
            
            // 关闭所有其他菜单
            document.querySelectorAll('.file-actions-menu').forEach(menu => {
                menu.style.display = 'none';
            });

            // 显示当前菜单
            const menu = button.nextElementSibling;
            if (menu) {
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            }

            // 点击其他地方关闭菜单
            document.addEventListener('click', function closeMenu(e) {
                if (!button.contains(e.target) && !menu.contains(e.target)) {
                    menu.style.display = 'none';
                    document.removeEventListener('click', closeMenu);
                }
            });
        }

        // 切换群聊菜单显示
        function toggleGroupMenu(event, groupId) {
            event.stopPropagation();
            
            // 关闭所有其他菜单
            document.querySelectorAll('.friend-menu, [id^="group-menu-"]').forEach(menu => {
                if (menu.id !== `group-menu-${groupId}`) {
                    menu.style.display = 'none';
                }
            });
            
            // 切换当前菜单
            const menu = document.getElementById(`group-menu-${groupId}`);
            if (menu) {
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            }
            
            // 点击其他地方关闭菜单
            document.addEventListener('click', function closeMenu(e) {
                if (!e.target.closest('[id="group-menu-' + groupId + '"]') && !e.target.closest(`[onclick*="toggleGroupMenu"]`)) {
                    const menu = document.getElementById(`group-menu-${groupId}`);
                    if (menu) {
                        menu.style.display = 'none';
                    }
                    document.removeEventListener('click', closeMenu);
                }
            });
        }

        // 添加好友窗口功能
        function showAddFriendWindow() {
            const modal = document.getElementById('add-friend-modal');
            modal.style.display = 'flex';
            
            // 加载好友申请列表
            loadFriendRequests();
        }

        function closeAddFriendWindow() {
            const modal = document.getElementById('add-friend-modal');
            modal.style.display = 'none';
        }

        // 切换添加好友窗口选项卡
        function switchAddFriendTab(tabName) {
            // 切换选项卡样式
            document.querySelectorAll('.add-friend-tab').forEach(tab => {
                tab.classList.remove('active');
                tab.style.color = '#666';
                tab.style.borderBottom = '1px solid #eaeaea';
            });
            
            document.getElementById(tabName + '-tab').classList.add('active');
            document.getElementById(tabName + '-tab').style.color = '#12b7f5';
            document.getElementById(tabName + '-tab').style.borderBottom = '2px solid #12b7f5';
            
            // 切换内容显示
            document.querySelectorAll('.add-friend-content').forEach(content => {
                content.style.display = 'none';
            });
            
            document.getElementById(tabName + '-content').style.display = 'block';
            
            // 根据选项卡类型加载对应的数据
            if (tabName === 'requests') {
                loadFriendRequests();
            }
        }

        // 搜索用户功能（添加好友弹窗）
        function searchUser() {
            const searchInput = document.getElementById('search-user-input');
            const searchTerm = searchInput.value.trim();
            const resultsDiv = document.getElementById('search-results');
            
            if (!searchTerm) {
                resultsDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">请输入用户名或邮箱进行搜索</p>';
                return;
            }
            
            resultsDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">搜索中...</p>';
            
            // 发送搜索请求到服务器
            fetch(`/src/user/search_users.php?q=${encodeURIComponent(searchTerm)}`, {
                credentials: 'include'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('网络请求失败');
                }
                return response.json();
            })
            .then(data => {
                let html = '';
                
                try {
                    // 处理用户列表
                    let users = [];
                    if (data && data.success) {
                        if (data.users) {
                            if (Array.isArray(data.users)) {
                                users = data.users;
                            } else if (typeof data.users === 'object') {
                                users = Object.values(data.users);
                            }
                        }
                    }

                    if (users.length > 0) {
                        users.forEach(user => {
                            // 安全获取属性
                            const userId = user.id || 0;
                            const userName = user.username || '未知用户';
                            const userEmail = user.email || '';
                            const safeUserName = userName.replace(/'/g, "\\'");
                            
                            html += `<div style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #f0f0f0;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; margin-bottom: 2px;">${userName}</div>
                                    <div style="font-size: 12px; color: #666;">${userEmail}</div>
                                </div>
                                <div style="position: relative;" class="search-user-action">
                                    <button onclick="toggleSearchUserMenu(event, ${userId})" style="background: none; border: none; cursor: pointer; color: #666; font-size: 20px; padding: 0 10px;">⋮</button>
                                    <div id="search-user-menu-${userId}" class="search-user-menu" style="display: none; position: absolute; right: 0; top: 100%; background: white; border: 1px solid #eee; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 10; min-width: 100px;">
                                        <button onclick="sendFriendRequest(${userId}, '${safeUserName}')" style="display: block; width: 100%; text-align: left; padding: 8px 12px; background: none; border: none; cursor: pointer; color: #333; font-size: 13px;">添加好友</button>
                                    </div>
                                </div>
                            </div>`;
                        });
                    } else {
                        html = '<p style="text-align: center; color: #666; padding: 20px;">未找到匹配的用户</p>';
                    }
                } catch (e) {
                    console.error('Mobile search render error:', e);
                    html = '<p style="text-align: center; color: #ff4d4f; padding: 20px;">渲染错误</p>';
                }
                
                resultsDiv.innerHTML = html;
            })
            .catch(error => {
                console.error('搜索用户失败:', error);
                resultsDiv.innerHTML = '<p style="text-align: center; color: #ff4d4f; padding: 20px;">搜索失败，请重试</p>';
            });
        }
        
        // 确保 searchUser 在全局作用域可访问
        window.searchUser = searchUser;
        
        // 切换搜索用户菜单显示
        window.toggleSearchUserMenu = function toggleSearchUserMenu(event, userId) {
            event.stopPropagation();
            
            // 关闭所有其他菜单
            document.querySelectorAll('.search-user-menu').forEach(menu => {
                menu.style.display = 'none';
            });
            
            // 切换当前菜单
            const menu = document.getElementById(`search-user-menu-${userId}`);
            if (menu) {
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            }
        }
        
        // 点击其他地方关闭搜索用户菜单
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.search-user-action')) {
                document.querySelectorAll('.search-user-menu').forEach(menu => {
                    menu.style.display = 'none';
                });
            }
        });

        // 滚动相关功能
        function initScrollFunctions() {
            const messagesContainer = document.getElementById('messages-container');
            const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
            
            if (!messagesContainer || !scrollToBottomBtn) return;
            
            // 更新按钮显示状态
            function updateScrollButton() {
                if (!messagesContainer || !scrollToBottomBtn) return;
                
                // 计算是否需要显示按钮：当滚动位置距离底部超过50px时显示
                const isAtBottom = messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 50;
                
                if (isAtBottom) {
                    scrollToBottomBtn.classList.remove('show');
                } else {
                    scrollToBottomBtn.classList.add('show');
                }
            }
            
            // 监听滚动事件，使用passive提高性能
            messagesContainer.addEventListener('scroll', updateScrollButton, { passive: true });
            
            // 页面加载时初始化状态
            updateScrollButton();
        }
        
        // 滚动到底部
        function scrollToBottom() {
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
                messagesContainer.scrollTo({
                    top: messagesContainer.scrollHeight,
                    behavior: 'smooth'
                });
            }
        }
        
        // 主界面搜索好友和群聊功能
        document.addEventListener('DOMContentLoaded', function() {
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.addEventListener('input', function(e) {
                    const searchTerm = e.target.value.trim().toLowerCase();
                    const searchResults = document.getElementById('main-search-results');
                    const chatList = document.getElementById('combined-chat-list');
                    
                    // 重置所有聊天项显示
                    const allChatItems = document.querySelectorAll('.chat-item');
                    
                    if (searchTerm.length < 1) {
                        searchResults.style.display = 'none';
                        allChatItems.forEach(item => item.style.display = 'flex');
                        return;
                    }
                    
                    // 本地搜索：过滤聊天列表
                    allChatItems.forEach(item => {
                        const nameElement = item.querySelector('.chat-name');
                        const name = nameElement ? nameElement.textContent.trim().toLowerCase() : '';
                        
                        if (name.includes(searchTerm)) {
                            item.style.display = 'flex';
                        } else {
                            item.style.display = 'none';
                        }
                    });
                    
                    // 隐藏原来的下拉搜索结果，因为现在直接在列表中过滤
                    if (searchResults) {
                        searchResults.style.display = 'none';
                    }
                });
            }
        });
        
        // 切换到指定聊天
        function switchToChat(chatType, chatId) {
            window.location.href = `?chat_type=${chatType}&id=${chatId}`;
        }

        // 发送好友请求
        window.sendFriendRequest = function sendFriendRequest(userId, username) {
            // 发送请求到服务器
            fetch(`/src/friends/send_friend_request.php?friend_id=${userId}`, {
                method: 'POST',
                credentials: 'include'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(`已向 ${username} 发送好友请求`, 'success');
                } else {
                    showNotification(`发送好友请求失败: ${data.message}`, 'error');
                }
            })
            .catch(error => {
                console.error('发送好友请求失败:', error);
                showNotification('发送好友请求失败，请重试', 'error');
            });
        }

        // 加载好友申请列表
        function loadFriendRequests() {
            console.log('开始加载申请列表');
            try {
                let requestsList;
                
                // 查找所有friend-requests-list元素
                const allRequestLists = document.querySelectorAll('#friend-requests-list');
                
                // 检查哪个弹窗是可见的，选择正确的元素
                if (allRequestLists.length > 0) {
                    // 先检查add-friend-modal中的好友申请列表（最常用的）
                    const addFriendModal = document.getElementById('add-friend-modal');
                    const friendRequestsModal = document.getElementById('friend-requests-modal');
                    
                    if (addFriendModal && addFriendModal.style.display !== 'none') {
                        // add-friend-modal可见，使用第三个元素（索引2）
                        requestsList = allRequestLists[2];
                    } else if (friendRequestsModal && friendRequestsModal.style.display !== 'none') {
                        // friend-requests-modal可见，使用第一个元素（索引0）
                        requestsList = allRequestLists[0];
                    } else {
                        // 默认使用第一个元素
                        requestsList = allRequestLists[0];
                    }
                } else {
                    console.error('申请列表元素不存在');
                    return;
                }
                
                // 检查DOM元素是否存在
                if (!requestsList) {
                    console.error('申请列表元素不存在');
                    return;
                }
                
                requestsList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">加载中...</p>';
                
                // 从服务器获取好友申请列表
                console.log('发送请求到/src/friends/get_friend_requests.php');
                fetch('/src/friends/get_friend_requests.php', {
                    credentials: 'include'
                })
                .then(response => {
                    console.log('收到响应:', response.status, response.statusText);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('响应数据:', data);
                    // 检查数据格式是否正确
                    if (!data || typeof data !== 'object') {
                        throw new Error('无效的响应数据格式');
                    }
                    
                    let html = '';
                    if (data.success && Array.isArray(data.requests) && data.requests.length > 0) {
                        console.log('申请列表:', data.requests);
                        data.requests.forEach(request => {
                            // 格式化时间
                            const formattedTime = request.created_at ? new Date(request.created_at).toLocaleString('zh-CN', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit'}) : '';
                            
                            if (request.type === 'friend') {
                                // 好友请求
                                const avatar = request.avatar ? `<img src="${request.avatar}" alt="${request.username}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : `<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 14px;">${request.username.substring(0, 2)}</div>`;
                                
                                html += `<div style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #f0f0f0;">
                                    <div style="margin-right: 12px;">${avatar}</div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; margin-bottom: 2px;">${request.username}</div>
                                        <div style="font-size: 12px; color: #666;">${request.email}</div>
                                        <div style="font-size: 11px; color: #999; margin-top: 2px;">${formattedTime}</div>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button onclick="acceptFriendRequest(${request.request_id}, ${request.id}, '${request.username}')" style="padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">接受</button>
                                        <button onclick="rejectFriendRequest(${request.request_id}, '${request.username}')" style="padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">拒绝</button>
                                    </div>
                                </div>`;
                            } else if (request.type === 'group') {
                                // 群聊邀请
                                // 群聊头像（使用默认头像，因为群聊没有实际头像字段）
                                const groupAvatar = `<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 14px;">${request.group_name.substring(0, 2)}</div>`;
                                
                                html += `<div style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #f0f0f0;">
                                    <div style="margin-right: 12px;">${groupAvatar}</div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; margin-bottom: 2px;">${request.group_name}</div>
                                        <div style="font-size: 12px; color: #666;">${request.inviter_name} 邀请您加入群聊</div>
                                        <div style="font-size: 11px; color: #999; margin-top: 2px;">${formattedTime}</div>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button onclick="acceptGroupInvitation(${request.id})" style="padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">接受</button>
                                        <button onclick="rejectGroupInvitation(${request.id})" style="padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">拒绝</button>
                                    </div>
                                </div>`;
                            }
                        });
                    } else {
                        console.log('暂无申请或请求失败:', data);
                        if (data.success === false) {
                            html = `<p style="text-align: center; color: #ff4d4f; padding: 20px;">${data.message || '获取申请失败'}</p>`;
                        } else {
                            html = '<p style="text-align: center; color: #666; padding: 20px;">暂无申请</p>';
                        }
                    }
                    
                    requestsList.innerHTML = html;
                })
                .catch(error => {
                    console.error('获取申请列表失败:', error);
                    requestsList.innerHTML = `<p style="text-align: center; color: #ff4d4f; padding: 20px;">获取申请失败: ${error.message}</p>`;
                });
            } catch (error) {
                console.error('加载申请列表时发生错误:', error);
                // 错误处理时也需要选择正确的元素
                const allRequestLists = document.querySelectorAll('#friend-requests-list');
                let requestsList;
                if (allRequestLists.length > 0) {
                    // 检查哪个弹窗是可见的
                    const addFriendModal = document.getElementById('add-friend-modal');
                    const friendRequestsModal = document.getElementById('friend-requests-modal');
                    
                    if (addFriendModal && addFriendModal.style.display !== 'none') {
                        requestsList = allRequestLists[2];
                    } else if (friendRequestsModal && friendRequestsModal.style.display !== 'none') {
                        requestsList = allRequestLists[0];
                    } else {
                        requestsList = allRequestLists[allRequestLists.length - 1]; // 默认为最后一个
                    }
                    
                    if (requestsList) {
                        requestsList.innerHTML = `<p style="text-align: center; color: #ff4d4f; padding: 20px;">加载失败: ${error.message}</p>`;
                    }
                }
            }
        }

        // 接受好友请求
        function acceptFriendRequest(requestId, userId, username) {
            console.log('Accepting request:', requestId, userId, username); // Debug log
            
            // 发送接受好友请求到服务器
            const formData = new FormData();
            formData.append('request_id', requestId);
            
            fetch(`/src/friends/accept_request.php?request_id=${requestId}`, {
                credentials: 'include',
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(`已接受 ${username} 的好友请求`, 'success');
                    // 重新加载好友申请列表
                    loadFriendRequests();
                    // 重新加载好友列表
                    loadFriendsList();
                } else {
                    showNotification(`接受好友请求失败: ${data.message}`, 'error');
                }
            })
            .catch(error => {
                console.error('接受好友请求失败:', error);
                showNotification('接受好友请求失败', 'error');
            });
        }

        // 拒绝好友请求
        function rejectFriendRequest(requestId, username) {
            // 发送拒绝好友请求到服务器
            const formData = new FormData();
            formData.append('request_id', requestId);
            
            fetch(`/src/friends/reject_request.php?request_id=${requestId}`, {
                credentials: 'include',
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(`已拒绝 ${username} 的好友请求`, 'success');
                    // 重新加载好友申请列表
                    loadFriendRequests();
                } else {
                    showNotification(`拒绝好友请求失败: ${data.message}`, 'error');
                }
            })
            .catch(error => {
                console.error('拒绝好友请求失败:', error);
                showNotification('拒绝好友请求失败', 'error');
            });
        }
        
        // 加载好友列表
        function loadFriendsList() {
            // 重新加载页面以更新好友列表
            window.location.reload();
        }
        
        // 加载好友列表用于创建群聊
        function loadFriendsForGroup() {
            const friendsContainer = document.getElementById('select-friends-container');
            
            friendsContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">加载中...</p>';
            
            // 从服务器获取好友列表
            fetch('/src/friends/get_available_friends.php', {
                credentials: 'include'
            })
            .then(response => response.json())
            .then(data => {
                let html = '';
                if (data.success && data.friends.length > 0) {
                    // 添加清空和创建按钮的容器
                    html += `<div style="display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 15px;">
                        <button onclick="clearSelectedFriends()" style="
                            padding: 8px 16px;
                            background: #f5f5f5;
                            color: #333;
                            border: 1px solid #ddd;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            transition: all 0.2s;
                        ">清空</button>
                        <button onclick="createGroup()" style="
                            padding: 8px 20px;
                            background: #12b7f5;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                            transition: all 0.2s;
                        ">创建</button>
                    </div>`;
                    
                    // 生成好友选择列表
                    html += `<div style="display: grid; gap: 10px;">`;
                    data.friends.forEach(friend => {
                        // 生成头像HTML
                        const avatar = friend.avatar ? 
                            `<img src="${friend.avatar}" alt="${friend.username}" style="
                                width: 48px;
                                height: 48px;
                                border-radius: 50%;
                                object-fit: cover;
                                border: 2px solid #eaeaea;
                                transition: all 0.2s;
                            ">` : 
                            `<div style="
                                width: 48px;
                                height: 48px;
                                border-radius: 50%;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                color: white;
                                font-weight: 600;
                                font-size: 18px;
                                border: 2px solid #eaeaea;
                                transition: all 0.2s;
                            ">${friend.username.substring(0, 2)}</div>`;
                        
                        // 生成好友项HTML
                        html += `<div class="friend-select-item" id="friend-item-${friend.id}" style="
                            display: flex;
                            align-items: center;
                            padding: 12px;
                            background: white;
                            border: 2px solid #f0f0f0;
                            border-radius: 12px;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                        " onmouseenter="this.style.borderColor='#12b7f5'; this.style.boxShadow='0 4px 12px rgba(18, 183, 245, 0.15)';" 
                           onmouseleave="if(!this.querySelector('input').checked) { this.style.borderColor='#f0f0f0'; this.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.05)'; this.style.background='white'; }" 
                           onclick="toggleFriendSelection(${friend.id})">
                            
                            <!-- 好友头像 -->
                            <div style="flex-shrink: 0;">${avatar}</div>
                            
                            <!-- 好友名称 -->
                            <div style="flex: 1; margin-left: 15px; font-weight: 500; color: #333; font-size: 15px;">
                                ${friend.username}
                            </div>
                            
                            <!-- 美化的选择按钮 -->
                            <div style="flex-shrink: 0;">
                                <label class="custom-checkbox" style="
                                    position: relative;
                                    display: inline-block;
                                    width: 24px;
                                    height: 24px;
                                    cursor: pointer;
                                ">
                                    <input type="checkbox" id="friend-${friend.id}" value="${friend.id}" style="
                                        opacity: 0;
                                        width: 0;
                                        height: 0;
                                    ">
                                    <span style="
                                        position: absolute;
                                        top: 0;
                                        left: 0;
                                        width: 24px;
                                        height: 24px;
                                        background-color: #f5f5f5;
                                        border: 2px solid #ddd;
                                        border-radius: 6px;
                                        transition: all 0.2s ease;
                                    "></span>
                                    <span style="
                                        position: absolute;
                                        top: 4px;
                                        left: 4px;
                                        width: 16px;
                                        height: 16px;
                                        background: white;
                                        border-radius: 3px;
                                        opacity: 0;
                                        transition: all 0.2s ease;
                                        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='white'%3e%3cpath fill-rule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clip-rule='evenodd'/%3e%3c/svg%3e");
                                        background-repeat: no-repeat;
                                        background-position: center;
                                        background-size: 12px;
                                    "></span>
                                </label>
                            </div>
                        </div>`;
                    });
                    html += `</div>`;
                    
                    // 添加样式
                    html += `<style>
                        /* 美化复选框选中状态 */
                        .custom-checkbox input:checked + span {
                            background-color: #12b7f5;
                            border-color: #12b7f5;
                        }
                        
                        .custom-checkbox input:checked + span + span {
                            opacity: 1;
                        }
                        
                        /* 选中好友项的样式 */
                        .friend-select-item input:checked + span {
                            background-color: #12b7f5;
                            border-color: #12b7f5;
                        }
                        
                        .friend-select-item input:checked + span + span {
                            opacity: 1;
                        }
                        
                        /* 按钮悬停效果 */
                        button:hover {
                            opacity: 0.9;
                            transform: translateY(-1px);
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                        }
                        
                        button:active {
                            transform: translateY(0);
                        }
                    </style>`;
                } else {
                    html = `<div style="text-align: center; color: #6c757d; padding: 40px 20px; background: white; border-radius: 12px; margin: 0;">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" style="margin-bottom: 15px;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                        <p style="font-size: 16px; margin: 0;">暂无好友</p>
                        <p style="font-size: 14px; margin-top: 8px; color: #999;">添加好友后即可创建群聊</p>
                    </div>`;
                }
                
                friendsContainer.innerHTML = html;
            })
            .catch(error => {
                console.error('获取好友列表失败:', error);
                friendsContainer.innerHTML = `<div style="text-align: center; color: #ff6b6b; padding: 40px 20px; background: white; border-radius: 12px; margin: 0;">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="#f44336" style="margin-bottom: 15px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    <p style="font-size: 16px; margin: 0;">加载失败</p>
                    <p style="font-size: 14px; margin-top: 8px; color: #999;">请检查网络连接后重试</p>
                    <button onclick="loadFriendsForGroup()" style="
                        margin-top: 15px;
                        padding: 8px 20px;
                        background: #12b7f5;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s;
                    ">重试</button>
                </div>`;
            });
        }
        
        // 切换好友选择状态
        function toggleFriendSelection(friendId) {
            const checkbox = document.getElementById(`friend-${friendId}`);
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
            }
        }
        
        // 清空选中的好友
        function clearSelectedFriends() {
            document.querySelectorAll('#select-friends-container input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        
        // 添加好友选择项的样式和交互
        function addFriendSelectStyles() {
            // 添加自定义复选框选中效果
            document.querySelectorAll('.friend-select-item input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    const item = this.closest('.friend-select-item');
                    const checkboxBg = this.nextElementSibling;
                    const checkboxCheck = checkboxBg.nextElementSibling;
                    const avatar = item.querySelector('.friend-avatar');
                    
                    if (this.checked) {
                        // 选中状态
                        item.style.background = '#e3f2fd';
                        item.style.borderColor = '#667eea';
                        checkboxBg.style.background = '#667eea';
                        checkboxBg.style.borderColor = '#667eea';
                        checkboxCheck.style.opacity = '1';
                        checkboxCheck.style.color = 'white';
                        avatar.style.borderColor = '#667eea';
                    } else {
                        // 未选中状态
                        item.style.background = '#f8f9fa';
                        item.style.borderColor = 'transparent';
                        checkboxBg.style.background = '#e9ecef';
                        checkboxBg.style.borderColor = '#dee2e6';
                        checkboxCheck.style.opacity = '0';
                        avatar.style.borderColor = 'transparent';
                    }
                });
                
                // 点击好友项时切换复选框状态
                checkbox.closest('.friend-select-item').addEventListener('click', function(e) {
                    if (!e.target.closest('input[type="checkbox"]')) {
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change'));
                    }
                });
            });
            
            // 添加悬停效果
            document.querySelectorAll('.friend-select-item').forEach(item => {
                item.addEventListener('mouseenter', function() {
                    if (!this.querySelector('input[type="checkbox"]').checked) {
                        this.style.background = '#e9ecef';
                        this.style.transform = 'translateY(-1px)';
                        this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                    }
                });
                
                item.addEventListener('mouseleave', function() {
                    if (!this.querySelector('input[type="checkbox"]').checked) {
                        this.style.background = '#f8f9fa';
                        this.style.transform = 'translateY(0)';
                        this.style.boxShadow = 'none';
                    }
                });
            });
        }
        
        // 切换好友选择状态
        function toggleFriendSelection(friendId) {
            const checkbox = document.getElementById(`friend-${friendId}`);
            const friendItem = checkbox.closest('div');
            if (checkbox.checked) {
                checkbox.checked = false;
                friendItem.style.borderColor = '#f0f0f0';
                friendItem.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                friendItem.style.background = 'white';
            } else {
                checkbox.checked = true;
                friendItem.style.borderColor = '#12b7f5';
                friendItem.style.boxShadow = '0 4px 12px rgba(18, 183, 245, 0.15)';
                friendItem.style.background = 'rgba(18, 183, 245, 0.05)';
            }
        }
        
        // 清空选中的好友
        function clearSelectedFriends() {
            document.querySelectorAll('#select-friends-container input[type="checkbox"]:checked').forEach(checkbox => {
                checkbox.checked = false;
                const friendItem = checkbox.closest('div');
                friendItem.style.borderColor = '#f0f0f0';
                friendItem.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                friendItem.style.background = 'white';
            });
        }
        
        // 创建群聊
        function createGroup() {
            const groupNameInput = document.getElementById('group-name');
            const groupName = groupNameInput.value.trim();
            
            // 验证群聊名称
            if (!groupName) {
                showNotification('请输入群聊名称', 'error');
                return;
            }
            
            // 验证名称不包含HTML代码
            if (/[<>]/.test(groupName)) {
                showNotification('名称不能包含HTML代码', 'error');
                return;
            }
            
            // 获取选中的好友
            const selectedFriends = [];
            document.querySelectorAll('#select-friends-container input[type="checkbox"]:checked').forEach(checkbox => {
                selectedFriends.push(parseInt(checkbox.value));
            });
            
            // 发送请求创建群聊
            fetch('/src/groups/create_group.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: groupName,
                    member_ids: selectedFriends
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification('群聊创建成功', 'success');
                    // 关闭添加好友窗口
                    closeAddFriendWindow();
                    // 刷新页面或更新群聊列表
                    window.location.reload();
                } else {
                    showNotification(data.message || '群聊创建失败', 'error');
                }
            })
            .catch(error => {
                console.error('群聊创建失败:', error);
                showNotification('群聊创建失败', 'error');
            });
        }
        
        // 接受群聊邀请
        function acceptGroupInvitation(invitationId) {
            fetch('handle_group_invitation.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    invitation_id: invitationId,
                    action: 'accept'
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification('已接受群聊邀请', 'success');
                    loadFriendRequests(); // 刷新申请列表
                } else {
                    showNotification(data.message || '接受邀请失败', 'error');
                }
            })
            .catch(error => {
                showNotification('接受邀请失败', 'error');
            });
        }

        // 拒绝群聊邀请
        function rejectGroupInvitation(invitationId) {
            fetch('handle_group_invitation.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    invitation_id: invitationId,
                    action: 'reject'
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification('已拒绝群聊邀请', 'success');
                    loadFriendRequests(); // 刷新申请列表
                } else {
                    showNotification(data.message || '拒绝邀请失败', 'error');
                }
            })
            .catch(error => {
                showNotification('拒绝邀请失败', 'error');
            });
        }
        
        // 清空群聊表单
        // 获取文件过期时间（秒）
        function getFileExpirySeconds(fileType) {
            switch(fileType) {
                case 'file':
                    return 7 * 24 * 60 * 60; // 7天
                case 'image':
                    return 30 * 24 * 60 * 60; // 30天
                case 'video':
                    return 14 * 24 * 60 * 60; // 14天
                case 'audio':
                    return 20 * 24 * 60 * 60; // 20天
                default:
                    return 7 * 24 * 60 * 60; // 默认7天
            }
        }
        
        // 检查文件是否过期
        function isFileExpired(filePath, fileType = '') {
            // 如果是localStorage文件ID，直接返回false（因为存储在localStorage中）
            if (filePath && (filePath.startsWith('Picture_') || filePath.startsWith('Video_') || filePath.startsWith('Audio_') || filePath.startsWith('File_'))) {
                return false;
            }
            
            // 从filePath中提取文件名，作为缓存的键
            const fileName = filePath.split('/').pop().split('?')[0];
            // 根据文件类型设置不同的前缀
            let prefix = 'File_';
            if (fileType === 'video') {
                prefix = 'Video_';
            } else if (fileType === 'image') {
                prefix = 'Picture_';
            } else if (fileType === 'audio') {
                prefix = 'Audio_';
            }
            
            const targetStorageKey = `${prefix}${encodeURIComponent(fileName)}`;
            
            // 检查localStorage中是否存在该文件的缓存记录
            return !localStorage.getItem(targetStorageKey);
        }
        
        // 设置文件缓存记录到localStorage
        function setFileCache(filePath, fileType, fileSize = 0) {
            // 如果是localStorage文件ID，不需要设置缓存记录
            if (filePath && (filePath.startsWith('Picture_') || filePath.startsWith('Video_') || filePath.startsWith('Audio_') || filePath.startsWith('File_'))) {
                return;
            }
            
            // 从filePath中提取文件名，作为缓存的键
            const fileName = filePath.split('/').pop().split('?')[0];
            // 根据文件类型设置不同的前缀
            let prefix = 'File_';
            if (fileType === 'video') {
                prefix = 'Video_';
            } else if (fileType === 'image') {
                prefix = 'Picture_';
            } else if (fileType === 'audio') {
                prefix = 'Audio_';
            }
            
            const storageKey = `${prefix}${encodeURIComponent(fileName)}`;
            // 存储文件类型和大小，格式为"type:size"
            localStorage.setItem(storageKey, `${fileType}:${fileSize}`);
        }
        
        // 加载聊天记录
        function loadChatHistory() {
            const messagesContainer = document.getElementById('messages-container');
            if (!messagesContainer) return;
            
            // 调用initChatMedia函数来初始化所有媒体文件，优先从IndexedDB获取
            initChatMedia();
            
            // 初始化音频播放器

            
            // 滚动到底部
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // 从服务器获取文件并缓存
        function fetchFileFromServer(filePath, fileName, fileLink) {
            // 初始化重试计数器（仅在第一次调用时）
            if (!fileRetryCounter[filePath]) {
                fileRetryCounter[filePath] = 0;
            }
            
            // 检查是否已达到最大重试次数
            if (fileRetryCounter[filePath] >= MAX_RETRIES) {
                // 达到最大重试次数，显示已清理提示
                fileLink.innerHTML = `<svg class="file-icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg><div class="file-info"><h4>文件不存在或已被清理</h4><p>${fileName}</p></div>`;
                fileLink.removeAttribute('href');
                fileLink.style.pointerEvents = 'none';
                fileLink.style.opacity = '0.6';
                // 移除重试计数器
                delete fileRetryCounter[filePath];
                return;
            }
            
            // 使用 FileHelper 构建安全 URL（通过 /src/api/api.php/file/get → 302 → list.php）
            let fetchUrl = (typeof FileHelper !== 'undefined')
                ? FileHelper.getFileUrl(filePath)
                : filePath;
            
            fetch(fetchUrl)
                .then(response => {
                    if (response.ok) {
                        // 文件存在，获取文件大小
                        const fileSize = parseInt(response.headers.get('content-length') || '0');
                        const fileType = getFileType(fileName);
                        // 只在localStorage缓存不存在时才缓存文件
                        if (isFileExpired(filePath, fileType)) {
                            setFileCache(filePath, fileType, fileSize);
                        }
                        // 重置重试计数器
                        delete fileRetryCounter[filePath];
                    } else {
                        // 文件不存在，增加重试计数器并继续重试
                        fileRetryCounter[filePath]++;
                        setTimeout(() => {
                            fetchFileFromServer(filePath, fileName, fileLink);
                        }, 1000); // 1秒后重试
                    }
                })
                .catch(error => {
                    // 网络错误，增加重试计数器并继续重试
                    fileRetryCounter[filePath]++;
                    setTimeout(() => {
                        fetchFileFromServer(filePath, fileName, fileLink);
                    }, 1000); // 1秒后重试
                });
        }
        
        // 初始化所有媒体文件（图片、音频、视频），优先从IndexedDB获取
        async function initChatMedia() {
            // 处理所有图片元素
            document.querySelectorAll('.message-image').forEach(async img => {
                const fileUrl = img.src;
                
                // 如果src已经是blob:开头，说明已经是本地Blob URL，无需再次处理
                if (fileUrl && fileUrl.startsWith('blob:')) {
                    return;
                }

                const fileName = img.getAttribute('data-file-name') || '未知图片';
                const filePath = img.getAttribute('data-file-path') || fileUrl;
                
                // 优先从IndexedDB获取图片
                try {
                    const fileData = await indexedDBManager.getFile(filePath);
                    if (fileData && fileData.data) {
                        // 从IndexedDB获取成功，转换为Blob URL
                        const blob = new Blob([fileData.data], { type: fileData.type });
                        const blobUrl = URL.createObjectURL(blob);
                        img.src = blobUrl;
                        return;
                    }
                } catch (error) {
                    // 忽略IndexedDB错误，继续尝试从服务器获取
                }
                
                // IndexedDB中没有，尝试从服务器获取，最多重试3次
                let success = false;
                for (let i = 0; i < 3 && !success; i++) {
                    try {
                        const response = await fetch(fileUrl, {
                            credentials: 'include',
                            cache: 'no-cache'
                        });
                        
                        if (response.ok) {
                            // 请求成功，获取Blob并转换为Blob URL
                            const blob = await response.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            img.src = blobUrl;
                            success = true;
                            
                            // 缓存到IndexedDB
                            try {
                                await indexedDBManager.saveFile({
                                    id: filePath,
                                    name: fileName,
                                    type: blob.type,
                                    size: blob.size,
                                    data: blob,
                                    url: fileUrl,
                                    uploadedAt: new Date().toISOString(),
                                    fileType: 'image'
                                });
                            } catch (cacheError) {
                                // 忽略缓存错误
                            }
                        } else if (response.status === 404) {
                            // 忽略404错误，不向控制台报错
                            break; // 404直接退出重试
                        }
                    } catch (error) {
                        // 忽略所有错误，不向控制台报错
                    }
                    
                    // 重试间隔1秒
                    if (!success && i < 2) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
                
                // 如果所有尝试都失败，显示"消息已被清理：{文件名}"
                if (!success) {
                    // 创建一个错误提示元素
                    const errorDiv = document.createElement('div');
                    errorDiv.style.cssText = `
                        background: #f8f9fa;
                        border: 1px solid #dee2e6;
                        border-radius: 8px;
                        padding: 20px;
                        text-align: center;
                        color: #6c757d;
                        font-size: 14px;
                    `;
                    errorDiv.textContent = `消息已被清理：${fileName}`;
                    
                    // 替换图片元素
                    if (img.parentNode) {
                        img.parentNode.replaceChild(errorDiv, img);
                    }
                }
            });
            
            // 处理所有音频元素
            document.querySelectorAll('.audio-element').forEach(async audio => {
                const fileUrl = audio.src;
                
                // 如果src已经是blob:开头，说明已经是本地Blob URL，无需再次处理
                if (fileUrl && fileUrl.startsWith('blob:')) {
                    return;
                }

                const fileName = audio.getAttribute('data-file-name') || '未知音频';
                const filePath = audio.getAttribute('data-file-path') || fileUrl;
                
                // 优先从IndexedDB获取音频
                try {
                    const fileData = await indexedDBManager.getFile(filePath);
                    if (fileData && fileData.data) {
                        // 从IndexedDB获取成功，转换为Blob URL
                        const blob = new Blob([fileData.data], { type: fileData.type });
                        const blobUrl = URL.createObjectURL(blob);
                        audio.src = blobUrl;
                        return;
                    }
                } catch (error) {
                    // 忽略IndexedDB错误，继续尝试从服务器获取
                }
                
                // IndexedDB中没有，尝试从服务器获取，最多重试3次
                let success = false;
                for (let i = 0; i < 3 && !success; i++) {
                    try {
                        const response = await fetch(fileUrl, {
                            credentials: 'include',
                            cache: 'no-cache'
                        });
                        
                        if (response.ok) {
                            // 请求成功，获取Blob并转换为Blob URL
                            const blob = await response.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            audio.src = blobUrl;
                            success = true;
                            
                            // 缓存到IndexedDB
                            try {
                                await indexedDBManager.saveFile({
                                    id: filePath,
                                    name: fileName,
                                    type: blob.type,
                                    size: blob.size,
                                    data: blob,
                                    url: fileUrl,
                                    uploadedAt: new Date().toISOString(),
                                    fileType: 'audio'
                                });
                            } catch (cacheError) {
                                // 忽略缓存错误
                            }
                        } else if (response.status === 404) {
                            // 忽略404错误，不向控制台报错
                            break; // 404直接退出重试
                        }
                    } catch (error) {
                        // 忽略所有错误，不向控制台报错
                    }
                    
                    // 重试间隔1秒
                    if (!success && i < 2) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
                
                // 如果所有尝试都失败，显示"消息已被清理：{文件名}"
                if (!success) {
                    // 创建一个错误提示元素
                    const errorDiv = document.createElement('div');
                    errorDiv.style.cssText = `
                        background: #f8f9fa;
                        border: 1px solid #dee2e6;
                        border-radius: 8px;
                        padding: 20px;
                        text-align: center;
                        color: #6c757d;
                        font-size: 14px;
                    `;
                    errorDiv.textContent = `消息已被清理：${fileName}`;
                    
                    // 查找父级播放器容器
                    const playerContainer = audio.closest('.custom-audio-player');
                    if (playerContainer && playerContainer.parentNode) {
                        // 替换整个播放器容器
                        playerContainer.parentNode.replaceChild(errorDiv, playerContainer);
                    } else if (audio.parentNode) {
                        // 如果找不到容器，仅替换音频元素
                        audio.parentNode.replaceChild(errorDiv, audio);
                    }
                }
            });
        }
        
        // 处理媒体文件加载失败
        function handleMediaLoadError(media, filePath, fileName, fileType) {
            // 初始化重试计数器（仅在第一次调用时）
            if (!fileRetryCounter[filePath]) {
                fileRetryCounter[filePath] = 0;
            }
            
            // 检查是否已达到最大重试次数
            if (fileRetryCounter[filePath] >= MAX_RETRIES) {
                // 达到最大重试次数，显示已清理提示
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = `
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    color: #6c757d;
                    font-size: 14px;
                `;
                errorDiv.textContent = `消息已被清理：${fileName}`;
                
                // 替换媒体元素
                if (media.tagName === 'AUDIO') {
                    const playerContainer = media.closest('.custom-audio-player');
                    if (playerContainer && playerContainer.parentNode) {
                        playerContainer.parentNode.replaceChild(errorDiv, playerContainer);
                    } else if (media.parentNode) {
                        media.parentNode.replaceChild(errorDiv, media);
                    }
                } else if (media.tagName === 'VIDEO') {
                    const videoContainer = media.closest('.video-container');
                    if (videoContainer && videoContainer.parentNode) {
                        videoContainer.parentNode.replaceChild(errorDiv, videoContainer);
                    } else if (media.parentNode) {
                        media.parentNode.replaceChild(errorDiv, media);
                    }
                } else if (media.parentNode) {
                    media.parentNode.replaceChild(errorDiv, media);
                }
                
                // 移除重试计数器
                delete fileRetryCounter[filePath];
                return;
            }
            
            // 增加重试计数器
            fileRetryCounter[filePath]++;
            
            // 执行获取媒体文件操作
            // 这里不再使用fetchMediaFromServer，而是直接使用新的加载逻辑
            setTimeout(() => {
                // 重新加载媒体文件
                if (media.tagName === 'IMG') {
                    media.src = media.src + '?' + new Date().getTime();
                } else if (media.tagName === 'AUDIO' || media.tagName === 'VIDEO') {
                    media.src = media.src + '?' + new Date().getTime();
                    media.load();
                }
            }, 1000); // 1秒后重试
        }
        
        // 视频播放器相关变量
        let currentVideoUrl = '';
        let currentVideoName = '';
        let currentVideoSize = 0;
        

        
        // 更多设置相关函数
        function showMoreSettings() {
            document.getElementById('more-settings-modal').style.display = 'flex';
        }

        function closeMoreSettingsModal() {
            document.getElementById('more-settings-modal').style.display = 'none';
        }

        function showChangePasswordModal() {
            document.getElementById('change-password-modal').style.display = 'flex';
        }

        function closeChangePasswordModal() {
            document.getElementById('change-password-modal').style.display = 'none';
        }

        function showChangeNameModal() {
            document.getElementById('change-name-modal').style.display = 'flex';
        }

        function closeChangeNameModal() {
            document.getElementById('change-name-modal').style.display = 'none';
        }

        function showChangeEmailModal() {
            document.getElementById('change-email-modal').style.display = 'flex';
        }

        function closeChangeEmailModal() {
            document.getElementById('change-email-modal').style.display = 'none';
        }

        // 修改密码
        function changePassword() {
            const oldPassword = document.getElementById('old-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            // 验证新密码和确认密码是否一致
            if (newPassword !== confirmPassword) {
                alert('两次输入的密码不同');
                return;
            }

            // 发送请求到服务器
            fetch('/src/auth/update_password.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    old_password: oldPassword,
                    new_password: newPassword
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('密码修改成功');
                    closeChangePasswordModal();
                } else {
                    alert(data.message || '原密码不正确');
                }
            })
            .catch(error => {
                console.error('修改密码失败:', error);
                alert('修改密码失败，请重试');
            });
        }

        // 修改名称
        function changeName() {
            const newName = document.getElementById('new-name').value.trim();
            
            // 验证名称长度
            const user_name_max = MOBILE_CHAT_CONFIG.userNameMax || 12;
            if (newName.length > user_name_max) {
                alert(`名称长度不能超过${user_name_max}个字符`);
                return;
            }
            
            // 验证名称不包含HTML代码
            if (/[<>]/.test(newName)) {
                alert('名称不能包含HTML代码');
                return;
            }

            if (!newName) {
                alert('请输入名称');
                return;
            }

            // 发送请求到服务器
            fetch('/src/user/update_name.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    new_name: newName
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('名称修改成功');
                    // 更新页面上的用户名显示
                    window.location.reload();
                    closeChangeNameModal();
                } else {
                    alert(data.message || '名称修改失败');
                }
            })
            .catch(error => {
                console.error('修改名称失败:', error);
                alert('修改名称失败，请重试');
            });
        }

        // 修改邮箱
        function changeEmail() {
            const newEmail = document.getElementById('new-email').value.trim();

            // 验证邮箱格式
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(newEmail)) {
                alert('请输入有效的邮箱格式');
                return;
            }

            // 发送请求到服务器
            fetch('/src/user/update_email.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    new_email: newEmail
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('邮箱修改成功');
                    // 更新页面上的邮箱显示
                    window.location.reload();
                    closeChangeEmailModal();
                } else {
                    alert(data.message || '邮箱修改失败');
                }
            })
            .catch(error => {
                console.error('修改邮箱失败:', error);
                alert('修改邮箱失败，请重试');
            });
        }

        // 关闭更多设置弹窗
        function closeMoreSettingsModal() {
            document.getElementById('more-settings-modal').style.display = 'none';
        }

        // 关闭修改密码弹窗
        function closeChangePasswordModal() {
            document.getElementById('change-password-modal').style.display = 'none';
        }

        // 关闭修改名称弹窗
        function closeChangeNameModal() {
            document.getElementById('change-name-modal').style.display = 'none';
        }

        // 关闭修改邮箱弹窗
        function closeChangeEmailModal() {
            document.getElementById('change-email-modal').style.display = 'none';
        }

        // 修改头像相关功能
        function showChangeAvatarModal() {
            document.getElementById('change-avatar-modal').style.display = 'flex';
        }

        function closeChangeAvatarModal() {
            document.getElementById('change-avatar-modal').style.display = 'none';
        }

        // 监听头像文件选择并显示文件名
        document.addEventListener('DOMContentLoaded', function() {
            const avatarFileInput = document.getElementById('avatar-file');
            if (avatarFileInput) {
                avatarFileInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    // 检查文件类型
                    if (!file.type.match('image.*')) {
                        alert('请选择图片文件');
                        return;
                    }
                    
                    // 检查文件大小（限制为5MB）
                    const maxSize = 5 * 1024 * 1024;
                    if (file.size > maxSize) {
                        alert('图片大小不能超过5MB');
                        return;
                    }
                    
                    // 读取文件并预览
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const avatarPreview = document.getElementById('avatar-preview');
                        // 清空预览区域
                        avatarPreview.innerHTML = '';
                        // 创建预览图片
                        const img = document.createElement('img');
                        img.src = event.target.result;
                        img.style.width = '100%';
                        img.style.height = '100%';
                        img.style.objectFit = 'cover';
                        avatarPreview.appendChild(img);
                        
                        // 显示文件名
                        const fileNameDiv = document.getElementById('selected-file-name');
                        if (fileNameDiv) {
                            fileNameDiv.textContent = '已选择: ' + file.name;
                        }
                    };
                    reader.readAsDataURL(file);
                });
            }
        });

        // 修改头像
        function changeAvatar() {
            const avatarFile = document.getElementById('avatar-file').files[0];
            if (!avatarFile) {
                alert('请选择头像图片');
                return false;
            }
            
            const formData = new FormData();
            formData.append('avatar', avatarFile);
            formData.append('action', 'change_avatar');
            
            fetch('/src/user/change_avatar.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('头像修改成功');
                    // 刷新页面以显示新头像
                    location.reload();
                } else {
                    alert('头像修改失败：' + data.message);
                }
            })
            .catch(error => {
                console.error('头像修改错误：', error);
                alert('头像修改失败，请重试');
            });
            
            return false;
        }

        // 截图功能
        async function takeScreenshot() {
            try {
                // 检查navigator.mediaDevices和getDisplayMedia是否可用
                if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                    alert('截图功能不可用：您的浏览器不支持屏幕捕获');
                    return;
                }
                
                // 请求屏幕捕获
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: 'always' },
                    audio: false
                });
                
                // 创建视频元素来显示流
                const video = document.createElement('video');
                video.srcObject = stream;
                
                // 使用Promise确保视频元数据加载完成
                await new Promise((resolve) => {
                    video.onloadedmetadata = resolve;
                });
                
                // 播放视频
                await video.play();
                
                // 创建Canvas元素
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                // 绘制视频帧到Canvas
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // 停止流
                stream.getTracks().forEach(track => track.stop());
                
                // 将Canvas转换为Blob，使用Promise处理
                const blob = await new Promise((resolve) => {
                    canvas.toBlob(resolve, 'image/png');
                });
                
                if (blob) {
                    // 创建文件对象
                    const screenshotFile = new File([blob], `screenshot_${Date.now()}.png`, {
                        type: 'image/png'
                    });
                    
                    // 创建DataTransfer对象
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(screenshotFile);
                    
                    // 将文件添加到file-input中
                    const fileInput = document.getElementById('file-input');
                    if (fileInput) {
                        fileInput.files = dataTransfer.files;
                        
                        // 触发change事件，自动提交表单
                        const event = new Event('change', { bubbles: true });
                        fileInput.dispatchEvent(event);
                    } else {
                        console.error('未找到file-input元素');
                        alert('截图失败：未找到文件输入元素');
                    }
                } else {
                    console.error('Canvas转换为Blob失败');
                    alert('截图失败：无法处理截图数据');
                }
            } catch (error) {
                console.error('截图失败:', error);
                // 根据错误类型提供更具体的提示
                if (error.name === 'NotAllowedError') {
                    alert('截图失败：您拒绝了屏幕捕获请求');
                } else if (error.name === 'NotFoundError') {
                    alert('截图失败：未找到可捕获的屏幕');
                } else if (error.name === 'NotReadableError') {
                    alert('截图失败：无法访问屏幕内容');
                } else {
                    alert(`截图失败：${error.message || '请重试'}`);
                }
            }
        }

        // 初始化视频播放器
        function initVideoPlayer() {
            console.log('开始初始化视频播放器...');
            
            // 获取视频元素和控件
            const videoElement = document.getElementById('custom-video-element');
            const playBtn = document.getElementById('video-play-btn');
            const progressBar = document.getElementById('video-progress-bar');
            const progress = document.getElementById('video-progress');
            const currentTimeEl = document.querySelector('.video-time.current-time');
            const totalTimeEl = document.querySelector('.video-time.total-time');
            const muteBtn = document.getElementById('video-mute-btn');
            const volumeSlider = document.getElementById('volume-slider');
            const videoControls = document.querySelector('.video-controls');
            const videoPlayer = document.querySelector('.custom-video-player');
            const videoHeader = document.querySelector('.video-player-header');
            
            // 检查必要元素是否存在
            console.log('元素检查结果:');
            console.log('videoElement:', !!videoElement);
            console.log('playBtn:', !!playBtn);
            console.log('progressBar:', !!progressBar);
            console.log('progress:', !!progress);
            console.log('currentTimeEl:', !!currentTimeEl);
            console.log('totalTimeEl:', !!totalTimeEl);
            console.log('muteBtn:', !!muteBtn);
            console.log('volumeSlider:', !!volumeSlider);
            console.log('videoControls:', !!videoControls);
            console.log('videoPlayer:', !!videoPlayer);
            console.log('videoHeader:', !!videoHeader);
            
            if (!videoElement || !playBtn || !progressBar || !progress || !currentTimeEl || !totalTimeEl || !muteBtn || !volumeSlider || !videoControls || !videoPlayer || !videoHeader) {
                console.error('视频播放器初始化失败：缺少必要元素');
                return;
            }
            
            console.log('所有必要元素已找到，开始绑定事件...');
            
            // 添加CSS过渡效果
            const style = document.createElement('style');
            style.textContent = `
                .video-controls {
                    transition: opacity 0.3s ease, transform 0.3s ease;
                    opacity: 1;
                    transform: translateY(0);
                }
                .video-controls.hidden {
                    opacity: 0;
                    transform: translateY(20px);
                    pointer-events: none;
                }
                .video-player-header {
                    transition: opacity 0.3s ease, transform 0.3s ease;
                    opacity: 1;
                    transform: translateY(0);
                }
                .video-player-header.hidden {
                    opacity: 0;
                    transform: translateY(-20px);
                    pointer-events: none;
                }
            `;
            document.head.appendChild(style);
            
            // 移除默认控件（如果存在）
            if (videoElement.hasAttribute('controls')) {
                videoElement.removeAttribute('controls');
            }
            
            // 播放/暂停控制 - 直接在HTML中添加onclick属性，确保事件能被正确触发
            playBtn.onclick = function(event) {
                console.log('播放/暂停按钮被点击! 当前状态:', videoElement.paused ? '已暂停' : '播放中');
                event.stopPropagation(); // 防止事件冒泡
                
                if (videoElement.paused) {
                    videoElement.play().catch(error => {
                        console.error('播放视频失败:', error);
                    });
                    playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
                    console.log('切换为播放状态');
                } else {
                    videoElement.pause();
                    playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                    console.log('切换为暂停状态');
                }
            };
            
            // 也添加一个事件监听器作为备份
            playBtn.addEventListener('click', function(event) {
                console.log('播放/暂停按钮事件监听器被触发!');
                // 这里不执行实际操作，只是作为调试用
            });
            
            // 确保按钮没有被其他元素覆盖
            console.log('播放按钮尺寸:', playBtn.offsetWidth, 'x', playBtn.offsetHeight);
            console.log('播放按钮位置:', playBtn.getBoundingClientRect());
            console.log('播放按钮z-index:', window.getComputedStyle(playBtn).zIndex);
            
            // 视频播放状态变化
            videoElement.addEventListener('play', function() {
                playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
            });
            
            videoElement.addEventListener('pause', function() {
                playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            });
            
            // 本地formatTime函数，避免被其他formatTime函数覆盖
            function formatTime(seconds) {
                if (isNaN(seconds)) return '0:00';
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            }
            
            // 设置视频时长
            videoElement.addEventListener('loadedmetadata', function() {
                totalTimeEl.textContent = formatTime(videoElement.duration);
            });
            
            // 更新进度条和时间
            videoElement.addEventListener('timeupdate', function() {
                // 确保duration有效才计算进度
                if (isNaN(videoElement.duration) || videoElement.duration <= 0) {
                    return;
                }
                const progressPercent = (videoElement.currentTime / videoElement.duration) * 100;
                progress.style.width = progressPercent + '%';
                currentTimeEl.textContent = formatTime(videoElement.currentTime);
            });
            
            // 进度条点击跳转到指定位置
            progressBar.onclick = function(e) {
                // 确保duration有效才允许跳转
                if (isNaN(videoElement.duration) || videoElement.duration <= 0) {
                    return;
                }
                const progressWidth = progressBar.clientWidth;
                const clickX = e.offsetX;
                const duration = videoElement.duration;
                
                videoElement.currentTime = (clickX / progressWidth) * duration;
            };
            
            // 音量控制
            volumeSlider.oninput = function() {
                videoElement.volume = this.value;
                if (this.value === 0) {
                    muteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-3.97zM3 9v6h4l5 5V4L7 9H3zm13.5 3c0 1.38-1.12 2.5-2.5 2.5s-2.5-1.12-2.5-2.5 1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5z"/></svg>';
                } else {
                    muteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-3.97zm-2.5-.75c.94 0 1.7-.76 1.7-1.7s-.76-1.7-1.7-1.7-1.7.76-1.7 1.7.76 1.7 1.7 1.7z"/></svg>';
                }
            };
            
            // 静音切换
            muteBtn.onclick = function() {
                if (videoElement.volume > 0) {
                    volumeSlider.value = 0;
                    videoElement.volume = 0;
                    muteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-3.97zM3 9v6h4l5 5V4L7 9H3zm13.5 3c0 1.38-1.12 2.5-2.5 2.5s-2.5-1.12-2.5-2.5 1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5z"/></svg>';
                } else {
                    volumeSlider.value = 1;
                    videoElement.volume = 1;
                    muteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-3.97zm-2.5-.75c.94 0 1.7-.76 1.7-1.7s-.76-1.7-1.7-1.7-1.7.76-1.7 1.7.76 1.7 1.7 1.7z"/></svg>';
                }
            };
            
            // 视频结束时重置
            videoElement.addEventListener('ended', function() {
                playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                videoElement.currentTime = 0;
            });
            
            // 鼠标移动显示/隐藏控件逻辑
            let hideControlsTimer;
            const showControls = () => {
                // 清除之前的计时器
                clearTimeout(hideControlsTimer);
                
                // 显示控件
                videoControls.classList.remove('hidden');
                videoHeader.classList.remove('hidden');
                
                // 设置3秒后隐藏控件（只有在播放状态且非全屏时）
                hideControlsTimer = setTimeout(() => {
                    if (!videoElement.paused && !document.fullscreenElement) {
                        videoControls.classList.add('hidden');
                        videoHeader.classList.add('hidden');
                    }
                }, 3000);
            };
            
            // 鼠标移动事件
            videoPlayer.addEventListener('mousemove', showControls);
            videoPlayer.addEventListener('mouseenter', showControls);
            
            // 全屏变化事件
            document.addEventListener('fullscreenchange', () => {
                if (document.fullscreenElement) {
                    // 进入全屏，隐藏标题栏，显示控制按钮
                    videoControls.classList.remove('hidden');
                    videoHeader.classList.add('hidden');
                    clearTimeout(hideControlsTimer);
                    
                    // 确保视频元素充满整个屏幕
                    videoPlayer.style.height = '100%';
                    videoElement.style.height = '100%';
                    videoElement.style.width = '100%';
                } else {
                    // 退出全屏，显示标题栏，恢复自动隐藏逻辑
                    videoControls.classList.remove('hidden');
                    videoHeader.classList.remove('hidden');
                    if (!videoElement.paused) {
                        hideControlsTimer = setTimeout(() => {
                            videoControls.classList.add('hidden');
                            videoHeader.classList.add('hidden');
                        }, 3000);
                    }
                    
                    // 恢复原始尺寸
                    videoPlayer.style.height = '';
                    videoElement.style.height = '';
                    videoElement.style.width = '';
                }
            });
            
            // 初始状态：显示控件
            showControls();
        }
        
        // 打开视频播放器
        // 打开视频播放器
        async function openVideoPlayer(videoUrl, videoName, videoSize) {
            const videoModal = document.getElementById('video-player-modal');
            const videoElement = document.getElementById('custom-video-element');
            const videoTitle = document.getElementById('video-player-title');
            const cacheStatus = document.getElementById('video-cache-status');
            
            // 设置当前视频信息
            currentVideoUrl = videoUrl;
            currentVideoName = videoName;
            currentVideoSize = videoSize;
            
            // 更新视频标题
            videoTitle.textContent = videoName;
            
            // 显示视频播放器弹窗
            videoModal.classList.add('visible');
            
            // 优先从IndexedDB获取视频
            try {
                const fileData = await indexedDBManager.getFile(videoUrl);
                if (fileData && fileData.data) {
                    // 从IndexedDB获取成功，转换为Blob URL
                    const blob = new Blob([fileData.data], { type: fileData.type });
                    const blobUrl = URL.createObjectURL(blob);
                    videoElement.src = blobUrl;
                    videoElement.play().catch(error => {
                        console.error('播放视频失败:', error);
                        // 播放失败时保持视频源不变，等待用户手动点击
                        videoElement.pause();
                    });
                    // 不显示缓存状态
                    cacheStatus.style.display = 'none';
                    return;
                }
            } catch (error) {
                // 忽略IndexedDB错误，继续尝试其他方式
                console.error('从IndexedDB获取视频失败:', error);
            }
            
            // 如果IndexedDB中没有，检查是否已经缓存（兼容旧版本）
            if (!isFileExpired(videoUrl, 'video')) {
                console.log('视频已缓存，直接使用URL播放');
                // 视频已缓存，直接使用URL播放，不重新缓存
                videoElement.src = videoUrl;
                videoElement.play().catch(error => {
                    console.error('播放视频失败:', error);
                    // 播放失败时保持视频源不变，等待用户手动点击
                    videoElement.pause();
                });
                // 不显示缓存状态
                cacheStatus.style.display = 'none';
            } else {
                // 显示缓存状态
                const cacheFileName = document.getElementById('cache-file-name');
                cacheFileName.textContent = videoName;
                cacheStatus.style.display = 'block';
                
                // 设置顶部缓存状态的文件名
                const topCacheFileName = document.getElementById('top-cache-file-name');
                topCacheFileName.textContent = videoName;
                
                // 初始化缓存状态
                updateCacheStatus(0, 0, 0, 0, videoSize);
                
                // 缓存视频并播放
                cacheVideo(videoUrl, videoName, videoSize, videoElement, cacheStatus);
            }
        }
        
        // 缓存完整视频
        async function cacheVideo(videoUrl, videoName, videoSize, videoElement, cacheStatus) {
            // 检查是否已有缓存进程在运行
            if (isCaching) {
                console.log('已有缓存进程在运行，跳过当前缓存');
                cacheStatus.style.display = 'none';
                return;
            }
            
            // 检查视频URL是否有效
            if (!videoUrl) {
                console.error('无效的视频URL');
                cacheStatus.style.display = 'none';
                showNotification('缓存视频失败：无效的视频URL', 'error');
                return;
            }
            
            // 优先从IndexedDB获取视频
            try {
                const fileData = await indexedDBManager.getFile(videoUrl);
                if (fileData && fileData.data) {
                    // 从IndexedDB获取成功，转换为Blob URL
                    const blob = new Blob([fileData.data], { type: fileData.type });
                    const blobUrl = URL.createObjectURL(blob);
                    videoElement.src = blobUrl;
                    videoElement.play().catch(error => {
                        console.error('播放视频失败:', error);
                        // 播放失败时保持视频源不变，等待用户手动点击
                        videoElement.pause();
                    });
                    cacheStatus.style.display = 'none';
                    isCaching = false;
                    return;
                }
            } catch (error) {
                // 忽略IndexedDB错误，继续尝试其他方式
                console.error('从IndexedDB获取视频失败:', error);
            }
            
            // 如果IndexedDB中没有，检查是否已经缓存（兼容旧版本）
            if (!isFileExpired(videoUrl, 'video')) {
                console.log('视频已缓存，直接使用缓存播放');
                // 直接使用视频URL，浏览器会自动使用缓存
                videoElement.src = videoUrl;
                videoElement.play().catch(error => {
                    console.error('播放视频失败:', error);
                    // 播放失败时保持视频源不变，等待用户手动点击
                    videoElement.pause();
                });
                cacheStatus.style.display = 'none';
                isCaching = false;
                return;
            }
            
            // 设置缓存标志为true
            isCaching = true;
            
            let downloadedBytes = 0;
            let startTime = Date.now();
            let lastTime = Date.now();
            let lastDownloaded = 0;
            
            // 禁用视频播放，直到缓存完成
            videoElement.pause();
            // 保存原视频URL，以便出错时恢复
            const originalSrc = videoUrl;
            
            fetch(videoUrl, {
                credentials: 'include',
                cache: 'force-cache'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                
                // 获取视频总大小
                const totalBytes = parseInt(response.headers.get('content-length') || '0');
                
                // 更新总进度
                updateCacheStatus(0, 0, 0, totalBytes, videoSize);
                
                // 创建读取器
                const reader = response.body.getReader();
                const chunks = [];
                
                // 读取数据
                return reader.read().then(function processChunk({ done, value }) {
                    if (done) {
                        // 下载完成
                        const blob = new Blob(chunks, { type: 'video/mp4' });
                        const blobUrl = URL.createObjectURL(blob);
                        
                        // 设置视频源为缓存的blob URL
                        videoElement.src = blobUrl;
                        
                        // 开始播放，使用catch处理可能的播放失败
                        videoElement.play().catch(error => {
                            console.error('播放视频失败:', error);
                            // 如果播放失败，尝试直接使用原URL
                            videoElement.src = originalSrc;
                            videoElement.load();
                        });
                        
                        // 更新缓存状态为100%
                        updateCacheStatus(100, 0, totalBytes, totalBytes, videoSize);
                        
                        // 隐藏缓存状态
                        setTimeout(() => {
                            cacheStatus.style.display = 'none';
                        }, 1000);
                        
                        // 设置localStorage缓存信息
                        const fileType = 'video';
                        setFileCache(videoUrl, fileType, totalBytes);
                        
                        // 重置缓存标志
                        isCaching = false;
                        
                        return blobUrl;
                    }
                    
                    // 添加到chunks
                    chunks.push(value);
                    downloadedBytes += value.length;
                    
                    // 计算进度和速度
                    const percentage = Math.round((downloadedBytes / totalBytes) * 100);
                    const currentTime = Date.now();
                    const elapsed = (currentTime - startTime) / 1000;
                    const speed = elapsed > 0 ? Math.round(downloadedBytes / elapsed / 1024) : 0; // KB/s
                    
                    // 更新缓存状态
                    updateCacheStatus(percentage, speed, downloadedBytes, totalBytes, videoSize);
                    
                    // 保存当前状态
                    lastDownloaded = downloadedBytes;
                    lastTime = currentTime;
                    
                    // 继续读取
                    return reader.read().then(processChunk);
                });
            })
            .catch(error => {
                console.error('视频缓存失败:', error);
                cacheStatus.style.display = 'none';
                showNotification('视频缓存失败，无法播放', 'error');
                
                // 重置缓存标志
                isCaching = false;
                // 恢复视频源
                videoElement.src = originalSrc;
                videoElement.load();
            });
        }
        
        // 更新缓存状态
        function updateCacheStatus(percentage, speed, loaded, total, fileSize) {
            // 更新播放器内的缓存状态
            const cachePercentage = document.getElementById('cache-percentage');
            const cacheSpeed = document.getElementById('cache-speed');
            const cacheSize = document.getElementById('cache-size');
            const cacheTotalSize = document.getElementById('cache-total-size');
            
            // 更新百分比
            cachePercentage.textContent = `${percentage}%`;
            
            // 更新速度，自动选择 KB/s 或 MB/s
            if (speed >= 1024) {
                cacheSpeed.textContent = (speed / 1024).toFixed(2) + ' MB/s';
            } else {
                cacheSpeed.textContent = speed + ' KB/s';
            }
            
            // 更新已缓存大小和总大小
            const loadedMB = total > 0 ? (loaded / (1024 * 1024)).toFixed(2) : '0.00';
            const totalMB = total > 0 ? (total / (1024 * 1024)).toFixed(2) : '0.00';
            cacheSize.textContent = `${loadedMB} MB`;
            cacheTotalSize.textContent = `${totalMB} MB`;
            
            // 更新页面顶部的缓存状态
            const topCacheStatus = document.getElementById('top-video-cache-status');
            const topCachePercentage = document.getElementById('top-cache-percentage');
            const topCacheProgressBar = document.getElementById('top-cache-progress-bar');
            const topCacheSpeed = document.getElementById('top-cache-speed');
            const topCacheSize = document.getElementById('top-cache-size');
            const topCacheTotalSize = document.getElementById('top-cache-total-size');
            
            if (percentage > 0 && percentage < 100) {
                topCacheStatus.style.display = 'block';
            }
            
            topCachePercentage.textContent = `${percentage}%`;
            topCacheProgressBar.style.width = `${percentage}%`;
            topCacheSpeed.textContent = speed >= 1024 ? (speed / 1024).toFixed(2) + ' MB/s' : speed + ' KB/s';
            topCacheSize.textContent = `${loadedMB} MB`;
            topCacheTotalSize.textContent = `${totalMB} MB`;
            
            // 如果缓存完成，隐藏顶部缓存状态
            if (percentage === 100) {
                setTimeout(() => {
                    topCacheStatus.style.display = 'none';
                }, 1000);
            }
        }
        
        // 切换视频全屏
        function toggleVideoFullscreen() {
            const videoPlayer = document.querySelector('.video-player-content');
            
            if (!document.fullscreenElement) {
                // 进入全屏
                videoPlayer.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
            } else {
                // 退出全屏
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        }
        
        // 关闭视频播放器
        function closeVideoPlayer() {
            const videoModal = document.getElementById('video-player-modal');
            const videoElement = document.getElementById('custom-video-element');
            const playBtn = document.getElementById('video-play-btn');
            const progress = document.getElementById('video-progress');
            const currentTimeEl = document.querySelector('.video-time.current-time');
            
            // 暂停视频
            if (videoElement) videoElement.pause();
            
            // 重置播放按钮和进度条
            if (playBtn) playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            if (progress) progress.style.width = '0%';
            if (currentTimeEl) currentTimeEl.textContent = '0:00';
            
            // 停止缓存
            if (isCaching) {
                isCaching = false;
                console.log('视频缓存已停止');
            }
            
            // 隐藏缓存状态
            const cacheStatus = document.getElementById('video-cache-status');
            if (cacheStatus) {
                cacheStatus.style.display = 'none';
            }
            
            // 隐藏顶部缓存状态
            const topCacheStatus = document.getElementById('top-video-cache-status');
            if (topCacheStatus) {
                topCacheStatus.style.display = 'none';
            }
            
            // 隐藏视频播放器弹窗
            videoModal.classList.remove('visible');
        }
        
        // 点击弹窗外部关闭视频播放器
        document.getElementById('video-player-modal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeVideoPlayer();
            }
        });
        
        // 添加下载任务并立即下载
        function addDownloadTask(fileName, filePath, fileSize, fileType) {
            console.log('开始下载文件:', fileName, filePath, fileSize, fileType);
            
            // 使用 FileHelper 构建安全 URL（通过 list.php 认证）
            const downloadUrl = (typeof FileHelper !== 'undefined')
                ? FileHelper.getFileUrl(filePath)
                : filePath;
            
            // 使用a标签下载文件
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        
        // 下载当前视频
        function downloadCurrentVideo() {
            if (currentVideoUrl && currentVideoName) {
                addDownloadTask(currentVideoName, currentVideoUrl, currentVideoSize, 'video');
            }
        }
        
        // 播放压缩视频
        function playCompressedVideo(videoUrl, videoName) {
            // 使用 FileHelper 构建安全 URL
            const safeUrl = (typeof FileHelper !== 'undefined')
                ? FileHelper.getFileUrl(videoUrl)
                : videoUrl;
            
            try {
                const videoModal = document.getElementById('video-player-modal');
                const videoElement = document.getElementById('custom-video-element');
                const videoTitle = document.getElementById('video-player-title');
                const cacheStatus = document.getElementById('video-cache-status');
                
                // 设置当前视频信息
                currentVideoUrl = safeUrl;
                currentVideoName = videoName;
                currentVideoSize = 0; // 假设视频大小未知
                
                // 更新视频标题
                videoTitle.textContent = videoName;
                
                // 显示视频播放器弹窗
                videoModal.classList.add('visible');
                
                // 检查是否已经缓存，避免二次缓存
                if (typeof isFileExpired !== 'undefined' && !isFileExpired(safeUrl, 'video')) {
                    console.log('视频已缓存，使用Blob URL播放');
                    // 使用fetch请求获取缓存的视频，然后创建Blob URL播放
                    fetch(safeUrl, {
                        credentials: 'include',
                        cache: 'force-cache'
                    })
                    .then(response => response.blob())
                    .then(blob => {
                        const blobUrl = URL.createObjectURL(blob);
                        videoElement.src = blobUrl;
                        videoElement.play().catch(error => {
                            console.error('播放视频失败:', error);
                            // 如果播放失败，尝试直接使用原URL
                            videoElement.src = safeUrl;
                            videoElement.load();
                        });
                        // 不显示缓存状态
                        cacheStatus.style.display = 'none';
                    })
                    .catch(error => {
                        console.error('获取缓存视频失败:', error);
                        // 发生错误时，降级使用服务器链接
                        videoElement.src = safeUrl;
                        videoElement.play().catch(error => {
                            console.error('播放视频失败:', error);
                        });
                        cacheStatus.style.display = 'none';
                    });
                } else {
                    // 显示缓存状态
                    const cacheFileName = document.getElementById('cache-file-name');
                    cacheFileName.textContent = videoName;
                    cacheStatus.style.display = 'block';
                    
                    // 初始化缓存状态
                    videoElement.src = safeUrl;
                    
                    // 调用cacheVideo函数进行缓存
                    if (typeof cacheVideo !== 'undefined') {
                        cacheVideo(safeUrl, videoName, 0, videoElement, cacheStatus);
                    } else {
                        // 如果cacheVideo函数不存在，直接播放
                        videoElement.play().catch(error => {
                            console.error('播放视频失败:', error);
                        });
                        cacheStatus.style.display = 'none';
                    }
                }
            } catch (error) {
                console.error('创建视频播放器失败:', error);
                // 显示错误提示，但不影响整体UI
                alert('无法播放视频，请尝试下载原画质视频');
            }
        }
        
        // 下载原画质视频
        function downloadOriginalVideo(videoUrl, videoName) {
            // 使用 FileHelper 构建安全 URL
            const safeUrl = (typeof FileHelper !== 'undefined')
                ? FileHelper.getFileUrl(videoUrl)
                : videoUrl;
            
            // 使用浏览器直接下载
            const link = document.createElement('a');
            link.href = safeUrl;
            link.download = videoName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        // 为视频缩略图添加点击事件监听器
        function initVideoElements() {
            // 为已有的视频缩略图添加点击事件
            document.querySelectorAll('.video-thumbnail').forEach(thumbnail => {
                thumbnail.addEventListener('click', function() {
                    const videoUrl = this.getAttribute('data-file-path');
                    const videoName = this.getAttribute('data-file-name');
                    playCompressedVideo(videoUrl, videoName);
                });
            });
        }
        
        // 初始化视频元素，将视频URL转换为Blob URL
        async function initChatVideos() {
            document.querySelectorAll('.video-element').forEach(async video => {
                // 只处理没有src或src为空的视频元素
                if (!video.src || video.src === '') {
                    const fileUrl = video.getAttribute('data-file-url');
                    const fileName = video.getAttribute('data-file-name');
                    const filePath = video.getAttribute('data-file-path');
                    
                    if (fileUrl) {
                        // 优先从IndexedDB获取视频
                        try {
                            const fileData = await indexedDBManager.getFile(filePath);
                            if (fileData && fileData.data) {
                                // 从IndexedDB获取成功，转换为Blob URL
                                const blob = new Blob([fileData.data], { type: fileData.type });
                                const blobUrl = URL.createObjectURL(blob);
                                video.src = blobUrl;
                                return;
                            }
                        } catch (error) {
                            // 忽略IndexedDB错误，继续尝试从服务器获取
                        }
                        
                        // IndexedDB中没有，尝试从服务器获取，最多重试3次
                        let success = false;
                        for (let i = 0; i < 3 && !success; i++) {
                            try {
                                const response = await fetch(fileUrl, {
                                    credentials: 'include',
                                    cache: 'no-cache'
                                });
                                
                                if (response.ok) {
                                    // 请求成功，获取Blob并转换为Blob URL
                                    const blob = await response.blob();
                                    const blobUrl = URL.createObjectURL(blob);
                                    video.src = blobUrl;
                                    success = true;
                                    
                                    // 缓存到IndexedDB
                                    try {
                                        await indexedDBManager.saveFile({
                                            id: filePath,
                                            name: fileName,
                                            type: blob.type,
                                            size: blob.size,
                                            data: blob,
                                            url: fileUrl,
                                            uploadedAt: new Date().toISOString(),
                                            fileType: 'video'
                                        });
                                    } catch (cacheError) {
                                        // 忽略缓存错误
                                    }
                                } else if (response.status === 404) {
                                    // 忽略404错误，不向控制台报错
                                    break; // 404直接退出重试
                                }
                            } catch (error) {
                                // 忽略所有错误，不向控制台报错
                            }
                            
                            // 重试间隔1秒
                            if (!success && i < 2) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        }
                        
                        // 如果所有尝试都失败，显示"消息已被清理：{文件名}"
                        if (!success) {
                            // 创建一个错误提示元素
                            const errorDiv = document.createElement('div');
                            errorDiv.style.cssText = `
                                background: #f8f9fa;
                                border: 1px solid #dee2e6;
                                border-radius: 8px;
                                padding: 20px;
                                text-align: center;
                                color: #6c757d;
                                font-size: 14px;
                            `;
                            errorDiv.textContent = `消息已被清理：${fileName}`;
                            
                            // 查找父级视频容器并替换
                            const videoContainer = video.closest('.video-container');
                            if (videoContainer && videoContainer.parentNode) {
                                videoContainer.parentNode.replaceChild(errorDiv, videoContainer);
                            } else if (video.parentNode) {
                                // 如果找不到容器，仅替换视频元素
                                video.parentNode.replaceChild(errorDiv, video);
                            }
                        }
                    }
                }
            });
        }
        
        // 在DOM加载完成后初始化聊天视频
        document.addEventListener('DOMContentLoaded', function() {
            initChatVideos();
        });
        
        // 录音功能
        let mediaRecorder = null;
        let audioChunks = [];
        let isRecording = false;
        
        function toggleRecording() {
            const recordBtn = document.getElementById('record-btn');
            
            if (!isRecording) {
                // 开始录音
                startRecording();
                recordBtn.style.color = '#ff4757';
                recordBtn.style.transform = 'scale(1.2)';
            } else {
                // 停止录音
                stopRecording();
                recordBtn.style.color = '#666';
                recordBtn.style.transform = 'scale(1)';
            }
        }
        
        function startRecording() {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];
                    
                    mediaRecorder.ondataavailable = event => {
                        if (event.data.size > 0) {
                            audioChunks.push(event.data);
                        }
                    };
                    
                    mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        const audioUrl = URL.createObjectURL(audioBlob);
                        
                        // 创建录音文件名（使用简单格式：录音_时间.webm）
                        const now = new Date();
                        const timeStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}${now.getSeconds().toString().padStart(2,'0')}`;
                        const fileName = `录音_${timeStr}.webm`;
                        
                        // 创建File对象
                        const audioFile = new File([audioBlob], fileName, { type: 'audio/webm' });
                        
                        // 发送录音文件，传入blobUrl以便立即播放
                        sendFile(audioFile, audioUrl);
                        
                        console.log('录音完成并发送', audioUrl);
                    };
                    
                    mediaRecorder.start();
                    isRecording = true;
                })
                .catch(error => {
                    console.error('获取麦克风权限失败:', error);
                    alert('无法获取麦克风权限，请检查浏览器设置');
                });
        }
        
        function stopRecording() {
            if (mediaRecorder && isRecording) {
                mediaRecorder.stop();
                isRecording = false;
                
                // 停止所有音轨
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
        }
        
        // 显示群聊成员
        function showGroupMembers(groupId, event) {
            if (event) {
                event.stopPropagation(); // 阻止事件冒泡，避免关闭菜单
            }
            
            const modal = document.getElementById('group-members-modal');
            const membersList = document.getElementById('group-members-list');
            
            // 清空成员列表
            membersList.innerHTML = '<p style="text-align: center; color: #666;">加载中...</p>';
            
            // 显示弹窗
            modal.style.display = 'flex';
            
            // 从服务器获取群聊成员
            fetch(`/src/groups/get_group_members.php?group_id=${groupId}`, {
                credentials: 'include' // 包含cookie
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // 渲染成员列表（横列显示）
                    let membersHtml = '<div style="display: flex; flex-direction: column; gap: 12px;">';
                    data.members.forEach(member => {
                        // 确定职位和对应样式
                        let position = '成员';
                        let positionStyle = 'background: rgba(67, 160, 71, 0.1); color: #43a047;'; // 成员样式
                        if (member.role === 'Master' || member.id === data.group_owner_id) {
                            position = '群主';
                            positionStyle = 'background: rgba(229, 57, 53, 0.1); color: #e53935;'; // 群主样式
                        } else if (member.role === 'admin' || member.is_admin) {
                            position = '管理员';
                            positionStyle = 'background: rgba(251, 140, 0, 0.1); color: #fb8c00;'; // 管理员样式
                        }
                        
                        // 检查是否是当前用户
                        const isCurrentUser = member.id === data.current_user_id;
                        // 检查是否是好友
                        const isFriend = member.friendship_status === 'friends';
                        
                        // 生成操作菜单HTML
                        let actionsMenu = '';
                        const currentUserRole = data.current_user_role || (data.is_owner ? 'Master' : (data.is_admin ? 'admin' : 'member'));
                        if (!isCurrentUser && (!data.all_user_group || currentUserRole === 'Master' || currentUserRole === 'admin')) {
                            actionsMenu = '<div style="position: relative;">' +
                                '<button class="group-member-actions-btn" onclick="toggleMemberActionsMenu(event, ' + groupId + ', ' + member.id + ', ' + (member.role === 'admin' || member.is_admin) + ', ' + isFriend + ', \'' + member.username + '\')" style="' +
                                    'background: none;' +
                                    'border: none;' +
                                    'width: 36px;' +
                                    'height: 36px;' +
                                    'border-radius: 50%;' +
                                    'display: flex;' +
                                    'align-items: center;' +
                                    'justify-content: center;' +
                                    'cursor: pointer;' +
                                    'font-size: 18px;' +
                                    'color: var(--text-secondary);' +
                                    'transition: all 0.2s;' +
                                    'z-index: 1000;' +
                                '">' +
                                    '•••' +
                                '</button>' +
                                '<div id="member-actions-menu-' + member.id + '" class="member-actions-menu" style="' +
                                    'display: none;' +
                                    'position: absolute;' +
                                    'right: 0;' +
                                    'top: 40px;' +
                                    'background: var(--modal-bg);' +
                                    'border: 1px solid var(--border-color);' +
                                    'border-radius: 8px;' +
                                    'box-shadow: 0 4px 12px var(--shadow-color);' +
                                    'padding: 8px 0;' +
                                    'min-width: 120px;' +
                                    'z-index: 1001;' +
                                    'backdrop-filter: blur(10px);' +
                                '">';
                            
                            // 添加好友按钮
                            if (!isFriend) {
                                actionsMenu += '<div class="member-action-item" onclick="addFriend(' + member.id + ', \'' + member.username + '\'); closeMemberActionsMenu(' + member.id + ')" style="' +
                                    'padding: 10px 16px;' +
                                    'cursor: pointer;' +
                                    'font-size: 14px;' +
                                    'color: var(--text-color);' +
                                    'transition: background-color 0.2s;' +
                                '">添加好友</div>';
                            }
                            
                            // 踢出按钮
                            if (!data.all_user_group && (currentUserRole === 'Master' || (currentUserRole === 'admin' && member.role !== 'admin' && member.role !== 'Master'))) {
                                actionsMenu += '<div class="member-action-item" onclick="kickMember(' + groupId + ', ' + member.id + '); closeMemberActionsMenu(' + member.id + ')" style="' +
                                    'padding: 10px 16px;' +
                                    'cursor: pointer;' +
                                    'font-size: 14px;' +
                                    'color: var(--danger-color);' +
                                    'transition: background-color 0.2s;' +
                                '">踢出</div>';
                            }
                            
                            // 设为管理员按钮
                            if (!isCurrentUser && currentUserRole === 'Master' && member.role !== 'admin' && member.role !== 'Master') {
                                actionsMenu += '<div class="member-action-item" onclick="setGroupAdmin(' + groupId + ', ' + member.id + ', true); closeMemberActionsMenu(' + member.id + ')" style="' +
                                    'padding: 10px 16px;' +
                                    'cursor: pointer;' +
                                    'font-size: 14px;' +
                                    'color: #4CAF50;' +
                                    'transition: background-color 0.2s;' +
                                '">设为管理员</div>';
                            }
                            
                            // 取消管理员按钮
                            if (!isCurrentUser && currentUserRole === 'Master' && (member.role === 'admin' || member.is_admin)) {
                                actionsMenu += '<div class="member-action-item" onclick="setGroupAdmin(' + groupId + ', ' + member.id + ', false); closeMemberActionsMenu(' + member.id + ')" style="' +
                                    'padding: 10px 16px;' +
                                    'cursor: pointer;' +
                                    'font-size: 14px;' +
                                    'color: #ff9800;' +
                                    'transition: background-color 0.2s;' +
                                '">取消管理员</div>';
                            }
                            
                            actionsMenu += '</div>' +
                                '</div>';
                        }
                        
                        // 生成头像HTML
                        let avatarHtml = '';
                        if (member.avatar && member.avatar !== 'deleted_user' && member.avatar !== 'x') {
                            avatarHtml = '<img src="' + member.avatar + '" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">';
                        } else {
                            avatarHtml = member.username.substring(0, 2);
                        }
                        
                        // 生成成员项HTML
                        membersHtml += '<div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: var(--hover-bg); border-radius: 10px; gap: 16px;">' +
                            '<div style="display: flex; align-items: center; gap: 16px; flex: 1;">' +
                                '<div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 22px;">' +
                                    avatarHtml +
                                '</div>' +
                                '<div style="flex: 1;">' +
                                    '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">' +
                                        '<span style="font-size: 16px; font-weight: 600; color: var(--text-color);">' + member.username + '</span>' +
                                        '<span style="padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 500; ' + positionStyle + '">' + position + '</span>' +
                                    '</div>' +
                                    '<div style="font-size: 14px; color: var(--text-secondary); font-weight: 500;">' + (member.email || member.status || '离线') + '</div>' +
                                '</div>' +
                            '</div>' +
                            actionsMenu +
                        '</div>';
                    });
                    
                    // 添加样式
                    membersHtml += '<style>' +
                        '/* 成员操作菜单样式 */' +
                        '.member-action-item:hover {' +
                            'background-color: var(--hover-bg) !important;' +
                        '}' +
                        '' +
                        '/* 确保删除好友UI优先显示 */' +
                        '.friend-menu {' +
                            'z-index: 2000 !important;' +
                        '}' +
                    '</style>';
                    
                    membersHtml += '</div>';
                    membersList.innerHTML = membersHtml;
                } else {
                    membersList.innerHTML = '<p style="text-align: center; color: #ff4d4f;">' + (data.message || '获取成员列表失败') + '</p>';
                }
            })
            .catch(error => {
                console.error('获取群聊成员失败:', error);
                membersList.innerHTML = '<p style="text-align: center; color: #ff4d4f;">获取成员列表失败</p>';
            });
        }
        
        // 切换成员操作菜单显示
        function toggleMemberActionsMenu(event, groupId, memberId, isAdmin, isFriend, username) {
            event.stopPropagation();
            
            // 关闭所有其他菜单
            document.querySelectorAll('.member-actions-menu').forEach(menu => {
                menu.style.display = 'none';
            });
            
            // 切换当前菜单
            const menu = document.getElementById(`member-actions-menu-${memberId}`);
            if (menu) {
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            }
        }
        
        // 关闭成员操作菜单
        function closeMemberActionsMenu(memberId) {
            const menu = document.getElementById(`member-actions-menu-${memberId}`);
            if (menu) {
                menu.style.display = 'none';
            }
        }
        
        // 点击其他地方关闭成员操作菜单
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.group-member-actions-btn') && !e.target.closest('.member-actions-menu')) {
                document.querySelectorAll('.member-actions-menu').forEach(menu => {
                    menu.style.display = 'none';
                });
            }
        });
        
        // 关闭群聊成员弹窗
        function closeGroupMembersModal() {
            const modal = document.getElementById('group-members-modal');
            modal.style.display = 'none';
        }
        
        // 踢出群聊成员
        function kickMember(groupId, memberId) {
            if (confirm('确定要将该成员踢出群聊吗？')) {
                fetch(`/src/groups/remove_group_member.php?group_id=${groupId}&member_id=${memberId}`, {
                    credentials: 'include',
                    method: 'POST'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showNotification('成员已成功踢出群聊', 'success');
                        // 重新加载成员列表
                        showGroupMembers(groupId);
                    } else {
                        showNotification(data.message || '踢出成员失败', 'error');
                    }
                })
                .catch(error => {
                    console.error('踢出成员失败:', error);
                    showNotification('踢出成员失败', 'error');
                });
            }
        }
        
        // 设置群管理员
        function setGroupAdmin(groupId, memberId, isAdmin) {
            const action = isAdmin ? '设为管理员' : '取消管理员';
            if (confirm(`确定要${action}吗？`)) {
                // 显示加载状态
                showNotification(`${action}中...`, 'info');
                
                fetch(`/src/groups/set_group_admin.php?group_id=${groupId}&member_id=${memberId}&is_admin=${isAdmin ? 1 : 0}`, {
                    credentials: 'include',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: '' // 必须有body，即使是空字符串
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showNotification(`${action}成功`, 'success');
                        // 延迟刷新成员列表，确保服务器数据已更新
                        setTimeout(() => {
                            // 强制从服务器获取最新数据，避免缓存
                            const membersList = document.getElementById('group-members-list');
                            if (membersList) {
                                membersList.innerHTML = '<p style="text-align: center; color: #666;">刷新成员列表中...</p>';
                            }
                            showGroupMembers(groupId);
                        }, 1000); // 增加延迟时间到1秒，确保服务器数据已更新
                    } else {
                        showNotification(`${action}失败：${data.message || '未知错误'}`, 'error');
                    }
                })
                .catch(error => {
                    console.error(`${action}失败:`, error);
                    showNotification(`${action}失败`, 'error');
                });
            }
        }
        
        // 添加好友
        function addFriend(userId, username) {
            fetch(`/src/friends/send_friend_request.php?friend_id=${userId}`, {
                credentials: 'include',
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(`已发送好友请求给 ${username}`, 'success');
                } else {
                    showNotification(data.message || '添加好友失败', 'error');
                }
            })
            .catch(error => {
                console.error('添加好友失败:', error);
                showNotification('添加好友失败', 'error');
            });
        }
        
        // 格式化时间显示（秒 -> mm:ss）
        function formatTime(seconds) {
            if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
            
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        
        // 获取新消息
        function getNewMessages() {
            const chatType = MOBILE_CHAT_CONFIG.chatType;
            const chatId = MOBILE_CHAT_CONFIG.selectedId;
            
            if (!chatId) return;
            
            // 获取最后一条消息的ID
            const messages = document.querySelectorAll('.message');
            let lastMessageId = 0;
            // 从后往前查找最近一条非临时消息的ID
            for (let i = messages.length - 1; i >= 0; i--) {
                const id = messages[i].dataset.messageId;
                // 假设服务器ID是纯数字，临时ID包含非数字字符（如 'temp_' 或 'msg_'）
                // 这里简单判断：如果是数字则认为是有效ID
                if (id && /^\d+$/.test(id)) {
                    lastMessageId = id;
                    break;
                }
            }
            
            // 构造请求URL
            let url;
            if (chatType === 'friend') {
                url = `/src/chat/get_new_messages.php?friend_id=${chatId}&last_message_id=${lastMessageId}`;
            } else {
                url = `/src/chat/get_new_group_messages.php?group_id=${chatId}&last_message_id=${lastMessageId}`;
            }
            
            // 发送请求获取新消息
            fetch(url)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.messages.length > 0) {
                        const messagesContainer = document.getElementById('messages-container');
                        
                        // 只添加新消息，避免重复
                        data.messages.forEach(msg => {
                            // 检查消息是否已经存在于当前聊天中
                            const existingMessage = document.querySelector(`[data-message-id="${msg.id}"][data-chat-type="${chatType}"][data-chat-id="${chatId}"]`);
                            if (!existingMessage) {
                                // 创建消息元素
                                const messageElement = createMessageElement(msg, chatType, chatId);
                                messagesContainer.appendChild(messageElement);
                            }
                        });
                        
                        // 滚动到底部
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        
                        // 处理新消息中的媒体文件
                document.querySelectorAll('.message-file').forEach(fileLink => {
                    const filePath = fileLink.getAttribute('data-file-path');
                    const fileName = fileLink.getAttribute('data-file-name');
                    if (filePath && fileName) {
                        const fileType = getFileType(fileName);
                        setFileCache(filePath, fileType, 0);
                    }
                });
                
                // 初始化新添加的音频播放器
    
                
                // 初始化新添加的视频元素
                initVideoElements();
                
                // 初始化新添加的聊天视频，转换为Blob URL
                initChatVideos();
                    }
                })
                .catch(error => {
                    console.error('获取新消息失败:', error);
                });
        }
        
        // 创建消息元素
        // HTML转义函数，确保HTML标签被显示为纯文本
        function escapeHtml(text) {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
        
        function createMessageElement(msg, chatType, chatId) {
            const messageDiv = document.createElement('div');
            // 确保类型匹配，使用 == 进行比较
            const isSent = parseInt(msg.sender_id) == parseInt(MOBILE_CHAT_CONFIG.userId);
            messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
            messageDiv.dataset.messageId = msg.id;
            messageDiv.dataset.chatType = chatType;
            messageDiv.dataset.chatId = chatId;
            
            let avatarHtml;
            if (isSent) {
                // 当前用户的头像
                avatarHtml = `${MOBILE_CHAT_CONFIG.hasAvatar ? `<img src="${MOBILE_CHAT_CONFIG.userAvatar}" alt="${MOBILE_CHAT_CONFIG.username}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : MOBILE_CHAT_CONFIG.usernameShort}`;
            } else {
                // 对方的头像
                if (chatType === 'friend') {
                    avatarHtml = (MOBILE_CHAT_CONFIG.selectedFriendAvatar && MOBILE_CHAT_CONFIG.selectedFriendAvatar !== '' ? `<img src="${MOBILE_CHAT_CONFIG.selectedFriendAvatar}" alt="${MOBILE_CHAT_CONFIG.selectedFriendUsername || ''}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : (MOBILE_CHAT_CONFIG.selectedFriendUsernameShort || '群'));
                } else {
                    // 群聊成员头像
                    avatarHtml = msg.avatar ? `<img src="${msg.avatar}" alt="${msg.sender_username}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : msg.sender_username.substring(0, 2);
                }
            }
            
            let contentHtml;
            let hasInternalMenu = false;
            if (msg.type === 'file' || msg.file_path) {
                let file_path = msg.file_path;
                const file_name = msg.file_name;
                const file_size = msg.file_size;
                const file_type = msg.type;
                
                // 从localStorage获取文件数据
                function getFileUrlFromLocalStorage(filePath) {
                    if (typeof(Storage) === "undefined") {
                        return filePath;
                    }
                    
                    // 检查是否是localStorage文件ID，支持多种前缀
            if (filePath && (filePath.startsWith('Picture_') || filePath.startsWith('Video_') || filePath.startsWith('Audio_') || filePath.startsWith('File_'))) {
                const fileData = localStorage.getItem(filePath);
                if (fileData) {
                    try {
                        const fileInfo = JSON.parse(fileData);
                        return fileInfo.data;
                    } catch (e) {
                        console.error('Failed to parse file data from localStorage:', e);
                    }
                }
            }
            // 服务器文件使用 FileHelper 构建安全 URL（list.php + vkey + token）
            if (typeof FileHelper !== 'undefined') {
                return FileHelper.getFileUrl(filePath);
            }
            // 回退
            return filePath;
                }
                
                // 从localStorage获取文件URL
                // 如果有传入的blob_url，优先使用它
                const fileUrl = msg.blob_url || getFileUrlFromLocalStorage(file_path);
                
                // 检测文件的实际类型
                // 如果文件名包含 localStorage ID 前缀（如 Audio_...），尝试提取真实扩展名或默认为 webm/mp3
                let ext;
                if (file_name.startsWith('Audio_')) {
                    ext = 'webm'; // 录音文件默认格式
                } else {
                    ext = file_name.toLowerCase().split('.').pop();
                }
                
                const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
                const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'wma', 'm4a', 'webm'];
                const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv'];
                
                if (imageExts.includes(ext)) {
                    // 图片类型
                    contentHtml = `<div class='message-media'>
                        <img src='${fileUrl}' alt='${file_name}' class='message-image' data-file-name='${file_name}' data-file-type='image' data-file-path='${file_path}'>
                    </div>`;
                } else if (audioExts.includes(ext)) {
                    hasInternalMenu = true;
                    // 检查是否可以撤回
                    const messageTime = new Date(msg.created_at);
                    const now = new Date();
                    const diffInMinutes = (now - messageTime) / (1000 * 60);
                    const canRecall = isSent && diffInMinutes <= 2;
                    let recallHtml = '';
                    if (canRecall) {
                        recallHtml = `<button class='file-action-item' onclick="event.stopPropagation(); recallMessage(this, '${msg.id}', '${chatType}', '${chatId}')" style='display: block; width: 100%; padding: 8px 16px; text-align: left; border: none; background: none; cursor: pointer; font-size: 14px; color: #333; transition: background-color 0.2s ease;'>撤回</button>`;
                    }

                    // 音频类型 - 作为普通文件显示
                    contentHtml = `<div class='message-media' style='position: relative;'>
                        <div class='message-file' onclick="event.preventDefault(); addDownloadTask('${file_name}', '${file_path}', ${file_size}, 'audio');">
                            <svg class='file-icon' viewBox='0 0 24 24' width='24' height='24' fill='currentColor'><path d='M8 5v14l11-7z'/></svg>
                            <div class='file-info' style='flex: 1;'>
                                <h4 style='margin: 0; font-size: 14px; font-weight: 500;'>${file_name}</h4>
                                <p style='margin: 2px 0 0 0; font-size: 12px; color: #666;'>${(file_size / 1024).toFixed(2)} KB</p>
                            </div>
                            <button style='background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s ease;' onclick="event.stopPropagation(); addDownloadTask('${file_name}', '${file_path}', ${file_size}, 'audio');">下载</button>
                            <!-- 音频操作按钮 -->
                            <div style='position: absolute; top: 10px; right: 10px; display: flex; gap: 5px; opacity: 1 !important;'>
                                <div style='position: relative;'>
                                    <button class='media-action-btn' onclick="event.stopPropagation(); toggleMediaActionsMenu(event, this)" style='width: 32px; height: 32px; font-size: 16px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;'>⋮</button>
                                    <div class='file-actions-menu' style='display: none; position: absolute; top: 40px; right: 0; background: white; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); padding: 8px 0; z-index: 5000; min-width: 80px;'>
                                        <button class='file-action-item' onclick="event.stopPropagation(); addDownloadTask('${file_name}', '${file_path}', ${file_size}, 'audio');" style='display: block; width: 100%; padding: 8px 16px; text-align: left; border: none; background: none; cursor: pointer; font-size: 14px; color: #333; transition: background-color 0.2s ease;'>下载</button>
                                        ${recallHtml}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
                    // 只在localStorage缓存不存在时才缓存文件
                    if (isFileExpired(file_path, 'audio')) {
                        setFileCache(file_path, 'audio', file_size);
                    }
                } else if (videoExts.includes(ext)) {
                    hasInternalMenu = true;
                    // 检查是否可以撤回
                    const messageTime = new Date(msg.created_at);
                    const now = new Date();
                    const diffInMinutes = (now - messageTime) / (1000 * 60);
                    const canRecall = isSent && diffInMinutes <= 2;
                    let recallHtml = '';
                    if (canRecall) {
                        recallHtml = `<button class='file-action-item' onclick="event.stopPropagation(); recallMessage(this, '${msg.id}', '${chatType}', '${chatId}')" style='display: block; width: 100%; padding: 8px 16px; text-align: left; border: none; background: none; cursor: pointer; font-size: 14px; color: #333; transition: background-color 0.2s ease;'>撤回</button>`;
                    }

                    // 视频类型 - 使用空src，后续通过JS加载为Blob URL
                    contentHtml = `<div class='message-media' style='position: relative;'>
                        <div class='video-container' style='position: relative;'>
                            <video src='' class='video-element' data-file-name='${file_name}' data-file-type='video' data-file-path='${file_path}' data-file-url='${fileUrl}' controlsList='nodownload'>
                            </video>
                            <!-- 视频操作按钮 -->
                            <div class='media-actions' style='position: absolute; top: 10px; right: 10px; display: flex; gap: 5px; opacity: 1 !important;'>
                                <div style='position: relative;'>
                                    <button class='media-action-btn' onclick="event.stopPropagation(); toggleMediaActionsMenu(event, this)" style='width: 32px; height: 32px; font-size: 16px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;'>⋮</button>
                                    <div class='file-actions-menu' style='display: none; position: absolute; top: 40px; right: 0; background: white; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); padding: 8px 0; z-index: 5000; min-width: 80px;'>
                                        <button class='file-action-item' onclick="event.stopPropagation(); addDownloadTask('${file_name}', '${file_path}', ${file_size}, 'video');" style='display: block; width: 100%; padding: 8px 16px; text-align: left; border: none; background: none; cursor: pointer; font-size: 14px; color: #333; transition: background-color 0.2s ease;'>下载</button>
                                        ${recallHtml}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
                    // 只在localStorage缓存不存在时才缓存文件
                    if (isFileExpired(file_path, 'video')) {
                        setFileCache(file_path, 'video', file_size);
                    }
                } else {
                // 其他文件类型
                contentHtml = `<div class='message-file' onclick="event.preventDefault(); addDownloadTask('${file_name}', '${file_path}', ${file_size}, 'file');">
                    <svg class='file-icon' viewBox='0 0 24 24' width='24' height='24' fill='currentColor'><path d='M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'/></svg>
                    <div class='file-info' style='flex: 1;'>
                        <h4 style='margin: 0; font-size: 14px; font-weight: 500;'>${file_name}</h4>
                        <p style='margin: 2px 0 0 0; font-size: 12px; color: #666;'>${(file_size / 1024).toFixed(2)} KB</p>
                    </div>
                    <button style='background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s ease;' onclick="event.stopPropagation(); addDownloadTask('${file_name}', '${file_path}', ${file_size}, 'file');">下载</button>
                </div>`;
                // 只在localStorage缓存不存在时才缓存文件
                if (isFileExpired(file_path, 'file')) {
                    setFileCache(file_path, 'file', file_size);
                }
            }
            } else {
                // 检测消息是否包含链接
                const escapedContent = escapeHtml(msg.content);
                const messageWithLinks = escapedContent.replace(/(https?:\/\/[^\s]+)/g, function(link) {
                    return `<a href="#" onclick="event.preventDefault(); handleLinkClick('${link}')" style="color: #12b7f5; text-decoration: underline;">${link}</a>`;
                });
                contentHtml = `<div class='message-text'>${messageWithLinks}</div>`;
            }
            
            // 将时间格式化为 X年X月X日X时X分
            const date = new Date(msg.created_at);
            const formattedTime = `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日${date.getHours().toString().padStart(2, '0')}时${date.getMinutes().toString().padStart(2, '0')}分`;
            const timeHtml = `<div class='message-time'>${formattedTime}</div>`;
            
            // 只有发送者可以看到操作按钮
            let messageActionsHtml = '';
            if (isSent) {
                // 检查消息是否在2分钟内，只有2分钟内的消息可以撤回
                const messageTime = new Date(msg.created_at);
                const now = new Date();
                const diffInMinutes = (now - messageTime) / (1000 * 60);
                
                // 只有2分钟内的消息才显示三个点按钮和撤回选项
                if (diffInMinutes <= 2 && !hasInternalMenu) {
                    const recallButtonHtml = `
                    <button class='message-action-item' onclick="event.stopPropagation(); recallMessage(this, '${msg.id}', '${chatType}', '${chatId}')" 
                            style='display: block; width: 100%; padding: 8px 16px; text-align: left; border: none; 
                                   background: none; cursor: pointer; font-size: 14px; color: var(--text-color); transition: background-color 0.2s ease;'>撤回</button>
                    `;
                
                    messageActionsHtml = `
                    <div class='message-actions' style='position: absolute; top: 50%; right: -10px; transform: translateY(-50%); display: flex; align-items: center; gap: 5px; z-index: 4000;'>
                        <div style='position: relative; z-index: 4000;'>
                            <button class='message-action-btn' onclick="event.stopPropagation(); toggleMessageActions(this)" 
                                    style='width: 28px; height: 28px; font-size: 18px; background: rgba(0,0,0,0.2); border: none; border-radius: 50%; 
                                           color: var(--text-color); cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 1; 
                                           transition: all 0.2s ease; position: relative; z-index: 4000;'>⋮</button>
                                <div class='message-actions-menu' style='display: none; position: absolute; top: 35px; right: 0; 
                                                                 background: var(--modal-bg); border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.3); 
                                                                 padding: 8px 0; z-index: 5000; min-width: 80px; border: 1px solid var(--border-color);'>
                                    ${recallButtonHtml}
                                </div>
                            </div>
                        </div>`;
                } else {
                    messageActionsHtml = '';
                }
            }
            
            // 为发送者的消息添加右键和长按事件
            if (isSent) {
                // 发送者的消息，头像在右，内容在左
                messageDiv.innerHTML = `
                    <div class='message-content' style='position: relative;'>
                        ${contentHtml}
                        ${timeHtml}
                        ${messageActionsHtml}
                    </div>
                    <div class='message-avatar'>${avatarHtml}</div>
                `;
                
                // 添加右键事件，禁止浏览器默认右键菜单
                messageDiv.addEventListener('contextmenu', function(event) {
                    event.preventDefault(); // 禁止浏览器默认右键菜单
                });
                

                
                // 添加点击事件关闭菜单
                messageDiv.addEventListener('click', function() {
                    const menu = this.querySelector('.message-actions-menu');
                    if (menu) {
                        menu.style.display = 'none';
                    }
                });
            } else {
                // 接收者的消息，头像在左，内容在右
                messageDiv.innerHTML = `
                    <div class='message-avatar'>${avatarHtml}</div>
                    <div class='message-content'>
                        ${contentHtml}
                        ${timeHtml}
                    </div>
                `;
            }
            
            return messageDiv;
        }
        
        // 全局对象，用于跟踪URL请求失败次数
        const urlFailureCount = {};
        const MAX_FAILURES = 5;
        
        // 检查URL是否已达到最大失败次数
        function shouldBlockRequest(url) {
            return urlFailureCount[url] >= MAX_FAILURES;
        }
        
        // 增加URL失败次数
        function incrementFailureCount(url) {
            if (!urlFailureCount[url]) {
                urlFailureCount[url] = 0;
            }
            urlFailureCount[url]++;
        }
        
        // 页面加载完成后初始化
        document.addEventListener('DOMContentLoaded', function() {
            // 初始化视频播放器
            initVideoPlayer();
            
            // 初始化视频元素
            initVideoElements();
            
            // 初始化滚动功能
            initScrollFunctions();
            
            // 初始化聊天输入功能（文件上传、发送按钮、回车发送、粘贴截图等事件）
            initChatInput();
            
            // 为所有图片添加错误处理，限制404请求次数
            document.addEventListener('error', function(e) {
                if (e.target.tagName === 'IMG') {
                    const imgUrl = e.target.src;
                    incrementFailureCount(imgUrl);
                    // 如果达到最大失败次数，替换为默认头像
                    if (shouldBlockRequest(imgUrl)) {
                        const username = e.target.alt || '';
                        e.target.style.display = 'none';
                        const parent = e.target.parentNode;
                        if (parent && parent.tagName === 'DIV') {
                            parent.innerHTML = username.substring(0, 2);
                        }
                    }
                }
            }, true);
        });
        
        // 撤回消息

        
        // 切换消息操作菜单
        function toggleMessageActions(button) {
            // 关闭所有其他消息操作菜单
            document.querySelectorAll('.message-actions-menu, .message-action-menu').forEach(menu => {
                if (menu !== button.nextElementSibling) {
                    menu.style.display = 'none';
                }
            });
            // 切换当前菜单
            const menu = button.nextElementSibling;
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        }
        
        // 点击页面其他地方关闭所有消息操作菜单
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.message-actions') && !e.target.closest('.message-action-btn') && !e.target.closest('.message-actions-menu')) {
                document.querySelectorAll('.message-actions-menu').forEach(menu => {
                    menu.style.display = 'none';
                });
            }
        });
        
        // 定期获取新消息
        setInterval(getNewMessages, 3000);
        
        // 标记消息为已读
        function markMessagesAsRead() {
            const chatType = MOBILE_CHAT_CONFIG.chatType;
            const selectedId = MOBILE_CHAT_CONFIG.selectedId;
            
            if (!selectedId) return;
            
            fetch('/src/chat/mark_messages_read.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `chat_type=${chatType}&chat_id=${selectedId}`
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    console.error('标记消息为已读失败:', data.message);
                } else {
                    // 更新当前聊天项的未读角标
                    const chatItem = document.querySelector(`[data-chat-id="${selectedId}"][data-chat-type="${chatType}"]`);
                    if (chatItem) {
                        const unreadCountElement = chatItem.querySelector('.unread-count');
                        if (unreadCountElement) {
                            unreadCountElement.remove();
                        }
                    }
                }
            })
            .catch(error => {
                console.error('标记消息为已读失败:', error);
            });
        }
        
        // 页面加载时标记当前聊天的消息为已读
        document.addEventListener('DOMContentLoaded', function() {
            // 初始化视频元素
            initVideoElements();
            
            // 标记当前聊天的消息为已读
            markMessagesAsRead();
        });
        
        // 确保视频媒体操作按钮在悬停时显示
        document.addEventListener('mouseover', function(e) {
            const mediaContainer = e.target.closest('.video-container');
            if (mediaContainer) {
                const mediaActions = mediaContainer.querySelector('.media-actions');
                if (mediaActions) {
                    mediaActions.style.opacity = '1';
                }
            }
        });
        
        // 确保图片点击能弹出查看器
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('message-image')) {
                const imageUrl = e.target.src;
                const imageName = e.target.getAttribute('data-file-name');
                // 这里可以添加图片查看器的代码
                console.log('查看图片:', imageName, imageUrl);
            }
        });

        // 深色模式切换
        function toggleTheme(isDark) {
            const html = document.documentElement;
            if (isDark) {
                html.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            } else {
                html.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
            }
        }

        // 初始化深色模式
        (function initTheme() {
            const savedTheme = localStorage.getItem('theme');
            const darkModeToggle = document.getElementById('dark-mode-toggle');
            
            if (savedTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                if (darkModeToggle) darkModeToggle.checked = true;
            } else if (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                // 如果没有保存的偏好，但系统是深色模式，也自动切换
                document.documentElement.setAttribute('data-theme', 'dark');
                if (darkModeToggle) darkModeToggle.checked = true;
            }

            // 监听系统主题变化
            if (window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                    if (!localStorage.getItem('theme')) {
                        if (e.matches) {
                            document.documentElement.setAttribute('data-theme', 'dark');
                            if (darkModeToggle) darkModeToggle.checked = true;
                        } else {
                            document.documentElement.removeAttribute('data-theme');
                            if (darkModeToggle) darkModeToggle.checked = false;
                        }
                    }
                });
            }
        })();
