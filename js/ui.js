/**
 * 游戏UI管理
 * 负责所有DOM操作和页面渲染
 */

const UI = {
    // 显示更新公告
    showReleaseNotes: function() {
        const modal = document.getElementById('release-note-modal');
        const body = document.getElementById('release-note-body');
        if (!modal || !body) return;

        // 获取数据
        const notes = (typeof GameData !== 'undefined' && Array.isArray(GameData.releaseNotes)) 
            ? GameData.releaseNotes 
            : [{ title: "暂无公告", content: "暂无更新内容。" }];

        // 渲染内容
        let html = '';
        notes.forEach(note => {
            html += `
                <div class="release-note-entry" style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px dashed #333;">
                    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
                        <span style="font-size:1.1em; font-weight:bold; color:#e0e0e0;">${note.version}</span>
                        <span style="font-size:0.85em; color:#888;">${note.date}</span>
                    </div>
                    <div style="font-size:0.95em; color:#ccc; line-height:1.6;">
                        ${note.content}
                    </div>
                </div>
            `;
        });
        
        body.innerHTML = html;
        modal.classList.remove('hidden');
    },

    // 显示更新公告
    showReleaseNotes: function() {
        const modal = document.getElementById('release-note-modal');
        const body = document.getElementById('release-note-body');
        if (!modal || !body) return;

        // 获取数据
        const notes = (typeof GameData !== 'undefined' && Array.isArray(GameData.releaseNotes)) 
            ? GameData.releaseNotes 
            : [{ title: "暂无公告", content: "暂无更新内容。" }];

        // 渲染内容
        let html = '';
        notes.forEach(note => {
            html += `
                <div class="release-note-entry" style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px dashed #333;">
                    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
                        <span style="font-size:1.1em; font-weight:bold; color:#e0e0e0;">${note.version}</span>
                        <span style="font-size:0.85em; color:#888;">${note.date}</span>
                    </div>
                    <div style="font-size:0.95em; color:#ccc; line-height:1.6;">
                        ${note.content}
                    </div>
                </div>
            `;
        });
        
        body.innerHTML = html;
        modal.classList.remove('hidden');
    },

    // 显示符箓图鉴
    showTalismanGuide: function() {
        const modal = document.getElementById('talisman-guide-modal');
        const body = document.getElementById('talisman-guide-body');
        if (!modal || !body) return;

        // 获取符箓数据
        const items = GameData.itemConfig || {};
        const talismans = Object.entries(items)
            .filter(([key, item]) => item.type === 'talisman')
            .map(([key, item]) => ({ name: key, ...item }));
        
        // 排序：红 > 蓝 > 黄 (自定义权重)
        const gradeWeight = { "红": 3, "蓝": 2, "黄": 1 };
        talismans.sort((a, b) => {
            const wa = gradeWeight[a.grade] || 0;
            const wb = gradeWeight[b.grade] || 0;
            return wb - wa;
        });

        const gradeColors = {
            "黄": "#f1c40f",
            "蓝": "#3498db",
            "红": "#e74c3c"
        };

        let html = '';
        talismans.forEach(t => {
            const color = gradeColors[t.grade] || '#ccc';
            const cooldownStr = t.cooldown ? (
                t.cooldown.oncePerMap ? "每图一次" : 
                (t.cooldown.oncePerBattle ? "每场一次" : 
                (t.cooldown.rounds ? `${t.cooldown.rounds}回合CD` : "无限制"))
            ) : "无限制";

            html += `
                <div class="talisman-entry" style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid #444; border-radius: 4px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                        <span style="font-size:1.1em; font-weight:bold; color:${color};">
                            <span style="display:inline-block; padding:1px 4px; border:1px solid ${color}; font-size:0.7em; margin-right:5px; border-radius:2px;">${t.grade}阶</span>
                            ${t.name}
                        </span>
                        <div style="text-align:right;">
                            <span style="font-size:0.85em; color:#aaa; display:block;">消耗 ${t.mpCost} MP</span>
                            ${t.reqLevel ? `<span style="font-size:0.85em; color:#888;">需 ${t.reqLevel}</span>` : ''}
                        </div>
                    </div>
                    <div style="font-size:0.9em; color:#ccc; margin-bottom:5px;">
                        <span style="color:#888;">[${cooldownStr}]</span> <span style="color:#aaa;">【用法】</span>${t.desc}
                    </div>
                    ${t.talisman && t.talisman.kind ? `
                    <div style="font-size:0.8em; color:#666; font-family:monospace; margin-top:4px;">
                        类型: ${t.talisman.kind} 
                        ${t.talisman.mult ? `| 倍率: ${Math.round(t.talisman.mult*100)}%` : ''}
                        ${t.talisman.element ? `| 属性: ${t.talisman.element}` : ''}
                    </div>` : ''}
                </div>
            `;
        });

        if (html === '') html = '<div style="padding:20px; text-align:center; color:#666;">暂无符箓记录</div>';
        
        body.innerHTML = html;
        modal.classList.remove('hidden');
    },

    // 切换面板
    toggleLeftPanel: function() {
        const panel = document.getElementById('left-panel');
        const btn = document.getElementById('expand-btn');
        
        if (panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            btn.classList.add('hidden');
        } else {
            panel.classList.add('collapsed');
            btn.classList.remove('hidden');
        }
    },

    // 初始化全局 Tooltip (修复遮挡问题)
    initGlobalTooltip: function() {
        const tooltip = document.getElementById('global-tooltip');
        if (!tooltip) return;

        let activeTarget = null;

        document.body.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[data-tooltip-key], [data-tooltip-text]');
            if (target) {
                activeTarget = target;
                const key = target.dataset.tooltipKey;
                const text = target.dataset.tooltipText;
                let content = '';

                if (key === 'race') {
                    const race = gameState.race;
                    const data = (GameData.raceConfig && GameData.raceConfig[race]) || { desc: '未知种族' };
                    content = `<h4>${race}</h4><p>${data.desc}</p>`;
                } else if (key === 'realm') {
                    let desc = '未知境界';
                    let next = '已至巅峰';
                    if (GameData.realmProgression) {
                        const idx = GameData.realmProgression.findIndex(r => r.stage === gameState.stage);
                        if (idx !== -1) {
                            desc = GameData.realmProgression[idx].desc || GameData.realmProgression[idx].stage; // Fallback
                            // Custom desc if available, else just stage name
                            // In GameData, only 'stage' etc. exists, desc might be missing. 
                            // Let's check GameData structure. data.js implies no 'desc' in progression array?
                            // Checked data.js: progression array has {realm, subRealm, stage...}. No 'desc'.
                            // I should add desc support or use generic text.
                            // However, the previous code had 'realmDesc' which seemed empty?
                            // Wait, previous code tried to access 'desc' but data.js didn't have it.
                            // I will add generic text based on realm.
                            desc = `当前处于${gameState.realm}阶段的${gameState.subRealm}层次。`;
                            if (idx + 1 < GameData.realmProgression.length) {
                                next = GameData.realmProgression[idx+1].stage;
                            }
                        }
                    }
                    content = `<h4>${gameState.realm}·${gameState.subRealm}</h4><p>${desc}</p><p style="margin-top:6px; color:#aaa; font-size:0.8em">下一境界: ${next}</p>`;
                } else if (text) {
                    content = `<p>${text}</p>`;
                }

                if (content) {
                    tooltip.innerHTML = content;
                    tooltip.style.visibility = 'visible';
                    tooltip.style.opacity = '1';
                }
            }
        });

        document.body.addEventListener('mousemove', (e) => {
            if (tooltip.style.visibility === 'visible') {
                const x = e.clientX + 15;
                const y = e.clientY + 15;
                
                // Boundary check
                const rect = tooltip.getBoundingClientRect();
                const maxX = window.innerWidth - rect.width - 10;
                const maxY = window.innerHeight - rect.height - 10;
                
                tooltip.style.left = Math.min(x, maxX) + 'px';
                tooltip.style.top = Math.min(y, maxY) + 'px';
            }
        });

        document.body.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-tooltip-key], [data-tooltip-text]');
            if (target && target === activeTarget) {
                tooltip.style.visibility = 'hidden';
                tooltip.style.opacity = '0';
                activeTarget = null;
            }
        });
    },

    // 渲染属性网格 (双列布局)
    renderStatsGrid: function() {
        const container = document.getElementById('stats-grid-container');
        if (!container) return;

        // Ensure Race Color
        const raceData = (GameData.raceConfig && GameData.raceConfig[gameState.race]) || { color: '#aaa' };
        
        // Exp bar calculation
        const expPercent = Math.min(100, Math.floor((gameState.exp / gameState.maxExp) * 100));

        // V2.4 Attribute Points
        const points = gameState.attributePoints || 0;
        const speed = gameState.speed || 10;

        const daoTypeRaw = (typeof gameState.daoType === 'string' && gameState.daoType.trim()) ? gameState.daoType.trim() : null;
        const daoBranchRaw = (typeof gameState.daoBranch === 'string' && gameState.daoBranch.trim()) ? gameState.daoBranch.trim() : null;
        const daoLabel = daoTypeRaw ? (daoBranchRaw ? `${daoTypeRaw}·${daoBranchRaw}` : daoTypeRaw) : '未立道';
        const daoTipMap = {
            '鬼道': '关键词：魂、怨、代价、记忆',
            '阴阳道': '关键词：推演、调和、逆转',
            '乾坤道': '关键词：兵戈、军势、本体',
            '天一道': '关键词：融会、复现、平衡'
        };
        const daoTip = daoTypeRaw && daoTipMap[daoTypeRaw] ? daoTipMap[daoTypeRaw] : '寻道之时，将遇“立道”之机。首次选择不可逆。';
        
        // Helper to generate allocation button
        const btn = (type) => points > 0 ? `<span class="stat-alloc-btn" data-type="${type}" title="点击加点">+</span>` : '';

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-cell"><span class="label">名称:</span><span class="value">${gameState.username}</span></div>
                <div class="stat-cell" data-tooltip-text="${daoTip}"><span class="label">道统:</span><span class="value" style="color:#888">${daoLabel}</span></div>
                
                <div class="stat-cell" data-tooltip-key="realm">
                    <span class="label">境界:</span>
                    <span class="value">${gameState.realm}·${gameState.subRealm}</span>
                </div>
                <div class="stat-cell" data-tooltip-key="race">
                    <span class="label">种族:</span>
                    <span class="value" style="color:${raceData.color}">${gameState.race}</span>
                </div>

                <div class="stat-cell" data-tooltip-text="气血决定了你的生存能力。<br>归零则身死道消。"><span class="label">气血:</span><span class="value">${Math.floor(gameState.hp)} ${btn('hp')}</span></div>
                <div class="stat-cell" data-tooltip-text="灵力用于施展功法与神通。<br>枯竭时无法释放技能。"><span class="label">魔法:</span><span class="value">${Math.floor(gameState.mp)} ${btn('mp')}</span></div>
                
                <div class="stat-cell" data-tooltip-text="物理攻击力，决定普通攻击与武技伤害。"><span class="label">物攻:</span><span class="value">${gameState.atk} ${btn('atk')}</span></div>
                <div class="stat-cell" data-tooltip-text="术法攻击力，决定灵术与神通伤害。"><span class="label">魔攻:</span><span class="value">${gameState.matk || 0} ${btn('matk')}</span></div>
                
                <div class="stat-cell" data-tooltip-text="物理防御力，减免受到的物理伤害。"><span class="label">物防:</span><span class="value">0</span></div>
                <div class="stat-cell" data-tooltip-text="术法防御力，减免受到的灵术伤害。"><span class="label">魔防:</span><span class="value">0</span></div>
                
                <div class="stat-cell" data-tooltip-text="身法速度，决定出手顺序与闪避概率。"><span class="label">速度:</span><span class="value">${speed} ${btn('speed')}</span></div>
                <div class="stat-cell" data-tooltip-text="先天灵根属性，影响功法修炼效率与威力。"><span class="label">五行:</span><span class="value">无</span></div>
            </div>
            
            ${points > 0 ? `<div style="text-align:center; color:#dddddd; font-weight:bold; margin-top:5px; font-size:0.9em;">可用属性点: ${points}</div>` : ''}
            
            <!-- Cultivation Bar Row -->
            <div style="margin-top:4px; font-size:0.9em; display:flex; flex-direction:column; gap:2px;" data-tooltip-text="当前修为进度。<br>满值后需进行【境界突破】。">
                <div style="display:flex; justify-content:space-between; color:#aaa; font-size:0.85em;">
                    <span>修为进度</span>
                    <span>${gameState.exp}/${gameState.maxExp}</span>
                </div>
                <div style="background:#333; height:6px; border-radius:3px; overflow:hidden;">
                    <div style="width:${expPercent}%; background:#cccccc; height:100%; transition:width 0.3s;"></div>
                </div>
            </div>
            
            <div id="breakthrough-container" style="margin-top:10px;"></div>
        `;
        
        // Bind click events for allocation buttons
        const btns = container.querySelectorAll('.stat-alloc-btn');
        btns.forEach(b => {
            b.onclick = (e) => {
                e.stopPropagation(); // Prevent tooltip toggle if any
                const type = b.getAttribute('data-type');
                if (gameState.allocatePoint(type)) {
                    UI.renderStatsGrid(); // Re-render to update values and points
                    let msg = '';
                    switch(type) {
                        case 'hp': msg = '气血上限+10'; break;
                        case 'mp': msg = '法力上限+10'; break;
                        case 'atk': msg = '物攻+1'; break;
                        case 'matk': msg = '法攻+1'; break;
                        case 'speed': msg = '速度+1'; break;
                    }
                    UI.addLog(`属性分配成功！${msg}`, 'sys');
                }
            };
        });

        // Add breakthrough button logic
        if (gameState.exp >= gameState.maxExp) {
            this.showBreakthroughBtn(true);
        }
    },

    // 渲染左侧面板
    renderLeftPanel: function() {
        // Render the new grid
        this.renderStatsGrid();

        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) debugPanel.style.display = 'none';

        // 渲染左侧迷你背包
        if (typeof this.renderMiniInventory === 'function') {
            this.renderMiniInventory();
        }

        const affinityList = document.getElementById('affinity-list');
        affinityList.innerHTML = '';
        for (const [dao, val] of Object.entries(gameState.daoAffinity)) {
            const li = document.createElement('li');
            li.textContent = `${dao}: ${val}`;
            affinityList.appendChild(li);
        }
    },

    // V1.4/V1.5 更新属性 UI
    updateStatsUI: function() {
        // [V1.9.0 Fix] 恢复实时刷新逻辑，确保战斗/修为变化即时反馈
        this.renderStatsGrid();
        this.renderBattleOverview();
        
        // 如果有挂机状态更新，也可以在这里刷新
        if (typeof this.updateHangingStatus === 'function') {
            this.updateHangingStatus();
        }
    },

    renderBattleOverview: function() {
        const empty = document.getElementById('battle-overview-empty');
        const root = document.getElementById('battle-overview');
        const envBadge = document.getElementById('battle-env');
        if (!empty || !root) return;

        const c = gameState && gameState.combat && typeof gameState.combat === 'object' ? gameState.combat : null;
        if (!c) {
            empty.classList.remove('hidden');
            root.classList.add('hidden');
            if (envBadge) envBadge.textContent = '未在战斗';
            return;
        }

        empty.classList.add('hidden');
        root.classList.remove('hidden');

        const p = c.player && typeof c.player === 'object' ? c.player : {
            hp: gameState.hp,
            maxHp: gameState.maxHp,
            mp: gameState.mp,
            maxMp: gameState.maxMp,
            statuses: []
        };
        const hp = Math.max(0, Number(p.hp) || 0);
        const maxHp = Math.max(1, Number(p.maxHp) || 1);
        const mp = Math.max(0, Number(p.mp) || 0);
        const maxMp = Math.max(0, Number(p.maxMp) || 0);

        const descById = {
            fear: '心神动摇，行动更易失序。',
            confuse: '神识迷乱，出手不稳。'
        };
        const mkIcon = (s) => {
            const obj = (s && typeof s === 'object') ? s : {};
            const id = typeof obj.id === 'string' ? obj.id : '';
            const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : (id || '状态');
            const d = Number.isFinite(Number(obj.duration)) ? Math.floor(Number(obj.duration)) : null;
            const desc = (id && descById[id]) ? descById[id] : '状态效果持续生效。';
            const el = document.createElement('span');
            el.className = 'status-icon';
            el.textContent = name.slice(0, 1);
            el.title = d !== null ? `${name}（${d}回合）\n${desc}` : `${name}\n${desc}`;
            return el;
        };

        const hpFill = document.getElementById('battle-player-hp-fill');
        const hpText = document.getElementById('battle-player-hp-text');
        const mpFill = document.getElementById('battle-player-mp-fill');
        const mpText = document.getElementById('battle-player-mp-text');
        if (hpFill) hpFill.style.width = `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%`;
        if (hpText) hpText.textContent = `${Math.floor(hp)}/${Math.floor(maxHp)}`;
        if (mpFill) mpFill.style.width = `${maxMp <= 0 ? 0 : Math.max(0, Math.min(100, (mp / maxMp) * 100))}%`;
        if (mpText) mpText.textContent = `${Math.floor(mp)}/${Math.floor(maxMp)}`;

        if (envBadge) {
            const env = c.env && typeof c.env === 'object' ? c.env : null;
            const mapId = env && typeof env.mapId === 'string' ? env.mapId : '未知';
            const diff = Number.isFinite(Number(env && env.difficulty)) ? Number(env.difficulty) : null;
            envBadge.textContent = diff !== null ? `${mapId}·难度${diff}` : mapId;
        }

        const ps = Array.isArray(c.playerStatuses) ? c.playerStatuses : (Array.isArray(p.statuses) ? p.statuses : []);
        const psEl = document.getElementById('battle-player-status');
        if (psEl) {
            psEl.innerHTML = '';
            const row = document.createElement('div');
            row.className = 'status-row';
            const label = document.createElement('div');
            label.className = 'status-label';
            label.textContent = '状态';
            const icons = document.createElement('div');
            icons.className = 'status-icons';
            if (!ps.length) {
                const none = document.createElement('span');
                none.className = 'status-empty';
                none.textContent = '无';
                icons.appendChild(none);
            } else {
                ps.filter(x => x && typeof x === 'object').slice(0, 10).forEach(s => icons.appendChild(mkIcon(s)));
            }
            row.appendChild(label);
            row.appendChild(icons);
            psEl.appendChild(row);
        }

        const list = document.getElementById('battle-monsters');
        if (list) {
            const monsters = Array.isArray(c.monsters) ? c.monsters : [];
            const activeId = typeof c.activeTargetId === 'string' ? c.activeTargetId : null;
            list.innerHTML = '';
            if (!monsters.length) {
                const div = document.createElement('div');
                div.className = 'monster-row';
                div.textContent = '无敌人数据';
                list.appendChild(div);
            } else {
                monsters.forEach(m => {
                    if (!m || typeof m !== 'object') return;
                    const row = document.createElement('div');
                    row.className = 'monster-row' + (activeId && m.id === activeId ? ' active' : '');

                    const header = document.createElement('div');
                    header.className = 'monster-row-header';

                    const name = document.createElement('div');
                    name.className = 'monster-name';
                    name.textContent = typeof m.name === 'string' ? m.name : (typeof m.id === 'string' ? m.id : '敌人');

                    const meta = document.createElement('div');
                    meta.className = 'monster-meta';
                    const dl = Number.isFinite(Number(m.dangerLevel)) ? Number(m.dangerLevel) : null;
                    meta.textContent = dl !== null ? `威胁${dl}` : '';

                    header.appendChild(name);
                    if (meta.textContent) header.appendChild(meta);

                    const track = document.createElement('div');
                    track.className = 'monster-hp-track';
                    const fill = document.createElement('div');
                    fill.className = 'monster-hp-fill';
                    const mhp = Math.max(0, Number(m.hp) || 0);
                    const mmax = Math.max(1, Number(m.maxHp) || 1);
                    fill.style.width = `${Math.max(0, Math.min(100, (mhp / mmax) * 100))}%`;
                    track.appendChild(fill);

                    const status = document.createElement('div');
                    status.className = 'monster-status';
                    const st = Array.isArray(m.statuses) ? m.statuses : [];
                    status.innerHTML = '';
                    const foot = document.createElement('div');
                    foot.className = 'monster-foot';
                    const hpText2 = document.createElement('div');
                    hpText2.className = 'monster-hp-text';
                    hpText2.textContent = `${Math.floor(mhp)}/${Math.floor(mmax)}`;
                    const icons2 = document.createElement('div');
                    icons2.className = 'status-icons';
                    if (!st.length) {
                        const none = document.createElement('span');
                        none.className = 'status-empty';
                        none.textContent = '无';
                        icons2.appendChild(none);
                    } else {
                        st.filter(x => x && typeof x === 'object').slice(0, 10).forEach(s => icons2.appendChild(mkIcon(s)));
                    }
                    foot.appendChild(hpText2);
                    foot.appendChild(icons2);
                    status.appendChild(foot);

                    row.appendChild(header);
                    row.appendChild(track);
                    row.appendChild(status);
                    list.appendChild(row);
                });
            }
        }
    },

    refreshDebugPanel: function() {
        if (typeof window !== 'undefined' && window.__PLAYER_MODE__ === true) return;
        const pre = document.getElementById('debug-last-meta');
        if (!pre) return;
        const engine = (typeof window !== 'undefined' && window.CombatEngine) ? window.CombatEngine : null;
        const engineName = (() => {
            if (!engine) return null;
            if (engine === (typeof window !== 'undefined' ? window.CombatEngineV2 : null)) return 'CombatEngineV2';
            return 'CombatEngine';
        })();
        const engineVersion = engine && typeof engine.version === 'string' ? engine.version : null;
        const lm = (obj) => (obj && typeof obj === 'object' ? obj : null);
        const snap = {
            freeze: {
                tag: (typeof window !== 'undefined' && typeof window.__FREEZE_TAG__ === 'string' && window.__FREEZE_TAG__.trim()) ? window.__FREEZE_TAG__.trim() : null,
                policy: {
                    system: 'frozen',
                    combatEngine: 'frozen',
                    replayRngDeltaKey: 'frozen',
                    eventSystemSchema: 'frozen'
                }
            },
            engine: { name: engineName, version: engineVersion },
            lastDeltaMeta: lm(gameState.lastDeltaMeta),
            lastStoryMeta: lm(gameState.lastStoryMeta),
            lastWorldMeta: lm(gameState.lastWorldMeta),
            lastAction: lm(gameState.replay && gameState.replay.lastAction),
            replay: gameState.replay && typeof gameState.replay === 'object'
                ? { enabled: gameState.replay.enabled === true, actions: Array.isArray(gameState.replay.actions) ? gameState.replay.actions.length : 0, seed: gameState.replay.seed ?? null }
                : null
        };
        pre.textContent = JSON.stringify(snap, null, 2);

        const area = document.getElementById('debug-rules-config');
        if (area && !area.dataset.touched) {
            const cfg = (typeof window !== 'undefined' && window.RulesConfig && typeof window.RulesConfig === 'object') ? window.RulesConfig : {};
            area.value = JSON.stringify(cfg, null, 2);
        }
        this._initReplayDebugPanelOnce();
    },

    withLogCapture: function(fn) {
        const f = typeof fn === 'function' ? fn : (() => {});
        const ui = this;
        const logs = [];
        const safeClone = (obj) => {
            try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
        };
        const origAdd = ui.addLog;
        const origEvent = ui.renderEventLogs;
        const origCombat = ui.renderCombatLogs;
        ui.addLog = function(msg, type = 'normal') {
            const text = typeof msg === 'string' ? msg : String(msg ?? '');
            const t = typeof type === 'string' ? type : 'sys';
            logs.push({ type: t === 'normal' ? 'sys' : t, tag: null, text });
        };
        ui.renderEventLogs = function(entries) {
            if (Array.isArray(entries)) logs.push(...entries.map(safeClone));
        };
        ui.renderCombatLogs = function(entries) {
            if (Array.isArray(entries)) logs.push(...entries.map(safeClone));
        };
        try {
            return f(logs);
        } finally {
            ui.addLog = origAdd;
            ui.renderEventLogs = origEvent;
            ui.renderCombatLogs = origCombat;
        }
    },

    _initReplayDebugPanelOnce: function() {
        if (this._replayDebugBound === true) return;
        const btnMeta = document.getElementById('debug-tab-meta');
        const btnReplay = document.getElementById('debug-tab-replay');
        const panelMeta = document.getElementById('debug-panel-meta');
        const panelReplay = document.getElementById('debug-panel-replay');
        if (!btnMeta || !btnReplay || !panelMeta || !panelReplay) return;

        const setTab = (tab) => {
            const isReplay = tab === 'replay';
            panelMeta.style.display = isReplay ? 'none' : 'block';
            panelReplay.style.display = isReplay ? 'block' : 'none';
        };
        btnMeta.addEventListener('click', () => setTab('meta'));
        btnReplay.addEventListener('click', () => {
            setTab('replay');
            this.refreshReplayEngineSelects();
            this.rebuildReplayTimeline();
        });
        setTab('meta');

        const elPlay = document.getElementById('debug-replay-play');
        const elPause = document.getElementById('debug-replay-pause');
        const elBack = document.getElementById('debug-replay-step-back');
        const elFwd = document.getElementById('debug-replay-step-fwd');
        const elEngineA = document.getElementById('debug-replay-engine-a');
        const elEngineB = document.getElementById('debug-replay-engine-b');
        const elShadow = document.getElementById('debug-replay-shadow-run');
        const elSlider = document.getElementById('debug-replay-tick');
        const elLabel = document.getElementById('debug-replay-tick-label');
        const elRebuild = document.getElementById('debug-replay-rebuild');
        const elBaseline = document.getElementById('debug-replay-adopt-baseline');

        const getTick = () => {
            const v = elSlider ? Number(elSlider.value) : 0;
            return Number.isFinite(v) ? Math.floor(v) : 0;
        };
        const setTickUI = (t) => {
            if (elSlider) elSlider.value = String(t);
            if (elLabel) elLabel.textContent = String(t);
        };

        if (elSlider) {
            elSlider.addEventListener('input', () => {
                const t = getTick();
                setTickUI(t);
                this.seekReplayTick(t);
            });
        }
        if (elBack) elBack.addEventListener('click', () => this.seekReplayTick(Math.max(0, getTick() - 1)));
        if (elFwd) elFwd.addEventListener('click', () => this.seekReplayTick(getTick() + 1));
        if (elRebuild) elRebuild.addEventListener('click', () => this.rebuildReplayTimeline());
        if (elBaseline) elBaseline.addEventListener('click', () => {
            if (typeof gameState !== 'undefined' && gameState && typeof gameState.captureReplayBaseline === 'function') {
                gameState.captureReplayBaseline('adopt');
                this.rebuildReplayTimeline();
            }
        });
        if (elShadow) elShadow.addEventListener('click', () => this.runShadowRun());
        if (elEngineA) elEngineA.addEventListener('change', () => {});
        if (elEngineB) elEngineB.addEventListener('change', () => {});

        if (elPause) elPause.addEventListener('click', () => {
            if (this._replayPlayTimer) {
                clearInterval(this._replayPlayTimer);
                this._replayPlayTimer = null;
            }
        });
        if (elPlay) elPlay.addEventListener('click', () => {
            if (this._replayPlayTimer) return;
            this._replayPlayTimer = setInterval(() => {
                const t0 = getTick();
                const t1 = t0 + 1;
                this.seekReplayTick(t1);
                setTickUI(t1);
                const maxTick = this._replayTimelineIndex && Number.isFinite(Number(this._replayTimelineIndex.maxTick)) ? Math.floor(Number(this._replayTimelineIndex.maxTick)) : 0;
                if (t1 >= maxTick) {
                    clearInterval(this._replayPlayTimer);
                    this._replayPlayTimer = null;
                }
            }, 350);
        });

        this._replayDebugBound = true;
        if (elLabel) setTickUI(getTick());
    },

    refreshReplayEngineSelects: function() {
        const selA = document.getElementById('debug-replay-engine-a');
        const selB = document.getElementById('debug-replay-engine-b');
        if (!selA || !selB) return;

        const reg = (typeof window !== 'undefined' && window.CombatEngineRegistry && typeof window.CombatEngineRegistry === 'object') ? window.CombatEngineRegistry : {};
        const keys = Object.keys(reg);
        const options = keys.map(k => {
            const entry = reg[k];
            const name = entry && entry.name ? entry.name : k;
            const v = entry && typeof entry.version === 'string' ? entry.version : '';
            return { key: k, label: `${name}${v ? ` (${v})` : ''}`, engine: entry && entry.engine ? entry.engine : null };
        });
        const current = (typeof window !== 'undefined' && window.CombatEngine) ? window.CombatEngine : null;
        const currentKey = options.find(o => o.engine && current && o.engine === current)?.key ?? null;

        const applyOptions = (sel) => {
            sel.innerHTML = '';
            options.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.key;
                opt.textContent = o.label;
                sel.appendChild(opt);
            });
        };
        applyOptions(selA);
        applyOptions(selB);

        if (options.length) {
            selA.value = currentKey || options[0].key;
            selB.value = options.length > 1
                ? (options[1].key === selA.value ? options[0].key : options[1].key)
                : selA.value;
        }
    },

    runShadowRun: function() {
        const selA = document.getElementById('debug-replay-engine-a');
        const selB = document.getElementById('debug-replay-engine-b');
        const keyA = selA ? selA.value : null;
        const keyB = selB ? selB.value : null;
        if (typeof window === 'undefined' || typeof window.shadowRunReplayMismatch !== 'function') return;

        const out = window.shadowRunReplayMismatch(gameState, keyA, keyB);
        const issuesPre = document.getElementById('debug-replay-issues');
        if (!out) return;

        const a = out.engineA;
        const b = out.engineB;
        const header = `Shadow: A=${a ? `${a.name}${a.version ? `(${a.version})` : ''}` : 'n/a'}  vs  B=${b ? `${b.name}${b.version ? `(${b.version})` : ''}` : 'n/a'}`;

        if (issuesPre) {
            const extra = Array.isArray(out.issues) && out.issues.length ? out.issues.join('\n') : '';
            issuesPre.textContent = extra ? `${header}\n${extra}` : header;
            issuesPre.style.color = '';
            delete issuesPre.dataset.kind;
        }

        if (out.mismatch) {
            this._replayMismatch = out.mismatch;
            if (issuesPre) {
                issuesPre.dataset.kind = 'mismatch';
                issuesPre.style.color = '#ff6b6b';
                const mm = out.mismatch;
                const diffs = Array.isArray(mm.diffs) ? mm.diffs : [];
                const diffLines = diffs.length
                    ? diffs.map(d => {
                        const k = d && typeof d.key === 'string' ? d.key : '';
                        const from = d && Object.prototype.hasOwnProperty.call(d, 'from') ? d.from : undefined;
                        const to = d && Object.prototype.hasOwnProperty.call(d, 'to') ? d.to : undefined;
                        const fmt = (v) => {
                            if (v === null) return 'null';
                            if (v === undefined) return 'undefined';
                            const t = typeof v;
                            if (t === 'string' || t === 'number' || t === 'boolean') return String(v);
                            try { return JSON.stringify(v); } catch { return String(v); }
                        };
                        return `${k}: ${fmt(from)} → ${fmt(to)}`;
                    })
                    : ['(unavailable)'];
                const keys = new Set(diffs.map(d => (d && typeof d.key === 'string' ? d.key : '')).filter(Boolean));
                const find = (k) => diffs.find(d => d && d.key === k) || null;
                const fmtVal = (v) => {
                    if (v === null) return 'null';
                    if (v === undefined) return 'undefined';
                    const t = typeof v;
                    if (t === 'string' || t === 'number' || t === 'boolean') return String(v);
                    try { return JSON.stringify(v); } catch { return String(v); }
                };
                const cause = [];
                if (keys.has('_rngState') || keys.has('rngSeed') || keys.has('lastRngConsumerTag')) {
                    const tag = find('lastRngConsumerTag');
                    const extra = tag ? ` (tag: ${fmtVal(tag.from)} → ${fmtVal(tag.to)})` : '';
                    cause.push(`- RNG divergence${extra}`);
                }
                if (keys.has('_deltaSeq')) {
                    cause.push('- Sequence divergence (state update count differs)');
                }
                if (keys.has('storyTick') || keys.has('storyDay') || keys.has('storyStep')) {
                    cause.push('- Time divergence (tick/day mismatch)');
                }
                if (keys.has('inCombat') || keys.has('monsterCount') || keys.has('storyNextEventId') || keys.has('storyChainId')) {
                    cause.push('- Branch divergence (combat/event path differs)');
                }
                if (keys.has('worldOrder') || keys.has('worldChaos') || keys.has('worldOmen')) {
                    cause.push('- World divergence (tendencies differ)');
                }
                if (!cause.length) cause.push('- Unknown (see Diff)');
                const effects = [];
                if (keys.has('hp')) {
                    const dk = find('lastDamageSourceDeltaKey') || find('lastDeltaKey');
                    const extra = dk ? ` (lastDamageSourceDeltaKey: ${fmtVal(dk.from)} → ${fmtVal(dk.to)})` : '';
                    effects.push(`- hp mismatch${extra}`);
                }
                if (keys.has('playerStatusIds')) effects.push('- status mismatch');
                if (keys.has('monstersHp')) effects.push('- monster hp mismatch');
                if (keys.has('lastDeltaKey')) {
                    const d = find('lastDeltaKey');
                    if (d) effects.push(`- lastDeltaKey mismatch (${fmtVal(d.from)} → ${fmtVal(d.to)})`);
                }
                if (!effects.length) effects.push('- (no core effects detected)');
                issuesPre.textContent = `${header}\n\n❌ Mismatch at tick ${mm.mismatchTick}\n   expected: ${mm.expectedHash}\n   actual: ${mm.actualHash}\n\nCause:\n${cause.join('\n')}\n\nEffects:\n${effects.join('\n')}\n\nDiff:\n${diffLines.join('\n')}`;
            }

            const lastGood = Number.isFinite(Number(out.mismatch.lastGoodTick)) ? Math.max(0, Math.floor(Number(out.mismatch.lastGoodTick))) : 0;
            this.seekReplayTick(lastGood, { skipVerify: true });
        } else {
            this._replayMismatch = null;
            this.renderReplayTick(Number(document.getElementById('debug-replay-tick')?.value) || 0);
        }
    },

    rebuildReplayTimeline: function() {
        if (typeof window === 'undefined' || typeof window.buildReplayTimeline !== 'function') return;
        const idx = window.buildReplayTimeline(gameState);
        this._replayTimelineIndex = idx;
        this._replayMismatch = null;

        const slider = document.getElementById('debug-replay-tick');
        const label = document.getElementById('debug-replay-tick-label');
        const maxTick = idx && Number.isFinite(Number(idx.maxTick)) ? Math.max(0, Math.floor(Number(idx.maxTick))) : 0;
        if (slider) {
            slider.max = String(maxTick);
            const cur = Number(slider.value);
            if (!Number.isFinite(cur) || cur > maxTick) slider.value = String(maxTick);
        }
        if (label && slider) label.textContent = slider.value;

        const issuesPre = document.getElementById('debug-replay-issues');
        if (issuesPre) issuesPre.textContent = idx && Array.isArray(idx.issues) && idx.issues.length ? idx.issues.join('\n') : '';

        const tick = slider ? Math.floor(Number(slider.value) || 0) : 0;
        this.renderReplayTick(tick);
        this.checkReplayMismatchAndFocus({ focus: true });
    },

    seekReplayTick: function(tick, opts) {
        const o = opts && typeof opts === 'object' ? opts : {};
        const t = Number.isFinite(Number(tick)) ? Math.max(0, Math.floor(Number(tick))) : 0;
        const slider = document.getElementById('debug-replay-tick');
        const label = document.getElementById('debug-replay-tick-label');
        if (slider) slider.value = String(t);
        if (label) label.textContent = String(t);

        if (typeof Logic !== 'undefined' && Logic && typeof Logic.runUntilTick === 'function') {
            this.withLogCapture(() => {
                Logic.runUntilTick(t, { render: true });
            });
        }
        this.renderReplayTick(t);
        if (o.skipVerify !== true) this.checkReplayMismatchAndFocus({ focus: true });
    },

    checkReplayMismatchAndFocus: function(opts) {
        const o = opts && typeof opts === 'object' ? opts : {};
        const focus = o.focus === true;

        const issuesPre = document.getElementById('debug-replay-issues');
        const label = document.getElementById('debug-replay-tick-label');
        const slider = document.getElementById('debug-replay-tick');

        const clearMismatchUI = () => {
            if (issuesPre && issuesPre.dataset && issuesPre.dataset.kind === 'mismatch') {
                issuesPre.textContent = '';
                issuesPre.style.color = '';
                delete issuesPre.dataset.kind;
            }
            if (label) label.style.color = '';
        };

        if (typeof window === 'undefined' || typeof window.verifyReplayMismatch !== 'function') {
            clearMismatchUI();
            return null;
        }
        const out = window.verifyReplayMismatch(gameState);
        const mm = out && out.mismatch && typeof out.mismatch === 'object' ? out.mismatch : null;
        if (!mm) {
            this._replayMismatch = null;
            clearMismatchUI();
            return null;
        }

        this._replayMismatch = mm;
        if (issuesPre) {
            issuesPre.dataset.kind = 'mismatch';
            issuesPre.style.color = '#ff6b6b';
            const diffs = Array.isArray(mm.diffs) ? mm.diffs : [];
            const diffLines = diffs.length
                ? diffs.map(d => {
                    const k = d && typeof d.key === 'string' ? d.key : '';
                    const from = d && Object.prototype.hasOwnProperty.call(d, 'from') ? d.from : undefined;
                    const to = d && Object.prototype.hasOwnProperty.call(d, 'to') ? d.to : undefined;
                    const fmt = (v) => {
                        if (v === null) return 'null';
                        if (v === undefined) return 'undefined';
                        const t = typeof v;
                        if (t === 'string' || t === 'number' || t === 'boolean') return String(v);
                        try { return JSON.stringify(v); } catch { return String(v); }
                    };
                    return `${k}: ${fmt(from)} → ${fmt(to)}`;
                })
                : ['(unavailable)'];
            const keys = new Set(diffs.map(d => (d && typeof d.key === 'string' ? d.key : '')).filter(Boolean));
            const find = (k) => diffs.find(d => d && d.key === k) || null;
            const fmtVal = (v) => {
                if (v === null) return 'null';
                if (v === undefined) return 'undefined';
                const t = typeof v;
                if (t === 'string' || t === 'number' || t === 'boolean') return String(v);
                try { return JSON.stringify(v); } catch { return String(v); }
            };
            const cause = [];
            if (keys.has('_rngState') || keys.has('rngSeed') || keys.has('lastRngConsumerTag')) {
                const tag = find('lastRngConsumerTag');
                const extra = tag ? ` (tag: ${fmtVal(tag.from)} → ${fmtVal(tag.to)})` : '';
                cause.push(`- RNG divergence${extra}`);
            }
            if (keys.has('_deltaSeq')) {
                cause.push('- Sequence divergence (state update count differs)');
            }
            if (keys.has('storyTick') || keys.has('storyDay') || keys.has('storyStep')) {
                cause.push('- Time divergence (tick/day mismatch)');
            }
            if (keys.has('inCombat') || keys.has('monsterCount') || keys.has('storyNextEventId') || keys.has('storyChainId')) {
                cause.push('- Branch divergence (combat/event path differs)');
            }
            if (keys.has('worldOrder') || keys.has('worldChaos') || keys.has('worldOmen')) {
                cause.push('- World divergence (tendencies differ)');
            }
            if (!cause.length) cause.push('- Unknown (see Diff)');
            const effects = [];
            if (keys.has('hp')) {
                const dk = find('lastDamageSourceDeltaKey') || find('lastDeltaKey');
                const extra = dk ? ` (lastDamageSourceDeltaKey: ${fmtVal(dk.from)} → ${fmtVal(dk.to)})` : '';
                effects.push(`- hp mismatch${extra}`);
            }
            if (keys.has('playerStatusIds')) effects.push('- status mismatch');
            if (keys.has('monstersHp')) effects.push('- monster hp mismatch');
            if (keys.has('lastDeltaKey')) {
                const d = find('lastDeltaKey');
                if (d) effects.push(`- lastDeltaKey mismatch (${fmtVal(d.from)} → ${fmtVal(d.to)})`);
            }
            if (!effects.length) effects.push('- (no core effects detected)');
            issuesPre.textContent = `❌ Mismatch at tick ${mm.mismatchTick}\n   expected: ${mm.expectedHash}\n   actual: ${mm.actualHash}\n\nCause:\n${cause.join('\n')}\n\nEffects:\n${effects.join('\n')}\n\nDiff:\n${diffLines.join('\n')}`;
        }

        if (label) label.style.color = '#ff6b6b';

        if (focus) {
            const lastGood = Number.isFinite(Number(mm.lastGoodTick)) ? Math.max(0, Math.floor(Number(mm.lastGoodTick))) : 0;
            const cur = slider ? Math.floor(Number(slider.value) || 0) : 0;
            if (cur > lastGood) {
                this.seekReplayTick(lastGood, { skipVerify: true });
            }
        }
        return mm;
    },

    renderReplayTick: function(tick) {
        const idx = this._replayTimelineIndex;
        const actionsPre = document.getElementById('debug-replay-actions');
        const logsPre = document.getElementById('debug-replay-logs');
        if (!actionsPre || !logsPre) return;

        const t = Number.isFinite(Number(tick)) ? Math.max(0, Math.floor(Number(tick))) : 0;
        const timeline = idx && Array.isArray(idx.timeline) ? idx.timeline : [];
        const byTick = idx && idx.byTick && typeof idx.byTick === 'object' ? idx.byTick : {};
        const pickIndex = (() => {
            const direct = byTick[String(t)];
            if (Number.isFinite(Number(direct))) return Number(direct);
            let best = -1;
            for (let i = 0; i < timeline.length; i++) {
                const tt = Number(timeline[i].tick) || 0;
                if (tt <= t) best = i;
            }
            return best;
        })();
        const node = pickIndex >= 0 ? timeline[pickIndex] : null;
        if (!node) {
            actionsPre.textContent = '';
            logsPre.textContent = '';
            return;
        }

        const fmtAction = (a) => {
            const type = typeof a.type === 'string' ? a.type : 'action';
            const p = a.payload && typeof a.payload === 'object' ? a.payload : {};
            if (type === 'move') return `move → map: ${p.mapName ?? ''}`;
            if (type === 'tick') return `tick`;
            if (type === 'event_choice') return `event_choice → ${p.eventId ?? ''} / ${p.optionId ?? ''}`;
            if (type === 'useItem') return `useItem → ${p.itemName ?? ''}`;
            if (type === 'breakthrough') return `breakthrough → ${p.realm ?? ''} · ${p.stage ?? ''}`;
            return `${type}`;
        };
        const fmtLog = (e) => {
            const type = typeof e.type === 'string' ? e.type : 'sys';
            const tag = typeof e.tag === 'string' ? e.tag : '';
            const text = typeof e.text === 'string' ? e.text : (typeof e === 'string' ? e : JSON.stringify(e));
            const meta = e && e.meta && typeof e.meta === 'object' ? e.meta : null;
            const dk = meta && typeof meta.deltaKey === 'string' ? meta.deltaKey : '';
            const head = `[${type}${tag ? `|${tag}` : ''}]`;
            return `${head} ${text}${dk ? ` (${dk})` : ''}`;
        };

        const mm = this._replayMismatch && typeof this._replayMismatch === 'object' ? this._replayMismatch : null;
        const header = `Tick ${node.tick}  deltaKey=${node.deltaKey || '-'}  hash=${node.stateHash || '-'}`;
        const markers = (() => {
            const out = [];
            const push = (s) => {
                const v = typeof s === 'string' ? s.trim() : '';
                if (!v) return;
                if (!out.includes(v)) out.push(v);
            };
            const acts = Array.isArray(node.actions) ? node.actions : [];
            for (let i = 0; i < acts.length; i++) {
                const a = acts[i];
                if (!a || typeof a !== 'object') continue;
                const t = typeof a.type === 'string' ? a.type : '';
                const p = a.payload && typeof a.payload === 'object' ? a.payload : {};
                if (t === 'breakthrough') push(`突破→${(p.realm ?? '')}${(p.stage ? `·${p.stage}` : '')}`);
                if (t === 'useItem') push(`道具:${p.itemName ?? ''}`);
                if (t === 'event_choice' && typeof p.eventId === 'string') {
                    if (p.eventId === 'event_cycle_complete_01') push('呼吸点');
                    if (p.eventId === 'event_heart_demon_combat_01') push('心魔:Combat');
                    if (p.eventId === 'event_breakthrough_stabilized_01') push('突破:Stabilized');
                }
            }
            const logs = Array.isArray(node.logs) ? node.logs : [];
            for (let i = 0; i < logs.length; i++) {
                const e = logs[i];
                if (!e || typeof e !== 'object') continue;
                const tag = typeof e.tag === 'string' ? e.tag : '';
                const text = typeof e.text === 'string' ? e.text : '';
                const meta = e.meta && typeof e.meta === 'object' ? e.meta : null;
                const eventType = meta && typeof meta.eventType === 'string' ? meta.eventType : '';
                const eventId = meta && typeof meta.eventId === 'string' ? meta.eventId : '';
                if (tag === 'event_start') {
                    if (eventId === 'event_cycle_complete_01') push('呼吸点');
                    else if (eventId === 'event_heart_demon_combat_01') push('心魔:Combat');
                    else if (eventId === 'event_breakthrough_stabilized_01') push('突破:Stabilized');
                    else if (/breakthrough/.test(eventId)) push('突破:分支');
                }
                if (tag === 'demon_end_win') push('心魔:守心');
                else if (tag === 'demon_end_lose') push('心魔:崩塌');
                if (eventType === 'heartDemon' && tag === 'event_end' && (text.includes('未灭') || text.includes('勉强') || text.includes('未能'))) push('心魔:灰结局');
            }
            return out;
        })();
        const prefix = (mm && Number.isFinite(Number(mm.mismatchTick)) && node.tick >= Number(mm.mismatchTick)) ? '❌ ' : '';
        const markerLine = `Markers: ${markers.length ? markers.join(' → ') : '-'}`;
        const actionsText = [header, markerLine, '', 'Actions:', ...(Array.isArray(node.actions) ? node.actions.map(fmtAction) : [])].join('\n');
        const logsText = ['Logs:', ...(Array.isArray(node.logs) ? node.logs.map(fmtLog) : [])].join('\n');

        actionsPre.textContent = prefix ? (prefix + actionsText) : actionsText;
        logsPre.textContent = logsText;
    },

    // V1.5 显示/隐藏突破按钮
    showBreakthroughBtn: function(show) {
        const container = document.getElementById('breakthrough-container');
        if (!container) return;

        container.innerHTML = '';
        if (!show) return;

        const prep = document.createElement('button');
        prep.id = 'btn-breakthrough-prepare';
        prep.textContent = "【破境准备】";
        prep.style.width = "100%";
        prep.style.marginBottom = "6px";
        prep.style.background = "linear-gradient(45deg, #1b5e20, #2e7d32)";
        prep.style.color = "#fff";
        prep.style.border = "none";
        prep.style.cursor = "pointer";
        prep.style.padding = "6px 0";
        prep.style.borderRadius = "4px";
        prep.onclick = () => {
            if (typeof UI !== 'undefined' && UI && typeof UI.playRitual === 'function') UI.playRitual('气机徐行，心神渐定……');
            setTimeout(() => Logic.requestBreakthroughPrepare(), 120);
        };
        container.appendChild(prep);

        const btn = document.createElement('button');
        btn.id = 'btn-breakthrough';
        btn.textContent = "【境界突破】";
        btn.style.width = "100%";
        btn.style.background = "linear-gradient(45deg, #b71c1c, #d32f2f)";
        btn.style.color = "#fff";
        btn.style.border = "none";
        btn.style.cursor = "pointer";
        btn.style.padding = "6px 0";
        btn.style.borderRadius = "4px";
        btn.className = "pulse-anim";
        btn.onclick = () => {
            if (typeof UI !== 'undefined' && UI && typeof UI.playRitual === 'function') UI.playRitual('气机翻涌，天命未定……');
            setTimeout(() => Logic.requestBreakthrough(), 120);
        };
        container.appendChild(btn);
    },

    // 渲染地图列表
    renderMapList: function() {
        const mapList = document.getElementById('map-list');
        mapList.innerHTML = '';
        
        const current = gameState.currentMap;
        if (!current) return;

        // 初始化显示状态 (默认全部显示)
        if (typeof this.showAllMaps === 'undefined') {
            this.showAllMaps = true;
        }

        // 控制栏
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.justifyContent = 'flex-end';
        controls.style.marginBottom = '5px';
        
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = this.showAllMaps ? "只看邻近" : "显示全部";
        toggleBtn.style.fontSize = "0.8em";
        toggleBtn.style.padding = "2px 8px";
        toggleBtn.style.cursor = "pointer";
        toggleBtn.onclick = () => {
            this.showAllMaps = !this.showAllMaps;
            this.renderMapList();
        };
        controls.appendChild(toggleBtn);
        mapList.appendChild(controls);

        // 地图网格
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gap = '10px';
        grid.style.marginBottom = '10px';

        const allMaps = Object.keys(GameData.mapConfig);
        const isYinId = (id) => {
            const m = GameData.mapConfig && GameData.mapConfig[id];
            const w = m && typeof m.world === 'string' ? m.world : '';
            return w === 'yin' || (typeof id === 'string' && id.startsWith('阴间'));
        };
        const getYinGateHint = () => {
            const isYinYangDao = gameState.activeDao === '阴阳道';
            const inv = gameState.inventory && typeof gameState.inventory === 'object' ? gameState.inventory : (gameState.inventory = {});
            const hasToken = (Number(inv['通阴符']) || 0) > 0;
            const sf = (gameState.story && gameState.story.flags && typeof gameState.story.flags === 'object') ? gameState.story.flags : {};
            const hasReady = sf.yin_pass_ready === true;
            const canAttempt = isYinYangDao || hasToken || hasReady;
            const tokenCount = Math.max(0, Number(inv['通阴符']) || 0);
            const hint = isYinYangDao
                ? '阴阳道可直接借道阴阳'
                : (hasReady ? '符火余烬尚在：可借道一次（不消耗通阴符）' : (hasToken ? `可消耗通阴符×1进入（当前：${tokenCount}）` : '需要【阴阳道】或【通阴符×1】'));
            return { canAttempt, hint };
        };

        allMaps.forEach(nid => {
            const map = GameData.mapConfig[nid];
            if (!map) return;

            const isCurrent = current.id === nid;
            const isNeighbor = current.neighbors && current.neighbors.includes(nid);
            const isCrossLayer = current.crossLayerMap === nid;
            const isReachable = isNeighbor || isCrossLayer;
            const yinGateTarget = nid === '阴间·思桥下层（运魂之河）' && isYinId(nid);

            if (!this.showAllMaps && !isReachable && !isCurrent) return;

            const btn = document.createElement('button');
            btn.className = "map-btn";

            let label = map.name;
            if (!isCurrent && isCrossLayer) label += " (借道)";
            if (map.locked) label += " 🔒";
            btn.textContent = label;

            let canClick = false;
            if (isCurrent) {
                btn.classList.add('active');
                btn.style.border = "1px solid #4CAF50";
                btn.style.color = "#4CAF50";
                btn.disabled = true;
            } else if (isReachable) {
                canClick = true;
                if (isCrossLayer) btn.style.border = "1px solid #9b59b6";
            } else {
                btn.disabled = true;
                btn.style.opacity = "0.4";
                btn.style.cursor = "not-allowed";
            }

            if (map.locked) {
                if (yinGateTarget && isReachable) {
                    const gate = getYinGateHint();
                    btn.title = `阴间通行：${gate.hint}`;
                    btn.style.border = "1px solid #9b59b6";
                    btn.style.opacity = "0.95";
                    canClick = true;
                } else {
                    btn.disabled = true;
                    btn.title = "此地封禁，不可进入";
                    btn.style.opacity = "0.6";
                    canClick = false;
                }
            }

            if (canClick) {
                btn.disabled = false;
                btn.addEventListener('click', () => Logic.requestEnterMap(nid));
            }

            grid.appendChild(btn);
        });

        mapList.appendChild(grid);

        // 2. 渲染跨界通道 (阴阳切换)
        if (current.crossLayerMap) {
            const targetId = current.crossLayerMap;
            const targetMap = GameData.mapConfig[targetId];
            if (targetMap) {
                const layerBtn = document.createElement('button');
                layerBtn.innerHTML = "☯ 是否借道阴阳？";
                layerBtn.className = "map-btn layer-switch-btn"; // Add custom class if needed
                layerBtn.style.width = "100%";
                layerBtn.style.marginTop = "10px";
                layerBtn.style.background = "linear-gradient(45deg, #333, #555)";
                layerBtn.style.border = "1px solid #777";
                const hintLine = document.createElement('div');
                hintLine.style.marginTop = '6px';
                hintLine.style.fontSize = '12px';
                hintLine.style.color = '#aaa';
                hintLine.style.lineHeight = '1.35';
                if (targetMap.locked && (targetId === '阴间·思桥下层（运魂之河）')) {
                    const gate = getYinGateHint();
                    hintLine.textContent = `阴间通行：${gate.hint}`;
                } else if (targetMap.locked) {
                    hintLine.textContent = '此地封禁，暂不可进入';
                } else if ((targetMap.world === 'yin') || (typeof targetId === 'string' && targetId.startsWith('阴间'))) {
                    hintLine.textContent = '提示：阴间战斗将承受额外惩罚';
                }

                layerBtn.onclick = () => {
                    Logic.requestEnterMap(targetId);
                };
                mapList.appendChild(layerBtn);
                if (hintLine.textContent) mapList.appendChild(hintLine);
            }
        }
    },

    // 渲染当前地图详情
    renderMapInfo: function() {
        const map = gameState.currentMap;
        if (!map) return;

        document.getElementById('active-map-panel').classList.remove('hidden');
        document.getElementById('map-hint').classList.add('hidden');
        document.getElementById('current-map-name').textContent = map.name;
        
        const monsterText = (map.monsterPool && map.monsterPool.length > 0) 
            ? map.monsterPool.join('、') 
            : (map.monsters && map.monsters.length > 0 ? map.monsters.join('、') : "无");
        document.getElementById('map-monsters').textContent = monsterText;
        
        const dropsText = map.drops && map.drops.length > 0 ? map.drops.join('、') : "无";
        document.getElementById('map-drops').textContent = dropsText;

        const panel = document.getElementById('active-map-panel');
        const details = panel ? panel.querySelector('.map-details') : null;
        if (details) {
            let el = document.getElementById('map-world-status');
            if (!el) {
                el = document.createElement('div');
                el.id = 'map-world-status';
                el.style.marginTop = '8px';
                el.style.paddingTop = '8px';
                el.style.borderTop = '1px dashed #333';
                details.appendChild(el);
            }
            const t = gameState && gameState.world && gameState.world.tendencies && typeof gameState.world.tendencies === 'object'
                ? gameState.world.tendencies
                : { order: 0, chaos: 0, omen: 0 };
            const clamp = (v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return 0;
                return Math.max(-5, Math.min(5, Math.trunc(n)));
            };
            const order = clamp(t.order);
            const chaos = clamp(t.chaos);
            const omen = clamp(t.omen);
            const label = (kind, v) => {
                const n = Number(v) || 0;
                if (kind === 'omen') {
                    if (n >= 5) return '天意不安';
                    if (n >= 3) return '异象初现';
                    if (n >= 1) return '微兆';
                    if (n <= -3) return '清宁';
                    if (n <= -1) return '无波';
                    return '平';
                }
                if (kind === 'chaos') {
                    if (n >= 5) return '狂澜将至';
                    if (n >= 3) return '乱流涌动';
                    if (n >= 1) return '躁动';
                    if (n <= -3) return '澄明';
                    if (n <= -1) return '平顺';
                    return '稳';
                }
                if (n >= 5) return '戒律如铁';
                if (n >= 3) return '循规渐紧';
                if (n >= 1) return '有矩';
                if (n <= -3) return '边界松动';
                if (n <= -1) return '松弛';
                return '常';
            };
            const desc = (() => {
                if (omen >= 3) return '天边像有裂纹，影子比平日更长。';
                if (chaos >= 3) return '灵气躁动，行事宜留后手。';
                if (order >= 3) return '门规森严，风声也更谨慎。';
                if (omen <= -3) return '夜风干净，心念稍易落定。';
                if (chaos <= -3) return '气机平顺，杂念不易滋生。';
                if (order <= -3) return '规矩松动，边界也更模糊。';
                return '天象平稳，暂无明显异兆。';
            })();
            el.innerHTML = `<div style="color:#888; font-size:12px;"><strong style="color:#aaa;">世界异象</strong> · 征兆：${label('omen', omen)} / 混沌：${label('chaos', chaos)} / 秩序：${label('order', order)}</div><div style="color:#aaa; font-size:12px; margin-top:4px;">${desc}</div>`;
        }
    },

    // 渲染背包
    renderInventory: function() {
        const list = document.getElementById('inventory-list');
        list.innerHTML = '';
        
        // [V1.9.0 Fix] 添加手动刷新按钮
        const refreshContainer = document.createElement('div');
        refreshContainer.style.width = '100%';
        refreshContainer.style.marginBottom = '8px';
        refreshContainer.style.textAlign = 'right';
        refreshContainer.style.borderBottom = '1px dashed #444';
        refreshContainer.style.paddingBottom = '4px';
        
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = "⟳ 刷新背包";
        refreshBtn.className = 'btn-mini';
        refreshBtn.onclick = () => {
             UI.renderInventory();
             UI.addLog("背包数据已刷新。", "sys");
        };
        refreshContainer.appendChild(refreshBtn);
        list.appendChild(refreshContainer);

        if (Object.keys(gameState.inventory).length === 0) {
            const empty = document.createElement('div');
            empty.textContent = "背包空空如也";
            empty.style.color = '#666';
            empty.style.textAlign = 'center';
            empty.style.padding = '20px';
            list.appendChild(empty);
            return;
        }

        const rareSet = new Set(['怨气结晶', '尸丹', '定心丹', '息灾符', '护脉散']);
        const getRarityClass = (name) => {
            const s = typeof name === 'string' ? name : '';
            if (rareSet.has(s)) return 'rarity-rare';
            if (/传说|传奇/.test(s)) return 'rarity-legendary';
            if (/史诗/.test(s)) return 'rarity-epic';
            if (/稀有/.test(s)) return 'rarity-rare';
            return '';
        };

        for (const [item, count] of Object.entries(gameState.inventory)) {
            if (count <= 0) continue;

            const card = document.createElement('div');
            card.className = 'item-card';
            
            const span = document.createElement('span');
            span.textContent = `${item} (x${count})`;
            const rc = getRarityClass(item);
            if (rc) span.className = rc;
            
            // [V1.9.0 Feature] 显示物品描述
            const itemCfg = (typeof GameData !== 'undefined' && GameData.itemConfig) ? GameData.itemConfig[item] : null;
            if (itemCfg && itemCfg.desc) {
                const br = document.createElement('br');
                const small = document.createElement('small');
                small.textContent = itemCfg.desc;
                small.style.color = '#888';
                small.style.fontSize = '12px';
                span.appendChild(br);
                span.appendChild(small);
            }

            const btn = document.createElement('button');
            const effect = (typeof GameData !== 'undefined' && GameData.itemConfig) ? GameData.itemConfig[item] : null;
            const isTalisman = effect && effect.type === 'talisman';
            let useHint = '';
            if (isTalisman) {
                const cd = effect.cooldown && typeof effect.cooldown === 'object' ? effect.cooldown : {};
                const inCombat = !!gameState.combat;
                const statuses = (inCombat && gameState.combat && gameState.combat.player && Array.isArray(gameState.combat.player.statuses))
                    ? gameState.combat.player.statuses
                    : [];
                const findSt = (id) => statuses.find(s => s && typeof s === 'object' && s.id === id);
                const mapId = (() => {
                    const m = gameState.currentMap && typeof gameState.currentMap === 'object' ? gameState.currentMap : null;
                    if (m && typeof m.id === 'string' && m.id.trim()) return m.id.trim();
                    if (m && typeof m.name === 'string' && m.name.trim()) return m.name.trim();
                    return null;
                })();
                const mapState = (mapId && gameState.mapStates && typeof gameState.mapStates === 'object' && gameState.mapStates[mapId] && typeof gameState.mapStates[mapId] === 'object')
                    ? gameState.mapStates[mapId]
                    : null;
                const perMapUsed = !!(mapState && mapState.talismanUsed && typeof mapState.talismanUsed === 'object' && mapState.talismanUsed[item] === true);

                if (cd.kind === 'world' && cd.oncePerMap === true && perMapUsed) {
                    useHint = '本图已用';
                } else if (cd.kind === 'battle') {
                    if (!inCombat) {
                        useHint = '需战斗中';
                    } else if (cd.oncePerBattle === true && findSt(`used_talisman_${item}`)) {
                        useHint = '本场已用';
                    } else if (Number.isFinite(Number(cd.rounds)) && Number(cd.rounds) > 0) {
                        const st = findSt(`cd_talisman_${item}`);
                        const d = st && Number.isFinite(Number(st.duration)) ? Math.max(0, Math.floor(Number(st.duration))) : 0;
                        if (d > 0) useHint = `CD${d}`;
                    }
                }
            }

            btn.textContent = useHint ? `使用（${useHint}）` : "使用";
            if (useHint) {
                btn.disabled = true;
                btn.style.opacity = "0.75";
            }
            btn.addEventListener('click', () => Logic.requestUseItem(item));
            
            card.appendChild(span);
            card.appendChild(btn);
            list.appendChild(card);
        }
    },

    // 渲染左侧迷你背包 (前10个物品)
    renderMiniInventory: function() {
        const grid = document.getElementById('mini-inventory');
        if (!grid) return;

        const rareSet = new Set(['怨气结晶', '尸丹', '定心丹', '息灾符', '护脉散']);
        const getRarityClass = (name) => {
            const s = typeof name === 'string' ? name : '';
            if (rareSet.has(s)) return 'rarity-rare';
            if (/传说|传奇/.test(s)) return 'rarity-legendary';
            if (/史诗/.test(s)) return 'rarity-epic';
            if (/稀有/.test(s)) return 'rarity-rare';
            return '';
        };
        
        // 获取所有物品（过滤掉数量<=0的）
        const items = Object.entries(gameState.inventory || {})
            .filter(([k, v]) => v > 0);
            
        // 获取所有插槽
        const slots = grid.querySelectorAll('.item-slot');
        
        slots.forEach((slot, index) => {
            // 清空插槽
            slot.textContent = '';
            slot.title = '空置';
            slot.classList.remove('has-item');
            slot.classList.remove('rarity-rare', 'rarity-epic', 'rarity-legendary');
            slot.onclick = null;
            
            if (index < items.length) {
                const [name, count] = items[index];
                slot.textContent = name.substring(0, 1); // 显示首字
                let title = `${name} (x${count})`;
                const effect = (typeof GameData !== 'undefined' && GameData.itemConfig) ? GameData.itemConfig[name] : null;
                const isTalisman = effect && effect.type === 'talisman';
                if (isTalisman) {
                    const cd = effect.cooldown && typeof effect.cooldown === 'object' ? effect.cooldown : {};
                    const inCombat = !!gameState.combat;
                    const statuses = (inCombat && gameState.combat && gameState.combat.player && Array.isArray(gameState.combat.player.statuses))
                        ? gameState.combat.player.statuses
                        : [];
                    const findSt = (id) => statuses.find(s => s && typeof s === 'object' && s.id === id);
                    const mapId = (() => {
                        const m = gameState.currentMap && typeof gameState.currentMap === 'object' ? gameState.currentMap : null;
                        if (m && typeof m.id === 'string' && m.id.trim()) return m.id.trim();
                        if (m && typeof m.name === 'string' && m.name.trim()) return m.name.trim();
                        return null;
                    })();
                    const mapState = (mapId && gameState.mapStates && typeof gameState.mapStates === 'object' && gameState.mapStates[mapId] && typeof gameState.mapStates[mapId] === 'object')
                        ? gameState.mapStates[mapId]
                        : null;
                    const perMapUsed = !!(mapState && mapState.talismanUsed && typeof mapState.talismanUsed === 'object' && mapState.talismanUsed[name] === true);
                    let hint = '';
                    if (cd.kind === 'world' && cd.oncePerMap === true && perMapUsed) {
                        hint = '本图已用';
                    } else if (cd.kind === 'battle') {
                        if (!inCombat) hint = '需战斗中';
                        else if (cd.oncePerBattle === true && findSt(`used_talisman_${name}`)) hint = '本场已用';
                        else if (Number.isFinite(Number(cd.rounds)) && Number(cd.rounds) > 0) {
                            const st = findSt(`cd_talisman_${name}`);
                            const d = st && Number.isFinite(Number(st.duration)) ? Math.max(0, Math.floor(Number(st.duration))) : 0;
                            if (d > 0) hint = `冷却：${d}回合`;
                        }
                    }
                    if (hint) title += `\n${hint}`;
                }
                slot.title = title;
                slot.classList.add('has-item');
                const rc = getRarityClass(name);
                if (rc) slot.classList.add(rc);
                // 可选：点击使用
                slot.onclick = () => {
                     if (confirm(`要在快捷栏使用 [${name}] 吗？`)) {
                         Logic.requestUseItem(name);
                     }
                };
            }
        });
    },

    // 渲染道统
    renderLineage: function() {
        const list = document.getElementById('known-lineages');
        if (list) list.textContent = Object.keys(gameState.daoAffinity).join(" / ");

        const skills = document.getElementById('passive-skills');
        if (!skills) return;

        skills.innerHTML = '';
        skills.className = 'skill-grid'; // Apply grid layout
        
        if (GameData.skillConfig) {
            // [V2.0] Filter skills by active Dao
            const activeDao = gameState.activeDao;
            const keys = (activeDao && activeDao !== "随机" && activeDao !== "None" && GameData.skillConfig[activeDao]) 
                ? [activeDao] 
                : Object.keys(GameData.skillConfig);

            keys.forEach(dao => {
                GameData.skillConfig[dao].forEach(skill => {
                    const li = document.createElement('li');
                    li.className = 'skill-card';
                    
                    // [V2.0] Add tooltip
                    li.title = `【${skill.name}】\n${skill.desc || skill.text || "暂无描述"}`;
                    
                    // Icon generation based on description/text
                    const text = (skill.text || skill.name) + (skill.desc || "");
                    let bgColor = '#555555';
                    
                    // Simple heuristic for color coding
                    if (/[伤雷火灭斩杀爆]/.test(text)) bgColor = '#8b3a3a'; // Attack (Reddish)
                    else if (/[防盾金御护壁]/.test(text)) bgColor = '#3a4b8b'; // Defense (Blueish)
                    else if (/[愈生木回药疗]/.test(text)) bgColor = '#3a8b4b'; // Heal (Greenish)
                    else if (/[速风行闪遁移]/.test(text)) bgColor = '#8b8b3a'; // Speed (Yellowish)
                    else if (/[道神玄心魂念]/.test(text)) bgColor = '#6a3a8b'; // Special (Purplish)
                    
                    const iconChar = skill.name.charAt(0);
                    
                    li.innerHTML = `
                        <div class="skill-icon" style="background-color: ${bgColor}">${iconChar}</div>
                        <div class="skill-info" style="flex:1; display:flex; flex-direction:column;">
                            <div style="font-weight:bold; color:var(--text-main); display:flex; justify-content:space-between;">
                                <span>${skill.name}</span>
                                <span style="font-size:0.8em; color:var(--accent);">[${dao}]</span>
                            </div>
                            <div style="font-size:0.85em; color:var(--text-dim); margin-top:4px; line-height:1.4;">${skill.text}</div>
                            <div style="font-size:0.8em; color:#888; margin-top:2px;">
                                消耗: ${skill.mpCost || 0}
                            </div>
                        </div>
                    `;
                    skills.appendChild(li);
                });
            });
        }
    },

    // 切换标签页
    switchTab: function(tabId) {
        document.querySelectorAll('.view-content').forEach(el => el.classList.remove('active'));
        document.getElementById('view-' + tabId).classList.add('active');
        
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

        const navMap = document.getElementById('nav-map');
        const navBattle = document.getElementById('nav-battle');
        const navInventory = document.getElementById('nav-inventory');
        const navLineage = document.getElementById('nav-lineage');
        if (tabId === 'map' && navMap) navMap.classList.add('active');
        if (tabId === 'battle' && navBattle) navBattle.classList.add('active');
        if (tabId === 'inventory' && navInventory) navInventory.classList.add('active');
        if (tabId === 'lineage' && navLineage) navLineage.classList.add('active');

        const ctMap = document.getElementById('center-tab-map');
        const ctBattle = document.getElementById('center-tab-battle');
        if (ctMap) {
            ctMap.classList.toggle('active', tabId === 'map');
            ctMap.setAttribute('aria-selected', tabId === 'map' ? 'true' : 'false');
        }
        if (ctBattle) {
            ctBattle.classList.toggle('active', tabId === 'battle');
            ctBattle.setAttribute('aria-selected', tabId === 'battle' ? 'true' : 'false');
        }

        if (tabId === 'battle' && typeof this.renderBattleOverview === 'function') this.renderBattleOverview();
    },

    // 更新挂机按钮状态
    updateHangingStatus: function() {
        const btn = document.getElementById('btn-toggle-hang');
        const badge = document.getElementById('hang-status-badge');
        
        if (!btn || !badge) return;

        if (gameState.isHanging) {
            btn.textContent = "停止挂机";
            btn.classList.add('active');
            badge.textContent = "挂机中...";
            badge.classList.add('hanging');
        } else {
            btn.textContent = "开始挂机";
            btn.classList.remove('active');
            badge.textContent = "空闲";
            badge.classList.remove('hanging');
        }
    },

    // 添加日志
    addLog: function(msg, type = 'normal') {
        const container = document.getElementById('log-container');

        const div = document.createElement('div');
        div.className = 'log-entry';
        div.dataset.logType = this.normalizeLogType(type);
        
        if (type === 'drop') div.classList.add('log-gain');
        else if (type === 'battle') div.classList.add('log-dmg');
        else if (type === 'sys') div.classList.add('log-sys');
        else if (type === 'log-event') div.classList.add('log-event');
        else if (type === 'env') div.classList.add('log-env');
        else if (type === 'npc') div.classList.add('log-npc');
        else if (type === 'log-dmg') div.classList.add('log-dmg');
        
        div.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        this.applyLogFilter();

        const s = typeof msg === 'string' ? msg : '';
        const dk = (typeof gameState !== 'undefined' && gameState && gameState.lastMeta && gameState.lastMeta.payload && typeof gameState.lastMeta.payload.deltaKey === 'string')
            ? gameState.lastMeta.payload.deltaKey
            : '';
        const mAtk = s.match(/攻击\s*\+(\d+)/);
        if (mAtk) this.spawnCombatFloat(`攻击 +${mAtk[1]}`, 'buff', { deltaKey: dk });
        const mHp = s.match(/气血上限\s*\+(\d+)/);
        if (mHp) this.spawnCombatFloat(`气血上限 +${mHp[1]}`, 'buff', { deltaKey: dk });
        
        const maxRows = 300;
        while (container.children.length > maxRows) {
            let removed = false;
            for (let i = 0; i < container.children.length; i++) {
                const el = container.children[i];
                const keep = el.classList && (el.classList.contains('log-battle-wrapper') || el.classList.contains('log-event-wrapper'));
                if (!keep) {
                    container.removeChild(el);
                    removed = true;
                    break;
                }
            }
            if (!removed) {
                container.removeChild(container.firstChild);
            }
        }
    },

    // === V1.8 事件日志折叠系统 ===
    currentEventLog: null,

    renderEventLogs: function(entries) {
        if (!Array.isArray(entries) || entries.length === 0) return;

        entries.forEach(entry => {
            if (!entry) return;
            const type = entry.type;
            const tag = entry.tag;
            const text = entry.text || '';
            const meta = entry.meta && typeof entry.meta === 'object' ? entry.meta : null;
            const eventType = meta && typeof meta.eventType === 'string' ? meta.eventType : null;
            const eventId = meta && typeof meta.eventId === 'string' ? meta.eventId : null;

            if (type === 'sys' && tag === 'event_start') {
                const title = typeof text === 'string' && text.trim() ? text : '事件';
                this.startEventLog(title, eventType, eventId);
                if (eventId && /breakthrough/.test(eventId)) {
                    this.playRitual('气机翻涌，天命未定……');
                    this.addRitualMarker('—— 破境仪式开启 ——');
                } else if ((eventType === 'heartDemon') || (eventId && /heart_demon/.test(eventId))) {
                    this.playRitual('影从心生，魇影成形……');
                    this.addRitualMarker('—— 心魔现形 ——');
                }
                return;
            }
            if (type === 'sys' && tag === 'event_end') {
                this.endEventLog(text);
                return;
            }
            if (type === 'sys') {
                this.addEventDetail(text, entry);
            }
        });
    },

    startEventLog: function(title, eventType, eventId) {
        const container = document.getElementById('log-container');
        if (!container) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'log-entry log-event-wrapper log-wrapper';
        wrapper.dataset.logType = 'sys';

        const header = document.createElement('div');
        header.className = 'event-header log-text-bold';
        header.style.cursor = 'pointer';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        const label = eventType ? `${title} (${eventType})` : title;
        header.innerHTML = `<span>🌀 ${label}</span> <span class="status">进行中...</span>`;

        const content = document.createElement('div');
        content.className = 'event-details log-text-secondary';
        content.style.display = 'block';
        content.style.paddingLeft = '10px';
        content.style.marginTop = '5px';
        content.style.fontSize = '0.9em';

        header.onclick = () => {
            content.style.display = (content.style.display === 'none') ? 'block' : 'none';
        };

        wrapper.appendChild(header);
        wrapper.appendChild(content);
        container.appendChild(wrapper);
        container.scrollTop = container.scrollHeight;

        this.currentEventLog = { wrapper, header, content, eventType: eventType || null, eventId: eventId || null };
        this.applyLogFilter();

        const wrappers = container.querySelectorAll('.log-event-wrapper');
        const maxEvents = 50;
        if (wrappers.length > maxEvents) {
            const removeCount = wrappers.length - maxEvents;
            for (let i = 0; i < removeCount; i++) wrappers[i].remove();
        }
    },

    addEventDetail: function(msg, entry) {
        if (!this.currentEventLog) {
            this.addLog(msg, 'log-event');
            return;
        }
        const div = document.createElement('div');
        const text = typeof msg === 'string' ? msg : '';
        const tag = entry && typeof entry.tag === 'string' ? entry.tag : '';
        div.className = 'event-line'
            + (tag === 'event_settlement' ? ' event-settlement' : '')
            + (tag === 'event_choice' ? ' event-choice' : '')
            + (tag === 'branch' ? ' event-branch' : '');
        let decorated = `> ${text}`;
        if (tag === 'branch') decorated = `> 🔀 ${text}`;
        else if (tag === 'event_choice') decorated = `> ▸ ${text}`;
        else if (tag === 'event_settlement') decorated = `> 💠 ${text}`;
        const showMeta = (typeof window !== 'undefined' && window.DEBUG_META === true);
        const meta = entry && entry.meta && typeof entry.meta === 'object' ? entry.meta : null;
        if (showMeta && meta) {
            const parts = [];
            if (typeof meta.deltaKey === 'string' && meta.deltaKey.trim()) parts.push(meta.deltaKey.trim());
            if (typeof meta.rule === 'string' && meta.rule.trim()) parts.push(meta.rule.trim());
            else if (typeof meta.source === 'string' && meta.source.trim()) parts.push(meta.source.trim());
            if (parts.length) decorated = `${decorated} [${parts.join('|')}]`;
        }
        div.textContent = decorated;
        if (tag === 'branch') {
            div.className += ' log-text-primary log-text-bold';
            div.style.borderLeft = '2px solid #888';
            div.style.paddingLeft = '5px';
        } else if (tag === 'event_choice') {
            div.className += ' log-text-italic';
        } else if (tag === 'event_settlement') {
            div.className += ' log-text-primary log-text-bold';
            div.style.borderTop = '1px dashed #555';
            div.style.marginTop = '4px';
            div.style.paddingTop = '2px';
        } else {
            div.className += ' log-text-primary';
        }
        this.currentEventLog.content.appendChild(div);
        if (this.currentEventLog.content.children.length > 60) {
            this.currentEventLog.content.removeChild(this.currentEventLog.content.firstChild);
        }
    },

    endEventLog: function(summary) {
        if (!this.currentEventLog) return;
        const { header, wrapper, eventType, eventId } = this.currentEventLog;
        const statusSpan = header.querySelector('.status');
        if (statusSpan) {
            statusSpan.textContent = "结束";
            statusSpan.className = "log-text-secondary";
        }
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'log-settlement-summary log-text-primary log-text-bold';
        summaryDiv.style.marginTop = "5px";
        summaryDiv.textContent = summary || '事件结束。';
        wrapper.appendChild(summaryDiv);

        if ((eventType === 'heartDemon') || (eventId && /heart_demon|breakthrough/.test(eventId))) {
            const breath = document.createElement('div');
            breath.className = 'ritual-breath';
            breath.textContent = '—— 本轮修行暂歇 ——';
            wrapper.appendChild(breath);
        }
        this.currentEventLog = null;
    },

    // === V1.5 战斗日志折叠系统 ===
    currentBattleLog: null, // 当前战斗日志容器
    activeLogFilter: 'all',

    renderCombatLogs: function(logs) {
        if (!Array.isArray(logs) || logs.length === 0) return;

        logs.forEach(entry => {
            if (!entry) return;

            const type = entry.type;
            const text = entry.text || '';
            const tag = entry.tag;

            if ((type === 'battle' && tag === 'start') || type === 'battle_start') {
                const m = text.match(/【(.+?)】/);
                const monsterName = m ? m[1] : text;
                this.startBattleLog(monsterName);
                return;
            }

            if ((type === 'battle' && tag === 'end_win') || type === 'battle_end_win') {
                this.endBattleLog(true, text);
                return;
            }

            if ((type === 'battle' && tag === 'end_lose') || type === 'battle_end_lose') {
                this.endBattleLog(false, text);
                return;
            }

            if (type === 'battle') {
                let subtype = entry.tag || 'dmg';
                if (!entry.tag) {
                    if (text.includes('你受到') && text.includes('伤害')) subtype = 'dmg-taken';
                    else if (text.includes('纸人替身')) subtype = 'skill';
                    else if (text.startsWith('[') && !text.startsWith('[普攻]')) subtype = 'skill';
                }
                this.addBattleDetail(text, subtype, entry);
            }
        });
    },

    startBattleLog: function(monsterName) {
        const container = document.getElementById('log-container');
        if (!container) return;

        container.querySelectorAll('.battle-details').forEach(el => {
            el.style.display = 'none';
        });
        
        // 创建折叠容器
        const wrapper = document.createElement('div');
        wrapper.className = 'log-entry log-battle-wrapper log-wrapper';
        wrapper.dataset.logType = 'battle';
        
        // 标题栏
        const header = document.createElement('div');
        header.className = 'battle-header log-text-bold';
        header.style.cursor = 'pointer';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.innerHTML = `<span>⚔️ 遭遇【${monsterName}】</span> <span class="status">战斗中...</span>`;
        
        // 内容区 (默认折叠)
        const content = document.createElement('div');
        content.className = 'battle-details log-text-secondary';
        content.style.display = 'block';
        content.style.paddingLeft = '10px';
        content.style.marginTop = '5px';
        content.style.fontSize = '0.9em';

        // 点击展开/收起
        header.onclick = () => {
            if (content.style.display === 'none') {
                content.style.display = 'block';
            } else {
                content.style.display = 'none';
            }
        };

        wrapper.appendChild(header);
        wrapper.appendChild(content);
        container.appendChild(wrapper);
        container.scrollTop = container.scrollHeight;

        this.currentBattleLog = { wrapper, header, content };
        this.applyLogFilter();

        const wrappers = container.querySelectorAll('.log-battle-wrapper');
        const maxBattles = 50;
        if (wrappers.length > maxBattles) {
            const removeCount = wrappers.length - maxBattles;
            for (let i = 0; i < removeCount; i++) {
                wrappers[i].remove();
            }
        }
    },

    addBattleDetail: function(msg, type, entry) {
        if (!this.currentBattleLog) return; // 如果没有战斗日志容器，直接忽略或降级为普通日志
        
        const div = document.createElement('div');
        let decorated = msg;
        const combat = typeof gameState !== 'undefined' ? gameState.combat : null;
        
        // [V2.0] Improved log prefix logic
        if (entry) {
            const sourceId = typeof entry.sourceId === 'string' ? entry.sourceId : null;
            const targetId = typeof entry.targetId === 'string' ? entry.targetId : null;
            let sourceName = null;

            if (sourceId === 'player') {
                sourceName = gameState.username || "你";
            } else if (sourceId) {
                const s = combat && Array.isArray(combat.monsters) ? combat.monsters.find(m => m && m.id === sourceId) : null;
                if (s && s.name) sourceName = s.name;
            } else if (targetId && combat && Array.isArray(combat.monsters)) {
                // Fallback: If target is monster and source is missing, assume player source
                const t = combat.monsters.find(m => m && m.id === targetId);
                if (t) sourceName = gameState.username || "你";
            }

            if (sourceName) {
                decorated = `[${sourceName}] ${decorated}`;
            } else if (targetId && combat && Array.isArray(combat.monsters)) {
                // Legacy fallback (should happen less now)
                const t = combat.monsters.find(m => m && m.id === targetId);
                if (t && t.name) decorated = `(${t.name}) ${decorated}`;
            }
        }

        const meta = entry && entry.meta && typeof entry.meta === 'object' ? entry.meta : null;
        if (meta && typeof meta.chainId === 'string') {
            const step = (typeof meta.step === 'number' || typeof meta.step === 'string') ? meta.step : '';
            decorated = `[链${step !== '' ? `-${step}` : ''}] ${decorated}`;
        }
        const showMeta = (typeof window !== 'undefined' && window.DEBUG_META === true);
        if (showMeta && meta) {
            const parts = [];
            if (typeof meta.deltaKey === 'string' && meta.deltaKey.trim()) parts.push(meta.deltaKey.trim());
            if (typeof meta.rule === 'string' && meta.rule.trim()) parts.push(meta.rule.trim());
            else if (typeof meta.source === 'string' && meta.source.trim()) parts.push(meta.source.trim());
            if (parts.length) decorated = `${decorated} [${parts.join('|')}]`;
        }
        div.textContent = `> ${decorated}`;
        if (type === 'dmg') div.className = 'log-text-primary';
        else if (type === 'dmg-taken') div.className = 'log-text-secondary';
        else if (type === 'skill' || (typeof type === 'string' && type.includes('skill'))) div.className = 'log-text-primary';
        else div.className = 'log-text-secondary';

        if (entry && entry.tag === 'chant') {
            div.className = 'log-text-bold';
            div.style.textAlign = 'center';
        } else if (entry && entry.tag === 'skill_cost') {
            div.className = 'log-text-tertiary';
        } else if (entry && (entry.tag === 'skill_heal' || entry.tag === 'skill_sacrifice')) {
            div.className = 'log-text-success';
        }

        if (entry && typeof entry.tag === 'string' && (entry.tag === 'suppression' || entry.tag === 'phase_change' || entry.tag.startsWith('status_') || entry.tag.startsWith('ai_') || entry.tag.startsWith('skill_'))) {
            div.style.fontWeight = 'bold';
        }
        if (entry && entry.tag === 'phase_change') {
            div.className = 'log-text-italic';
            div.style.borderBottom = '1px solid #ccc';
        }

        if (entry && entry.tag === 'demon_end_win') {
            div.className = 'log-text-success log-text-bold';
            div.style.textDecoration = 'underline';
            this.spawnCombatFloat('心魔溃散', 'success', meta || {});
        } else if (entry && entry.tag === 'demon_end_lose') {
            div.className = 'log-text-secondary log-text-bold';
            this.spawnCombatFloat('道途未断', 'failsoft', meta || {});
        }

        if (entry && typeof entry.tag === 'string') {
            if (entry.tag === 'status_undying') {
                this.spawnCombatFloat('不腐', 'rare', meta || {});
            } else if (entry.tag === 'status_fear') {
                this.spawnCombatFloat('恐惧', 'fail', meta || {});
            } else if (entry.tag === 'skill_summon' || entry.tag === 'summon') {
                const summonName = meta && meta.summon && typeof meta.summon.name === 'string' ? meta.summon.name : '';
                const count = meta && meta.summon && Number.isFinite(Number(meta.summon.count)) ? Math.floor(Number(meta.summon.count)) : 0;
                const label = summonName ? (count > 1 ? `${summonName}+${count}` : summonName) : '召唤';
                this.spawnCombatFloat(label, 'buff', meta || {});
            } else if (entry.tag === 'skill_chant' || entry.tag === 'chant') {
                this.spawnCombatFloat('吟唱', 'sys', meta || {});
            } else if (entry.tag === 'skill_domain') {
                this.spawnCombatFloat('鬼域', 'buff', meta || {});
            } else if (entry.tag === 'skill_sacrifice') {
                this.spawnCombatFloat('血祭', 'rare', meta || {});
            }
        }

        const dropName = (() => {
            const s = typeof msg === 'string' ? msg : '';
            const i = s.indexOf('获得 [');
            if (i < 0) return null;
            const j = s.indexOf(']', i);
            if (j < 0) return null;
            const k = s.indexOf('[', i);
            if (k < 0 || k >= j) return null;
            const name = s.slice(k + 1, j).trim();
            return name || null;
        })();
        if (dropName) {
            const rareSet = new Set(['怨气结晶', '尸丹', '定心丹', '息灾符', '护脉散']);
            const isRare = rareSet.has(dropName);
            if (isRare) {
                div.classList.add('drop-rare');
                if (typeof UI !== 'undefined' && UI && typeof UI.spawnCombatFloat === 'function') {
                    UI.spawnCombatFloat(`获得:${dropName}`, 'rare', meta || {});
                }
            }
        }
        
        this.currentBattleLog.content.appendChild(div);
        if (this.currentBattleLog.content.children.length > 60) {
            this.currentBattleLog.content.removeChild(this.currentBattleLog.content.firstChild);
        }

        const dmg = meta && Number.isFinite(Number(meta.damage)) ? Math.floor(Number(meta.damage)) : null;
        if (Number.isFinite(dmg) && dmg > 0) {
            if (type === 'dmg') this.spawnCombatFloat(`-${dmg}`, 'dmg', meta);
            else if (type === 'dmg-taken') this.spawnCombatFloat(`-${dmg}`, 'taken', meta);
        }
    },

    spawnCombatFloat: function(text, kind, meta) {
        const layer = document.getElementById('combat-fx-layer');
        if (!layer) return;
        const el = document.createElement('div');
        el.className = `combat-float ${kind || 'sys'}`;
        el.textContent = text;
        const dk = meta && typeof meta.deltaKey === 'string' ? meta.deltaKey : '';
        const h1 = (typeof gameState !== 'undefined' && gameState && typeof gameState.hashFNV1a32 === 'function')
            ? parseInt(gameState.hashFNV1a32(`${dk}|${kind || ''}|${text}`), 16)
            : 1;
        const h2 = (typeof gameState !== 'undefined' && gameState && typeof gameState.hashFNV1a32 === 'function')
            ? parseInt(gameState.hashFNV1a32(`${text}|${kind || ''}|${dk}`), 16)
            : 1;
        const x = 20 + ((h1 % 6000) / 100);
        const y = 30 + ((h2 % 4500) / 100);
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
        layer.appendChild(el);
        const durationMs = (() => {
            const m = meta && typeof meta === 'object' ? meta : null;
            const raw = m && Number.isFinite(Number(m.durationMs)) ? Math.floor(Number(m.durationMs)) : null;
            if (raw !== null) return Math.max(350, Math.min(4000, raw));
            if (kind === 'rare') return 1500;
            if (kind === 'success' || kind === 'fail' || kind === 'pseudo') return 1300;
            if (kind === 'failsoft') return 1350;
            return 1050;
        })();
        setTimeout(() => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        }, durationMs);
    },

    ensureRitualUI: function() {
        if (document.getElementById('ritual-overlay') && document.getElementById('ritual-toast')) return;
        const overlay = document.createElement('div');
        overlay.id = 'ritual-overlay';
        overlay.className = 'ritual-overlay hidden';
        const toast = document.createElement('div');
        toast.id = 'ritual-toast';
        toast.className = 'ritual-toast hidden';
        document.body.appendChild(overlay);
        document.body.appendChild(toast);
    },

    playRitual: function(text) {
        this.ensureRitualUI();
        const overlay = document.getElementById('ritual-overlay');
        const toast = document.getElementById('ritual-toast');
        if (!overlay || !toast) return;

        toast.textContent = typeof text === 'string' ? text : '';

        overlay.classList.remove('hidden');
        toast.classList.remove('hidden');
        overlay.classList.add('ritual-in');
        toast.classList.add('ritual-in');

        setTimeout(() => {
            overlay.classList.remove('ritual-in');
            toast.classList.remove('ritual-in');
            overlay.classList.add('ritual-out');
            toast.classList.add('ritual-out');
        }, 1100);

        setTimeout(() => {
            overlay.classList.add('hidden');
            toast.classList.add('hidden');
            overlay.classList.remove('ritual-out');
            toast.classList.remove('ritual-out');
        }, 1600);
    },

    addRitualMarker: function(text) {
        const container = document.getElementById('log-container');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'log-entry log-ritual-marker';
        div.dataset.logType = 'sys';
        div.textContent = typeof text === 'string' ? text : '';
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        this.applyLogFilter();
    },

    endBattleLog: function(isWin, summary) {
        if (!this.currentBattleLog) return;

        const { header, wrapper } = this.currentBattleLog;
        const statusSpan = header.querySelector('.status');
        
        if (isWin) {
            statusSpan.textContent = "✅ 胜利";
            statusSpan.style.color = "#4caf50";
            wrapper.style.borderColor = "#2e7d32";
        } else {
            statusSpan.textContent = "❌ 失败";
            statusSpan.style.color = "#f44336";
            wrapper.style.borderColor = "#c62828";
        }
        
        // 添加总结行
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'log-settlement-summary';
        summaryDiv.style.marginTop = "5px";
        summaryDiv.style.fontWeight = "bold";
        summaryDiv.style.color = isWin ? "#fff" : "#ffcccc";
        summaryDiv.innerHTML = summary;
        wrapper.appendChild(summaryDiv);

        this.currentBattleLog = null; // 重置
    },

    normalizeLogType: function(type) {
        if (type === 'log-event') return 'sys';
        if (type === 'log-dmg') return 'battle';
        if (type === 'normal') return 'sys';
        return type || 'sys';
    },

    setLogFilter: function(filter) {
        this.activeLogFilter = filter || 'all';
        const root = document.getElementById('log-filters');
        if (root) {
            root.querySelectorAll('.log-filter').forEach(btn => {
                const f = btn.dataset.filter;
                if ((f || 'all') === this.activeLogFilter) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        }
        this.applyLogFilter();
    },

    applyLogFilter: function() {
        const container = document.getElementById('log-container');
        if (!container) return;
        const filter = this.activeLogFilter || 'all';
        Array.from(container.children).forEach(el => {
            const t = el.dataset && el.dataset.logType ? el.dataset.logType : 'sys';
            el.style.display = (filter === 'all' || t === filter) ? '' : 'none';
        });
    },

    // 显示事件弹窗
    showEventModal: function(event) {
        const modal = document.getElementById('event-modal');
        document.getElementById('event-title').textContent = event.title;
        document.getElementById('event-desc').textContent = event.desc;
        
        const optionsDiv = document.getElementById('event-options');
        optionsDiv.innerHTML = '';
        
        const storyFlags = (typeof gameState !== 'undefined' && gameState && gameState.story && gameState.story.flags && typeof gameState.story.flags === 'object')
            ? gameState.story.flags
            : {};
        const rawOptions = Array.isArray(event.options) ? event.options : [];
        const visible = (typeof Rules !== 'undefined' && Rules && typeof Rules.isOptionUnlocked === 'function')
            ? rawOptions.filter(opt => Rules.isOptionUnlocked(event, opt, storyFlags))
            : rawOptions.slice();
        const finalOptions = visible.length ? visible : [{ id: 'leave', text: '转身离开', log: '' }];

        finalOptions.forEach((opt, idx) => {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '4px';
            wrap.style.marginBottom = '8px';

            const btn = document.createElement('button');
            btn.textContent = opt.text;
            if (opt.tooltip) {
                btn.title = opt.tooltip;
            }

            const getPreview = () => {
                const eid = (event && typeof event.id === 'string') ? event.id : '';
                const oid = (opt && typeof opt.id === 'string') ? opt.id : '';
                const sf = storyFlags && typeof storyFlags === 'object' ? storyFlags : {};
                const setFlags = opt && opt.meta && opt.meta.story && opt.meta.story.setFlags && typeof opt.meta.story.setFlags === 'object'
                    ? opt.meta.story.setFlags
                    : null;

                const parts = [];
                if (setFlags && Object.prototype.hasOwnProperty.call(setFlags, 'bt_success_bonus')) {
                    parts.push(`成功倾向:${String(setFlags.bt_success_bonus)}`);
                }
                if (setFlags && (setFlags.bt_debt === true || setFlags.bt_debt_due === true)) {
                    const lvl = (setFlags.bt_debt_level ?? setFlags.bt_debt_due_level);
                    parts.push(`债务:${lvl !== undefined ? String(lvl) : '有'}`);
                }
                if (setFlags && Object.prototype.hasOwnProperty.call(setFlags, 'bt_efficiency_malus')) {
                    parts.push(`效率↓:${String(setFlags.bt_efficiency_malus)}`);
                }
                if (setFlags && Object.prototype.hasOwnProperty.call(setFlags, 'mf_strain')) {
                    parts.push(`心劳:${String(setFlags.mf_strain)}`);
                }

                const method = (() => {
                    const m1 = setFlags && typeof setFlags.bt_method === 'string' ? setFlags.bt_method : null;
                    const m0 = typeof sf.bt_method === 'string' ? sf.bt_method : null;
                    return (m1 || m0 || '').trim();
                })();
                if (method) {
                    const risk = (method === 'blood' || method === 'pill' || method === 'evil') ? '高'
                        : (method === 'intense' ? '中' : '低');
                    parts.push(`风险:${risk}`);
                } else if (eid === 'event_breakthrough_aftershock_01') {
                    parts.push(`风险:${oid === 'press' ? '高' : '中'}`);
                }

                if (typeof gameState !== 'undefined' && gameState && gameState.daoType === '阴阳道') {
                    const d = opt && opt.delta && typeof opt.delta === 'object' ? opt.delta : null;
                    if (d) {
                        const hp = Number(d.playerHp) || 0;
                        const mp = Number(d.playerMp) || 0;
                        const exp = Number(d.expDelta) || 0;
                        const downs = (hp < 0 ? 1 : 0) + (mp < 0 ? 1 : 0) + (exp < 0 ? 1 : 0);
                        if (downs > 0) {
                            const heavy = hp <= -15 || exp <= -50;
                            parts.push(`推演:${heavy ? '高' : '中'}`);
                        }
                    }
                }

                if (eid === 'event_breakthrough_aftershock_01') {
                    if (oid === 'steady') parts.push('走向:心魔');
                    if (oid === 'press') parts.push('走向:稳定/崩塌');
                }
                if (/^event_heart_demon_/.test(eid)) {
                    parts.push('守心提示:不要追求“完美结果”');
                }
                if (!parts.length) return '';
                return parts.join(' | ');
            };

            const hint = document.createElement('div');
            hint.style.fontSize = '12px';
            hint.style.color = '#aaa';
            hint.style.lineHeight = '1.2';
            const previewText = getPreview();
            if (previewText) hint.textContent = previewText;

            btn.addEventListener('click', () => {
                modal.classList.add('hidden');
                const optionId = (opt && typeof opt.id === 'string' && opt.id.trim()) ? opt.id.trim() : String(idx);
                Logic.resolveEvent({ eventId: event && event.id ? event.id : null, optionId, optionIndex: idx, option: opt, event });
            });
            wrap.appendChild(btn);
            if (previewText) wrap.appendChild(hint);
            optionsDiv.appendChild(wrap);
        });
        
        modal.classList.remove('hidden');
    }
};
