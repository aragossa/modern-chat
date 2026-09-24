        function openTab(evt, tabName) {
            // 关闭所有标签页
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tab-content");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].style.display = "none";
            }
            tablinks = document.getElementsByClassName("tab");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].className = tablinks[i].className.replace(" active", "");
            }
            // 打开当前标签页
            document.getElementById(tabName).style.display = "block";
            if (evt) {
                evt.currentTarget.className += " active";
            } else {
                // 如果没有事件对象，手动激活对应标签
                var tabBtn = document.querySelector(`[onclick="openTab(event, '${tabName}')"]`);
                if (tabBtn) {
                    tabBtn.className += " active";
                }
            }
        }
        
        // 公告管理相关函数
        function showEditAnnouncementModal(id, title, content, isActive) {
            document.getElementById('edit-announcement-id').value = id;
            document.getElementById('edit-announcement-title').value = title;
            document.getElementById('edit-announcement-content').value = content;
            document.getElementById('edit-announcement-active').checked = isActive;
            document.getElementById('edit-announcement-modal').style.display = 'flex';
        }
        
        function closeEditAnnouncementModal() {
            document.getElementById('edit-announcement-modal').style.display = 'none';
        }
        
        function showDeleteAnnouncementModal(id) {
            document.getElementById('delete-announcement-id').value = id;
            document.getElementById('delete-announcement-modal').style.display = 'flex';
        }
        
        function closeDeleteAnnouncementModal() {
            document.getElementById('delete-announcement-modal').style.display = 'none';
        }
        
        // 页面加载时检查URL参数，激活对应的标签页
        document.addEventListener('DOMContentLoaded', function() {
            const urlParams = new URLSearchParams(window.location.search);
            const tab = urlParams.get('tab');
            if (tab && document.getElementById(tab)) {
                openTab(null, tab);
            }
        });
        
        // 清除数据相关变量
        let currentClearAction = '';
        let currentActionId = '';
        let countdownInterval = null;
        let countdownTime = 4;
        
        // 显示清除数据确认弹窗
        function showClearDataModal(action, id = '') {
            currentClearAction = action;
            currentActionId = id;
            
            // 设置确认消息
            const messageEl = document.getElementById('clear-data-message');
            switch(action) {
                case 'clear_all_messages':
                    messageEl.textContent = '确定要清除所有聊天记录吗？此操作不可恢复！';
                    break;
                case 'clear_all_files':
                    messageEl.textContent = '确定要清除所有文件记录吗？此操作不可恢复！';
                    break;
                case 'clear_all_scan_login':
                    messageEl.textContent = '确定要清除所有扫码登录数据吗？此操作不可恢复！';
                    break;
                case 'clear_scan_login_expired':
                    messageEl.textContent = '确定要清除过期的扫码登录数据吗？';
                    break;
                case 'clear_scan_login_all':
                    messageEl.textContent = '确定要清除所有扫码登录数据吗？此操作不可恢复！';
                    break;
                case 'delete_group':
                    messageEl.textContent = '确定要解散这个群聊吗？此操作不可恢复！';
                    break;
                case 'deactivate_user':
                    messageEl.textContent = '确定要注销这个用户吗？用户将不允许登录。';
                    break;
                case 'delete_user':
                    messageEl.textContent = '确定要强制删除这个用户吗？此操作不可恢复！';
                    break;
            }
            
            // 重置密码输入和错误提示
            document.getElementById('admin-password').value = '';
            document.getElementById('password-error').style.display = 'none';
            
            // 重置倒计时
            resetCountdown();
            
            // 显示弹窗
            document.getElementById('clear-data-modal').style.display = 'flex';
            
            // 开始倒计时
            startCountdown();
            
            // 添加事件监听器
            document.getElementById('cancel-clear-btn').addEventListener('click', closeClearDataModal);
            document.getElementById('confirm-clear-btn').addEventListener('click', handleConfirmClear);
            document.getElementById('admin-password').addEventListener('input', handlePasswordInput);
        }
        
        // 关闭清除数据确认弹窗
        function closeClearDataModal() {
            document.getElementById('clear-data-modal').style.display = 'none';
            
            // 清除倒计时
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            
            // 移除事件监听器
            document.getElementById('cancel-clear-btn').removeEventListener('click', closeClearDataModal);
            document.getElementById('confirm-clear-btn').removeEventListener('click', handleConfirmClear);
            document.getElementById('admin-password').removeEventListener('input', handlePasswordInput);
        }
        
        // 重置倒计时
        function resetCountdown() {
            countdownTime = 3;
            const countdownEl = document.getElementById('countdown');
            countdownEl.textContent = countdownTime;
            
            const confirmBtn = document.getElementById('confirm-clear-btn');
            confirmBtn.disabled = true;
            confirmBtn.style.cursor = 'not-allowed';
            confirmBtn.style.opacity = '0.6';
        }
        
        // 开始倒计时
        function startCountdown() {
            if (countdownInterval) {
                clearInterval(countdownInterval);
            }
            
            countdownInterval = setInterval(() => {
                countdownTime--;
                const countdownEl = document.getElementById('countdown');
                countdownEl.textContent = countdownTime;
                
                if (countdownTime <= 0) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                    
                    const confirmBtn = document.getElementById('confirm-clear-btn');
                    confirmBtn.disabled = false;
                    confirmBtn.style.cursor = 'pointer';
                    confirmBtn.style.opacity = '1';
                    confirmBtn.textContent = '确定';
                }
            }, 1000);
        }
        
        // 处理密码输入
        function handlePasswordInput() {
            // 隐藏密码错误提示
            document.getElementById('password-error').style.display = 'none';
        }
        
        // 处理确认清除
        function handleConfirmClear() {
            const password = document.getElementById('admin-password').value;
            if (!password) {
                document.getElementById('password-error').textContent = '请输入密码';
                document.getElementById('password-error').style.display = 'block';
                return;
            }
            
            // 验证密码
            validatePassword(password).then(isValid => {
                if (isValid) {
                    // 密码正确，执行清除操作
                    executeClearAction();
                } else {
                    // 密码错误，显示错误提示
                    document.getElementById('password-error').style.display = 'block';
                }
            });
        }
        
        // 验证管理员密码
        async function validatePassword(password) {
            try {
                const response = await fetch('/src/admin/admin.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        'action': 'validate_admin_password',
                        'password': password
                    })
                });
                
                const result = await response.json();
                return result.valid;
            } catch (error) {
                console.error('验证密码失败:', error);
                return false;
            }
        }
        
        // 执行清除操作
        function executeClearAction() {
            const password = document.getElementById('admin-password').value;
            
            // 创建表单
            const form = document.createElement('form');
            form.method = 'POST';
            form.style.display = 'none';
            
            // 添加表单字段
            const actionInput = document.createElement('input');
            actionInput.type = 'hidden';
            actionInput.name = 'action';
            actionInput.value = currentClearAction;
            form.appendChild(actionInput);
            
            const passwordInput = document.createElement('input');
            passwordInput.type = 'hidden';
            passwordInput.name = 'password';
            passwordInput.value = password;
            form.appendChild(passwordInput);
            
            // 添加ID字段（如果需要）
        if (currentActionId !== '') {
            const idInput = document.createElement('input');
            idInput.type = 'hidden';
            // 根据操作类型设置不同的ID字段名
            switch(currentClearAction) {
                case 'delete_group':
                    idInput.name = 'group_id';
                    break;
                case 'deactivate_user':
                case 'delete_user':
                    idInput.name = 'user_id';
                    break;
            }
            idInput.value = currentActionId;
            form.appendChild(idInput);
        }
    }
    
    // 群聊封禁相关变量
    let currentGroupId = '';
    let groupBanCountdownInterval = null;
    let groupBanCountdownTime = 5;
    
    // 显示封禁群聊弹窗
    function showBanGroupModal(groupId, groupName) {
        currentGroupId = groupId;
        document.getElementById('ban-group-name').textContent = `群聊：${groupName}`;
        
        // 重置表单
        document.getElementById('ban-group-reason').value = '';
        document.getElementById('ban-group-years').value = '0';
        document.getElementById('ban-group-months').value = '0';
        document.getElementById('ban-group-days').value = '0';
        document.getElementById('ban-group-hours').value = '0';
        document.getElementById('ban-group-minutes').value = '0';
        document.getElementById('ban-group-permanent').checked = false;
        document.getElementById('admin-password-ban-group').value = '';
        
        // 隐藏错误提示
        document.getElementById('ban-group-reason-error').style.display = 'none';
        document.getElementById('ban-group-duration-error').style.display = 'none';
        document.getElementById('admin-password-error-ban-group').style.display = 'none';
        
        // 重置按钮状态
        const confirmBtn = document.getElementById('confirm-ban-group-btn');
        confirmBtn.disabled = true;
        confirmBtn.style.cursor = 'not-allowed';
        confirmBtn.style.opacity = '0.6';
        
        // 隐藏倒计时
        document.getElementById('ban-group-countdown').style.display = 'none';
        
        // 显示弹窗
        document.getElementById('ban-group-modal').style.display = 'flex';
        
        // 添加事件监听器
        document.getElementById('cancel-ban-group-btn').addEventListener('click', closeBanGroupModal);
        document.getElementById('confirm-ban-group-btn').addEventListener('click', handleConfirmBanGroup);
        document.getElementById('ban-group-permanent').addEventListener('change', handleBanGroupPermanentChange);
        document.getElementById('admin-password-ban-group').addEventListener('input', handleBanGroupPasswordInput);
    }
    
    // 关闭封禁群聊弹窗
    function closeBanGroupModal() {
        document.getElementById('ban-group-modal').style.display = 'none';
        
        // 清除倒计时
        if (groupBanCountdownInterval) {
            clearInterval(groupBanCountdownInterval);
            groupBanCountdownInterval = null;
        }
        
        // 移除事件监听器
        document.getElementById('cancel-ban-group-btn').removeEventListener('click', closeBanGroupModal);
        document.getElementById('confirm-ban-group-btn').removeEventListener('click', handleConfirmBanGroup);
        document.getElementById('ban-group-permanent').removeEventListener('change', handleBanGroupPermanentChange);
        document.getElementById('admin-password-ban-group').removeEventListener('input', handleBanGroupPasswordInput);
    }
    
    // 处理永久封禁复选框变化
    function handleBanGroupPermanentChange() {
        const isPermanent = document.getElementById('ban-group-permanent').checked;
        const durationInputs = ['ban-group-years', 'ban-group-months', 'ban-group-days', 'ban-group-hours', 'ban-group-minutes'];
        const warningEl = document.getElementById('ban-group-permanent-warning');
        
        durationInputs.forEach(id => {
            const input = document.getElementById(id);
            input.disabled = isPermanent;
            if (isPermanent) {
                input.value = '0';
            }
        });
        
        // 显示或隐藏永久封禁警告
        warningEl.style.display = isPermanent ? 'block' : 'none';
    }
    
    // 处理封禁群聊密码输入
    function handleBanGroupPasswordInput() {
        document.getElementById('admin-password-error-ban-group').style.display = 'none';
        
        // 密码输入后开始5秒倒计时
        const password = document.getElementById('admin-password-ban-group').value;
        if (password) {
            startGroupBanCountdown();
        } else {
            // 清除倒计时
            if (groupBanCountdownInterval) {
                clearInterval(groupBanCountdownInterval);
                groupBanCountdownInterval = null;
            }
            
            // 重置按钮和倒计时
            const confirmBtn = document.getElementById('confirm-ban-group-btn');
            confirmBtn.disabled = true;
            confirmBtn.style.cursor = 'not-allowed';
            confirmBtn.style.opacity = '0.6';
            document.getElementById('ban-group-countdown').style.display = 'none';
        }
    }
    
    // 开始封禁群聊倒计时
    function startGroupBanCountdown() {
        // 重置倒计时
        groupBanCountdownTime = 5;
        document.getElementById('ban-group-countdown-time').textContent = groupBanCountdownTime;
        document.getElementById('ban-group-countdown').style.display = 'block';
        
        const confirmBtn = document.getElementById('confirm-ban-group-btn');
        confirmBtn.disabled = true;
        confirmBtn.style.cursor = 'not-allowed';
        confirmBtn.style.opacity = '0.6';
        
        // 清除之前的倒计时
        if (groupBanCountdownInterval) {
            clearInterval(groupBanCountdownInterval);
        }
        
        // 开始新的倒计时
        groupBanCountdownInterval = setInterval(() => {
            groupBanCountdownTime--;
            document.getElementById('ban-group-countdown-time').textContent = groupBanCountdownTime;
            
            if (groupBanCountdownTime <= 0) {
                clearInterval(groupBanCountdownInterval);
                groupBanCountdownInterval = null;
                
                confirmBtn.disabled = false;
                confirmBtn.style.cursor = 'pointer';
                confirmBtn.style.opacity = '1';
            }
        }, 1000);
    }
    
    // 处理确认封禁群聊
    async function handleConfirmBanGroup() {
        const reason = document.getElementById('ban-group-reason').value.trim();
        const isPermanent = document.getElementById('ban-group-permanent').checked;
        const password = document.getElementById('admin-password-ban-group').value;
        
        // 验证理由
        if (!reason) {
            document.getElementById('ban-group-reason-error').textContent = '请输入封禁理由';
            document.getElementById('ban-group-reason-error').style.display = 'block';
            return;
        }
        
        // 计算封禁时长
        let banDuration = 0;
        if (!isPermanent) {
            const years = parseInt(document.getElementById('ban-group-years').value) || 0;
            const months = parseInt(document.getElementById('ban-group-months').value) || 0;
            const days = parseInt(document.getElementById('ban-group-days').value) || 0;
            const hours = parseInt(document.getElementById('ban-group-hours').value) || 0;
            const minutes = parseInt(document.getElementById('ban-group-minutes').value) || 0;
            
            // 转换为秒
            banDuration = (years * 365 * 24 * 60 * 60) + 
                         (months * 30 * 24 * 60 * 60) + 
                         (days * 24 * 60 * 60) + 
                         (hours * 60 * 60) + 
                         (minutes * 60);
            
            if (banDuration <= 0) {
                document.getElementById('ban-group-duration-error').textContent = '请输入有效的封禁时长或选择永久封禁';
                document.getElementById('ban-group-duration-error').style.display = 'block';
                return;
            }
        }
        
        // 验证密码
        const isValidPassword = await validatePassword(password);
        if (!isValidPassword) {
            document.getElementById('admin-password-error-ban-group').textContent = '密码错误，请重试';
            document.getElementById('admin-password-error-ban-group').style.display = 'block';
            return;
        }
        
        // 创建表单
        const form = document.createElement('form');
        form.method = 'POST';
        form.style.display = 'none';
        
        // 添加表单字段
        form.appendChild(createHiddenInput('action', 'ban_group'));
        form.appendChild(createHiddenInput('group_id', currentGroupId));
        form.appendChild(createHiddenInput('ban_reason', reason));
        form.appendChild(createHiddenInput('ban_duration', isPermanent ? 0 : banDuration));
        form.appendChild(createHiddenInput('password', password));
        
        // 添加到页面并提交
        document.body.appendChild(form);
        form.submit();
    }
    
    // 显示解除群聊封禁弹窗
    function showLiftGroupBanModal(groupId) {
        currentGroupId = groupId;
        
        // 重置表单
        document.getElementById('admin-password-lift-group-ban').value = '';
        document.getElementById('admin-password-error-lift-group-ban').style.display = 'none';
        
        // 显示弹窗
        document.getElementById('lift-group-ban-modal').style.display = 'flex';
        
        // 添加事件监听器
        document.getElementById('cancel-lift-group-ban-btn').addEventListener('click', closeLiftGroupBanModal);
        document.getElementById('confirm-lift-group-ban-btn').addEventListener('click', handleConfirmLiftGroupBan);
        document.getElementById('admin-password-lift-group-ban').addEventListener('input', handleLiftGroupBanPasswordInput);
    }
    
    // 关闭解除群聊封禁弹窗
    function closeLiftGroupBanModal() {
        document.getElementById('lift-group-ban-modal').style.display = 'none';
        
        // 移除事件监听器
        document.getElementById('cancel-lift-group-ban-btn').removeEventListener('click', closeLiftGroupBanModal);
        document.getElementById('confirm-lift-group-ban-btn').removeEventListener('click', handleConfirmLiftGroupBan);
        document.getElementById('admin-password-lift-group-ban').removeEventListener('input', handleLiftGroupBanPasswordInput);
    }
    
    // 处理解除群聊封禁密码输入
    function handleLiftGroupBanPasswordInput() {
        document.getElementById('admin-password-error-lift-group-ban').style.display = 'none';
    }
    
    // 处理确认解除群聊封禁
    async function handleConfirmLiftGroupBan() {
        const password = document.getElementById('admin-password-lift-group-ban').value;
        
        // 验证密码
        const isValidPassword = await validatePassword(password);
        if (!isValidPassword) {
            document.getElementById('admin-password-error-lift-group-ban').textContent = '密码错误，请重试';
            document.getElementById('admin-password-error-lift-group-ban').style.display = 'block';
            return;
        }
        
        // 创建表单
        const form = document.createElement('form');
        form.method = 'POST';
        form.style.display = 'none';
        
        // 添加表单字段
        form.appendChild(createHiddenInput('action', 'lift_group_ban'));
        form.appendChild(createHiddenInput('group_id', currentGroupId));
        form.appendChild(createHiddenInput('password', password));
        
        // 添加到页面并提交
        document.body.appendChild(form);
        form.submit();
    }
    
    // 创建隐藏输入字段辅助函数
    function createHiddenInput(name, value) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        return input;
    }
        
        // 显示操作结果弹窗
        function showResultModal(success, title, message) {
            const modal = document.getElementById('result-modal');
            const iconEl = document.getElementById('result-icon');
            const titleEl = document.getElementById('result-title');
            const messageEl = document.getElementById('result-message');
            
            // 设置图标
            iconEl.textContent = success ? '✅' : '❌';
            
            // 设置标题和消息
            titleEl.textContent = title;
            messageEl.textContent = message;
            
            // 显示弹窗
            modal.style.display = 'flex';
        }
        
        // 关闭封禁记录弹窗
        function closeBanRecordModal() {
            document.getElementById('ban-record-modal').style.display = 'none';
        }
        
        // 显示封禁记录
        function showBanRecordModal(type, id, name) {
            const modal = document.getElementById('ban-record-modal');
            const titleEl = document.getElementById('ban-record-title');
            const contentEl = document.getElementById('ban-record-content');
            
            // 设置标题
            titleEl.textContent = `${type === 'user' ? '用户' : '群聊'} "${name}" 的封禁记录`;
            
            // 显示加载状态
            contentEl.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">加载中...</div>';
            
            // 显示弹窗
            modal.style.display = 'flex';
            
            // 发送请求获取封禁记录
            fetch(`/src/admin/get_ban_records.php?type=${type}&id=${id}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        if (data.records.length === 0) {
                            contentEl.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">暂无封禁记录</p>';
                        } else {
                            let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
                            data.records.forEach(record => {
                                html += `
                                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                            <div>
                                                <h4 style="margin: 0 0 8px 0; color: #333; font-size: 15px;">${record.action === 'ban' ? '封禁' : record.action === 'lift' ? '解除封禁' : '自动解除'}</h4>
                                                <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">原因: ${record.reason || '无'}</p>
                                                <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">操作人: ${record.banned_by || '系统'}</p>
                                                <p style="margin: 0 0 4px 0; color: #666; font-size: 13px;">封禁时间: ${record.ban_start}</p>
                                                ${record.ban_end ? `<p style="margin: 0; color: #666; font-size: 13px;">截止时间: ${record.ban_end}</p>` : ''}
                                            </div>
                                            <div style="font-size: 12px; color: #999; margin-top: 5px;">${record.action_time}</div>
                                        </div>
                                    </div>
                                `;
                            });
                            html += '</div>';
                            contentEl.innerHTML = html;
                        }
                    } else {
                        contentEl.innerHTML = `<p style="text-align: center; color: #ff4757; padding: 20px;">${data.message}</p>`;
                    }
                })
                .catch(error => {
                    console.error('获取封禁记录失败:', error);
                    contentEl.innerHTML = '<p style="text-align: center; color: #ff4757; padding: 20px;">获取封禁记录失败，请稍后重试</p>';
                });
        }
        
        // 关闭操作结果弹窗
        function closeResultModal() {
            document.getElementById('result-modal').style.display = 'none';
        }
        
        // 封禁用户相关变量
        let currentBanUserId = '';
        
        // 显示封禁用户弹窗
        function showBanUserModal(userId, username) {
            currentBanUserId = userId;
            
            // 设置用户名
            const usernameEl = document.getElementById('ban-user-username');
            usernameEl.textContent = `用户: ${username}`;
            
            // 重置输入字段和错误提示
            document.getElementById('ban-reason').value = '';
            document.getElementById('ban-years').value = '0';
            document.getElementById('ban-months').value = '0';
            document.getElementById('ban-days').value = '0';
            document.getElementById('ban-hours').value = '0';
            document.getElementById('ban-minutes').value = '0';
            document.getElementById('ban-permanent').checked = false;
            document.getElementById('admin-password-ban').value = '';
            document.getElementById('ban-reason-error').style.display = 'none';
            document.getElementById('ban-duration-error').style.display = 'none';
            document.getElementById('ban-permanent-warning').style.display = 'none';
            document.getElementById('admin-password-error-ban').style.display = 'none';
            
            // 显示弹窗
            document.getElementById('ban-user-modal').style.display = 'flex';
            
            // 添加事件监听器
            document.getElementById('cancel-ban-btn').addEventListener('click', closeBanUserModal);
            document.getElementById('confirm-ban-btn').addEventListener('click', handleBanUser);
            document.getElementById('ban-permanent').addEventListener('change', handleBanPermanentChange);
        }
        
        // 关闭封禁用户弹窗
        function closeBanUserModal() {
            document.getElementById('ban-user-modal').style.display = 'none';
            
            // 移除事件监听器
            document.getElementById('cancel-ban-btn').removeEventListener('click', closeBanUserModal);
            document.getElementById('confirm-ban-btn').removeEventListener('click', handleBanUser);
            document.getElementById('ban-permanent').removeEventListener('change', handleBanPermanentChange);
        }
        
        // 处理永久封禁复选框变化
        function handleBanPermanentChange() {
            const isPermanent = document.getElementById('ban-permanent').checked;
            const durationInputs = ['ban-years', 'ban-months', 'ban-days', 'ban-hours', 'ban-minutes'];
            const warningEl = document.getElementById('ban-permanent-warning');
            
            durationInputs.forEach(id => {
                const input = document.getElementById(id);
                input.disabled = isPermanent;
                if (isPermanent) {
                    input.value = '0';
                }
            });
            
            // 显示或隐藏永久封禁警告
            warningEl.style.display = isPermanent ? 'block' : 'none';
        }
        
        // 处理封禁用户
        async function handleBanUser() {
            const reason = document.getElementById('ban-reason').value.trim();
            const isPermanent = document.getElementById('ban-permanent').checked;
            const adminPassword = document.getElementById('admin-password-ban').value;
            
            // 验证输入
            if (!reason) {
                document.getElementById('ban-reason-error').textContent = '请输入封禁理由';
                document.getElementById('ban-reason-error').style.display = 'block';
                return;
            }
            
            // 计算封禁时长
            let banDuration = 0;
            if (!isPermanent) {
                const years = parseInt(document.getElementById('ban-years').value) || 0;
                const months = parseInt(document.getElementById('ban-months').value) || 0;
                const days = parseInt(document.getElementById('ban-days').value) || 0;
                const hours = parseInt(document.getElementById('ban-hours').value) || 0;
                const minutes = parseInt(document.getElementById('ban-minutes').value) || 0;
                
                // 转换为秒
                banDuration = (years * 365 * 24 * 60 * 60) + 
                             (months * 30 * 24 * 60 * 60) + 
                             (days * 24 * 60 * 60) + 
                             (hours * 60 * 60) + 
                             (minutes * 60);
                
                if (banDuration <= 0) {
                    document.getElementById('ban-duration-error').textContent = '请输入有效的封禁时长或选择永久封禁';
                    document.getElementById('ban-duration-error').style.display = 'block';
                    return;
                }
            }
            
            if (!adminPassword) {
                document.getElementById('admin-password-error-ban').textContent = '请输入管理员密码';
                document.getElementById('admin-password-error-ban').style.display = 'block';
                return;
            }
            
            // 验证管理员密码
            const isValid = await validatePassword(adminPassword);
            if (isValid) {
                // 密码正确，执行封禁操作
                executeBanUser(reason, isPermanent ? 0 : banDuration, adminPassword);
            } else {
                // 密码错误，显示错误提示
                document.getElementById('admin-password-error-ban').style.display = 'block';
            }
        }
        
        // 执行封禁用户操作
        function executeBanUser(reason, duration, adminPassword) {
            // 创建表单
            const form = document.createElement('form');
            form.method = 'POST';
            form.style.display = 'none';
            
            // 添加表单字段
            const actionInput = document.createElement('input');
            actionInput.type = 'hidden';
            actionInput.name = 'action';
            actionInput.value = 'ban_user';
            form.appendChild(actionInput);
            
            const userIdInput = document.createElement('input');
            userIdInput.type = 'hidden';
            userIdInput.name = 'user_id';
            userIdInput.value = currentBanUserId;
            form.appendChild(userIdInput);
            
            const reasonInput = document.createElement('input');
            reasonInput.type = 'hidden';
            reasonInput.name = 'ban_reason';
            reasonInput.value = reason;
            form.appendChild(reasonInput);
            
            const durationInput = document.createElement('input');
            durationInput.type = 'hidden';
            durationInput.name = 'ban_duration';
            durationInput.value = duration;
            form.appendChild(durationInput);
            
            const passwordInput = document.createElement('input');
            passwordInput.type = 'hidden';
            passwordInput.name = 'password';
            passwordInput.value = adminPassword;
            form.appendChild(passwordInput);
            
            // 添加到页面并提交
            document.body.appendChild(form);
            form.submit();
            
            // 关闭弹窗
            closeBanUserModal();
        }
        
        // 解除封禁相关变量
        let currentLiftBanUserId = '';
        
        // 显示解除封禁弹窗
        function showLiftBanModal(userId, username) {
            currentLiftBanUserId = userId;
            
            // 设置用户名
            const usernameEl = document.getElementById('lift-ban-username');
            usernameEl.textContent = `用户: ${username}`;
            
            // 重置输入字段和错误提示
            document.getElementById('admin-password-lift-ban').value = '';
            document.getElementById('admin-password-error-lift-ban').style.display = 'none';
            
            // 显示弹窗
            document.getElementById('lift-ban-modal').style.display = 'flex';
            
            // 添加事件监听器
            document.getElementById('cancel-lift-ban-btn').addEventListener('click', closeLiftBanModal);
            document.getElementById('confirm-lift-ban-btn').addEventListener('click', handleLiftBan);
        }
        
        // 关闭解除封禁弹窗
        function closeLiftBanModal() {
            document.getElementById('lift-ban-modal').style.display = 'none';
            
            // 移除事件监听器
            document.getElementById('cancel-lift-ban-btn').removeEventListener('click', closeLiftBanModal);
            document.getElementById('confirm-lift-ban-btn').removeEventListener('click', handleLiftBan);
        }
        
        // 处理解除封禁
        async function handleLiftBan() {
            const adminPassword = document.getElementById('admin-password-lift-ban').value;
            
            if (!adminPassword) {
                document.getElementById('admin-password-error-lift-ban').textContent = '请输入管理员密码';
                document.getElementById('admin-password-error-lift-ban').style.display = 'block';
                return;
            }
            
            // 验证管理员密码
            const isValid = await validatePassword(adminPassword);
            if (isValid) {
                // 密码正确，执行解除封禁操作
                executeLiftBan(adminPassword);
            } else {
                // 密码错误，显示错误提示
                document.getElementById('admin-password-error-lift-ban').style.display = 'block';
            }
        }
        
        // 执行解除封禁操作
        function executeLiftBan(adminPassword) {
            // 创建表单
            const form = document.createElement('form');
            form.method = 'POST';
            form.style.display = 'none';
            
            // 添加表单字段
            const actionInput = document.createElement('input');
            actionInput.type = 'hidden';
            actionInput.name = 'action';
            actionInput.value = 'lift_ban';
            form.appendChild(actionInput);
            
            const userIdInput = document.createElement('input');
            userIdInput.type = 'hidden';
            userIdInput.name = 'user_id';
            userIdInput.value = currentLiftBanUserId;
            form.appendChild(userIdInput);
            
            const passwordInput = document.createElement('input');
            passwordInput.type = 'hidden';
            passwordInput.name = 'password';
            passwordInput.value = adminPassword;
            form.appendChild(passwordInput);
            
            // 添加到页面并提交
            document.body.appendChild(form);
            form.submit();
            
            // 关闭弹窗
            closeLiftBanModal();
        }
        
        // 修改密码相关变量
        let currentUserId = '';
        
        // 显示修改密码弹窗
        function showChangePasswordModal(userId, username) {
            currentUserId = userId;
            
            // 设置用户名
            const usernameEl = document.getElementById('change-password-username');
            usernameEl.textContent = `用户: ${username}`;
            
            // 重置输入字段和错误提示
            document.getElementById('new-password').value = '';
            document.getElementById('admin-password-change').value = '';
            document.getElementById('password-error').style.display = 'none';
            document.getElementById('admin-password-error-change').style.display = 'none';
            
            // 显示弹窗
            document.getElementById('change-password-modal').style.display = 'flex';
            
            // 添加事件监听器
            document.getElementById('cancel-change-password-btn').addEventListener('click', closeChangePasswordModal);
            document.getElementById('confirm-change-password-btn').addEventListener('click', handleChangePassword);
            document.getElementById('new-password').addEventListener('input', handlePasswordInputChange);
        }
        
        // 关闭修改密码弹窗
        function closeChangePasswordModal() {
            document.getElementById('change-password-modal').style.display = 'none';
            
            // 移除事件监听器
            document.getElementById('cancel-change-password-btn').removeEventListener('click', closeChangePasswordModal);
            document.getElementById('confirm-change-password-btn').removeEventListener('click', handleChangePassword);
            document.getElementById('new-password').removeEventListener('input', handlePasswordInputChange);
        }
        
        // 处理密码输入变化
        function handlePasswordInputChange() {
            // 隐藏密码错误提示
            document.getElementById('password-error').style.display = 'none';
        }
        
        // 检查密码复杂度
        function checkPasswordComplexity(password) {
            let complexity = 0;
            
            // 检查是否包含小写字母
            if (/[a-z]/.test(password)) complexity++;
            
            // 检查是否包含大写字母
            if (/[A-Z]/.test(password)) complexity++;
            
            // 检查是否包含数字
            if (/\d/.test(password)) complexity++;
            
            // 检查是否包含特殊符号
            if (/[^a-zA-Z0-9]/.test(password)) complexity++;
            
            return complexity >= 2;
        }
        
        // 处理修改密码
        async function handleChangePassword() {
            const newPassword = document.getElementById('new-password').value;
            const adminPassword = document.getElementById('admin-password-change').value;
            
            // 检查密码复杂度
            if (!newPassword) {
                document.getElementById('password-error').textContent = '请输入新密码';
                document.getElementById('password-error').style.display = 'block';
                return;
            }
            
            if (!checkPasswordComplexity(newPassword)) {
                document.getElementById('password-error').textContent = '密码不符合安全要求，请包含至少2种字符类型（大小写字母、数字、特殊符号）';
                document.getElementById('password-error').style.display = 'block';
                return;
            }
            
            if (!adminPassword) {
                document.getElementById('admin-password-error-change').textContent = '请输入管理员密码';
                document.getElementById('admin-password-error-change').style.display = 'block';
                return;
            }
            
            // 验证管理员密码
            const isValid = await validatePassword(adminPassword);
            if (isValid) {
                // 密码正确，执行修改密码操作
                executeChangePassword(newPassword);
            } else {
                // 密码错误，显示错误提示
                document.getElementById('admin-password-error-change').style.display = 'block';
            }
        }
        
        // 执行修改密码操作
        function executeChangePassword(newPassword) {
            const adminPassword = document.getElementById('admin-password-change').value;
            
            // 创建表单
            const form = document.createElement('form');
            form.method = 'POST';
            form.style.display = 'none';
            
            // 添加表单字段
            const actionInput = document.createElement('input');
            actionInput.type = 'hidden';
            actionInput.name = 'action';
            actionInput.value = 'change_password';
            form.appendChild(actionInput);
            
            const userIdInput = document.createElement('input');
            userIdInput.type = 'hidden';
            userIdInput.name = 'user_id';
            userIdInput.value = currentUserId;
            form.appendChild(userIdInput);
            
            const newPasswordInput = document.createElement('input');
            newPasswordInput.type = 'hidden';
            newPasswordInput.name = 'new_password';
            newPasswordInput.value = newPassword;
            form.appendChild(newPasswordInput);
            
            const passwordInput = document.createElement('input');
            passwordInput.type = 'hidden';
            passwordInput.name = 'password';
            passwordInput.value = adminPassword;
            form.appendChild(passwordInput);
            
            // 添加到页面并提交
            document.body.appendChild(form);
            form.submit();
            
            // 关闭弹窗
            closeChangePasswordModal();
        }
        
        // 忘记密码申请相关变量
        let currentRequestId = '';
        
        // 显示通过忘记密码申请弹窗
        function showApprovePasswordModal(requestId, username) {
            currentRequestId = requestId;
            
            // 设置用户名
            const usernameEl = document.getElementById('approve-password-username');
            usernameEl.textContent = `用户: ${username}`;
            
            // 重置输入字段和错误提示
            document.getElementById('admin-password-approve').value = '';
            document.getElementById('admin-password-error-approve').style.display = 'none';
            
            // 显示弹窗
            document.getElementById('approve-password-modal').style.display = 'flex';
            
            // 添加事件监听器
            document.getElementById('cancel-approve-btn').addEventListener('click', closeApprovePasswordModal);
            document.getElementById('confirm-approve-btn').addEventListener('click', handleApprovePassword);
        }
        
        // 关闭通过忘记密码申请弹窗
        function closeApprovePasswordModal() {
            document.getElementById('approve-password-modal').style.display = 'none';
            
            // 移除事件监听器
            document.getElementById('cancel-approve-btn').removeEventListener('click', closeApprovePasswordModal);
            document.getElementById('confirm-approve-btn').removeEventListener('click', handleApprovePassword);
        }
        
        // 处理通过忘记密码申请
        async function handleApprovePassword() {
            const adminPassword = document.getElementById('admin-password-approve').value;
            
            if (!adminPassword) {
                document.getElementById('admin-password-error-approve').textContent = '请输入管理员密码';
                document.getElementById('admin-password-error-approve').style.display = 'block';
                return;
            }
            
            // 验证管理员密码
            const isValid = await validatePassword(adminPassword);
            if (isValid) {
                // 密码正确，执行通过操作
                executeApprovePassword(adminPassword);
            } else {
                // 密码错误，显示错误提示
                document.getElementById('admin-password-error-approve').style.display = 'block';
            }
        }
        
        // 执行通过忘记密码申请操作
        function executeApprovePassword(adminPassword) {
            // 创建表单
            const form = document.createElement('form');
            form.method = 'POST';
            form.style.display = 'none';
            
            // 添加表单字段
            const actionInput = document.createElement('input');
            actionInput.type = 'hidden';
            actionInput.name = 'action';
            actionInput.value = 'approve_password_request';
            form.appendChild(actionInput);
            
            const requestIdInput = document.createElement('input');
            requestIdInput.type = 'hidden';
            requestIdInput.name = 'request_id';
            requestIdInput.value = currentRequestId;
            form.appendChild(requestIdInput);
            
            const passwordInput = document.createElement('input');
            passwordInput.type = 'hidden';
            passwordInput.name = 'password';
            passwordInput.value = adminPassword;
            form.appendChild(passwordInput);
            
            // 添加到页面并提交
            document.body.appendChild(form);
            form.submit();
            
            // 关闭弹窗
            closeApprovePasswordModal();
        }
        
        // 显示拒绝忘记密码申请弹窗
        function showRejectPasswordModal(requestId, username) {
            currentRequestId = requestId;
            
            // 设置用户名
            const usernameEl = document.getElementById('reject-password-username');
            usernameEl.textContent = `用户: ${username}`;
            
            // 显示弹窗
            document.getElementById('reject-password-modal').style.display = 'flex';
            
            // 添加事件监听器
            document.getElementById('cancel-reject-btn').addEventListener('click', closeRejectPasswordModal);
            document.getElementById('confirm-reject-btn').addEventListener('click', executeRejectPassword);
        }
        
        // 关闭拒绝忘记密码申请弹窗
        function closeRejectPasswordModal() {
            document.getElementById('reject-password-modal').style.display = 'none';
            
            // 移除事件监听器
            document.getElementById('cancel-reject-btn').removeEventListener('click', closeRejectPasswordModal);
            document.getElementById('confirm-reject-btn').removeEventListener('click', executeRejectPassword);
        }
        
        // 执行拒绝忘记密码申请操作
        function executeRejectPassword() {
            // 创建表单
            const form = document.createElement('form');
            form.method = 'POST';
            form.style.display = 'none';
            
            // 添加表单字段
            const actionInput = document.createElement('input');
            actionInput.type = 'hidden';
            actionInput.name = 'action';
            actionInput.value = 'reject_password_request';
            form.appendChild(actionInput);
            
            const requestIdInput = document.createElement('input');
            requestIdInput.type = 'hidden';
            requestIdInput.name = 'request_id';
            requestIdInput.value = currentRequestId;
            form.appendChild(requestIdInput);
            
            // 添加到页面并提交
            document.body.appendChild(form);
            form.submit();
            
            // 关闭弹窗
            closeRejectPasswordModal();
        }
        
        // 修改用户名称相关变量
        let currentUserIdChange = '';
        let currentUsername = '';
        
        // 显示修改用户名称弹窗
        function showChangeUsernameModal(userId, username) {
            currentUserIdChange = userId;
            currentUsername = username;
            
            // 设置当前用户名
            const currentUsernameEl = document.getElementById('change-username-current');
            currentUsernameEl.textContent = `当前名称: ${username}`;
            
            // 重置输入字段和错误提示
            document.getElementById('new-username').value = '';
            document.getElementById('admin-password-username').value = '';
            document.getElementById('username-error').style.display = 'none';
            document.getElementById('admin-password-error-username').style.display = 'none';
            
            // 显示弹窗
            document.getElementById('change-username-modal').style.display = 'flex';
            
            // 添加事件监听器
            document.getElementById('cancel-change-username-btn').addEventListener('click', closeChangeUsernameModal);
            document.getElementById('confirm-change-username-btn').addEventListener('click', handleChangeUsername);
        }
        
        // 关闭修改用户名称弹窗
        function closeChangeUsernameModal() {
            document.getElementById('change-username-modal').style.display = 'none';
            
            // 移除事件监听器
            document.getElementById('cancel-change-username-btn').removeEventListener('click', closeChangeUsernameModal);
            document.getElementById('confirm-change-username-btn').removeEventListener('click', handleChangeUsername);
        }
        
        // 处理修改用户名称
        async function handleChangeUsername() {
            const newUsername = document.getElementById('new-username').value.trim();
            const adminPassword = document.getElementById('admin-password-username').value;
            
            // 验证新名称
            if (!newUsername) {
                document.getElementById('username-error').textContent = '请输入新名称';
                document.getElementById('username-error').style.display = 'block';
                return;
            }
            
            if (newUsername === currentUsername) {
                document.getElementById('username-error').textContent = '新名称与当前名称相同';
                document.getElementById('username-error').style.display = 'block';
                return;
            }
            
            // 检查名称长度
            const maxLength = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.userNameMaxLength) || 10;
            if (newUsername.length < 3 || newUsername.length > maxLength) {
                document.getElementById('username-error').textContent = `名称长度必须在3-${maxLength}个字符之间`;
                document.getElementById('username-error').style.display = 'block';
                return;
            }
            
            if (!adminPassword) {
                document.getElementById('admin-password-error-username').textContent = '请输入管理员密码';
                document.getElementById('admin-password-error-username').style.display = 'block';
                return;
            }
            
            // 验证管理员密码
            const isValid = await validatePassword(adminPassword);
            if (isValid) {
                // 密码正确，执行修改名称操作
                executeChangeUsername(newUsername, adminPassword);
            } else {
                // 密码错误，显示错误提示
                document.getElementById('admin-password-error-username').style.display = 'block';
            }
        }
        
        // 封禁管理相关变量
        let currentIPAddress = '';
        let currentFingerprint = '';
        
        // 搜索IP封禁记录
        function searchIPBans() {
            const searchTerm = document.getElementById('ip-search').value.toLowerCase();
            const rows = document.querySelectorAll('#ip-bans-table-body tr');
            
            rows.forEach(row => {
                const ipAddress = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
                if (ipAddress.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }
        
        // 清除IP搜索
        function clearIPSearch() {
            document.getElementById('ip-search').value = '';
            const rows = document.querySelectorAll('#ip-bans-table-body tr');
            rows.forEach(row => {
                row.style.display = '';
            });
        }
        
        // 搜索浏览器指纹封禁记录
        function searchFingerprintBans() {
            const searchTerm = document.getElementById('fingerprint-search').value.toLowerCase();
            const rows = document.querySelectorAll('#fingerprint-bans-table-body tr');
            
            rows.forEach(row => {
                const fingerprint = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
                if (fingerprint.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }
        
        // 清除浏览器指纹搜索
        function clearFingerprintSearch() {
            document.getElementById('fingerprint-search').value = '';
            const rows = document.querySelectorAll('#fingerprint-bans-table-body tr');
            rows.forEach(row => {
                row.style.display = '';
            });
        }
        
        // 显示解除IP封禁弹窗
        function showLiftIPBanModal(ipAddress) {
            currentIPAddress = ipAddress;
            
            // 重置表单
            document.getElementById('admin-password-lift-ip-ban').value = '';
            document.getElementById('admin-password-error-lift-ip-ban').style.display = 'none';
            
            // 设置IP地址显示
            document.getElementById('lift-ip-ban-address').textContent = `IP地址: ${ipAddress}`;
            
            // 显示弹窗
            document.getElementById('lift-ip-ban-modal').style.display = 'flex';
            
            // 添加事件监听器
            document.getElementById('cancel-lift-ip-ban-btn').addEventListener('click', closeLiftIPBanModal);
            document.getElementById('confirm-lift-ip-ban-btn').addEventListener('click', handleConfirmLiftIPBan);
            document.getElementById('admin-password-lift-ip-ban').addEventListener('input', handleLiftIPBanPasswordInput);
        }
        
        // 关闭解除IP封禁弹窗
        function closeLiftIPBanModal() {
            document.getElementById('lift-ip-ban-modal').style.display = 'none';
            
            // 移除事件监听器
            document.getElementById('cancel-lift-ip-ban-btn').removeEventListener('click', closeLiftIPBanModal);
            document.getElementById('confirm-lift-ip-ban-btn').removeEventListener('click', handleConfirmLiftIPBan);
            document.getElementById('admin-password-lift-ip-ban').removeEventListener('input', handleLiftIPBanPasswordInput);
        }
        
        // 处理解除IP封禁密码输入
        function handleLiftIPBanPasswordInput() {
            document.getElementById('admin-password-error-lift-ip-ban').style.display = 'none';
        }
        
        // 处理确认解除IP封禁
        async function handleConfirmLiftIPBan() {
            const password = document.getElementById('admin-password-lift-ip-ban').value;
            
            // 验证密码
            const isValidPassword = await validatePassword(password);
            if (!isValidPassword) {
                document.getElementById('admin-password-error-lift-ip-ban').textContent = '密码错误，请重试';
                document.getElementById('admin-password-error-lift-ip-ban').style.display = 'block';
                return;
            }
            
            // 创建表单
            const form = document.createElement('form');
            form.method = 'POST';
            form.style.display = 'none';
            
            // 添加表单字段
            form.appendChild(createHiddenInput('action', 'lift_ip_ban'));
            form.appendChild(createHiddenInput('ip_address', currentIPAddress));
            form.appendChild(createHiddenInput('password', password));
            
            // 添加到页面并提交
            document.body.appendChild(form);
            form.submit();
        }
        
        // 显示解除浏览器指纹封禁弹窗
        function showLiftFingerprintBanModal(fingerprint) {
            currentFingerprint = fingerprint;
            
            // 重置表单
            document.getElementById('admin-password-lift-fingerprint-ban').value = '';
            document.getElementById('admin-password-error-lift-fingerprint-ban').style.display = 'none';
            
            // 设置指纹显示
            document.getElementById('lift-fingerprint-ban-fingerprint').textContent = `浏览器指纹: ${fingerprint}`;
            
            // 显示弹窗
            document.getElementById('lift-fingerprint-ban-modal').style.display = 'flex';
            
            // 添加事件监听器
            document.getElementById('cancel-lift-fingerprint-ban-btn').addEventListener('click', closeLiftFingerprintBanModal);
            document.getElementById('confirm-lift-fingerprint-ban-btn').addEventListener('click', handleConfirmLiftFingerprintBan);
            document.getElementById('admin-password-lift-fingerprint-ban').addEventListener('input', handleLiftFingerprintBanPasswordInput);
        }
        
        // 关闭解除浏览器指纹封禁弹窗
        function closeLiftFingerprintBanModal() {
            document.getElementById('lift-fingerprint-ban-modal').style.display = 'none';
            
            // 移除事件监听器
            document.getElementById('cancel-lift-fingerprint-ban-btn').removeEventListener('click', closeLiftFingerprintBanModal);
            document.getElementById('confirm-lift-fingerprint-ban-btn').removeEventListener('click', handleConfirmLiftFingerprintBan);
            document.getElementById('admin-password-lift-fingerprint-ban').removeEventListener('input', handleLiftFingerprintBanPasswordInput);
        }
        
        // 处理解除浏览器指纹封禁密码输入
        function handleLiftFingerprintBanPasswordInput() {
            document.getElementById('admin-password-error-lift-fingerprint-ban').style.display = 'none';
        }
        
        // 处理确认解除浏览器指纹封禁
        async function handleConfirmLiftFingerprintBan() {
            const password = document.getElementById('admin-password-lift-fingerprint-ban').value;
            
            // 验证密码
            const isValidPassword = await validatePassword(password);
            if (!isValidPassword) {
                document.getElementById('admin-password-error-lift-fingerprint-ban').textContent = '密码错误，请重试';
                document.getElementById('admin-password-error-lift-fingerprint-ban').style.display = 'block';
                return;
            }
            
            // 创建表单
            const form = document.createElement('form');
            form.method = 'POST';
            form.style.display = 'none';
            
            // 添加表单字段
            form.appendChild(createHiddenInput('action', 'lift_fingerprint_ban'));
            form.appendChild(createHiddenInput('fingerprint', currentFingerprint));
            form.appendChild(createHiddenInput('password', password));
            
            // 添加到页面并提交
            document.body.appendChild(form);
            form.submit();
        }
        
        // 显示手动封禁IP地址弹窗
        function showBanIPModal() {
            const ipAddress = document.getElementById('manual-ip').value.trim();
            const duration = document.getElementById('manual-ip-duration').value.trim();
            const isPermanent = document.getElementById('manual-ip-permanent').value === 'true';
            
            // 验证输入
            if (!ipAddress) {
                alert('请输入IP地址');
                return;
            }
            
            if (!isPermanent && !duration) {
                alert('请输入封禁时长');
                return;
            }
            
            // 设置弹窗内容
            document.getElementById('ban-ip-address').textContent = `IP地址: ${ipAddress}`;
            let details = '';
            if (isPermanent) {
                details = '封禁类型: 永久封禁';
            } else {
                details = `封禁类型: 临时封禁，时长: ${duration} 小时`;
            }
            document.getElementById('ban-ip-details').textContent = details;
            
            // 重置表单
            document.getElementById('admin-password-ban-ip').value = '';
            document.getElementById('admin-password-error-ban-ip').style.display = 'none';
            
            // 显示弹窗
            document.getElementById('ban-ip-modal').style.display = 'flex';
            
            // 添加事件监听器
            document.getElementById('cancel-ban-ip-btn').addEventListener('click', closeBanIPModal);
            document.getElementById('confirm-ban-ip-btn').addEventListener('click', handleConfirmBanIP);
            document.getElementById('admin-password-ban-ip').addEventListener('input', handleBanIPPasswordInput);
        }
        
        // 关闭手动封禁IP地址弹窗
        function closeBanIPModal() {
            document.getElementById('ban-ip-modal').style.display = 'none';
            
            // 移除事件监听器
            document.getElementById('cancel-ban-ip-btn').removeEventListener('click', closeBanIPModal);
            document.getElementById('confirm-ban-ip-btn').removeEventListener('click', handleConfirmBanIP);
            document.getElementById('admin-password-ban-ip').removeEventListener('input', handleBanIPPasswordInput);
        }
        
        // 处理手动封禁IP地址密码输入
        function handleBanIPPasswordInput() {
            document.getElementById('admin-password-error-ban-ip').style.display = 'none';
        }
        
        // 处理确认手动封禁IP地址
        async function handleConfirmBanIP() {
            const ipAddress = document.getElementById('manual-ip').value.trim();
            const duration = document.getElementById('manual-ip-duration').value.trim();
            const isPermanent = document.getElementById('manual-ip-permanent').value === 'true';
            const password = document.getElementById('admin-password-ban-ip').value;
            
            // 验证密码
            const isValidPassword = await validatePassword(password);
            if (!isValidPassword) {
                document.getElementById('admin-password-error-ban-ip').textContent = '密码错误，请重试';
                document.getElementById('admin-password-error-ban-ip').style.display = 'block';
                return;
            }
            
            // 创建表单
            const form = document.createElement('form');
            form.method = 'POST';
            form.style.display = 'none';
            
            // 添加表单字段
            form.appendChild(createHiddenInput('action', 'ban_ip'));
            form.appendChild(createHiddenInput('ip_address', ipAddress));
            form.appendChild(createHiddenInput('ban_duration', isPermanent ? 0 : parseInt(duration) * 3600));
            form.appendChild(createHiddenInput('is_permanent', isPermanent ? '1' : '0'));
            form.appendChild(createHiddenInput('password', password));
            
            // 添加到页面并提交
            document.body.appendChild(form);
            form.submit();
        }
        
        // 显示手动封禁浏览器指纹弹窗
        function showBanFingerprintModal() {
            const fingerprint = document.getElementById('manual-fingerprint').value.trim();
            const duration = document.getElementById('manual-fingerprint-duration').value.trim();
            const isPermanent = document.getElementById('manual-fingerprint-permanent').value === 'true';
            
            // 验证输入
            if (!fingerprint) {
                alert('请输入浏览器指纹');
                return;
            }
            
            if (!isPermanent && !duration) {
                alert('请输入封禁时长');
                return;
            }
            
            // 设置弹窗内容
            document.getElementById('ban-fingerprint-fingerprint').textContent = `浏览器指纹: ${fingerprint}`;
            let details = '';
            if (isPermanent) {
                details = '封禁类型: 永久封禁';
            } else {
                details = `封禁类型: 临时封禁，时长: ${duration} 小时`;
            }
            document.getElementById('ban-fingerprint-details').textContent = details;
            
            // 重置表单
            document.getElementById('admin-password-ban-fingerprint').value = '';
            document.getElementById('admin-password-error-ban-fingerprint').style.display = 'none';
            
            // 显示弹窗
            document.getElementById('ban-fingerprint-modal').style.display = 'flex';
            
            // 添加事件监听器
            document.getElementById('cancel-ban-fingerprint-btn').addEventListener('click', closeBanFingerprintModal);
            document.getElementById('confirm-ban-fingerprint-btn').addEventListener('click', handleConfirmBanFingerprint);
            document.getElementById('admin-password-ban-fingerprint').addEventListener('input', handleBanFingerprintPasswordInput);
        }
        
        // 关闭手动封禁浏览器指纹弹窗
        function closeBanFingerprintModal() {
            document.getElementById('ban-fingerprint-modal').style.display = 'none';
            
            // 移除事件监听器
            document.getElementById('cancel-ban-fingerprint-btn').removeEventListener('click', closeBanFingerprintModal);
            document.getElementById('confirm-ban-fingerprint-btn').removeEventListener('click', handleConfirmBanFingerprint);
            document.getElementById('admin-password-ban-fingerprint').removeEventListener('input', handleBanFingerprintPasswordInput);
        }
        
        // 处理手动封禁浏览器指纹密码输入
        function handleBanFingerprintPasswordInput() {
            document.getElementById('admin-password-error-ban-fingerprint').style.display = 'none';
        }
        
        // 处理确认手动封禁浏览器指纹
        async function handleConfirmBanFingerprint() {
            const fingerprint = document.getElementById('manual-fingerprint').value.trim();
            const duration = document.getElementById('manual-fingerprint-duration').value.trim();
            const isPermanent = document.getElementById('manual-fingerprint-permanent').value === 'true';
            const password = document.getElementById('admin-password-ban-fingerprint').value;
            
            // 验证密码
            const isValidPassword = await validatePassword(password);
            if (!isValidPassword) {
                document.getElementById('admin-password-error-ban-fingerprint').textContent = '密码错误，请重试';
                document.getElementById('admin-password-error-ban-fingerprint').style.display = 'block';
                return;
            }
            
            // 创建表单
            const form = document.createElement('form');
            form.method = 'POST';
            form.style.display = 'none';
            
            // 添加表单字段
            form.appendChild(createHiddenInput('action', 'ban_fingerprint'));
            form.appendChild(createHiddenInput('fingerprint', fingerprint));
            form.appendChild(createHiddenInput('ban_duration', isPermanent ? 0 : parseInt(duration) * 3600));
            form.appendChild(createHiddenInput('is_permanent', isPermanent ? '1' : '0'));
            form.appendChild(createHiddenInput('password', password));
            
            // 添加到页面并提交
            document.body.appendChild(form);
            form.submit();
        }
        
        // 执行修改用户名称操作
        function executeChangeUsername(newUsername, adminPassword) {
            // 创建表单
            const form = document.createElement('form');
            form.method = 'POST';
            form.style.display = 'none';
            
            // 添加表单字段
            const actionInput = document.createElement('input');
            actionInput.type = 'hidden';
            actionInput.name = 'action';
            actionInput.value = 'change_username';
            form.appendChild(actionInput);
            
            const userIdInput = document.createElement('input');
            userIdInput.type = 'hidden';
            userIdInput.name = 'user_id';
            userIdInput.value = currentUserIdChange;
            form.appendChild(userIdInput);
            
            const newUsernameInput = document.createElement('input');
            newUsernameInput.type = 'hidden';
            newUsernameInput.name = 'new_username';
            newUsernameInput.value = newUsername;
            form.appendChild(newUsernameInput);
            
            const passwordInput = document.createElement('input');
            passwordInput.type = 'hidden';
            passwordInput.name = 'password';
            passwordInput.value = adminPassword;
            form.appendChild(passwordInput);
            
            // 添加到页面并提交
            document.body.appendChild(form);
            form.submit();
            
            // 关闭弹窗
            closeChangeUsernameModal();
        }

        // 同步QQ音乐歌单
        async function syncQQPlaylist(btn) {
            const qq = prompt("请输入QQ号进行同步：");
            if (!qq) return;

            const originalText = btn.textContent;
            
            try {
                btn.textContent = '获取信息中...';
                btn.disabled = true;

                // 1. 获取用户信息
                const infoRes = await fetch(`https://api.vkeys.cn/v2/music/tencent/info?uin=${qq}`);
                const infoData = await infoRes.json();

                if (infoData.code !== 200) {
                    throw new Error('获取用户信息失败：' + (infoData.msg || '未知错误'));
                }

                const userName = infoData.data.info.name;
                const playlistId = infoData.data.likesong.id;

                if (!confirm(`获取到用户 ${userName} 中的我的喜欢歌单准备同步\n点击确认开始同步，取消则停止`)) {
                    btn.textContent = originalText;
                    btn.disabled = false;
                    return;
                }

                btn.textContent = '同步中(0%)...';

                let allSongs = [];
                let page = 1;
                let hasMore = true;
                let totalProcessed = 0;

                // 2. 循环获取所有歌曲
                while (hasMore) {
                    const dissRes = await fetch(`https://api.vkeys.cn/v2/music/tencent/dissinfo?id=${playlistId}&page=${page}`);
                    const dissData = await dissRes.json();

                    if (dissData.code === 200 && dissData.data.list && dissData.data.list.length > 0) {
                        for (const songItem of dissData.data.list) {
                            const songName = songItem.song;
                            const singerName = songItem.singer;
                            
                            let matchId = null;

                            // 3. 搜索并匹配歌曲 (choose=1 to 5)
                            for (let k = 1; k <= 5; k++) {
                                try {
                                    // number-2 从 1 开始，即 choose 参数
                                    const searchRes = await fetch(`https://api.vkeys.cn/v2/music/tencent?word=${encodeURIComponent(songName)}&choose=${k}&quality=8`);
                                    const searchData = await searchRes.json();

                                    if (searchData.code === 200 && searchData.data) {
                                        const resSinger = searchData.data.singer;
                                        // 只要歌手名包含或被包含，即视为匹配
                                        // 注意：有些API返回的singer可能是数组或字符串，这里假设是字符串，如果是数组需要 join
                                        const resSingerStr = Array.isArray(resSinger) ? resSinger.join('/') : resSinger;
                                        
                                        if (resSingerStr.includes(singerName) || singerName.includes(resSingerStr)) {
                                            matchId = k;
                                            break; 
                                        }
                                    }
                                } catch (e) {
                                    console.warn('Search failed for', songName, k, e);
                                }
                                // 稍微延迟避免过快
                                await new Promise(r => setTimeout(r, 200));
                            }

                            if (matchId) {
                                allSongs.push({ name: songName, id: matchId });
                            }
                            
                            totalProcessed++;
                            btn.textContent = `同步中(${totalProcessed})...`;
                        }
                        page++;
                        // 稍微延迟避免过快
                        await new Promise(r => setTimeout(r, 500));
                    } else {
                        hasMore = false;
                    }
                }

                if (allSongs.length === 0) {
                    alert('未找到可同步的歌曲');
                    return;
                }

                // 4. 提交保存
                const finalData = {};
                allSongs.forEach(s => {
                    finalData[s.name] = s.id.toString();
                });

                const playlistName = `${userName}的歌单`;
                
                const formData = new FormData();
                formData.append('action', 'sync_qq_playlist');
                formData.append('playlist_name', playlistName);
                formData.append('songs', JSON.stringify(finalData));

                const saveRes = await fetch('/src/admin/admin.php', {
                    method: 'POST',
                    body: formData
                });
                const saveData = await saveRes.json();

                if (saveData.success) {
                    alert(`同步成功！已保存歌单：${playlistName}，包含 ${allSongs.length} 首歌曲`);
                    location.reload();
                } else {
                    throw new Error(saveData.message || '保存失败');
                }

            } catch (e) {
                console.error(e);
                alert('操作失败：' + e.message);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
            <!-- 违禁词管理 -->
