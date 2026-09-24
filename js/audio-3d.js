/**
 * 3D环绕音效处理模块
 * 优化的音效处理，确保跨浏览器兼容性和性能
 */
class Audio3DManager {
    constructor() {
        this.audioContext = null;
        this.audioSource = null;
        this.pannerNode = null;
        this.gainNode = null;
        this.isEnabled = false;
        this.animationId = null;
        this.intensity = 0.7; // 默认强度70%
        this.supported = false;
        this.initialize();
    }
    
    /**
     * 初始化音频上下文和检测浏览器支持
     */
    initialize() {
        try {
            // 检测浏览器支持
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext && typeof AudioContext.prototype.createPanner === 'function') {
                this.supported = true;
                this.audioContext = new AudioContext();
            }
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
            this.supported = false;
        }
    }
    
    /**
     * 设置音频元素
     * @param {HTMLAudioElement} audioElement - 音频元素
     */
    setAudioElement(audioElement) {
        if (!this.supported || !audioElement) return;
        
        try {
            if (!this.audioContext) {
                this.initialize();
            }
            
            if (this.audioContext && !this.audioSource) {
                this.audioSource = this.audioContext.createMediaElementSource(audioElement);
                this.createAudioNodes();
                this.connectNodes();
            }
        } catch (error) {
            console.warn('Failed to set audio element:', error);
        }
    }
    
    /**
     * 创建音频节点
     */
    createAudioNodes() {
        if (!this.audioContext) return;
        
        try {
            // 创建3D音效节点
            this.pannerNode = this.audioContext.createPanner();
            this.pannerNode.panningModel = 'HRTF'; // 使用头部相关传输函数
            this.pannerNode.distanceModel = 'linear'; // 线性距离模型，增强空间感
            this.pannerNode.refDistance = 0.5; // 参考距离减小，增强距离感
            this.pannerNode.maxDistance = 10000;
            this.pannerNode.rolloffFactor = 0.8; // 衰减因子调整
            this.pannerNode.coneInnerAngle = 360;
            this.pannerNode.coneOuterAngle = 0;
            this.pannerNode.coneOuterGain = 0;
            
            // 创建音量节点
            this.gainNode = this.audioContext.createGain();
        } catch (error) {
            console.warn('Failed to create audio nodes:', error);
        }
    }
    
    /**
     * 连接音频节点
     */
    connectNodes() {
        if (!this.audioSource || !this.pannerNode || !this.gainNode || !this.audioContext) return;
        
        try {
            this.audioSource.disconnect();
            if (this.isEnabled) {
                this.audioSource.connect(this.pannerNode);
                this.pannerNode.connect(this.gainNode);
                this.gainNode.connect(this.audioContext.destination);
            } else {
                this.audioSource.connect(this.audioContext.destination);
            }
        } catch (error) {
            console.warn('Failed to connect audio nodes:', error);
        }
    }
    
    /**
     * 启用/禁用3D环绕音效
     * @param {boolean} enabled - 是否启用
     * @param {number} intensity - 音效强度 (0-1)
     */
    toggle(enabled, intensity = 0.7) {
        if (!this.supported) return false;
        
        this.isEnabled = enabled;
        this.intensity = Math.max(0, Math.min(1, intensity)); // 限制在0-1范围内
        
        try {
            // 确保音频上下文处于活动状态
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            this.connectNodes();
            
            if (enabled) {
                this.startAnimation();
            } else {
                this.stopAnimation();
            }
            
            return true;
        } catch (error) {
            console.warn('Failed to toggle 3D audio:', error);
            return false;
        }
    }
    
    /**
     * 开始3D音效动画
     */
    startAnimation() {
        if (!this.isEnabled || !this.pannerNode) return;
        
        this.stopAnimation(); // 清除之前的动画
        
        let time = 0;
        const radius = 1.5; // 增大半径增强环绕感
        
        const animate = () => {
            if (!this.isEnabled || !this.pannerNode) return;
            
            time += 0.008; // 减慢速度，增强沉浸感
            
            // 计算复杂的3D轨迹，实现真正的环绕效果
            const x = Math.sin(time) * radius * this.intensity;
            const y = Math.sin(time * 0.3) * 0.8 * this.intensity; // 增加垂直运动幅度
            const z = Math.cos(time) * radius * this.intensity;
            
            try {
                this.pannerNode.positionX.value = x;
                this.pannerNode.positionY.value = y;
                this.pannerNode.positionZ.value = z;
            } catch (error) {
                console.warn('Failed to update panner position:', error);
                this.stopAnimation();
                return;
            }
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        this.animationId = requestAnimationFrame(animate);
    }
    
    /**
     * 停止3D音效动画
     */
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // 重置位置
        if (this.pannerNode) {
            try {
                this.pannerNode.positionX.value = 0;
                this.pannerNode.positionY.value = 0;
                this.pannerNode.positionZ.value = 0;
            } catch (error) {
                console.warn('Failed to reset panner position:', error);
            }
        }
    }
    
    /**
     * 设置音效强度
     * @param {number} intensity - 强度值 (0-100)
     */
    setIntensity(intensity) {
        this.intensity = Math.max(0, Math.min(1, intensity / 100));
    }
    
    /**
     * 检查浏览器支持情况
     * @returns {boolean} 是否支持3D音效
     */
    isSupported() {
        return this.supported;
    }
    
    /**
     * 销毁实例，释放资源
     */
    destroy() {
        this.stopAnimation();
        
        if (this.audioSource) {
            try {
                this.audioSource.disconnect();
            } catch (error) {
                // 忽略错误
            }
        }
        
        if (this.audioContext) {
            try {
                this.audioContext.close();
            } catch (error) {
                // 忽略错误
            }
        }
        
        this.audioContext = null;
        this.audioSource = null;
        this.pannerNode = null;
        this.gainNode = null;
        this.isEnabled = false;
    }
}

// 导出单例实例
const audio3DManager = new Audio3DManager();
window.Audio3DManager = Audio3DManager;
window.audio3DManager = audio3DManager;