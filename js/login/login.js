        // 页面加载时检查安全锁
        document.addEventListener('DOMContentLoaded', () => {
            if (isSafetyLocked) {
                showSafetyLock();
            }
            
            if (document.getElementById('scan-login').classList.contains('active')) {
                initScanLogin();
            }
        });
        
        // 显示安全锁弹窗
        function showSafetyLock() {
            document.getElementById('safetyLockModal').classList.add('active');
        }
        
        // 关闭安全锁弹窗
        function closeSafetyLock() {
            document.getElementById('safetyLockModal').classList.remove('active');
        }
        
        // 继续登录
        function continueLogin() {
            document.getElementById('safetyLockModal').classList.remove('active');
        }
        
        // 浏览器指纹生成功能
        function generateBrowserFingerprint() {
            // 收集浏览器信息
            const fingerprintData = {
                userAgent: navigator.userAgent,
                screenResolution: screen.width + 'x' + screen.height,
                colorDepth: screen.colorDepth,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: navigator.language,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                localStorageEnabled: typeof(Storage) !== 'undefined' && typeof(Storage.prototype.getItem) === 'function',
                sessionStorageEnabled: typeof(Storage) !== 'undefined' && typeof(Storage.prototype.getItem) === 'function',
                plugins: Array.from(navigator.plugins).map(plugin => plugin.name + ' ' + plugin.version).join(','),
                hardwareConcurrency: navigator.hardwareConcurrency || 0,
                deviceMemory: navigator.deviceMemory || 0
            };
            
            // 将数据转换为字符串
            const fingerprintString = JSON.stringify(fingerprintData);
            
            // 使用SHA-256生成哈希值
            return crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprintString))
                .then(hashBuffer => {
                    // 将ArrayBuffer转换为十六进制字符串
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                    return hashHex;
                });
        }
        
        // 登录选项切换
        document.querySelectorAll('.login-option').forEach(option => {
            option.addEventListener('click', () => {
                const method = option.dataset.method;
                
                // 更新选项状态
                document.querySelectorAll('.login-option').forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                
                // 更新登录方式显示
                document.querySelectorAll('.login-method').forEach(methodEl => methodEl.classList.remove('active'));
                document.getElementById(method + '-login').classList.add('active');
                
                // 如果从扫码登录切换到其他登录方式，停止监测和倒计时
                if (method !== 'scan') {
                    clearInterval(checkInterval);
                    clearInterval(countdownInterval);
                }
                
                // 如果切换到扫码登录，初始化二维码
                if (method === 'scan') {
                    initScanLogin();
                }
            });
        });
        
        // 扫码登录初始化
        let checkInterval;
        let countdownInterval;
        let currentQid;
        
        async function initScanLogin() {
            // 清除之前的定时器
            if (checkInterval) clearInterval(checkInterval);
            if (countdownInterval) clearInterval(countdownInterval);
            
            try {
                // 生成浏览器指纹
                const fingerprint = await generateBrowserFingerprint();
                
                // 获取二维码，传递浏览器指纹
                const response = await fetch('/src/auth/scan_login.php', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    // 将浏览器指纹作为URL参数传递
                    cache: 'no-cache'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    currentQid = data.qid;
                    
                    // 生成二维码（使用qrcode.js库，无需外部API）
                    const qrCode = document.getElementById('qr-code');
                    qrCode.innerHTML = '<canvas id="qr-canvas"></canvas>';
                    const canvas = document.getElementById('qr-canvas');
                    
                    // 将浏览器指纹添加到二维码内容中
                    const qrContentWithFingerprint = data.qr_content + '&browser_fingerprint=' + encodeURIComponent(fingerprint);
                    
                    // 根据配置生成二维码 - 使用白底黑码
            QRCode.toCanvas(canvas, qrContentWithFingerprint, {
                width: 280,
                margin: 8,
                errorCorrectionLevel: 'H',
                color: {
                    dark: '#000000', // 二维码颜色为黑色
                    light: '#ffffff' // 背景颜色为白色
                }
            }, function(error) {
                        if (error) {
                            console.error('生成二维码失败:', error);
                            qrCode.innerHTML = '<p style="color: #ff4757;">生成二维码失败，请重试</p>';
                        } else {
                            // 添加扫码引导提示
                            const hint = document.createElement('div');
                            hint.style.position = 'absolute';
                            hint.style.top = '10px';
                            hint.style.left = '50%';
                            hint.style.transform = 'translateX(-50%)';
                            hint.style.color = '#666';
                            hint.style.fontSize = '12px';
                            hint.style.background = 'rgba(255, 255, 255, 0.9)';
                            hint.style.padding = '4px 8px';
                            hint.style.borderRadius = '4px';
                            hint.style.border = '1px solid #e0e0e0';
                            hint.textContent = '请将二维码完整对准摄像头';
                            qrCode.appendChild(hint);
                        }
                    });
                    
                    // 初始化倒计时
                    startCountdown();
                    
                    // 开始检查登录状态
                    checkLoginStatus();
                } else {
                    document.getElementById('status-message').textContent = data.message || '生成二维码失败，请重试';
                    document.getElementById('status-message').className = 'status-message status-error';
                }
            } catch (error) {
                console.error('获取二维码失败:', error);
                document.getElementById('status-message').textContent = '生成二维码失败，请重试';
                document.getElementById('status-message').className = 'status-message status-error';
            }
        }
        
        // 倒计时
        function startCountdown() {
            let seconds = 300; // 5分钟
            const countdownEl = document.getElementById('countdown');
            
            countdownInterval = setInterval(() => {
                seconds--;
                const minutes = Math.floor(seconds / 60);
                const secs = seconds % 60;
                countdownEl.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
                
                if (seconds <= 0) {
                    clearInterval(countdownInterval);
                    clearInterval(checkInterval);
                    // 显示二维码失效提示
                    const qrCode = document.getElementById('qr-code');
                    const statusMsg = document.getElementById('status-message');
                    
                    // 隐藏原有的状态信息
                    statusMsg.textContent = '';
                    statusMsg.className = 'status-message';
                    
                    // 在二维码中间显示失效提示
                    qrCode.innerHTML = `
                        <div style="position: relative; width: 200px; height: 200px; background: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                            <div style="font-size: 48px; margin-bottom: 10px;">⏰</div>
                            <p style="text-align: center; font-size: 14px; color: #666; margin-bottom: 15px;">二维码已失效</p>
                            <button onclick="initScanLogin()" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: background-color 0.2s;">
                                点击刷新二维码
                            </button>
                        </div>
                    `;
                }
            }, 1000);
        }
        
        // 检查登录状态
        function checkLoginStatus() {
            checkInterval = setInterval(() => {
                fetch(`/src/auth/scan_login.php?check_status=true&qid=${currentQid}`)
                    .then(response => response.json())
                    .then(data => {
                        const statusMsg = document.getElementById('status-message');
                        
                        // 调试信息
                        console.log('登录状态检查结果:', data);
                        
                        if (data.status === 'success') {
                            // 清除定时器，避免重复请求
                            clearInterval(checkInterval);
                            // 登录成功，跳转到/src/auth/login_process.php，使用token而不是直接使用user_id
                            console.log('登录成功，跳转到:', `/src/auth/login_process.php?scan_login=true&token=${data.token}`);
                            window.location.href = `/src/auth/login_process.php?scan_login=true&token=${data.token}`;
                        } else if (data.status === 'expired') {
                            // 二维码过期，刷新
                            clearInterval(checkInterval);
                            statusMsg.textContent = '二维码已过期，正在刷新...';
                            statusMsg.className = 'status-message status-pending';
                            setTimeout(initScanLogin, 1000);
                        } else if (data.status === 'scanned') {
                            // 已扫描，等待手机确认
                            statusMsg.textContent = '手机已扫描，等待确认登录...';
                            statusMsg.className = 'status-message status-scanned';
                        } else if (data.status === 'rejected') {
                            // 手机端拒绝登录
                            clearInterval(checkInterval);
                            clearInterval(countdownInterval);
                            
                            // 隐藏原有的状态信息
                            statusMsg.textContent = '';
                            statusMsg.className = 'status-message';
                            
                            // 在二维码中间显示失效提示
                            const qrCode = document.getElementById('qr-code');
                            qrCode.innerHTML = `
                                <div style="position: relative; width: 200px; height: 200px; background: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                                    <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                                    <p style="text-align: center; font-size: 14px; color: #666; margin-bottom: 15px;">手机端拒绝了登录请求</p>
                                    <button onclick="initScanLogin()" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: background-color 0.2s;">
                                        点击刷新二维码
                                    </button>
                                </div>
                            `;
                        } else if (data.status === 'error') {
                            // 错误状态
                            statusMsg.textContent = '检查登录状态失败: ' + (data.message || '未知错误');
                            statusMsg.className = 'status-message status-error';
                        } else {
                            // 等待扫描
                            statusMsg.textContent = '等待扫描...';
                            statusMsg.className = 'status-message status-pending';
                        }
                    })
                    .catch(error => {
                        console.error('检查登录状态失败:', error);
                        const statusMsg = document.getElementById('status-message');
                        statusMsg.textContent = '网络错误，检查登录状态失败';
                        statusMsg.className = 'status-message status-error';
                    });
            }, 1000); // 每1秒检查一次，提高响应速度
        }
        
        // 极验验证码初始化
        let geetestCaptcha = null;
        
        // 初始化极验验证码
        initGeetest4({
            captchaId: '55574dfff9c40f2efeb5a26d6d188245',
            https: true
        }, function (captcha) {
            // captcha为验证码实例
            geetestCaptcha = captcha;
            captcha.appendTo("#captcha");// 调用appendTo将验证码插入到页的某一个元素中
        });
        
        // 表单提交处理，生成浏览器指纹
        async function handleLoginSubmit(form) {
            // 检查是否同意协议
            const agreeCheckbox = document.getElementById('agree_terms');
            if (!agreeCheckbox.checked) {
                alert('请勾选同意用户协议和隐私协议');
                return false;
            }

            // 检查极验验证码是否通过
            if (!geetestCaptcha || !geetestCaptcha.getValidate()) {
                alert('请完成验证码验证');
                return false;
            }
            
            // 获取验证码验证结果
            const validate = geetestCaptcha.getValidate();
            if (validate) {
                // 极验4.0返回的参数
                document.getElementById('geetest_challenge').value = validate.lot_number;
                document.getElementById('geetest_validate').value = validate.captcha_output;
                document.getElementById('geetest_seccode').value = validate.pass_token;
                
                // 添加新的隐藏字段用于极验4.0二次校验
                const genTimeInput = document.createElement('input');
                genTimeInput.type = 'hidden';
                genTimeInput.name = 'gen_time';
                genTimeInput.value = validate.gen_time;
                form.appendChild(genTimeInput);
                
                const captchaIdInput = document.createElement('input');
                captchaIdInput.type = 'hidden';
                captchaIdInput.name = 'captcha_id';
                captchaIdInput.value = '55574dfff9c40f2efeb5a26d6d188245';
                form.appendChild(captchaIdInput);
            }
            
            // 生成浏览器指纹
            const fingerprintInput = document.getElementById('browser_fingerprint');
            if (!fingerprintInput.value) {
                const fingerprint = await generateBrowserFingerprint();
                fingerprintInput.value = fingerprint;
            }
            
            // 安全锁状态下的验证
            if (isSafetyLocked) {
                const email = document.getElementById('email').value;
                // 在安全锁状态下，需要验证用户是否为管理员
                // 这里只做前端提示，实际验证在后端/src/auth/login_process.php中进行
                alert('系统处于安全锁定状态，只有管理员账号可以登录。');
            }
            
            return true;
        }
        
        // 页面加载完成后，如果扫码登录是默认选项，初始化二维码
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('scan-login').classList.contains('active')) {
                initScanLogin();
            }
        });

        // 协议预览功能
        const agreements = {
            terms: {
                title: '用户协议',
                url: 'Agreement/terms_of_service.md'
            },
            privacy: {
                title: '隐私协议',
                url: 'Agreement/privacy_policy.md'
            }
        };

        const MIN_READ_TIME = 10; // 最小阅读时间（秒）

        let currentAgreement = null;
        let readStatus = {
            terms: { scrolledToBottom: false, readTime: 0, completed: false },
            privacy: { scrolledToBottom: false, readTime: 0, completed: false }
        };
        let readTimer = null;
        let readStartTime = null;

        // 显示协议弹窗
        async function showModal(type) {
            currentAgreement = type;
            const modal = document.getElementById('agreementModal');
            const titleEl = document.getElementById('modalTitle');
            const bodyEl = document.getElementById('modalBody');
            const agreeBtn = document.getElementById('agreeBtn');
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            const timeRemaining = document.getElementById('timeRemaining');
            const readProgress = document.getElementById('readProgress');

            titleEl.textContent = agreements[type].title;
            bodyEl.innerHTML = '<div style="text-align: center; padding: 40px;">加载中...</div>';

            // 重置进度
            progressFill.style.width = '0%';
            progressText.textContent = '0%';
            readProgress.classList.remove('completed');
            timeRemaining.textContent = '还需阅读 ' + MIN_READ_TIME + ' 秒';

            // 清除之前的计时器
            if (readTimer) {
                clearInterval(readTimer);
                readTimer = null;
            }

            // 根据阅读状态设置按钮
            if (readStatus[type].completed) {
                agreeBtn.disabled = false;
                agreeBtn.textContent = '已阅读并同意';
                readProgress.classList.add('completed');
                progressFill.style.width = '100%';
                progressText.textContent = '100%';
                timeRemaining.textContent = '已完成阅读';
            } else {
                agreeBtn.disabled = true;
                agreeBtn.textContent = '请先完整阅读协议';
            }

            modal.classList.add('active');

            try {
                const response = await fetch(agreements[type].url);
                if (response.ok) {
                    const content = await response.text();
                    bodyEl.innerHTML = renderMarkdown(content);

                    // 添加滚动监听
                    setTimeout(() => {
                        setupScrollListener(type);
                    }, 100);
                } else {
                    bodyEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #ff4d4f;">加载失败，请稍后重试</div>';
                }
            } catch (error) {
                console.error('加载协议失败:', error);
                bodyEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #ff4d4f;">加载失败，请稍后重试</div>';
            }
        }

        // 设置滚动监听
        function setupScrollListener(type) {
            const bodyEl = document.getElementById('modalBody');
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            const agreeBtn = document.getElementById('agreeBtn');
            const readProgress = document.getElementById('readProgress');
            const timeRemaining = document.getElementById('timeRemaining');

            // 如果该协议尚未完成，开始计时
            if (!readStatus[type].completed) {
                readStartTime = Date.now();
                readTimer = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - readStartTime) / 1000);
                    const remaining = Math.max(0, MIN_READ_TIME - elapsed);

                    if (remaining > 0) {
                        timeRemaining.textContent = '还需阅读 ' + remaining + ' 秒';
                    } else {
                        timeRemaining.textContent = '阅读时间已达要求';
                        checkCanAgree(type);
                    }
                }, 1000);
            }

            bodyEl.onscroll = function() {
                const scrollTop = bodyEl.scrollTop;
                const scrollHeight = bodyEl.scrollHeight;
                const clientHeight = bodyEl.clientHeight;

                // 计算滚动百分比
                const scrollPercent = Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100));

                progressFill.style.width = scrollPercent + '%';
                progressText.textContent = scrollPercent + '%';

                // 判断是否滚动到底部（允许5px误差）
                if (scrollTop + clientHeight >= scrollHeight - 5) {
                    readStatus[type].scrolledToBottom = true;
                    checkCanAgree(type);
                }
            };
        }

        // 检查是否可以同意
        function checkCanAgree(type) {
            const agreeBtn = document.getElementById('agreeBtn');
            const readProgress = document.getElementById('readProgress');
            const timeRemaining = document.getElementById('timeRemaining');

            const elapsed = Math.floor((Date.now() - readStartTime) / 1000);
            const timeMet = elapsed >= MIN_READ_TIME;
            const scrolled = readStatus[type].scrolledToBottom;

            if (scrolled && timeMet) {
                readStatus[type].completed = true;
                readStatus[type].readTime = elapsed;

                agreeBtn.disabled = false;
                agreeBtn.textContent = '已阅读并同意';
                readProgress.classList.add('completed');
                timeRemaining.textContent = '已完成阅读';

                // 清除计时器
                if (readTimer) {
                    clearInterval(readTimer);
                    readTimer = null;
                }
            }
        }

        // 关闭弹窗
        function closeModal() {
            const bodyEl = document.getElementById('modalBody');
            if (bodyEl.onscroll) {
                bodyEl.onscroll = null;
            }
            if (readTimer) {
                clearInterval(readTimer);
                readTimer = null;
            }
            document.getElementById('agreementModal').classList.remove('active');
            currentAgreement = null;
        }

        // 同意并关闭
        function agreeAndClose() {
            closeModal();
        }

        // 检查登录是否允许
        function canLogin() {
            // 两个协议都必须完成阅读
            return readStatus.terms.completed && readStatus.privacy.completed;
        }

        // 简单的 Markdown 渲染
        function renderMarkdown(text) {
            return text
                // 标题
                .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                // 分隔线
                .replace(/^---$/gm, '<hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">')
                // 粗体
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                // 列表
                .replace(/^- (.+)$/gm, '<li>$1</li>')
                .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
                // 段落
                .replace(/^([^<\n].+)$/gm, '<p>$1</p>')
                // 清理空段落
                .replace(/<p><\/p>/g, '')
                .replace(/<p>(<h[1-6]>)/g, '$1')
                .replace(/(<\/h[1-6]>)<\/p>/g, '$1');
        }

        // 点击遮罩层关闭弹窗
        document.getElementById('agreementModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                closeModal();
            }
        });

        // ESC键关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        });
