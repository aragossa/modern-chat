// 极验验证码初始化
        let geetestCaptcha = null;
        let smsCountdownTimer = null;
        const SMS_COOLDOWN_KEY = 'sms_cooldown_end_time';
        
        // 检查是否有未完成的倒计时
        function checkSmsCooldown() {
            const endTime = localStorage.getItem(SMS_COOLDOWN_KEY);
            if (endTime) {
                const now = Date.now();
                const remaining = Math.ceil((parseInt(endTime) - now) / 1000);
                
                if (remaining > 0) {
                    startSmsCountdown(remaining);
                } else {
                    localStorage.removeItem(SMS_COOLDOWN_KEY);
                    resetSmsButton();
                }
            }
        }
        
        // 启动倒计时
        function startSmsCountdown(seconds) {
            const btn = document.getElementById('send_sms_btn');
            
            // 如果是新启动的倒计时（即不是从localStorage恢复的），设置结束时间
            if (!localStorage.getItem(SMS_COOLDOWN_KEY)) {
                const endTime = Date.now() + (seconds * 1000);
                localStorage.setItem(SMS_COOLDOWN_KEY, endTime);
            }
            
            btn.disabled = true;
            btn.style.background = '#ccc';
            btn.style.cursor = 'not-allowed';
            
            clearInterval(smsCountdownTimer);
            
            function updateBtn() {
                btn.textContent = `${seconds}秒后重试`;
                if (seconds <= 0) {
                    clearInterval(smsCountdownTimer);
                    localStorage.removeItem(SMS_COOLDOWN_KEY);
                    resetSmsButton();
                }
                seconds--;
            }
            
            updateBtn(); // 立即执行一次
            smsCountdownTimer = setInterval(updateBtn, 1000);
        }
        
        // 重置短信按钮状态
        function resetSmsButton() {
            const btn = document.getElementById('send_sms_btn');
            // 只有当极验验证通过后才启用按钮
            if (geetestCaptcha && geetestCaptcha.getValidate()) {
                btn.disabled = false;
                btn.style.background = 'linear-gradient(135deg, #12b7f5 0%, #00a2e8 100%)';
                btn.style.cursor = 'pointer';
            } else {
                btn.disabled = true;
                btn.style.background = '#ccc';
                btn.style.cursor = 'not-allowed';
            }
            btn.textContent = '获取验证码';
        }

        // 初始化极验验证码
        initGeetest4({
            captchaId: '55574dfff9c40f2efeb5a26d6d188245'
        }, function (captcha) {
            // captcha为验证码实例
            geetestCaptcha = captcha;
            captcha.appendTo("#captcha");
            
            // 监听验证成功事件
            captcha.onSuccess(function() {
                const btn = document.getElementById('send_sms_btn');
                // 如果没有在倒计时中，则启用按钮
                if (!localStorage.getItem(SMS_COOLDOWN_KEY)) {
                    btn.disabled = false;
                    btn.style.background = 'linear-gradient(135deg, #12b7f5 0%, #00a2e8 100%)';
                    btn.style.cursor = 'pointer';
                }
            });
        });
        
        // 发送短信验证码
        document.getElementById('send_sms_btn').addEventListener('click', function() {
            if (this.disabled) return;
            
            const phone = document.getElementById('phone').value;
            if (!/^1[3-9]\d{9}$/.test(phone)) {
                alert('请输入有效的11位手机号');
                return;
            }
            
            const validate = geetestCaptcha.getValidate();
            if (!validate) {
                alert('请先完成验证码验证');
                return;
            }
            
            // 准备发送数据
            const formData = new FormData();
            formData.append('phone', phone);
            formData.append('geetest_challenge', validate.lot_number);
            formData.append('geetest_validate', validate.captcha_output);
            formData.append('geetest_seccode', validate.pass_token);
            formData.append('gen_time', validate.gen_time);
            formData.append('captcha_id', '55574dfff9c40f2efeb5a26d6d188245');
            
            // 禁用按钮防止重复点击
            this.disabled = true;
            this.textContent = '发送中...';
            
            fetch('/src/auth/send_sms.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('验证码已发送，请注意查收');
                    startSmsCountdown(60);
                    // 发送成功后锁定手机号输入框，防止修改
                    document.getElementById('phone').readOnly = true;
                    document.getElementById('phone').style.backgroundColor = '#f0f0f0';
                } else {
                    alert(data.message || '发送失败');
                    // 如果不是倒计时引起的失败，恢复按钮
                    if (!data.message.includes('秒后')) {
                         resetSmsButton();
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('发送请求失败，请检查网络');
                resetSmsButton();
            });
        });
        
        // 页面加载时检查倒计时
        checkSmsCooldown();
        
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
        
        // 表单提交处理
        async function handleRegisterSubmit(form) {
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
            return true;
        }

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

        let currentAgreement = null;
        let hasReadToBottom = {
            terms: false,
            privacy: false
        };
        let hasReadForTenSeconds = {
            terms: false,
            privacy: false
        };
        let countdownTimers = {
            terms: null,
            privacy: null
        };
        let countdownSeconds = {
            terms: 10,
            privacy: 10
        };
        const REQUIRED_READ_TIME = 10; // 必须倒计时10秒

        // 显示协议弹窗
        async function showModal(type) {
            currentAgreement = type;
            const modal = document.getElementById('agreementModal');
            const titleEl = document.getElementById('modalTitle');
            const bodyEl = document.getElementById('modalBody');
            const agreeBtn = document.getElementById('agreeBtn');
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            const timerText = document.getElementById('timerText');
            const readProgress = document.getElementById('readProgress');

            titleEl.textContent = agreements[type].title;
            bodyEl.innerHTML = '<div style="text-align: center; padding: 40px;">加载中...</div>';

            // 重置进度
            progressFill.style.width = '0%';
            progressText.textContent = '0%';
            countdownSeconds[type] = REQUIRED_READ_TIME;
            timerText.textContent = countdownSeconds[type] + '秒';
            timerText.className = 'timer-text counting';
            readProgress.classList.remove('completed');

            // 清除旧的计时器
            if (countdownTimers[type]) {
                clearInterval(countdownTimers[type]);
                countdownTimers[type] = null;
            }

            // 检查是否已经阅读完成
            const bothRead = hasReadToBottom.terms && hasReadForTenSeconds.terms &&
                           hasReadToBottom.privacy && hasReadForTenSeconds.privacy;

            if (hasReadToBottom[type] && hasReadForTenSeconds[type]) {
                agreeBtn.disabled = false;
                agreeBtn.textContent = '已阅读并同意';
                timerText.textContent = '完成';
                timerText.className = 'timer-text completed';
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

                    // 如果还没有阅读完成，启动倒计时
                    if (!hasReadForTenSeconds[type]) {
                        countdownSeconds[type] = REQUIRED_READ_TIME;
                        countdownTimers[type] = setInterval(() => {
                            countdownSeconds[type]--;
                            timerText.textContent = countdownSeconds[type] + '秒';

                            if (countdownSeconds[type] <= 0) {
                                hasReadForTenSeconds[type] = true;
                                clearInterval(countdownTimers[type]);
                                countdownTimers[type] = null;
                                timerText.textContent = '完成';
                                timerText.className = 'timer-text completed';
                                checkAgreementStatus(type);
                            }
                        }, 1000);
                    } else {
                        timerText.textContent = '完成';
                        timerText.className = 'timer-text completed';
                    }

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

            bodyEl.onscroll = function() {
                const scrollTop = bodyEl.scrollTop;
                const scrollHeight = bodyEl.scrollHeight;
                const clientHeight = bodyEl.clientHeight;

                // 计算滚动百分比
                const scrollPercent = Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100));

                progressFill.style.width = scrollPercent + '%';
                progressText.textContent = scrollPercent + '%';

                // 判断是否滚动到底部（允许5px误差）
                if (scrollTop + clientHeight >= scrollHeight - 5 && !hasReadToBottom[type]) {
                    hasReadToBottom[type] = true;
                    readProgress.classList.add('completed');
                    checkAgreementStatus(type);
                }
            };
        }

        // 检查协议状态
        function checkAgreementStatus(type) {
            const agreeBtn = document.getElementById('agreeBtn');

            // 检查当前协议是否阅读完成
            if (hasReadToBottom[type] && hasReadForTenSeconds[type]) {
                agreeBtn.disabled = false;
                agreeBtn.textContent = '已阅读并同意';
            }

            // 检查是否两个协议都阅读完成
            const bothRead = hasReadToBottom.terms && hasReadForTenSeconds.terms &&
                           hasReadToBottom.privacy && hasReadForTenSeconds.privacy;

            const agreementStatus = document.getElementById('agreementStatus');
            const registerBtn = document.getElementById('registerBtn');

            if (bothRead) {
                agreementStatus.textContent = '（已同意）';
                agreementStatus.parentElement.classList.add('completed');
                registerBtn.disabled = false;
                registerBtn.textContent = '注册';
            } else {
                let remaining = [];
                if (!hasReadToBottom.terms || !hasReadForTenSeconds.terms) {
                    remaining.push('用户协议');
                }
                if (!hasReadToBottom.privacy || !hasReadForTenSeconds.privacy) {
                    remaining.push('隐私协议');
                }
                agreementStatus.textContent = `（需阅读：${remaining.join('、')}）`;
                agreementStatus.parentElement.classList.remove('completed');
                registerBtn.disabled = true;
                registerBtn.textContent = '请先阅读协议';
            }
        }

        // 关闭弹窗
        function closeModal() {
            const bodyEl = document.getElementById('modalBody');

            // 停止倒计时
            if (currentAgreement && countdownTimers[currentAgreement]) {
                clearInterval(countdownTimers[currentAgreement]);
                countdownTimers[currentAgreement] = null;
            }

            if (bodyEl.onscroll) {
                bodyEl.onscroll = null;
            }
            document.getElementById('agreementModal').classList.remove('active');
            currentAgreement = null;
        }

        // 同意并关闭
        function agreeAndClose() {
            closeModal();
        }

        // 简单的 Markdown 渲染
        function renderMarkdown(text) {
            return text
                // 处理特殊的分隔标记
                .replace(/--- #/g, '<hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;"><h2>')
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