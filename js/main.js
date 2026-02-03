/**
 * 游戏入口 Main
 * 负责初始化、登录流程、事件绑定
 */

// 登录处理函数
function handleLogin() {
    const nameInput = document.getElementById('username');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert("请输入道号！");
        nameInput.focus();
        return;
    }

    // 记住我
    const remember = document.getElementById('remember-me').checked;
    if (remember) {
        localStorage.setItem('xiuxian_user', name);
    } else {
        localStorage.removeItem('xiuxian_user');
    }

    // 更新状态并进入游戏
    gameState.username = name;
    
    // 尝试读取存档
    if (gameState.load(name)) {
        console.log("Found save file for", name);
    } else {
        console.log("No save file found, creating new character.");
    }
    
    enterGame();
}

function handleLogout() {
    localStorage.removeItem('xiuxian_user');
    location.reload();
}

function handleResetSave() {
    if (confirm('确定要兵解重修吗？这将清除当前角色的所有存档数据，且无法恢复！')) {
        const user = gameState.username || localStorage.getItem('xiuxian_user');
        if (user) {
            localStorage.removeItem('cultivation_save_' + user);
        }
        localStorage.removeItem('xiuxian_user');
        location.reload();
    }
}

function checkLogin() {
    const user = localStorage.getItem('xiuxian_user');
    if (user) {
        // 安全检查：如果找不到 username 输入框，说明 DOM 可能未就绪或 ID 错误
        const nameInput = document.getElementById('username');
        if (nameInput) nameInput.value = user;
        
        gameState.username = user;
        
        // 尝试读取存档
        if (gameState.load(user)) {
            console.log("Found save file for", user);
        }
        
        enterGame();
    } else {
        const nameInput = document.getElementById('username');
        if (nameInput) nameInput.focus();
    }
}

function enterGame() {
    try {
        // 隐藏登录页，显示主界面
        const loginScreen = document.getElementById('login-screen');
        const appScreen = document.getElementById('app');
        
        if (loginScreen) loginScreen.classList.add('hidden');
        if (appScreen) appScreen.classList.remove('hidden');

        // 安全检查：游戏数据是否加载
        if (typeof GameData === 'undefined' || !GameData.mapConfig) {
            throw new Error("核心数据(GameData)加载失败，请刷新页面重试。");
        }
        
        console.log("%c 修仙测试版 - 开发者提示", "color: #ff0055; font-size: 20px; font-weight: bold;");
        console.log("%c 本游戏目前为纯前端架构（无后端），所有数据存储在本地(LocalStorage)。", "color: #666; font-size: 14px;");
        console.log("%c ⚠️ 关于数据修改 (F12)：\n1. 这是一个单机测试版，我们不禁止您探索代码或修改数据。\n2. 但请注意：修改数值(如无限血量)可能会导致游戏乐趣丧失或逻辑崩溃(NaN/Infinity)。\n3. 提交Bug时，请注明是否使用了修改手段，这有助于我们定位问题。\n4. 请勿在玩家群传播修改后的截图误导他人。", "color: #e67e22; font-size: 14px; font-weight: bold;");

        // 初始化默认地图 (如果尚未设置或地图数据无效)
        if (!gameState.currentMap || !gameState.currentMap.name || !GameData.mapConfig[gameState.currentMap.name]) {
            console.warn("Map data invalid or missing, resetting to default.");
            gameState.currentMap = GameData.mapConfig["抗龙村"];
            gameState.environmentTag = "凡俗";
            gameState.isHanging = false; // 强制停止挂机，防止在无效地图挂机导致崩溃
        }

        // V1.6 兼容性修复：修正旧存档中的非法“凡人·前期”状态
        if (gameState.realm === "凡人" && (gameState.stage === "凡人前期" || gameState.subRealm === "前期")) {
            console.log("[Migration] Fixing legacy mortal state: 凡人·前期 -> 凡人");
            gameState.stage = "凡人";
            gameState.subRealm = "凡俗";
            gameState.save(); // 立即保存修复后的状态
        }

        // [V1.9.0 Beta Gift] Ensure delivery on login (Fixed)
        if (!gameState.flags) gameState.flags = {};
        if (!gameState.flags.beta_gift_respec_v2) {
            if (!gameState.inventory) gameState.inventory = {};
            gameState.inventory['洗髓丹'] = (gameState.inventory['洗髓丹'] || 0) + 1;
            gameState.flags.beta_gift_respec_v2 = true;
            // Also set the old flag to prevent double dipping if old code runs
            gameState.flags.beta_gift_respec = true; 
            if (typeof UI !== 'undefined' && UI.addLog) UI.addLog("【内测福利】已发放：洗髓丹 x1 (可用于重置属性点)", "sys");
            gameState.save();
        }
        
        // 同步 UI 状态
        if (UI && typeof UI.initGlobalTooltip === 'function') UI.initGlobalTooltip();
        if (UI && typeof UI.ensureRitualUI === 'function') UI.ensureRitualUI();
    
    // 确保 settings 存在，防止新用户报错
        if (!gameState.settings) {
            gameState.settings = { pauseOnEvent: true };
        }
        
        if (document.getElementById('pause-on-event')) {
            document.getElementById('pause-on-event').checked = gameState.settings.pauseOnEvent;
        }

        // 恢复挂机状态 UI (如果加载了挂机状态)
        if (gameState.isHanging) {
            // 双重检查地图有效性
            if (gameState.currentMap && Array.isArray(gameState.currentMap.monsters)) {
                // 恢复循环
                Logic.gameLoop();
                // 恢复 UI 状态
                UI.updateHangingStatus();
            } else {
                console.error("Hanging state valid but map invalid, stopping hanging.");
                gameState.isHanging = false;
                gameState.save();
                UI.updateHangingStatus();
            }
        } else {
             // 确保UI显示为停止状态
             UI.updateHangingStatus();
        }

        // 启动自动保存定时器 (60s)
        setInterval(() => {
            if (gameState.username) {
                gameState.save();
            }
        }, 60000);

        // 初始渲染
        UI.renderLeftPanel();
        UI.renderMapList();
        UI.renderMapInfo();
        UI.renderInventory();
        UI.renderLineage();

        UI.addLog(`欢迎道友 【${gameState.username}】 重返修仙路。`, 'sys');

    } catch (e) {
        console.error("Enter Game Critical Error:", e);
        alert("进入游戏时发生错误：" + e.message + "\n建议使用【兵解重修】功能重置存档。");
        // 尝试至少渲染左侧面板以便用户能看到设置按钮
        try { UI.renderLeftPanel(); } catch(e2) {}
    }
}

function initCombatEngineRegistry() {
    if (typeof window === 'undefined') return;
    const reg = (window.CombatEngineRegistry && typeof window.CombatEngineRegistry === 'object')
        ? window.CombatEngineRegistry
        : (window.CombatEngineRegistry = {});

    if (typeof CombatEngine !== 'undefined' && CombatEngine && typeof CombatEngine === 'object') {
        const key = (typeof CombatEngine.version === 'string' && CombatEngine.version.trim()) ? CombatEngine.version.trim() : 'CombatEngine';
        reg[key] = { name: 'CombatEngine', version: CombatEngine.version || null, engine: CombatEngine };
        if (!window.CombatEngine) window.CombatEngine = CombatEngine;
    }
    if (typeof CombatEngineV2 !== 'undefined' && CombatEngineV2 && typeof CombatEngineV2 === 'object') {
        const key = (typeof CombatEngineV2.version === 'string' && CombatEngineV2.version.trim()) ? CombatEngineV2.version.trim() : 'CombatEngineV2';
        reg[key] = { name: 'CombatEngineV2', version: CombatEngineV2.version || null, engine: CombatEngineV2 };
        window.CombatEngineV2 = CombatEngineV2;
    }
}

function initEventListeners() {
    initCombatEngineRegistry();
    // 1. 登录相关
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.addEventListener('click', handleLogin);
    
    ['username', 'password'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') handleLogin();
            });
        }
    });

    // 2. 左侧面板开关
    const togglePanel = () => UI.toggleLeftPanel();
    const btnCollapse = document.getElementById('btn-collapse-panel');
    const btnExpand = document.getElementById('expand-btn');
    if (btnCollapse) btnCollapse.addEventListener('click', togglePanel);
    if (btnExpand) btnExpand.addEventListener('click', togglePanel);

    // 3. 左侧快捷操作
    const btnQuickLineage = document.getElementById('btn-quick-lineage');
    const btnQuickInventory = document.getElementById('btn-quick-inventory');
    if (btnQuickLineage) btnQuickLineage.addEventListener('click', () => UI.switchTab('lineage'));
    if (btnQuickInventory) btnQuickInventory.addEventListener('click', () => UI.switchTab('inventory'));

    // 4. 底部导航
    const navMap = document.getElementById('nav-map');
    const navBattle = document.getElementById('nav-battle');
    const navInventory = document.getElementById('nav-inventory');
    const navLineage = document.getElementById('nav-lineage');
    const navTrigger = document.getElementById('nav-trigger-event');
    
    if (navMap) navMap.addEventListener('click', () => UI.switchTab('map'));
    if (navBattle) navBattle.addEventListener('click', () => UI.switchTab('battle'));
    if (navInventory) navInventory.addEventListener('click', () => UI.switchTab('inventory'));
    if (navLineage) navLineage.addEventListener('click', () => UI.switchTab('lineage'));
    if (navTrigger) navTrigger.addEventListener('click', () => Logic.requestTriggerEvent());

    const centerTabMap = document.getElementById('center-tab-map');
    const centerTabBattle = document.getElementById('center-tab-battle');
    if (centerTabMap) centerTabMap.addEventListener('click', () => UI.switchTab('map'));
    if (centerTabBattle) centerTabBattle.addEventListener('click', () => UI.switchTab('battle'));

    // 5. 地图控制
    const btnToggleHang = document.getElementById('btn-toggle-hang');
    if (btnToggleHang) btnToggleHang.addEventListener('click', () => Logic.requestToggleHanging());
    
    // 6. 设置监听
    const chkPause = document.getElementById('pause-on-event');
    if (chkPause) {
        chkPause.addEventListener('change', (e) => {
            gameState.settings.pauseOnEvent = e.target.checked;
        });
    }

    // Theme Toggle
    const btnTheme = document.getElementById('btn-theme-toggle');
    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            const body = document.body;
            const current = body.getAttribute('data-theme');
            const next = current === 'stealth' ? '' : 'stealth';
            body.setAttribute('data-theme', next);
            // Optional: Save preference
            // localStorage.setItem('xiuxian_theme', next);
        });
    }

    // Release Notes
    const btnViewNotes = document.getElementById('btn-view-release-notes');
    const linkViewNotes = document.getElementById('link-release-notes');
    const btnCloseNotes = document.getElementById('btn-close-release-note');
    
    if (btnViewNotes) btnViewNotes.addEventListener('click', () => UI.showReleaseNotes());
    if (linkViewNotes) linkViewNotes.addEventListener('click', (e) => {
        e.preventDefault();
        UI.showReleaseNotes();
    });
    if (btnCloseNotes) btnCloseNotes.addEventListener('click', () => {
        const modal = document.getElementById('release-note-modal');
        if (modal) modal.classList.add('hidden');
    });

    // Talisman Guide
    const navTalismanGuide = document.getElementById('nav-talisman-guide');
    const btnCloseTalismanGuide = document.getElementById('btn-close-talisman-guide');
    
    if (navTalismanGuide) navTalismanGuide.addEventListener('click', () => UI.showTalismanGuide());
    if (btnCloseTalismanGuide) btnCloseTalismanGuide.addEventListener('click', () => {
        const modal = document.getElementById('talisman-guide-modal');
        if (modal) modal.classList.add('hidden');
    });

    // Log Toggle
    const btnLogToggle = document.getElementById('btn-toggle-log');
    const logContainer = document.getElementById('log-container');
    const logFilters = document.getElementById('log-filters');
    if (btnLogToggle && logContainer) {
        btnLogToggle.addEventListener('click', () => {
            const isCollapsed = logContainer.style.display === 'none';
            if (isCollapsed) {
                logContainer.style.display = '';
                if (logFilters) logFilters.style.display = '';
                btnLogToggle.textContent = '▼';
            } else {
                logContainer.style.display = 'none';
                if (logFilters) logFilters.style.display = 'none';
                btnLogToggle.textContent = '◀';
            }
        });
    }

    const engineSelect = document.getElementById('debug-engine-select');
    const engineApply = document.getElementById('debug-engine-apply');
    const rulesArea = document.getElementById('debug-rules-config');
    const rulesApply = document.getElementById('debug-rules-apply');
    const replayToggle = document.getElementById('debug-replay-toggle');
    const replayClear = document.getElementById('debug-replay-clear');

    const refreshEngineList = () => {
        if (!engineSelect) return;
        const reg = (typeof window !== 'undefined' && window.CombatEngineRegistry && typeof window.CombatEngineRegistry === 'object') ? window.CombatEngineRegistry : {};
        const keys = Object.keys(reg);
        const options = [];
        if (typeof window !== 'undefined' && window.CombatEngine && typeof window.CombatEngine === 'object') {
            const v = typeof window.CombatEngine.version === 'string' ? window.CombatEngine.version : '';
            options.push({ key: '__current__', label: `当前引擎 (${v || 'unknown'})` });
        }
        keys.forEach(k => {
            const entry = reg[k];
            const name = entry && entry.name ? entry.name : k;
            const v = entry && typeof entry.version === 'string' ? entry.version : '';
            options.push({ key: k, label: `${name}${v ? ` (${v})` : ''}` });
        });
        engineSelect.innerHTML = '';
        options.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.key;
            opt.textContent = o.label;
            engineSelect.appendChild(opt);
        });
    };

    if (engineSelect) refreshEngineList();
    if (engineApply) {
        engineApply.addEventListener('click', () => {
            const v = engineSelect ? engineSelect.value : null;
            const reg = (typeof window !== 'undefined' && window.CombatEngineRegistry && typeof window.CombatEngineRegistry === 'object') ? window.CombatEngineRegistry : {};
            const entry = v && v !== '__current__' ? reg[v] : null;
            if (entry && entry.engine) {
                window.CombatEngine = entry.engine;
                if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog(`已切换战斗引擎：${entry.name || v}`, 'sys');
                if (typeof UI !== 'undefined' && UI && typeof UI.refreshDebugPanel === 'function') UI.refreshDebugPanel();
            }
        });
    }

    if (rulesArea) {
        rulesArea.addEventListener('input', () => {
            rulesArea.dataset.touched = '1';
        });
    }
    if (rulesApply) {
        rulesApply.addEventListener('click', () => {
            if (!rulesArea) return;
            let cfg = null;
            try {
                cfg = JSON.parse(rulesArea.value || '{}');
            } catch (e) {
                alert('RulesConfig JSON 解析失败：' + e.message);
                return;
            }
            if (typeof window !== 'undefined') window.RulesConfig = cfg;
            if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog('RulesConfig 已应用（仅当前页面生效）', 'sys');
            if (typeof UI !== 'undefined' && UI && typeof UI.refreshDebugPanel === 'function') UI.refreshDebugPanel();
        });
    }

    if (replayToggle) {
        replayToggle.addEventListener('change', (e) => {
            if (typeof gameState !== 'undefined' && gameState && typeof gameState.setReplayEnabled === 'function') {
                gameState.setReplayEnabled(e.target.checked === true);
                if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog(e.target.checked ? '已开始录制 replay' : '已停止录制 replay', 'sys');
                if (typeof UI !== 'undefined' && UI && typeof UI.refreshDebugPanel === 'function') UI.refreshDebugPanel();
            }
        });
    }
    if (replayClear) {
        replayClear.addEventListener('click', () => {
            if (typeof gameState !== 'undefined' && gameState && gameState.replay && typeof gameState.replay === 'object') {
                gameState.replay.actions = [];
                gameState.replay.seq = 0;
                gameState.replay.lastAction = null;
                if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog('replay 已清空', 'sys');
                if (typeof UI !== 'undefined' && UI && typeof UI.refreshDebugPanel === 'function') UI.refreshDebugPanel();
            }
        });
    }

    // 7. 保存/退出/重置
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            if (gameState.username) {
                gameState.save();
                UI.addLog('手动保存成功', 'sys');
            }
        });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', handleLogout);

    const btnBetaBoostLeft = document.getElementById('btn-beta-boost-left');
    
    const handleBetaBoost = () => {
        if (typeof gameState === 'undefined') return;

        // Ensure story flags exist for persistence
        if (!gameState.story) gameState.story = {};
        if (!gameState.story.flags) gameState.story.flags = {};
        
        const flags = gameState.story.flags;

        // 0. Legacy/Inconsistent State Detection
        // If flags say "OFF" but stats are "HIGH", we assume "ON" state with lost flags.
        // We set it to ON so the logic below will treat it as a "Turn Off" (Restore) request immediately.
        if (!flags.betaBoostActive && gameState.maxHp >= 99999 && gameState.atk >= 5000) {
            console.warn("[BetaBoost] Detected high stats without active flag. Syncing to ACTIVE state.");
            flags.betaBoostActive = true;
            // Since we don't have original stats, we assume standard defaults
            flags.betaBoostBackup = {
                hp: 100, maxHp: 100, mp: 50, maxMp: 50, atk: 10, matk: 10, speed: 10
            };
            if (typeof UI !== 'undefined' && UI.addLog) {
                UI.addLog('【系统】检测到异常高数值，已自动同步金手指状态。正在执行关闭操作...', 'sys');
            }
        }

        if (flags.betaBoostActive) {
            // === Deactivate (Restore) ===
            const backup = flags.betaBoostBackup;
            console.log("[BetaBoost] Restoring from backup:", backup);
            
            if (backup) {
                // Restore Stats with explicit Number conversion
                if (backup.maxHp !== undefined) gameState.maxHp = Number(backup.maxHp);
                if (backup.hp !== undefined) gameState.hp = Number(backup.hp);
                if (backup.maxMp !== undefined) gameState.maxMp = Number(backup.maxMp);
                if (backup.mp !== undefined) gameState.mp = Number(backup.mp);
                if (backup.atk !== undefined) gameState.atk = Number(backup.atk);
                if (backup.matk !== undefined) gameState.matk = Number(backup.matk);
                if (backup.speed !== undefined) gameState.speed = Number(backup.speed);
                
                // Safety clamp
                if (gameState.hp > gameState.maxHp) gameState.hp = gameState.maxHp;
                if (gameState.mp > gameState.maxMp) gameState.mp = gameState.maxMp;
                
                if (typeof UI !== 'undefined' && UI.addLog) {
                    UI.addLog(`【内测金手指】已关闭！数值还原: HP ${gameState.hp}/${gameState.maxHp}, 攻 ${gameState.atk}`, 'sys');
                }
            } else {
                // Fallback if backup missing
                if (typeof UI !== 'undefined' && UI.addLog) UI.addLog('【警告】无法找到原始数值备份，重置为默认值。', 'sys');
                gameState.maxHp = 100; gameState.hp = 100;
                gameState.maxMp = 50; gameState.mp = 50;
                gameState.atk = 10; gameState.matk = 10;
                gameState.speed = 10;
            }
            
            // Clear Flag
            flags.betaBoostActive = false;
            delete flags.betaBoostBackup;
            
            alert('数值已恢复至原始状态。');
        } else {
            // === Activate (Boost) ===
            
            // 1. Backup Stats
            flags.betaBoostBackup = {
                hp: gameState.hp,
                maxHp: gameState.maxHp,
                mp: gameState.mp,
                maxMp: gameState.maxMp,
                atk: gameState.atk,
                matk: gameState.matk,
                speed: gameState.speed
            };
            console.log("[BetaBoost] Backed up stats:", flags.betaBoostBackup);
            
            // 2. Apply Boost
            gameState.maxHp = 99999;
            gameState.hp = gameState.maxHp;
            gameState.maxMp = 99999;
            gameState.mp = gameState.maxMp;
            gameState.atk = 5000;
            gameState.matk = 5000;
            gameState.speed = 50;
            
            // 3. Give Items
            if (!gameState.inventory) gameState.inventory = {};
            gameState.inventory['息灾符'] = (gameState.inventory['息灾符'] || 0) + 10;
            gameState.inventory['天罡破煞符'] = (gameState.inventory['天罡破煞符'] || 0) + 10;
            gameState.inventory['定心丹'] = (gameState.inventory['定心丹'] || 0) + 10;

            // 4. Set Flag
            flags.betaBoostActive = true;
            
            // 5. Log & Alert
            if (typeof UI !== 'undefined' && UI.addLog) {
                UI.addLog('【内测金手指】已开启！数值大幅增强，获得强力符箓！', 'sys');
            }
            alert('内测福利已发放！\n生命/法力 -> 99999\n双攻 -> 5000\n速度 -> 50\n并获得若干符箓。\n\n再次点击此按钮可恢复原始数值。');
        }
        
        // Common UI Refresh
        if (typeof UI !== 'undefined') {
            UI.renderLeftPanel();
            UI.renderInventory();
        }
        
        // Save immediately
        if (typeof gameState.save === 'function') gameState.save();
    };

    if (btnBetaBoostLeft) btnBetaBoostLeft.addEventListener('click', handleBetaBoost);

    // Auto-remove duplicate button if it exists (Fix for "Two Buttons" issue)
    const duplicateBtn = document.getElementById('btn-beta-boost');
    if (duplicateBtn) {
        duplicateBtn.remove();
        console.log("Removed duplicate beta boost button (btn-beta-boost)");
    }

    const btnReset = document.getElementById('btn-reset-save');
    if (btnReset) btnReset.addEventListener('click', handleResetSave);

    const btnExport = document.getElementById('btn-export-battle');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const eventPayload = (typeof gameState !== 'undefined' && typeof gameState.getEventExport === 'function')
                ? gameState.getEventExport()
                : null;
            const battlePayload = (typeof gameState !== 'undefined' && typeof gameState.getBattleExport === 'function')
                ? gameState.getBattleExport()
                : null;
            const payload = eventPayload || battlePayload;
            if (!payload) {
                alert('暂无可导出的战斗/事件数据');
                return;
            }
            const json = JSON.stringify(payload, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const isEvent = !!eventPayload;
            const eventType = isEvent && payload && typeof payload.eventType === 'string' ? payload.eventType : null;
            a.download = isEvent ? `event_${eventType || 'unknown'}_${Date.now()}.json` : `battle_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            if (typeof UI !== 'undefined' && UI.addLog) UI.addLog(isEvent ? '已导出本次事件 JSON' : '已导出本场战斗 JSON', 'sys');
        });
    }

    // 8. 日志筛选
    const filterRoot = document.getElementById('log-filters');
    if (filterRoot) {
        filterRoot.querySelectorAll('.log-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                if (typeof UI !== 'undefined' && UI.setLogFilter) {
                    UI.setLogFilter(btn.dataset.filter);
                }
            });
        });
    }
}

// 页面加载完成后初始化
window.onload = function() {
    initEventListeners();
    checkLogin();
};
