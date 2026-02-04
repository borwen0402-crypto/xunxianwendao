/**
 * 游戏核心逻辑
 * 负责游戏规则判断、状态修改、模拟后端API行为
 */

function defineRule(meta, fn) {
    fn.ruleMeta = meta;
    return fn;
}

if (typeof window !== 'undefined') window.defineRule = defineRule;

const Rules = {
    // 探索恢复规则
    explorationRecovery: defineRule({
        inputs: ['hp', 'mp', 'maxHp', 'maxMp', 'statusTags', 'storyFlags'],
        outputs: ['delta', 'changed'],
        guarantees: ['noSideEffect', 'deterministic']
    }, function(input) {
        const cfg = (typeof window !== 'undefined' && window.RulesConfig && typeof window.RulesConfig === 'object') ? window.RulesConfig : null;
        const rrRaw = cfg && Object.prototype.hasOwnProperty.call(cfg, 'regenRate') ? Number(cfg.regenRate) : 0.05;
        const regenRateBase = Number.isFinite(rrRaw) ? Math.max(0, Math.min(0.5, rrRaw)) : 0.05;
        const hp = Number(input && input.hp) || 0;
        const mp = Number(input && input.mp) || 0;
        const maxHp = Math.max(1, Number(input && input.maxHp) || 100);
        const maxMp = Math.max(0, Number(input && input.maxMp) || 0);
        const statusTags = Array.isArray(input && input.statusTags) ? input.statusTags.filter(x => typeof x === 'string') : [];
        const storyFlags = input && input.storyFlags && typeof input.storyFlags === 'object' ? input.storyFlags : {};
        const hasMfNoise = Object.prototype.hasOwnProperty.call(storyFlags, 'mf_noise');
        const mindNoise = hasMfNoise ? (storyFlags.mf_noise === true) : (storyFlags.mind_noise === true);
        const interference = storyFlags.mf_interference === true;
        const pressure = storyFlags.mf_pressure === true;
        const mindStrain = (() => {
            const hasMfStrain = Object.prototype.hasOwnProperty.call(storyFlags, 'mf_strain');
            const v = Number(hasMfStrain ? storyFlags.mf_strain : storyFlags.mind_strain);
            if (!Number.isFinite(v)) return 0;
            return Math.max(0, Math.min(5, Math.floor(v)));
        })();
        const hpPct = Math.max(0, Math.min(1, hp / maxHp));
        const mpPct = maxMp > 0 ? Math.max(0, Math.min(1, mp / maxMp)) : 1;
        let regenRateEff = regenRateBase * (1 + (1 - hpPct) * 0.9);
        if (maxMp > 0) regenRateEff = regenRateEff * (1 + (1 - mpPct) * 0.2);
        if (statusTags.includes('rested')) regenRateEff *= 1.15;
        if (statusTags.includes('wounded')) regenRateEff *= 1.05;
        if (statusTags.includes('tainted')) regenRateEff *= 0.9;
        if (mindNoise) regenRateEff *= 0.97;
        if (interference) regenRateEff *= 0.96;
        if (pressure) regenRateEff *= 0.98;
        if (mindStrain > 0) regenRateEff *= Math.max(0.85, 1 - mindStrain * 0.03);
        const malus = Number(storyFlags.bt_efficiency_malus) || 0;
        if (malus > 0) regenRateEff *= Math.max(0.1, 1 - malus);
        regenRateEff = Math.max(0, Math.min(0.5, regenRateEff));

        const regenHp = hp < maxHp ? Math.max(0, Math.min(maxHp - hp, Math.floor(maxHp * regenRateEff))) : 0;
        const regenMp = mp < maxMp ? Math.max(0, Math.min(maxMp - mp, Math.floor(maxMp * regenRateEff))) : 0;
        return { delta: { playerHp: regenHp, playerMp: regenMp }, changed: regenHp !== 0 || regenMp !== 0 };
    }),

    // 战斗胜利奖励规则
    victoryRewards: defineRule({
        inputs: ['monsters', 'map', 'suppression', 'storyFlags'],
        outputs: ['delta', 'expGain', 'drop'],
        guarantees: ['noSideEffect']
    }, function(input, rng) {
        const cfg = (typeof window !== 'undefined' && window.RulesConfig && typeof window.RulesConfig === 'object') ? window.RulesConfig : null;
        const dcRaw = cfg && Object.prototype.hasOwnProperty.call(cfg, 'dropChance') ? Number(cfg.dropChance) : 0.3;
        const dropChanceBase = Number.isFinite(dcRaw) ? Math.max(0, Math.min(1, dcRaw)) : 0.3;
        const random = typeof rng === 'function' ? rng : gameState.rng;
        const monsters = Array.isArray(input && input.monsters) ? input.monsters : [];
        const map = input && typeof input.map === 'object' ? input.map : null;
        const suppression = input && typeof input.suppression === 'object' ? input.suppression : {};
        const storyFlags = input && input.storyFlags && typeof input.storyFlags === 'object' ? input.storyFlags : {};
        const pressure = storyFlags.mf_pressure === true;
        const mindStrain = (() => {
            const hasMfStrain = Object.prototype.hasOwnProperty.call(storyFlags, 'mf_strain');
            const v = Number(hasMfStrain ? storyFlags.mf_strain : storyFlags.mind_strain);
            if (!Number.isFinite(v)) return 0;
            return Math.max(0, Math.min(5, Math.floor(v)));
        })();
        const suppressed = suppression && suppression.flags && suppression.flags.suppressed === true;
        const dominant = suppression && suppression.flags && suppression.flags.dominant === true;
        const bias = suppressed ? 0.75 : (dominant ? 1.15 : 1);
        let dropChance = dropChanceBase * bias;
        if (pressure) dropChance *= 0.95;
        if (mindStrain > 0) dropChance *= Math.max(0.8, 1 - mindStrain * 0.04);
        dropChance = Math.max(0, Math.min(1, dropChance));

        // [V1.9.0 Beta] Map cultivation gain fixed at 100 for fast leveling
        let expGain = 100;
        /* Original Logic
        let expGain = 0;
        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            expGain += (m && typeof m.exp === 'number') ? m.exp : (m && Number(m.exp)) || 10;
        }
        */

        let drop = null;
        if (map && Array.isArray(map.drops) && map.drops.length && random() < dropChance) {
            drop = map.drops[Math.floor(random() * map.drops.length)] || null;
        }

        return { delta: { expDelta: expGain }, expGain, drop };
    }),

    // 突破进阶规则
    breakthroughAdvance: defineRule({
        inputs: ['stage', 'realm', 'exp', 'maxExp'],
        outputs: ['delta', 'success'],
        guarantees: ['noSideEffect', 'deterministic']
    }, function(input) {
        // 简单模拟
        return { delta: { maxHpDelta: 100, maxMpDelta: 50 }, success: true };
    }),

    combatStatusRule: defineRule({
        inputs: ['phase', 'player', 'monster', 'monsters', 'env', 'round', 'rng'],
        outputs: ['takenMult', 'damageMult', 'mpCostMult', 'logs', 'flags'],
        guarantees: ['noSideEffect']
    }, function(input) {
        const phase = input && typeof input.phase === 'string' ? input.phase : '';
        const player = input && input.player && typeof input.player === 'object' ? input.player : {};
        const monster = input && input.monster && typeof input.monster === 'object' ? input.monster : null;
        const monsters = Array.isArray(input && input.monsters) ? input.monsters : [];

        const playerStatuses = Array.isArray(player.statuses) ? player.statuses : [];
        const hasStatus = (id) => playerStatuses.some(s => s && typeof s === 'object' && s.id === id);

        const domainActive = monsters.some(m => m && Array.isArray(m.statuses) && m.statuses.some(s => s && typeof s === 'object' && s.id === 'ghost_domain'));
        const monsterIsYin = monster && Array.isArray(monster.tags) && (monster.tags.includes('yin') || monster.tags.includes('ghost'));
        const monsterSealed = monster && Array.isArray(monster.statuses) && monster.statuses.some(s => s && typeof s === 'object' && s.id === 'sealed');

        let takenMult = 1;
        let damageMult = 1;
        let mpCostMult = 1;

        if (phase === 'monster') {
            if (hasStatus('immune')) takenMult *= 0;
            if (hasStatus('talisman_shield')) {
                takenMult *= 0.6;
                if (hasStatus('talisman_shield_yin') && monsterIsYin) takenMult *= 0.8;
            }
            if (monsterSealed) takenMult *= 0.85;
            if (domainActive && monsterIsYin) takenMult *= 1.25;
        }

        if (phase === 'player') {
            if (hasStatus('fear')) damageMult *= 0.85;
        }

        if (takenMult === 1 && damageMult === 1 && mpCostMult === 1) return null;
        return { takenMult, damageMult, mpCostMult };
    }),

    combatAiRule: defineRule({
        inputs: ['phase', 'player', 'monster', 'monsters', 'env', 'round', 'rng'],
        outputs: ['action', 'targetId'],
        guarantees: ['noSideEffect', 'deterministic']
    }, function() {
        return null;
    }),

    combatSkillRule: defineRule({
        inputs: ['phase', 'player', 'skill', 'target', 'monsters', 'env', 'round', 'rng'],
        outputs: ['mpCostMult', 'flatDamage', 'damageMult', 'logs', 'flags'],
        guarantees: ['noSideEffect']
    }, function() {
        return null;
    }),

    storyTick: defineRule({
        inputs: ['story', 'tick', 'location'],
        outputs: ['trigger', 'eventId', 'storyUpdate'],
        guarantees: ['noSideEffect', 'deterministic']
    }, function(input) {
        const story0 = input && input.story && typeof input.story === 'object' ? input.story : {};
        const tick0 = Number.isFinite(Number(story0.tick)) ? Math.floor(Number(story0.tick)) : (Number.isFinite(Number(input && input.tick)) ? Math.floor(Number(input.tick)) : 0);
        const nextAt = Number.isFinite(Number(story0.nextAtTick)) ? Math.floor(Number(story0.nextAtTick)) : 0;
        const nextEventId = (typeof story0.nextEventId === 'string' && story0.nextEventId.trim()) ? story0.nextEventId.trim() : null;
        const completed = story0.completed === true;

        const tick1 = tick0 + 1;
        const storyUpdate = { tick: tick1 };

        if (completed || !nextEventId) return { trigger: false, eventId: null, storyUpdate };
        if (tick1 < nextAt) return { trigger: false, eventId: null, storyUpdate };

        return { trigger: true, eventId: nextEventId, storyUpdate };
    }),

    getEventById: function(eventId) {
        if (typeof GameData === 'undefined' || !GameData || !Array.isArray(GameData.events)) return null;
        const id = typeof eventId === 'string' ? eventId : null;
        if (!id) return null;
        for (let i = 0; i < GameData.events.length; i++) {
            const e = GameData.events[i];
            if (e && e.id === id) return e;
        }
        return null;
    },

    getAftermath: function(storyFlags) {
        const f = storyFlags && typeof storyFlags === 'object' ? storyFlags : {};
        const v = typeof f.mf_aftermath === 'string' ? f.mf_aftermath.trim() : '';
        return v ? v : null;
    },

    getEventWeight: function(event, storyFlagsOrWorld, worldMaybe) {
        const cfg = (typeof window !== 'undefined' && window.RulesConfig && typeof window.RulesConfig === 'object') ? window.RulesConfig : null;
        const epsRaw = cfg && Object.prototype.hasOwnProperty.call(cfg, 'mfEpsilon') ? Number(cfg.mfEpsilon) : 0.03;
        const eps = Number.isFinite(epsRaw) ? Math.max(0, Math.min(0.2, epsRaw)) : 0.03;
        if (!event || typeof event !== 'object') return 1;
        const looksLikeWorld = (x) => {
            if (!x || typeof x !== 'object') return false;
            if (x.tendencies && typeof x.tendencies === 'object') return true;
            const hasAny = Object.prototype.hasOwnProperty.call(x, 'order') || Object.prototype.hasOwnProperty.call(x, 'chaos') || Object.prototype.hasOwnProperty.call(x, 'omen');
            return hasAny;
        };
        const storyFlags = (worldMaybe !== undefined)
            ? (storyFlagsOrWorld && typeof storyFlagsOrWorld === 'object' ? storyFlagsOrWorld : {})
            : (looksLikeWorld(storyFlagsOrWorld) ? {} : (storyFlagsOrWorld && typeof storyFlagsOrWorld === 'object' ? storyFlagsOrWorld : {}));
        const world = (worldMaybe !== undefined)
            ? (worldMaybe && typeof worldMaybe === 'object' ? worldMaybe : null)
            : (looksLikeWorld(storyFlagsOrWorld) ? storyFlagsOrWorld : null);

        const af = this.getAftermath(storyFlags);
        const meta = event.meta && typeof event.meta === 'object' ? event.meta : {};
        const rarity = typeof meta.rarity === 'string' ? meta.rarity.trim() : '';
        let w = 1;
        if (af === 'tempered' && rarity === 'rare') w *= (1 + eps);
        if (af === 'scarred' && rarity === 'extreme') w *= (1 + eps);

        const wcfgRaw = cfg && Object.prototype.hasOwnProperty.call(cfg, 'wtEpsilon') ? Number(cfg.wtEpsilon) : 0.03;
        const weps = Number.isFinite(wcfgRaw) ? Math.max(0, Math.min(0.2, wcfgRaw)) : 0.03;
        const tend = (() => {
            if (!world || typeof world !== 'object') return null;
            const t = world.tendencies && typeof world.tendencies === 'object' ? world.tendencies : world;
            const clamp = (v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return 0;
                return Math.max(-5, Math.min(5, Math.trunc(n)));
            };
            return { order: clamp(t.order), chaos: clamp(t.chaos), omen: clamp(t.omen) };
        })();
        const tags = Array.isArray(meta.tendencyTags) ? meta.tendencyTags.filter(x => typeof x === 'string') : [];
        const axisFactor = (v) => 1 + weps * (Math.max(-5, Math.min(5, v)) / 5);
        if (tend) {
            if (tags.includes('order')) w *= axisFactor(tend.order);
            if (tags.includes('chaos')) w *= axisFactor(tend.chaos);
            if (tend.omen !== 0) {
                const rareish = rarity === 'rare' || rarity === 'extreme';
                if (rareish || tags.includes('omen')) w *= axisFactor(tend.omen);
            }
        }
        return Math.max(0, w);
    },

    isEventAvailable: function(event, world) {
        if (!event || typeof event !== 'object') return false;
        const meta = event.meta && typeof event.meta === 'object' ? event.meta : {};
        if (meta.hidden === true) return false;
        const gate = meta.worldGate && typeof meta.worldGate === 'object' ? meta.worldGate : null;
        if (!gate) return true;
        const t = (() => {
            if (!world || typeof world !== 'object') return { order: 0, chaos: 0, omen: 0 };
            const raw = world.tendencies && typeof world.tendencies === 'object' ? world.tendencies : world;
            const clamp = (v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return 0;
                return Math.max(-5, Math.min(5, Math.trunc(n)));
            };
            return { order: clamp(raw.order), chaos: clamp(raw.chaos), omen: clamp(raw.omen) };
        })();
        const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

        const og = n(gate.orderGte);
        if (og !== null && t.order < og) return false;
        const ol = n(gate.orderLte);
        if (ol !== null && t.order > ol) return false;
        const cg = n(gate.chaosGte);
        if (cg !== null && t.chaos < cg) return false;
        const cl = n(gate.chaosLte);
        if (cl !== null && t.chaos > cl) return false;
        const mg = n(gate.omenGte);
        if (mg !== null && t.omen < mg) return false;
        const ml = n(gate.omenLte);
        if (ml !== null && t.omen > ml) return false;

        return true;
    },

    isOptionUnlocked: function(event, option, storyFlags) {
        const f = storyFlags && typeof storyFlags === 'object' ? storyFlags : {};
        const meta = option && typeof option === 'object' && option.meta && typeof option.meta === 'object' ? option.meta : {};
        const gate = meta.gate && typeof meta.gate === 'object' ? meta.gate : null;
        if (!gate) return true;

        const af = this.getAftermath(f);
        const toArr = (x) => {
            if (typeof x === 'string') return [x];
            if (Array.isArray(x)) return x.filter(v => typeof v === 'string');
            return [];
        };

        const reqAf = toArr(gate.requiresAftermath).map(s => s.trim()).filter(Boolean);
        if (reqAf.length && (!af || !reqAf.includes(af))) return false;
        const forbAf = toArr(gate.forbidsAftermath).map(s => s.trim()).filter(Boolean);
        if (forbAf.length && af && forbAf.includes(af)) return false;

        const reqFlags = gate.requiresFlags;
        if (Array.isArray(reqFlags)) {
            for (let i = 0; i < reqFlags.length; i++) {
                const k = reqFlags[i];
                if (typeof k !== 'string' || !k) continue;
                if (f[k] !== true) return false;
            }
        } else if (reqFlags && typeof reqFlags === 'object') {
            const keys = Object.keys(reqFlags);
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                if (!Object.prototype.hasOwnProperty.call(reqFlags, k)) continue;
                if (f[k] !== reqFlags[k]) return false;
            }
        }

        const forbFlags = gate.forbidsFlags;
        if (Array.isArray(forbFlags)) {
            for (let i = 0; i < forbFlags.length; i++) {
                const k = forbFlags[i];
                if (typeof k !== 'string' || !k) continue;
                if (f[k] === true) return false;
            }
        } else if (forbFlags && typeof forbFlags === 'object') {
            const keys = Object.keys(forbFlags);
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                if (!Object.prototype.hasOwnProperty.call(forbFlags, k)) continue;
                if (f[k] === forbFlags[k]) return false;
            }
        }

        return true;
    },
    
    // 探索循环处理
    processExploration: function(meta) {
        if (gameState.combat) return;
        const m = meta && typeof meta === 'object' ? meta : {};
        const deltaKey = (typeof m.deltaKey === 'string' && m.deltaKey.trim()) ? m.deltaKey.trim() : null;
        const cfg = (typeof window !== 'undefined' && window.RulesConfig && typeof window.RulesConfig === 'object') ? window.RulesConfig : null;
        const erRaw = cfg && Object.prototype.hasOwnProperty.call(cfg, 'encounterRate') ? Number(cfg.encounterRate) : 0.2;
        const encounterRateBase = Number.isFinite(erRaw) ? Math.max(0, Math.min(1, erRaw)) : 0.2;
        const map = gameState.currentMap;
        const danger = map && Object.prototype.hasOwnProperty.call(map, 'dangerLevel') ? Number(map.dangerLevel) : 1;
        const dangerLevel = Number.isFinite(danger) ? Math.max(1, Math.min(10, Math.round(danger))) : 1;
        const realmIndex = (typeof GameData !== 'undefined' && GameData.realms && gameState.realm && GameData.realms[gameState.realm] && Number.isFinite(Number(GameData.realms[gameState.realm].index)))
            ? Math.max(1, Math.min(10, Math.floor(Number(GameData.realms[gameState.realm].index))))
            : 1;
        let encounterRate = encounterRateBase * (1 + (dangerLevel - 1) * 0.08) * (1 + (realmIndex - 1) * 0.04);
        const storyFlags = (gameState.story && typeof gameState.story === 'object' && gameState.story.flags && typeof gameState.story.flags === 'object')
            ? gameState.story.flags
            : {};
        const pressure = storyFlags.mf_pressure === true;
        const hasMfNoise = Object.prototype.hasOwnProperty.call(storyFlags, 'mf_noise');
        const mindNoise = hasMfNoise ? (storyFlags.mf_noise === true) : (storyFlags.mind_noise === true);
        const mindStrain = (() => {
            const hasMfStrain = Object.prototype.hasOwnProperty.call(storyFlags, 'mf_strain');
            const v = Number(hasMfStrain ? storyFlags.mf_strain : storyFlags.mind_strain);
            if (!Number.isFinite(v)) return 0;
            return Math.max(0, Math.min(5, Math.floor(v)));
        })();
        if (pressure) encounterRate *= 1.12;
        if (mindStrain > 0) encounterRate *= (1 + Math.min(0.15, mindStrain * 0.05));
        encounterRate = Math.max(0, Math.min(1, encounterRate));

        // 1. 恢复处理
        const recoveryRes = this.explorationRecovery({
            hp: gameState.hp,
            mp: gameState.mp,
            maxHp: gameState.maxHp,
            maxMp: gameState.maxMp,
            statusTags: Array.isArray(gameState.statusTags) ? gameState.statusTags : [],
            storyFlags
        });
        
        if (recoveryRes.changed && typeof gameState.applyPlayerDelta === 'function') {
            gameState.applyPlayerDelta(recoveryRes.delta, { source: 'Rules.explorationRecovery', rule: 'Rules.explorationRecovery', deltaKey: deltaKey || undefined });
        }

        // 2. 随机事件
        if (!map) return;

        // 基础遇敌率 20%
        gameState._lastRngConsumerTag = 'explore.encounter.roll';
        if (gameState.rng() < encounterRate) { 
            this.startCombat(map, { deltaKey: deltaKey || undefined }); 
        } else {
            this.generatePeacefulLog(map);
        }
        
        UI.updateStatsUI();
    },

    // 战斗开始
    startCombat: function(map, meta) {
        if (!map) return;
        const m = meta && typeof meta === 'object' ? meta : {};
        const deltaKey = (typeof m.deltaKey === 'string' && m.deltaKey.trim()) ? m.deltaKey.trim() : null;
        
        const pool = Array.isArray(map.monsterPool) ? map.monsterPool : (Array.isArray(map.monsters) ? map.monsters : []);
        if (!pool.length) return;
        const maxCount = map.maxMonsters || 1;
        
        // 随机怪物数量 1-maxCount
        gameState._lastRngConsumerTag = 'combat.spawn.count';
        const count = maxCount <= 1 ? 1 : (1 + Math.floor(gameState.rng() * Math.min(2, maxCount)));
        
        const monsters = [];
        for (let i = 0; i < count; i++) {
            gameState._lastRngConsumerTag = 'combat.spawn.pick';
            const name = pool[Math.floor(gameState.rng() * pool.length)];
            const monsterProto = GameData.monsters[name] || { name: name, hp: 100, atk: 10, exp: 10 };
            monsters.push({
                id: `m${i}`,
                name: name, // Ensure name is explicitly set
                ...monsterProto,
                hp: monsterProto.hp, // Instance HP
                maxHp: monsterProto.hp
            });
        }
        
        // 初始化战斗状态
        if (typeof CombatEngine !== 'undefined' && CombatEngine && typeof CombatEngine.createCombat === 'function') {
            const p = { hp: gameState.hp, mp: gameState.mp, maxHp: gameState.maxHp, maxMp: gameState.maxMp, atk: gameState.atk, matk: gameState.matk, realm: gameState.realm, subRealm: gameState.subRealm, activeDao: gameState.activeDao, daoType: gameState.daoType, daoBranch: gameState.daoBranch, ghosts: Array.isArray(gameState.ghosts) ? gameState.ghosts : [], soulUrn: gameState.soulUrn && typeof gameState.soulUrn === 'object' ? gameState.soulUrn : null, statuses: [] };
            const mapId = map && typeof map.id === 'string' && map.id.trim() ? map.id.trim() : (map.name || '未知');
            const yinYang = (gameState.mapStates && gameState.mapStates[mapId] && typeof gameState.mapStates[mapId] === 'object') ? (Number(gameState.mapStates[mapId].yinYang) || 0) : 0;
            const env = { mapId, difficulty: Number.isFinite(Number(map.dangerLevel)) ? Number(map.dangerLevel) : 1, yinYang, world: (map && typeof map.world === 'string') ? map.world : 'yang' };
            gameState.combat = CombatEngine.createCombat(p, monsters, env);
        } else {
            gameState.combat = {
                round: 0,
                player: { hp: gameState.hp, mp: gameState.mp, maxHp: gameState.maxHp, maxMp: gameState.maxMp, atk: gameState.atk, matk: gameState.matk, realm: gameState.realm, subRealm: gameState.subRealm, activeDao: gameState.activeDao, daoType: gameState.daoType, daoBranch: gameState.daoBranch, ghosts: Array.isArray(gameState.ghosts) ? gameState.ghosts : [], soulUrn: gameState.soulUrn && typeof gameState.soulUrn === 'object' ? gameState.soulUrn : null, statuses: [] },
                monsters: monsters,
                env: { mapId: map && typeof map.id === 'string' && map.id.trim() ? map.id.trim() : (map.name || '未知'), difficulty: Number.isFinite(Number(map.dangerLevel)) ? Number(map.dangerLevel) : 1, yinYang: 0, world: (map && typeof map.world === 'string') ? map.world : 'yang' },
                logs: [],
                activeTargetId: monsters[0] ? monsters[0].id : null
            };
        }
        const label = monsters.map(m => m.name).join('、');
        if (typeof UI !== 'undefined' && UI && typeof UI.renderCombatLogs === 'function') {
            UI.renderCombatLogs([{ type: 'battle', tag: 'start', text: `遭遇【${label}】`, monsters }]);
        } else if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') {
            UI.addLog(`遭遇敌人：${label}`, 'battle');
        }
        if (typeof UI !== 'undefined' && UI && typeof UI.renderCombatUI === 'function') UI.renderCombatUI();
        if (deltaKey) gameState.lastMeta = { source: 'combat_start', tick: (gameState.story && gameState.story.tick) || 0, payload: { deltaKey } };
    },

    // V1.5 战斗结束
    endCombat: function(isWin, monsterSnapshot, meta) {
        const m = meta && typeof meta === 'object' ? meta : {};
        const parentDeltaKey = (typeof m.deltaKey === 'string' && m.deltaKey.trim()) ? m.deltaKey.trim() : null;
        const rewardDeltaKey = parentDeltaKey ? `${parentDeltaKey}:victoryRewards` : (typeof gameState.makeDeltaKey === 'function' ? gameState.makeDeltaKey('Rules.victoryRewards') : null);
        const snapshotMonsters = Array.isArray(monsterSnapshot)
            ? monsterSnapshot
            : (monsterSnapshot ? [monsterSnapshot] : (Array.isArray(gameState.combat.monsters) ? gameState.combat.monsters : []));
        const primary = snapshotMonsters[0] || gameState.combat.monster;

        if (isWin) {
            const mapDanger = gameState.currentMap && Object.prototype.hasOwnProperty.call(gameState.currentMap, 'dangerLevel')
                ? Number(gameState.currentMap.dangerLevel)
                : 1;
            const monsterIndex = Number.isFinite(mapDanger) ? Math.max(1, Math.min(10, Math.round(mapDanger))) : 1;
            const realmIndex = (typeof GameData !== 'undefined' && GameData.realms && gameState.realm && GameData.realms[gameState.realm] && Number.isFinite(Number(GameData.realms[gameState.realm].index)))
                ? Math.max(1, Math.min(10, Math.floor(Number(GameData.realms[gameState.realm].index))))
                : 1;
            const diff = realmIndex - monsterIndex;
            const suppression = { diff, flags: { suppressed: diff <= -1, dominant: diff >= 2 } };
            const storyFlags = (gameState.story && typeof gameState.story === 'object' && gameState.story.flags && typeof gameState.story.flags === 'object')
                ? gameState.story.flags
                : {};
            let rngSeq = 0;
            const rewardRng = () => {
                rngSeq += 1;
                gameState._lastRngConsumerTag = `loot.roll#${rngSeq}`;
                return gameState.rng();
            };
            const rewardRes = (typeof Rules !== 'undefined' && Rules && typeof Rules.victoryRewards === 'function')
                ? Rules.victoryRewards({ monsters: snapshotMonsters, map: gameState.currentMap, suppression, storyFlags }, rewardRng)
                : null;

            const expGain = rewardRes ? (Number(rewardRes.expGain) || 0) : 0;
            if (expGain !== 0) {
                if (typeof gameState.applyPlayerDelta === 'function') {
                    gameState.applyPlayerDelta({ expDelta: expGain }, { source: 'Rules.victoryRewards', rule: 'Rules.victoryRewards', deltaKey: typeof rewardDeltaKey === 'string' ? rewardDeltaKey : undefined });
                } else {
                    gameState.exp = (Number(gameState.exp) || 0) + expGain;
                }
            }

            let dropMsg = "";
            if (rewardRes && rewardRes.drop) {
                dropMsg = `，获得 [${rewardRes.drop}]`;
                // [V1.9.0 Fix] 确保掉落物写入背包
                if (!gameState.inventory) gameState.inventory = {};
                gameState.inventory[rewardRes.drop] = (gameState.inventory[rewardRes.drop] || 0) + 1;
            }
            const sf2 = (gameState.story && typeof gameState.story === 'object' && gameState.story.flags && typeof gameState.story.flags === 'object')
                ? gameState.story.flags
                : {};
            const lootMult = Number(sf2.loot_boost_mult) || 1;
            const stealOnce = sf2.loot_steal_once === true;
            const extraDropChance = lootMult > 1 ? Math.max(0, Math.min(1, lootMult - 1)) : 0;
            let extraDrop = null;
            if (lootMult > 1 && gameState.currentMap && Array.isArray(gameState.currentMap.drops) && gameState.currentMap.drops.length) {
                if (!rewardRes || !rewardRes.drop) {
                    if (rewardRng() < extraDropChance) {
                        extraDrop = gameState.currentMap.drops[Math.floor(rewardRng() * gameState.currentMap.drops.length)] || null;
                    }
                } else if (stealOnce) {
                    extraDrop = rewardRes.drop;
                }
            } else if (stealOnce && rewardRes && rewardRes.drop) {
                extraDrop = rewardRes.drop;
            }
            if (extraDrop) {
                if (!gameState.inventory) gameState.inventory = {};
                gameState.inventory[extraDrop] = (gameState.inventory[extraDrop] || 0) + 1;
                dropMsg += `，额外获得 [${extraDrop}]`;
            }
            if ((lootMult > 1 || stealOnce) && typeof gameState.applyStoryUpdate === 'function') {
                gameState.applyStoryUpdate({ setFlags: { loot_boost_mult: 1, loot_steal_once: false } }, { source: 'Rules.victoryRewards', rule: 'loot_boost', deltaKey: typeof rewardDeltaKey === 'string' ? rewardDeltaKey : undefined });
            }

            const label = snapshotMonsters.length <= 1
                ? (primary ? primary.name : "敌人")
                : snapshotMonsters.map(m => m.name).join('、');
            const summary = `击败【${label}】，修为 +${expGain}${dropMsg}`;
            const endLogs = [{ type: 'battle', tag: 'end_win', text: summary, meta: { deltaKey: typeof rewardDeltaKey === 'string' ? rewardDeltaKey : null, source: 'Rules.victoryRewards', rule: 'Rules.victoryRewards' } }];
            UI.renderCombatLogs(endLogs);
            if (gameState.combat && Array.isArray(gameState.combat.logs)) {
                gameState.combat.logs.push(...endLogs);
                if (gameState.combat.logs.length > 2000) gameState.combat.logs.splice(0, gameState.combat.logs.length - 2000);
            }
            
            // 检查突破
            this.checkBreakthrough();
        } else {
            const label = snapshotMonsters.length <= 1
                ? (primary ? primary.name : "敌人")
                : snapshotMonsters.map(m => m.name).join('、');
            const endLogs = [{ type: 'battle', tag: 'end_lose', text: `被【${label}】击败，重伤垂危！` }];
            UI.renderCombatLogs(endLogs);
            if (gameState.combat && Array.isArray(gameState.combat.logs)) {
                gameState.combat.logs.push(...endLogs);
                if (gameState.combat.logs.length > 2000) gameState.combat.logs.splice(0, gameState.combat.logs.length - 2000);
            }
        }
        
        // Clear combat
        gameState.combat = null;
        UI.updateStatsUI();
    },

    // 检查突破
    checkBreakthrough: function() {
        if (gameState.exp >= gameState.maxExp) {
            UI.showBreakthroughBtn(true);
        } else {
            UI.showBreakthroughBtn(false);
        }
    },

    // 获取技能
    getSkill: function() {
        let pool = [];
        if (gameState.activeDao !== "随机" && GameData.skillConfig[gameState.activeDao]) {
            pool = GameData.skillConfig[gameState.activeDao];
        } else {
            Object.values(GameData.skillConfig).forEach(arr => pool.push(...arr));
        }
        if (pool.length === 0) return "普通攻击";
        gameState._lastRngConsumerTag = 'combat.skill.pick';
        return pool[Math.floor(gameState.rng() * pool.length)];
    },

    // 生成和平日志
    generatePeacefulLog: function(map) {


        // 检查心之回响 (Mindfracture Echo)
        // 极低权重，仅一次
        const sf = (gameState.story && gameState.story.flags) ? gameState.story.flags : {};
        const af = this.getAftermath(sf);
        
        // Echo is allowed to appear at different times across playthroughs; but must never appear twice within the same save.
        gameState._lastRngConsumerTag = 'explore.echo.roll';
        if (af && !sf.mf_echo_seen && gameState.rng() < 0.01) { // 1% chance per peaceful tick
            let echoText = "";
            if (typeof GameData !== 'undefined' && GameData.mfEchoTexts && GameData.mfEchoTexts[af]) {
                echoText = GameData.mfEchoTexts[af];
            } else {
                // Fallback hardcoded texts
                if (af === 'tempered') echoText = "你忽然意识到，当年的心魔，已经很久没出现了。";
                else if (af === 'scarred') echoText = "你偶尔会想，如果当年再慢一步，会不会不同。";
                else if (af === 'broken') echoText = "有些路你已经不再看见了，但你说不清从什么时候开始的。";
            }
            
            if (echoText) {
                if (typeof gameState.setStoryFlag === 'function') {
                    gameState.setStoryFlag('mf_echo_seen', true);
                } else {
                    sf.mf_echo_seen = true;
                }
                UI.addLog(echoText, 'sys');
                return;
            }
        }

        gameState._lastRngConsumerTag = 'explore.npc.roll';
        if (map.npc && map.npc.length > 0 && gameState.rng() < 0.3) {
            const npc = map.npc[0];
            UI.addLog(`${npc}看了你一眼，低声道：夜路少走。`, 'npc');
        } else {
            this.generateEnvironmentLog(map);
        }
    },

    // 生成环境日志
    generateEnvironmentLog: function(map) {
        let pool = (GameData.environmentLogs && GameData.environmentLogs[map.env]) ? GameData.environmentLogs[map.env].slice() : [];
        
        // World Tendency Injection
        if (typeof GameData !== 'undefined' && GameData.worldTendencyLogs && gameState.world && gameState.world.tendencies) {
             const w = gameState.world.tendencies;
             const getLogs = (type, val) => {
                 if (!val) return [];
                 const cfg = GameData.worldTendencyLogs[type];
                 if (!Array.isArray(cfg)) return [];
                 for (let i = 0; i < cfg.length; i++) {
                     const c = cfg[i];
                     if (val >= c.min && val <= c.max && Array.isArray(c.logs)) return c.logs;
                 }
                 return [];
             };
             const l1 = getLogs('omen', w.omen);
             if (l1.length) pool = pool.concat(l1);
             const l2 = getLogs('chaos', w.chaos);
             if (l2.length) pool = pool.concat(l2);
             const l3 = getLogs('order', w.order);
             if (l3.length) pool = pool.concat(l3);
        }

        const sf = (gameState.story && gameState.story.flags && typeof gameState.story.flags === 'object') ? gameState.story.flags : {};
        const w2 = (gameState.world && gameState.world.tendencies && typeof gameState.world.tendencies === 'object') ? gameState.world.tendencies : null;
        if (w2) {
            const mapName = map && typeof map.name === 'string' ? map.name : '';
            const env = map && typeof map.env === 'string' ? map.env : '';
            const omen = Number(w2.omen) || 0;
            const chaos = Number(w2.chaos) || 0;
            const order = Number(w2.order) || 0;
            const method = (typeof sf.bt_method === 'string' && sf.bt_method.trim()) ? sf.bt_method.trim() : '';
            const hasFalseSuccess = sf.bt_fake_collapsed === true || sf.bt_false_success_forced === true;
            const hasHeartDemon = (Number(sf.heart_demon_seen) || 0) >= 1 || sf.bt_aftershock_failed === true;
            const hasDebt = sf.bt_debt === true || method === 'pill' || method === 'evil' || method === 'blood';
            const isIntrospective = sf.refusedExtremeOnce === true || (Number(sf.heart_demon_accepted) || 0) >= 1;
            const isRebel = method === 'intense' || sf.bt_aftershock_failed === true || sf.bt_fake_collapsed === true;
            const isHeretic = hasDebt;
            const isStable = method === 'normal' || method === 'celestial' || sf.bt_stabilized === true || sf.bt_aftershock_resolved === true;

            const extra = [];
            // 收紧门槛：Omen >= 3 (原2)
            if (omen >= 3 && hasFalseSuccess && (env === '遗址' || env === '灵脉' || mapName === '旧宗遗址' || mapName === '灵脉浅层')) {
                extra.push("你路过一处旧痕，气机轻轻一扭。那一次“成功”，像薄纸一样仍贴在你背后。");
                extra.push("你忽然想起那次破境：门后之光没有重量。世界似乎一直记得这句话。");
            }
            // 收紧门槛：Chaos >= 2 || Omen >= 3 (原 Chaos >= 1 || Omen >= 2)
            if (hasHeartDemon && (chaos >= 2 || omen >= 3) && (env === '死寂' || env === '遗址' || mapName === '死镇' || mapName === '旧宗遗址')) {
                extra.push("你听见自己在心里咳了一声。那道影子没有现身，但你知道它没走远。");
                extra.push("风声里夹着一句熟悉的语气：你不是第一次这么做。你把脚步压得更稳。");
            }
            // 收紧门槛：Omen >= 2 || Chaos >= 2 (原 >= 1)
            if (hasDebt && (env === '血祭' || mapName === '血祭残坛') && (omen >= 2 || chaos >= 2)) {
                extra.push("你靠近残坛时，忽然觉得胸口一沉：像有一笔旧账在暗处翻页。");
                extra.push("你不确定那算不算誓言，但世界把它当成了。");
            }

            const routeExtra = [];
            // 收紧门槛：Order >= 2 || Omen <= -1 (原 Order >= 1 || Omen <= 0)
            if (isIntrospective && (order >= 2 || omen <= -1)) {
                routeExtra.push("你察觉到，天地对你的存在，似乎已经有所判断：你并不急着赢，你更在意看清。");
            } else if (isHeretic && (chaos >= 2 || omen >= 2)) {
                routeExtra.push("你察觉到，天地对你的存在，似乎已经有所判断：你走的是旁门，路快，也更响。");
            } else if (isRebel && (chaos >= 2 || omen >= 2)) {
                routeExtra.push("你察觉到，天地对你的存在，似乎已经有所判断：你逆着走，哪怕摔倒，也要再向前一步。");
            } else if (isStable && order >= 2) {
                routeExtra.push("你察觉到，天地对你的存在，似乎已经有所判断：你守得住，每一步都算数。");
            }

            if (extra.length) pool = pool.concat(extra);
            if (routeExtra.length) pool = pool.concat(routeExtra);
        }

        if (pool.length > 0) {
            gameState._lastRngConsumerTag = 'explore.env.pick';
            const r = gameState.rng();
            const pickedIndex = Math.floor(r * pool.length);
            if (gameState.isHanging && (pickedIndex % 10) !== 0) return;
            const log = pool[pickedIndex];
            UI.addLog(log, 'env');
        }
    }
};

if (typeof window !== 'undefined') {
    window.Rules = Rules;
    if (!window.RulesConfig || typeof window.RulesConfig !== 'object') {
        window.RulesConfig = { encounterRate: 0.2, regenRate: 0.05, dropChance: 0.3, mfEpsilon: 0.03, yinPenaltyNormal: 1.1, yinPenaltyElite: 1.25, yinPenaltyBoss: 1.35, ambientEventRate: 0.06 };
    }
    const reg = {};
    Object.keys(Rules).forEach(k => {
        const fn = Rules[k];
        if (typeof fn === 'function' && fn.ruleMeta && typeof fn.ruleMeta === 'object') {
            reg[k] = { name: k, ruleMeta: fn.ruleMeta };
        }
    });
    window.RulesRegistry = reg;
}

// === Logic Controller ===
// 负责协调 UI 请求与游戏规则，充当 Controller 层
const Logic = {
    // 游戏主循环句柄
    loopInterval: null,
    _uiHoldUntilTs: 0,
    _maybeTriggerAmbientEvent: function(tickDeltaKey) {
        if (typeof GameData === 'undefined' || !GameData || !Array.isArray(GameData.events)) return false;
        if (typeof UI === 'undefined' || !UI || typeof UI.showEventModal !== 'function') return false;

        const cfg = (typeof window !== 'undefined' && window.RulesConfig && typeof window.RulesConfig === 'object') ? window.RulesConfig : null;
        const rateRaw = cfg && Object.prototype.hasOwnProperty.call(cfg, 'ambientEventRate') ? Number(cfg.ambientEventRate) : 0.06;
        let rate = Number.isFinite(rateRaw) ? Math.max(0, Math.min(0.5, rateRaw)) : 0.06;
        if (gameState.isHanging) rate *= 0.35;
        if (rate <= 0) return false;

        gameState._lastRngConsumerTag = 'explore.event.roll';
        if (gameState.rng() >= rate) return false;

        const storyFlags = (gameState.story && typeof gameState.story === 'object' && gameState.story.flags && typeof gameState.story.flags === 'object')
            ? gameState.story.flags
            : {};
        const world = (gameState.world && typeof gameState.world === 'object') ? gameState.world : null;
        const map = gameState.currentMap && typeof gameState.currentMap === 'object' ? gameState.currentMap : null;
        const mapId = map && typeof map.id === 'string' && map.id.trim() ? map.id.trim() : (map && typeof map.name === 'string' ? map.name : null);

        const pool = GameData.events
            .filter(e => e && typeof e === 'object' && typeof e.id === 'string' && e.id.startsWith('evt_ambient_'))
            .filter(e => {
                if (e.eventType === 'story') return false;
                const meta = e.meta && typeof e.meta === 'object' ? e.meta : {};
                if (meta.mapIds && Array.isArray(meta.mapIds) && mapId) {
                    const ok = meta.mapIds.some(x => typeof x === 'string' && x === mapId);
                    if (!ok) return false;
                }
                return (typeof Rules !== 'undefined' && Rules && typeof Rules.isEventAvailable === 'function')
                    ? Rules.isEventAvailable(e, world)
                    : true;
            });
        if (!pool.length) return false;

        const weights = [];
        let sum = 0;
        for (let i = 0; i < pool.length; i++) {
            const e = pool[i];
            const w = (typeof Rules !== 'undefined' && Rules && typeof Rules.getEventWeight === 'function')
                ? Number(Rules.getEventWeight(e, storyFlags, world))
                : 1;
            const ww = Number.isFinite(w) ? Math.max(0, w) : 0;
            weights.push(ww);
            sum += ww;
        }
        if (!(sum > 0)) return false;

        gameState._lastRngConsumerTag = 'explore.event.pick';
        let r = gameState.rng() * sum;
        let picked = pool[0];
        for (let i = 0; i < pool.length; i++) {
            r -= weights[i];
            if (r <= 0) {
                picked = pool[i];
                break;
            }
        }

        if (picked) {
            UI.showEventModal(picked);
            if (typeof tickDeltaKey === 'string' && tickDeltaKey.trim()) {
                gameState.lastMeta = { source: 'ambient_event', tick: (gameState.story && gameState.story.tick) || 0, payload: { eventId: picked.id, deltaKey: tickDeltaKey } };
            }
            return true;
        }
        return false;
    },

    // 1. 进入地图
    requestEnterMap: function(mapName) {
        if (gameState.isHanging) {
            alert("挂机中无法移动，请先停止挂机！");
            return;
        }

        const map = GameData.mapConfig[mapName];
        if (!map) return;

        // 简单的拓扑检查 (UI已经做过禁用处理，这里做二次校验)
        if (gameState.currentMap) {
            const isNeighbor = gameState.currentMap.neighbors.includes(mapName);
            const isCrossLayer = gameState.currentMap.crossLayerMap === mapName;
            if (gameState.currentMap.name !== mapName && !isNeighbor && !isCrossLayer) {
                console.warn("Cheat warning: attempting to jump to non-neighbor map.");
                return;
            }
        }

        const mapWorld = (map && typeof map.world === 'string') ? map.world : 'yang';
        const isYinMap = mapWorld === 'yin' || (typeof mapName === 'string' && mapName.startsWith('阴间'));
        if (map.locked) {
            if (isYinMap && mapName === '阴间·思桥下层（运魂之河）') {
                const isYinYangDao = gameState.activeDao === '阴阳道';
                const inv = gameState.inventory && typeof gameState.inventory === 'object' ? gameState.inventory : (gameState.inventory = {});
                const hasToken = (Number(inv['通阴符']) || 0) > 0;
                const sf = (gameState.story && gameState.story.flags && typeof gameState.story.flags === 'object') ? gameState.story.flags : {};
                const hasReady = sf.yin_pass_ready === true;
                if (!isYinYangDao && !hasToken && !hasReady) {
                    UI.addLog(`进入阴间需要【阴阳道】或消耗【通阴符×1】。`, 'sys');
                    return;
                }
                if (!isYinYangDao && hasReady) {
                    if (typeof gameState.applyStoryUpdate === 'function') gameState.applyStoryUpdate({ setFlags: { yin_pass_ready: false } }, { source: 'Move', rule: 'yin_pass_ready' });
                    UI.addLog(`通阴符的余烬未散，你循着阴风入了桥下。`, 'sys');
                } else if (!isYinYangDao) {
                    inv['通阴符'] = (Number(inv['通阴符']) || 0) - 1;
                    if (inv['通阴符'] <= 0) delete inv['通阴符'];
                    UI.addLog(`你燃起一张【通阴符】，阴风裹住你的影子。`, 'sys');
                    if (typeof UI !== 'undefined' && UI && typeof UI.renderInventory === 'function') UI.renderInventory();
                }
            } else {
                UI.addLog(`【${mapName}】被神秘力量封锁，无法进入。`, 'sys');
                return;
            }
        }

        const moveAction = (typeof gameState !== 'undefined' && gameState && typeof gameState.recordAction === 'function')
            ? gameState.recordAction('move', { mapName })
            : null;
        gameState.currentMap = map;
        gameState.environmentTag = map.env;
        if (moveAction && typeof moveAction.deltaKey === 'string' && moveAction.deltaKey.trim()) {
            gameState.lastMeta = { source: 'move', tick: (gameState.story && gameState.story.tick) || 0, payload: { mapName, deltaKey: moveAction.deltaKey } };
        }
        
        UI.renderMapList();
        UI.renderMapInfo();
        UI.addLog(`你来到了【${mapName}】。${map.desc}`, 'sys');
        gameState.save();
    },

    // 2. 切换挂机状态
    requestToggleHanging: function() {
        if (gameState.isHanging) {
            this.requestStopHanging();
        } else {
            this.requestStartHanging();
        }
    },

    requestStartHanging: function() {
        if (!gameState.currentMap) {
            alert("请先选择一个地图！");
            return;
        }
        
        // 自动战斗测试检查
        const hasMonsters = (gameState.currentMap.monsterPool && gameState.currentMap.monsterPool.length > 0) || 
                          (gameState.currentMap.monsters && gameState.currentMap.monsters.length > 0);
        if (!hasMonsters && !gameState.currentMap.npc) {
             UI.addLog("此地荒芜，无需挂机。", "sys");
             return;
        }

        const startAction = (typeof gameState !== 'undefined' && gameState && typeof gameState.recordAction === 'function')
            ? (() => {
            const mapName = gameState.currentMap && gameState.currentMap.name ? gameState.currentMap.name : null;
            return gameState.recordAction('hanging_start', { mapName });
        })()
            : null;
        gameState.isHanging = true;
        UI.updateHangingStatus();
        if (startAction && typeof startAction.deltaKey === 'string' && startAction.deltaKey.trim()) {
            gameState.lastMeta = { source: 'hanging_start', tick: (gameState.story && gameState.story.tick) || 0, payload: { deltaKey: startAction.deltaKey } };
        }
        this.gameLoop(); // 立即执行一次
        
        if (this.loopInterval) clearInterval(this.loopInterval);
        this.loopInterval = setInterval(() => {
            this.gameLoop();
        }, 2000); // 2秒一轮
        
        UI.addLog("开始在当前区域探索...", "sys");
    },

    requestStopHanging: function() {
        const stopAction = (typeof gameState !== 'undefined' && gameState && typeof gameState.recordAction === 'function')
            ? gameState.recordAction('hanging_stop', {})
            : null;
        gameState.isHanging = false;
        UI.updateHangingStatus();
        if (stopAction && typeof stopAction.deltaKey === 'string' && stopAction.deltaKey.trim()) {
            gameState.lastMeta = { source: 'hanging_stop', tick: (gameState.story && gameState.story.tick) || 0, payload: { deltaKey: stopAction.deltaKey } };
        }
        if (this.loopInterval) {
            clearInterval(this.loopInterval);
            this.loopInterval = null;
        }
        UI.addLog("停止了探索。", "sys");
        gameState.save();
    },

    _stopHangingSilently: function() {
        gameState.isHanging = false;
        if (this.loopInterval) {
            clearInterval(this.loopInterval);
            this.loopInterval = null;
        }
    },

    _applyMove: function(mapName, opts) {
        const o = opts && typeof opts === 'object' ? opts : {};
        const silent = o.silent === true;
        const key = typeof mapName === 'string' && mapName.trim() ? mapName.trim() : null;
        if (!key || typeof GameData === 'undefined' || !GameData || !GameData.mapConfig || !GameData.mapConfig[key]) return false;
        const map = GameData.mapConfig[key];
        gameState.currentMap = map;
        gameState.environmentTag = map.env;
        const deltaKey = typeof o.deltaKey === 'string' && o.deltaKey.trim() ? o.deltaKey.trim() : null;
        if (deltaKey) gameState.lastMeta = { source: 'move', tick: (gameState.story && gameState.story.tick) || 0, payload: { mapName: key, deltaKey } };
        if (!silent) {
            if (typeof UI !== 'undefined' && UI) {
                if (typeof UI.renderMapList === 'function') UI.renderMapList();
                if (typeof UI.renderMapInfo === 'function') UI.renderMapInfo();
            }
        }
        return true;
    },

    _runOneTickCore: function(tickDeltaKey, opts) {
        const o = opts && typeof opts === 'object' ? opts : {};
        const allowEventModal = o.allowEventModal !== false;
        const stopOnLose = o.stopOnLose !== false;

        if (allowEventModal) {
            const hasDao = typeof gameState.daoType === 'string' && gameState.daoType.trim();
            const daoLocked = gameState.daoLocked === true;
            const sf = (gameState.story && typeof gameState.story === 'object' && gameState.story.flags && typeof gameState.story.flags === 'object')
                ? gameState.story.flags
                : {};
            const offered = sf.dao_offered === true;
            if (!daoLocked && !hasDao && !offered && gameState.realm === '寻道' && typeof gameState.applyStoryUpdate === 'function') {
                gameState.applyStoryUpdate(
                    { nextEventId: 'event_establish_dao_01', delayTicks: 0, setFlags: { dao_offered: true } },
                    { source: 'DaoEstablish', rule: 'DaoEstablish', deltaKey: tickDeltaKey }
                );
            }
        }

        if (typeof Rules.storyTick === 'function') {
            const res = Rules.storyTick({ story: gameState.story, tick: gameState.story.tick });
            if (res && res.storyUpdate) {
                gameState.applyStoryUpdate(res.storyUpdate, { source: 'Rules.storyTick', rule: 'Rules.storyTick', deltaKey: tickDeltaKey });
            }
            if (allowEventModal && res && res.trigger && res.eventId) {
                const ev = (typeof Rules.getEventById === 'function') ? Rules.getEventById(res.eventId) : null;
                if (ev && typeof UI !== 'undefined' && UI && typeof UI.showEventModal === 'function') {
                    UI.showEventModal(ev);
                    return { paused: true, combatResult: null };
                }
            }
        }

        if (gameState.combat) {
            if (typeof CombatEngine !== 'undefined' && CombatEngine) {
                let rngSeq = 0;
                const rng = () => {
                    rngSeq += 1;
                    gameState._lastRngConsumerTag = `combat.roll#${rngSeq}`;
                    return gameState.rng();
                };
                const res = CombatEngine.run(gameState.combat, rng, {
                    rules: {
                        realm: Rules.breakthroughAdvance,
                        status: Rules.combatStatusRule,
                        ai: Rules.combatAiRule,
                        skill: Rules.combatSkillRule
                    },
                    trace: { deltaKey: tickDeltaKey, source: 'combat' }
                });

                if (res && res.delta && typeof gameState.applyPlayerDelta === 'function') {
                    gameState.applyPlayerDelta(res.delta, { source: 'CombatEngine', deltaKey: (typeof tickDeltaKey === 'string' ? tickDeltaKey : undefined) });
                    // [V1.9.0 Fix] 战斗中每回合实时刷新UI状态(HP/MP)
                    if (typeof UI !== 'undefined' && UI && typeof UI.updateStatsUI === 'function') UI.updateStatsUI();
                }
                if (res && Array.isArray(res.effects) && res.effects.length && typeof gameState.applyExternalEffects === 'function') {
                    gameState.applyExternalEffects(res.effects, { source: 'CombatEngine', deltaKey: (typeof tickDeltaKey === 'string' ? tickDeltaKey : undefined) });
                }
                if (res && Array.isArray(res.statusChanges) && res.statusChanges.length && typeof gameState.applyStatusChanges === 'function') {
                    gameState.applyStatusChanges(res.statusChanges);
                }

                if (res && res.combat) gameState.combat = res.combat;
                if (res && res.logs && res.logs.length) {
                    if (typeof UI !== 'undefined' && UI && typeof UI.renderCombatLogs === 'function') UI.renderCombatLogs(res.logs);
                }

                if (res && res.result === 'win') {
                    Rules.endCombat(true, gameState.combat.monsters, { deltaKey: tickDeltaKey });
                    return { paused: false, combatResult: 'win' };
                } else if (res && res.result === 'lose') {
                    Rules.endCombat(false, gameState.combat.monsters, { deltaKey: tickDeltaKey });
                    if (stopOnLose) this._stopHangingSilently();
                    return { paused: false, combatResult: 'lose' };
                }
            }
        } else {
            if (allowEventModal && this._maybeTriggerAmbientEvent(tickDeltaKey)) {
                return { paused: true, combatResult: null };
            }
            Rules.processExploration({ deltaKey: tickDeltaKey });
            if (gameState && gameState.daoType === '鬼道' && typeof gameState.tickGhosts === 'function') {
                gameState.tickGhosts(tickDeltaKey);
            }
        }
        return { paused: false, combatResult: null };
    },

    _resolveEventImpl: function(payload, opts) {
        const o = opts && typeof opts === 'object' ? opts : {};
        const p = payload && typeof payload === 'object' ? payload : {};
        const recordAction = o.recordAction !== false;

        // [V1.9.0] Special handling for 洗髓丹 Event (Synthetic, bypasses GameData lookup)
        const checkEventId = (p.event && p.event.id) ? p.event.id : p.eventId;
        if (checkEventId === 'evt_use_xisuidan') {
            const optId = (p.option && p.option.id) ? p.option.id : p.optionId;
            if (optId === 'confirm') {
                const usageCount = (gameState.flags && gameState.flags.xisui_usage_count) ? Number(gameState.flags.xisui_usage_count) : 0;
                const cost = 1 + usageCount;
                
                // Double check inventory
                if ((gameState.inventory['洗髓丹'] || 0) < cost) {
                    if (typeof UI !== 'undefined' && UI.addLog) UI.addLog(`洗髓丹不足，需要 ${cost} 颗。`, 'sys');
                    return false;
                }
                
                // Deduct cost
                gameState.inventory['洗髓丹'] -= cost;
                if (gameState.inventory['洗髓丹'] <= 0) delete gameState.inventory['洗髓丹'];
                
                // Update usage count
                if (!gameState.flags) gameState.flags = {};
                gameState.flags.xisui_usage_count = ((gameState.flags.xisui_usage_count || 0) + 1);

                // Perform Respec
                const alloc = gameState.allocatedStats || { atk: 0, hp: 0, speed: 0 };
                const pts = (alloc.atk || 0) + (alloc.hp || 0) + (alloc.speed || 0);
                
                gameState.atk = Math.max(0, (gameState.atk || 0) - (alloc.atk || 0));
                gameState.maxHp = Math.max(1, (gameState.maxHp || 0) - ((alloc.hp || 0) * 10));
                gameState.hp = Math.min(gameState.hp, gameState.maxHp);
                gameState.speed = Math.max(10, (gameState.speed || 0) - (alloc.speed || 0));
                gameState.attributePoints = (gameState.attributePoints || 0) + pts;
                gameState.allocatedStats = { atk: 0, hp: 0, speed: 0 };
                
                if (typeof UI !== 'undefined' && UI.addLog) UI.addLog(`药力化开，经脉重塑！已返还 ${pts} 点属性点。`, 'sys');
                
                if (typeof UI !== 'undefined') {
                    if (UI.updateStatsUI) UI.updateStatsUI();
                    if (UI.renderInventory) UI.renderInventory();
                }
                if (typeof gameState.save === 'function') gameState.save();
                
                // Record action manually since we bypassed standard flow
                if (recordAction && typeof gameState.recordAction === 'function') {
                    gameState.recordAction('event_choice', { eventId: 'evt_use_xisuidan', optionId: 'confirm' }, o.deltaKeyOverride ? { deltaKey: o.deltaKeyOverride } : undefined);
                }
            } else {
                if (typeof UI !== 'undefined' && UI.addLog) UI.addLog(`你收起了洗髓丹，决定暂且缓缓。`, 'sys');
                if (recordAction && typeof gameState.recordAction === 'function') {
                    gameState.recordAction('event_choice', { eventId: 'evt_use_xisuidan', optionId: 'cancel' }, o.deltaKeyOverride ? { deltaKey: o.deltaKeyOverride } : undefined);
                }
            }
            return true;
        }

        const event = p.event && typeof p.event === 'object'
            ? p.event
            : ((typeof Rules !== 'undefined' && Rules && typeof Rules.getEventById === 'function' && p.eventId) ? Rules.getEventById(p.eventId) : null);
        if (!event) return false;
        const rawOptions = Array.isArray(event.options) ? event.options : [];
        const option = p.option && typeof p.option === 'object'
            ? p.option
            : (typeof p.optionId === 'string' ? (rawOptions.find(v => v && v.id === p.optionId) || null) : (rawOptions[p.optionIndex] || null));
        if (!option) return false;

        const overrideDeltaKey = typeof o.deltaKeyOverride === 'string' && o.deltaKeyOverride.trim() ? o.deltaKeyOverride.trim() : null;
        const choiceAction = (recordAction && event && option && typeof gameState !== 'undefined' && gameState && typeof gameState.recordAction === 'function')
            ? gameState.recordAction('event_choice', { eventId: event.id || null, optionId: option.id || null }, overrideDeltaKey ? { deltaKey: overrideDeltaKey } : undefined)
            : null;

        if (typeof gameState === 'undefined' || !gameState || typeof gameState.makeDeltaKey !== 'function') {
            if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog('deltaKey 生成失败：gameState.makeDeltaKey 未就绪。', 'sys');
            return false;
        }
        const deltaKey = overrideDeltaKey
            ? overrideDeltaKey
            : ((choiceAction && typeof choiceAction.deltaKey === 'string' && choiceAction.deltaKey.trim())
                ? choiceAction.deltaKey
                : gameState.makeDeltaKey(event && event.id ? `Event:${event.id}` : 'Event'));

        if (typeof EventSystem === 'undefined' || !EventSystem || typeof EventSystem.runEvent !== 'function') {
            if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog('EventSystem 未就绪。', 'sys');
            return false;
        }

        const map = gameState && gameState.currentMap && typeof gameState.currentMap === 'object' ? gameState.currentMap : null;
        const ctx = {
            eventType: event.eventType,
            event,
            option,
            deltaKey,
            player: { hp: gameState.hp, mp: gameState.mp, maxHp: gameState.maxHp, maxMp: gameState.maxMp, atk: gameState.atk, realm: gameState.realm, subRealm: gameState.subRealm, activeDao: gameState.activeDao, statuses: [] },
            env: { mapId: map && map.name ? map.name : '未知', difficulty: map && map.dangerLevel ? map.dangerLevel : 1 },
            behaviorStats: gameState.behaviorStats || null,
            bt_method: (gameState.story && gameState.story.flags && gameState.story.flags.bt_method) || 'normal'
        };
        const rng = () => {
            gameState._lastRngConsumerTag = 'event.roll';
            return gameState.rng();
        };
        const res = EventSystem.runEvent(ctx, rng, { deltaKey });

        if (res && typeof res === 'object') {
            if (!Array.isArray(res.logs)) res.logs = [];
            const branchText = (() => {
                const t = (typeof option.text === 'string' && option.text.trim()) ? option.text.trim() : '';
                if (t) return `选择：${t}`;
                const id = (typeof option.id === 'string' && option.id.trim()) ? option.id.trim() : '';
                return id ? `选择：${id}` : '选择：-';
            })();
            const branchEntry = {
                type: 'sys',
                tag: 'branch',
                text: branchText,
                meta: { eventType: ctx.eventType || (event && event.eventType) || 'trial', eventId: event && event.id ? event.id : null, optionId: option && option.id ? option.id : null, deltaKey, source: 'Logic' }
            };
            const i0 = res.logs.findIndex(e => e && typeof e === 'object' && e.tag === 'event_start');
            if (i0 >= 0) res.logs.splice(i0 + 1, 0, branchEntry);
            else res.logs.unshift(branchEntry);
        }

        if (res && typeof res === 'object') {
            const result = typeof res.result === 'string' ? res.result : '';
            const eventId = event && typeof event.id === 'string' ? event.id : '';
            const eventType = ctx.eventType || (event && event.eventType) || '';
            const flags = res.flags && typeof res.flags === 'object' ? res.flags : null;
            const shouldShowOutcome = (eventType === 'heartDemon')
                || (typeof eventId === 'string' && /breakthrough|heart_demon|cycle_complete/.test(eventId))
                || (flags && (flags.breakthroughFailed === true || flags.heartDemonTriggered === true));
            if (shouldShowOutcome) {
                const floatKind = (result === 'failure') ? 'fail' : ((result === 'partial') ? 'pseudo' : 'success');
                const floatText = (result === 'failure') ? '失败' : ((result === 'partial') ? '未竟' : '成功');
                if (typeof UI !== 'undefined' && UI && typeof UI.spawnCombatFloat === 'function') {
                    UI.spawnCombatFloat(floatText, floatKind, { deltaKey, durationMs: (floatKind === 'success' ? 1200 : 1300) });
                }
            }

            const effects = Array.isArray(res.effects) ? res.effects : [];
            const fmtSigned = (n) => {
                const v = Math.trunc(Number(n) || 0);
                if (v === 0) return null;
                return v > 0 ? `+${v}` : `-${Math.abs(v)}`;
            };
            const effectParts = [];
            for (let i = 0; i < effects.length; i++) {
                const e = effects[i];
                if (!e || typeof e !== 'object') continue;
                if (e.target !== 'player') continue;
                const t = typeof e.type === 'string' ? e.type : '';
                const v = Math.trunc(Number(e.value) || 0);
                const s = fmtSigned(v);
                if (!s) continue;
                if (t === 'hp') {
                    if (typeof UI !== 'undefined' && UI && typeof UI.spawnCombatFloat === 'function') {
                        UI.spawnCombatFloat(s, v > 0 ? 'heal' : 'taken', { deltaKey });
                    }
                    effectParts.push(`HP${s}`);
                } else if (t === 'mp') {
                    if (typeof UI !== 'undefined' && UI && typeof UI.spawnCombatFloat === 'function') {
                        UI.spawnCombatFloat(`MP${s}`, v > 0 ? 'buff' : 'taken', { deltaKey });
                    }
                    effectParts.push(`MP${s}`);
                } else if (t === 'exp') {
                    if (typeof UI !== 'undefined' && UI && typeof UI.spawnCombatFloat === 'function') {
                        UI.spawnCombatFloat(`EXP${s}`, 'exp', { deltaKey });
                    }
                    effectParts.push(`EXP${s}`);
                } else if (t === 'maxHp') {
                    if (typeof UI !== 'undefined' && UI && typeof UI.spawnCombatFloat === 'function') {
                        UI.spawnCombatFloat(`MaxHP${s}`, 'buff', { deltaKey });
                    }
                    effectParts.push(`MaxHP${s}`);
                } else if (t === 'maxMp') {
                    if (typeof UI !== 'undefined' && UI && typeof UI.spawnCombatFloat === 'function') {
                        UI.spawnCombatFloat(`MaxMP${s}`, 'buff', { deltaKey });
                    }
                    effectParts.push(`MaxMP${s}`);
                }
            }

            const story = flags && flags.story && typeof flags.story === 'object' ? flags.story : null;
            const setFlags = story && story.setFlags && typeof story.setFlags === 'object' ? story.setFlags : null;
            const flagParts = [];
            if (setFlags) {
                const keys = Object.keys(setFlags);
                for (let i = 0; i < keys.length; i++) {
                    const k = keys[i];
                    const val = setFlags[k];
                    if (k === 'bt_method') flagParts.push(`准备:${String(val)}`);
                    else if (k === 'bt_debt_due' || k === 'bt_debt') flagParts.push(`${k}=${String(val)}`);
                    else if (k === 'bt_debt_due_level' || k === 'bt_debt_level') flagParts.push(`${k}:${String(val)}`);
                    else if (k === 'bt_efficiency_malus') flagParts.push(`效率↓:${String(val)}`);
                    else if (k === 'mf_strain' || k === 'mind_strain') flagParts.push(`心劳:${String(val)}`);
                    if (typeof UI !== 'undefined' && UI && typeof UI.spawnCombatFloat === 'function') {
                        if (k === 'bt_debt_due_level' || k === 'bt_debt_level') UI.spawnCombatFloat(`债务:${String(val)}`, 'sys', { deltaKey });
                        else if (k === 'bt_efficiency_malus') UI.spawnCombatFloat(`效率↓`, 'pseudo', { deltaKey });
                        else if (k === 'mf_strain' || k === 'mind_strain') UI.spawnCombatFloat(`心劳:${String(val)}`, 'pseudo', { deltaKey });
                    }
                }
            }

            const pieces = [];
            if (effectParts.length) pieces.push(effectParts.join(' '));
            if (flagParts.length) pieces.push(flagParts.join(' '));
            if (pieces.length) {
                if (!Array.isArray(res.logs)) res.logs = [];
                res.logs.push({
                    type: 'sys',
                    tag: 'event_settlement',
                    text: `结算：${pieces.join(' | ')}`,
                    meta: { eventType: ctx.eventType || (event && event.eventType) || 'trial', eventId: event && event.id ? event.id : null, deltaKey, source: 'Logic' }
                });
            }
        }
        if (res && Array.isArray(res.logs) && typeof UI !== 'undefined' && UI && typeof UI.renderEventLogs === 'function') {
            UI.renderEventLogs(res.logs);
        }
        if (res && typeof gameState.applyEventResult === 'function') {
            gameState.applyEventResult(res);
        }
        if (o.silent !== true && typeof UI !== 'undefined' && UI) {
            if (typeof UI.updateStatsUI === 'function') UI.updateStatsUI();
            if (typeof UI.renderInventory === 'function') UI.renderInventory();
            if (typeof UI.renderLeftPanel === 'function') UI.renderLeftPanel();
        }
        if (o.silent !== true && typeof gameState.save === 'function') gameState.save();

        const eid = event && typeof event.id === 'string' ? event.id : null;
        if (gameState.isHanging && eid && (/breakthrough/.test(eid) || /heart_demon/.test(eid))) {
            this._uiHoldUntilTs = Date.now() + 850;
        }
        return true;
    },

    _useItemImpl: function(itemName, opts) {
        const o = opts && typeof opts === 'object' ? opts : {};
        const recordAction = o.recordAction !== false;
        const name = typeof itemName === 'string' && itemName.trim() ? itemName.trim() : null;
        if (!name || !gameState.inventory[name] || gameState.inventory[name] <= 0) return false;

        // [V1.9.0] Special handling for 洗髓丹 (Marrow Cleansing Pill)
        if (name === '洗髓丹') {
            const usageCount = (gameState.flags && gameState.flags.xisui_usage_count) ? Number(gameState.flags.xisui_usage_count) : 0;
            const cost = 1 + usageCount;
            
            if ((gameState.inventory[name] || 0) < cost) {
                if (typeof UI !== 'undefined' && UI.addLog) UI.addLog(`洗髓丹不足，当前需消耗 ${cost} 颗。`, 'sys');
                return false;
            }

            // In replay/silent mode, we assume the subsequent event_choice will handle the logic.
            // We just return true to acknowledge the "open modal" action.
            if (o.silent) return true;

            const evt = {
                id: 'evt_use_xisuidan',
                title: '福至心灵',
                desc: `某一刻你福至心灵，觉得如果破而后立会有更好的发展……\n（当前需消耗洗髓丹：${cost} 颗）`,
                options: [
                    { id: 'confirm', text: '遵循本心' },
                    { id: 'cancel', text: '暂且缓缓' }
                ],
                meta: { cost: cost },
                eventType: 'sys'
            };
            
            if (typeof UI !== 'undefined' && UI.showEventModal) {
                UI.showEventModal(evt);
                // Record the "useItem" action which basically just opened the modal
                if (recordAction && typeof gameState.recordAction === 'function') {
                    gameState.recordAction('useItem', { itemName: name }, o.deltaKeyOverride ? { deltaKey: o.deltaKeyOverride } : undefined);
                }
                return true; 
            }
        }

        const overrideDeltaKey = typeof o.deltaKeyOverride === 'string' && o.deltaKeyOverride.trim() ? o.deltaKeyOverride.trim() : null;
        const action = (recordAction && typeof gameState !== 'undefined' && gameState && typeof gameState.recordAction === 'function')
            ? gameState.recordAction('useItem', { itemName: name }, overrideDeltaKey ? { deltaKey: overrideDeltaKey } : undefined)
            : null;
        const deltaKey = overrideDeltaKey
            ? overrideDeltaKey
            : ((action && typeof action.deltaKey === 'string' && action.deltaKey.trim())
                ? action.deltaKey
                : (typeof gameState.makeDeltaKey === 'function' ? gameState.makeDeltaKey(`ItemUse:${name}`) : null));

        // [V1.9.0 Refactor] Use centralized GameData.itemConfig
        const effects = (typeof GameData !== 'undefined' && GameData.itemConfig) ? GameData.itemConfig : {};

        const effect = effects[name];
        if (!effect) {
            if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog(`【${name}】似乎无法直接使用。`, 'sys');
            return false;
        }

        if (effect.type === 'talisman') {
            const inCombat = !!gameState.combat;
            const mpCost = Number.isFinite(Number(effect.mpCost)) ? Math.max(0, Math.floor(Number(effect.mpCost))) : 0;
            const cd = effect.cooldown && typeof effect.cooldown === 'object' ? effect.cooldown : {};
            const talisman = effect.talisman && typeof effect.talisman === 'object' ? effect.talisman : {};

            const mapId = (() => {
                const m = gameState.currentMap && typeof gameState.currentMap === 'object' ? gameState.currentMap : null;
                if (m && typeof m.id === 'string' && m.id.trim()) return m.id.trim();
                if (m && typeof m.name === 'string' && m.name.trim()) return m.name.trim();
                return null;
            })();

            const ensureMapState = () => {
                if (!mapId) return null;
                if (!gameState.mapStates || typeof gameState.mapStates !== 'object') gameState.mapStates = {};
                const cur = (gameState.mapStates[mapId] && typeof gameState.mapStates[mapId] === 'object') ? gameState.mapStates[mapId] : {};
                if (!cur.talismanUsed || typeof cur.talismanUsed !== 'object') cur.talismanUsed = {};
                gameState.mapStates[mapId] = cur;
                return cur;
            };

            const applyCombatStatusChanges = (changes) => {
                if (!inCombat) return;
                if (!Array.isArray(changes) || !changes.length) return;
                if (typeof CombatEngine !== 'undefined' && CombatEngine && typeof CombatEngine.applyStatusChanges === 'function') {
                    gameState.combat = CombatEngine.applyStatusChanges(gameState.combat, changes);
                }
            };

            const findCombatTarget = () => {
                const c = gameState.combat && typeof gameState.combat === 'object' ? gameState.combat : null;
                const list = c && Array.isArray(c.monsters) ? c.monsters : [];
                const alive = list.filter(m => m && typeof m === 'object' && (Number(m.hp) || 0) > 0);
                if (!alive.length) return null;
                const tid = c && typeof c.activeTargetId === 'string' ? c.activeTargetId : null;
                if (tid) {
                    const t = alive.find(m => m.id === tid);
                    if (t) return t;
                }
                return alive[0];
            };

            const hasPlayerStatus = (id) => {
                const c = gameState.combat && typeof gameState.combat === 'object' ? gameState.combat : null;
                const p = c && c.player && typeof c.player === 'object' ? c.player : null;
                const list = p && Array.isArray(p.statuses) ? p.statuses : [];
                return list.some(s => s && typeof s === 'object' && s.id === id);
            };

            const setPlayerStatus = (status) => applyCombatStatusChanges([{ target: 'player', op: 'refresh', status }]);
            const removePlayerStatus = (id) => applyCombatStatusChanges([{ target: 'player', op: 'remove', status: { id } }]);

            if (cd.kind === 'battle' && !inCombat) {
                if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog(`【${name}】需在战斗中使用。`, 'sys');
                return false;
            }

            if (cd.kind === 'world' && cd.oncePerMap === true) {
                const ms = ensureMapState();
                if (ms && ms.talismanUsed && ms.talismanUsed[name] === true) {
                    if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog(`【${name}】在此地已用过一次。`, 'sys');
                    return false;
                }
            }

            if (cd.kind === 'battle' && Number.isFinite(Number(cd.rounds)) && cd.rounds > 0) {
                const cdId = `cd_talisman_${name}`;
                if (hasPlayerStatus(cdId)) {
                    if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog(`【${name}】尚在冷却。`, 'sys');
                    return false;
                }
            }

            if (cd.kind === 'battle' && cd.oncePerBattle === true) {
                const usedId = `used_talisman_${name}`;
                if (hasPlayerStatus(usedId)) {
                    if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog(`【${name}】本场战斗只能使用一次。`, 'sys');
                    return false;
                }
            }

            if (mpCost > 0 && (Number(gameState.mp) || 0) < mpCost) {
                if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog(`灵力不足，无法使用【${name}】（需要 MP ${mpCost}）。`, 'sys');
                return false;
            }

            gameState.inventory[name]--;
            if (gameState.inventory[name] <= 0) delete gameState.inventory[name];

            if (mpCost > 0) {
                gameState.applyPlayerDelta({ playerMp: -mpCost }, { source: 'ItemUse', rule: name, deltaKey: deltaKey || undefined });
                if (inCombat && gameState.combat && gameState.combat.player) gameState.combat.player.mp = gameState.mp;
            }

            if (cd.kind === 'world' && cd.oncePerMap === true) {
                const ms = ensureMapState();
                if (ms && ms.talismanUsed) ms.talismanUsed[name] = true;
            }
            if (cd.kind === 'battle' && Number.isFinite(Number(cd.rounds)) && cd.rounds > 0) {
                const cdRounds = Math.max(1, Math.floor(Number(cd.rounds)));
                setPlayerStatus({ id: `cd_talisman_${name}`, name: '符箓冷却', stacks: 1, duration: cdRounds });
            }
            if (cd.kind === 'battle' && cd.oncePerBattle === true) {
                setPlayerStatus({ id: `used_talisman_${name}`, name: '符箓已用', stacks: 1, duration: 999 });
            }

            const power = Math.max(1, Math.floor((Number(gameState.atk) || 0) + (Number(gameState.matk) || 0)));

            const applyDamageTo = (monsterId, dmg) => {
                if (!inCombat || !monsterId) return;
                if (typeof gameState.applyExternalEffects === 'function') {
                    gameState.applyExternalEffects([{ source: 'player', target: { monsterId }, type: 'hp', value: -Math.max(0, Math.floor(dmg)), meta: { external: true, kind: 'talisman' } }], { source: 'Talisman', rule: name, deltaKey: deltaKey || undefined });
                }
            };

            const logBattle = (text) => {
                if (o.silent === true) return;
                if (typeof UI !== 'undefined' && UI && typeof UI.renderCombatLogs === 'function') UI.renderCombatLogs([{ type: 'battle', tag: 'skill', text, sourceId: 'player', meta: { action: 'talisman', item: name, deltaKey } }]);
                else if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog(text, 'battle');
            };

            if (inCombat) {
                if (name === '天罡破煞符') {
                    const t = findCombatTarget();
                    if (!t) return false;
                    const isGhost = Array.isArray(t.tags) && t.tags.includes('ghost');
                    const dmg = Math.floor(power * (isGhost ? 1.6 : 1));
                    applyDamageTo(t.id, dmg);
                    const negatives = ['fear', 'confuse', 'sealed', 'burn', 'slow'];
                    const p = gameState.combat && gameState.combat.player ? gameState.combat.player : null;
                    const st = p && Array.isArray(p.statuses) ? p.statuses : [];
                    const hit = st.find(s => s && typeof s === 'object' && negatives.includes(s.id));
                    if (hit) removePlayerStatus(hit.id);
                    logBattle(`天罡破煞符化作一道清光，斩落 ${dmg}。`);
                } else if (name === '金光护体符') {
                    setPlayerStatus({ id: 'talisman_shield', name: '金光护体', stacks: 1, duration: 3 });
                    setPlayerStatus({ id: 'talisman_shield_yin', name: '金光护体·阴', stacks: 1, duration: 3 });
                    logBattle('金光覆体，护住周身气机。');
                } else if (name === '九转还魂符') {
                    setPlayerStatus({ id: 'talisman_revive', name: '九转还魂', stacks: 1, duration: 999 });
                    logBattle('你贴上九转还魂符，气机留了一线回路。');
                } else if (name === '风火遁形符') {
                    if (gameState.story && typeof gameState.story === 'object' && gameState.story.flags && typeof gameState.story.flags === 'object' && typeof gameState.applyStoryUpdate === 'function') {
                        gameState.applyStoryUpdate({ setFlags: { next_battle_damage_malus: 0.1 } }, { source: 'ItemUse', rule: name, deltaKey: deltaKey || undefined });
                    }
                    gameState.combat = null;
                    if (o.silent !== true && typeof UI !== 'undefined' && UI && typeof UI.renderCombatUI === 'function') UI.renderCombatUI();
                    logBattle('风火遁形符燃起，你瞬息脱战。');
                } else if (name === '万鬼辟易符') {
                    const c = gameState.combat;
                    const list = c && Array.isArray(c.monsters) ? c.monsters : [];
                    let hitCount = 0;
                    for (let i = 0; i < list.length; i++) {
                        const m = list[i];
                        if (!m || typeof m !== 'object') continue;
                        if ((Number(m.hp) || 0) <= 0) continue;
                        const isGhost = Array.isArray(m.tags) && m.tags.includes('ghost');
                        if (!isGhost) continue;
                        const dmg = Math.floor(power * 1.5);
                        applyDamageTo(m.id, dmg);
                        hitCount++;
                        if (gameState.rng() < 0.5) {
                            applyCombatStatusChanges([{ target: { monsterId: m.id }, op: 'refresh', status: { id: 'fear', name: '恐惧', stacks: 1, duration: 1 } }]);
                        }
                    }
                    logBattle(`万鬼辟易符照下，鬼物受创（${hitCount}）。`);
                } else if (name === '五行封印符') {
                    const t = findCombatTarget();
                    if (!t) return false;
                    const isBoss = Array.isArray(t.tags) && t.tags.includes('boss');
                    const d = isBoss ? 1 : 2;
                    applyCombatStatusChanges([{ target: { monsterId: t.id }, op: 'refresh', status: { id: 'sealed', name: '封印', stacks: 1, duration: d } }]);
                    logBattle(`五行封印符落下，封住【${t.name}】（${d}回合）。`);
                } else if (name === '乾坤挪移符') {
                    const c = gameState.combat;
                    const list = c && Array.isArray(c.monsters) ? c.monsters : [];
                    for (let i = 0; i < list.length; i++) {
                        const m = list[i];
                        if (!m || typeof m !== 'object') continue;
                        applyCombatStatusChanges([{ target: { monsterId: m.id }, op: 'remove', status: { id: 'shan_ghost_chant' } }]);
                    }
                    logBattle('乾坤挪移符撕开气机，吟唱被打断。');
                } else if (name === '紫霞雷鸣符') {
                    const c = gameState.combat;
                    const list = c && Array.isArray(c.monsters) ? c.monsters : [];
                    let total = 0;
                    for (let i = 0; i < list.length; i++) {
                        const m = list[i];
                        if (!m || typeof m !== 'object') continue;
                        if ((Number(m.hp) || 0) <= 0) continue;
                        const isGhost = Array.isArray(m.tags) && m.tags.includes('ghost');
                        const dmg = Math.floor(power * (isGhost ? 1.7 : 1.4));
                        total += dmg;
                        applyDamageTo(m.id, dmg);
                    }
                    logBattle(`紫霞雷鸣符落下，雷光遍地（总计 ${total}）。`);
                } else if (name === '封魂符') {
                    const t = findCombatTarget();
                    if (!t) return false;
                    const tags = Array.isArray(t.tags) ? t.tags : [];
                    const isBoss = tags.includes('boss');
                    const isElite = tags.includes('elite');
                    const p = isBoss ? 0.15 : (isElite ? 0.4 : 0.7);
                    gameState._lastRngConsumerTag = `talisman.seal#${name}`;
                    const ok = gameState.rng() < p;
                    if (ok) {
                        applyCombatStatusChanges([{ target: { monsterId: t.id }, op: 'refresh', status: { id: 'sealed', name: '封魂', stacks: 1, duration: 2 } }]);
                        logBattle(`封魂符镇下，【${t.name}】魂机受制。`);
                    } else {
                        logBattle(`封魂符镇下，却被【${t.name}】挣开。`);
                    }
                } else if (name === '朱雀火凤符') {
                    const t = findCombatTarget();
                    if (!t) return false;
                    const dmg = Math.floor(power * 1.3);
                    applyDamageTo(t.id, dmg);
                    applyCombatStatusChanges([{ target: { monsterId: t.id }, op: 'refresh', status: { id: 'burn', name: '灼烧', stacks: 1, duration: 2, hpPct: 0.05 } }]);
                    logBattle(`朱雀火凤符轰下，【${t.name}】受创并灼烧。`);
                } else if (name === '玄武水渊符') {
                    const t = findCombatTarget();
                    if (!t) return false;
                    const dmg = Math.floor(power * 1.3);
                    applyDamageTo(t.id, dmg);
                    setPlayerStatus({ id: 'talisman_shield', name: '玄武护体', stacks: 1, duration: 2 });
                    logBattle(`玄武水渊符落下，你周身水意成盾。`);
                } else {
                    logBattle(`使用了【${name}】。`);
                }
            } else {
                if (name === '紫微星辰符') {
                    gameState.applyPlayerDelta({ expDelta: 25 }, { source: 'ItemUse', rule: name, deltaKey: deltaKey || undefined });
                    if (typeof gameState.applyStoryUpdate === 'function') gameState.applyStoryUpdate({ setFlags: { bt_success_bonus: "+5" } }, { source: 'ItemUse', rule: name, deltaKey: deltaKey || undefined });
                } else if (name === '天眼通明符') {
                    if (typeof gameState.applyStoryUpdate === 'function') gameState.applyStoryUpdate({ setFlags: { talisman_preview_steps: 1, talisman_hidden_bonus: 0.3 } }, { source: 'ItemUse', rule: name, deltaKey: deltaKey || undefined });
                } else if (name === '通阴符') {
                    if (typeof gameState.applyStoryUpdate === 'function') gameState.applyStoryUpdate({ setFlags: { yin_pass_ready: true } }, { source: 'ItemUse', rule: name, deltaKey: deltaKey || undefined });
                } else if (name === '五鬼搬运符') {
                    if (typeof gameState.applyStoryUpdate === 'function') gameState.applyStoryUpdate({ setFlags: { loot_boost_mult: 1.25, loot_steal_once: true } }, { source: 'ItemUse', rule: name, deltaKey: deltaKey || undefined });
                }
                if (o.silent !== true && typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog(`使用了【${name}】，${effect.desc}`, 'sys');
            }

            if (o.silent !== true && typeof UI !== 'undefined' && UI) {
                if (typeof UI.renderInventory === 'function') UI.renderInventory();
                if (typeof UI.updateStatsUI === 'function') UI.updateStatsUI();
            }
            if (o.silent !== true && typeof gameState.save === 'function') gameState.save();
            return true;
        }

        gameState.inventory[name]--;
        if (gameState.inventory[name] <= 0) delete gameState.inventory[name];

        // [V1.9.0 Feature] Special Item Effects
        if (effect.effect === 'respec') {
             const alloc = gameState.allocatedStats || { atk: 0, hp: 0, speed: 0 };
             const pts = (alloc.atk || 0) + (alloc.hp || 0) + (alloc.speed || 0);
             if (pts > 0) {
                 // Revert stats
                 gameState.atk = Math.max(0, (gameState.atk || 0) - (alloc.atk || 0));
                 gameState.maxHp = Math.max(1, (gameState.maxHp || 0) - ((alloc.hp || 0) * 10));
                 gameState.hp = Math.min(gameState.hp, gameState.maxHp);
                 gameState.speed = Math.max(10, (gameState.speed || 0) - (alloc.speed || 0));
                 
                 // Return points
                 gameState.attributePoints = (gameState.attributePoints || 0) + pts;
                 gameState.allocatedStats = { atk: 0, hp: 0, speed: 0 };
                 
                 if (typeof UI !== 'undefined' && UI.addLog) UI.addLog(`药力化开，经脉重塑！已返还 ${pts} 点属性点。`, 'sys');
             } else {
                 if (typeof UI !== 'undefined' && UI.addLog) UI.addLog(`你尚未分配属性点，药力在体内空转了一圈。`, 'sys');
             }
        }

        const delta = {
            playerHp: effect.hp || 0,
            playerMp: effect.mp || 0,
            expDelta: effect.exp || 0,
            maxHpDelta: effect.maxHpDelta || 0,
            maxMpDelta: effect.maxMpDelta || 0
        };

        gameState.applyPlayerDelta(delta, { source: 'ItemUse', rule: name, deltaKey: deltaKey || undefined });
        if ((effect.setFlags && typeof effect.setFlags === 'object') || Number.isFinite(Number(effect.mfStrainDelta))) {
            const sf = (gameState.story && gameState.story.flags && typeof gameState.story.flags === 'object') ? gameState.story.flags : {};
            const nextFlags = Object.assign({}, (effect.setFlags && typeof effect.setFlags === 'object') ? effect.setFlags : {});
            if (Number.isFinite(Number(effect.mfStrainDelta))) {
                const cur = Number(sf.mf_strain ?? sf.mind_strain) || 0;
                const out = Math.max(0, Math.min(5, Math.floor(cur + Number(effect.mfStrainDelta))));
                nextFlags.mf_strain = out;
            }
            if (Object.keys(nextFlags).length && typeof gameState.applyStoryUpdate === 'function') {
                gameState.applyStoryUpdate({ setFlags: nextFlags }, { source: 'ItemUse', rule: name, deltaKey: deltaKey || undefined });
            }
        }

        if (typeof UI !== 'undefined' && UI && typeof UI.spawnCombatFloat === 'function') {
            const hp = Math.trunc(Number(delta.playerHp) || 0);
            const mp = Math.trunc(Number(delta.playerMp) || 0);
            const exp = Math.trunc(Number(delta.expDelta) || 0);
            const maxHp = Math.trunc(Number(delta.maxHpDelta) || 0);
            const maxMp = Math.trunc(Number(delta.maxMpDelta) || 0);
            if (hp !== 0) UI.spawnCombatFloat(hp > 0 ? `+${hp}` : `-${Math.abs(hp)}`, hp > 0 ? 'heal' : 'taken', { deltaKey });
            if (mp !== 0) UI.spawnCombatFloat(`MP${mp > 0 ? `+${mp}` : `-${Math.abs(mp)}`}`, mp > 0 ? 'buff' : 'taken', { deltaKey });
            if (exp !== 0) UI.spawnCombatFloat(`EXP${exp > 0 ? `+${exp}` : `-${Math.abs(exp)}`}`, 'exp', { deltaKey });
            if (maxHp !== 0) UI.spawnCombatFloat(`MaxHP+${maxHp}`, 'buff', { deltaKey });
            if (maxMp !== 0) UI.spawnCombatFloat(`MaxMP+${maxMp}`, 'buff', { deltaKey });
        }
        if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog(`使用了【${name}】，${effect.desc}`, 'sys');

        if (o.silent !== true && typeof UI !== 'undefined' && UI) {
            if (typeof UI.renderInventory === 'function') UI.renderInventory();
            if (typeof UI.updateStatsUI === 'function') UI.updateStatsUI();
        }
        if (o.silent !== true && typeof gameState.save === 'function') gameState.save();
        return true;
    },

    _breakthroughImpl: function(payload, opts) {
        const o = opts && typeof opts === 'object' ? opts : {};
        const recordAction = o.recordAction !== false;
        const p = payload && typeof payload === 'object' ? payload : {};

        const progression = GameData.realmProgression || [];
        let nextStage = null;
        const desiredRealm = typeof p.realm === 'string' ? p.realm : null;
        const desiredStage = typeof p.stage === 'string' ? p.stage : null;
        if (desiredRealm && desiredStage) {
            nextStage = progression.find(v => v && v.realm === desiredRealm && v.stage === desiredStage) || null;
        } else {
            const currentIdx = progression.findIndex(v => v && v.realm === gameState.realm && v.stage === gameState.stage);
            if (currentIdx !== -1 && currentIdx < progression.length - 1) nextStage = progression[currentIdx + 1];
        }
        if (!nextStage) return false;

        const overrideDeltaKey = typeof o.deltaKeyOverride === 'string' && o.deltaKeyOverride.trim() ? o.deltaKeyOverride.trim() : null;
        const action = (recordAction && typeof gameState !== 'undefined' && gameState && typeof gameState.recordAction === 'function')
            ? gameState.recordAction('breakthrough', { realm: nextStage.realm, stage: nextStage.stage }, overrideDeltaKey ? { deltaKey: overrideDeltaKey } : undefined)
            : null;
        const deltaKey = overrideDeltaKey
            ? overrideDeltaKey
            : ((action && typeof action.deltaKey === 'string' && action.deltaKey.trim()) ? action.deltaKey : null);

        if (typeof gameState.applyBreakthroughAdvance === 'function' && gameState.applyBreakthroughAdvance(nextStage)) {
            if (deltaKey) gameState.lastMeta = { source: 'breakthrough', tick: (gameState.story && gameState.story.tick) || 0, payload: { deltaKey } };
            if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') {
                UI.addLog(`突破成功！晋升为【${nextStage.realm} · ${nextStage.stage}】！`, 'sys');
                UI.addLog(`气血上限 +${nextStage.hpBonus || 0}，攻击 +${nextStage.atkBonus || 0}，获得自由属性点 +1`, 'sys');
            }
            if (o.silent !== true && typeof UI !== 'undefined' && UI) {
                if (typeof UI.renderLeftPanel === 'function') UI.renderLeftPanel();
                if (typeof UI.showBreakthroughBtn === 'function') UI.showBreakthroughBtn(false);
            }
            if (o.silent !== true && typeof gameState.save === 'function') gameState.save();
            return true;
        }
        return false;
    },

    applyReplayAction: function(action, opts) {
        const o = opts && typeof opts === 'object' ? opts : {};
        const silent = o.silent === true;
        const record = o.record === true;
        const a = action && typeof action === 'object' ? action : null;
        if (!a) return false;
        const t = typeof a.type === 'string' ? a.type : '';
        const p = a.payload && typeof a.payload === 'object' ? a.payload : {};
        const deltaKey = typeof a.deltaKey === 'string' && a.deltaKey.trim() ? a.deltaKey.trim() : null;

        if (t === 'move') return this._applyMove(p.mapName, { silent, deltaKey });
        if (t === 'hanging_start') {
            gameState.isHanging = true;
            if (deltaKey) gameState.lastMeta = { source: 'hanging_start', tick: (gameState.story && gameState.story.tick) || 0, payload: { deltaKey } };
            return true;
        }
        if (t === 'hanging_stop') {
            gameState.isHanging = false;
            if (deltaKey) gameState.lastMeta = { source: 'hanging_stop', tick: (gameState.story && gameState.story.tick) || 0, payload: { deltaKey } };
            return true;
        }
        if (t === 'tick') return this._runOneTickCore(deltaKey || (typeof gameState.makeDeltaKey === 'function' ? gameState.makeDeltaKey('tick') : 'tick#0'), { allowEventModal: false, stopOnLose: true });
        if (t === 'event_choice') return this._resolveEventImpl({ eventId: p.eventId, optionId: p.optionId }, { recordAction: record, deltaKeyOverride: deltaKey, silent });
        if (t === 'useItem') return this._useItemImpl(p.itemName, { recordAction: record, deltaKeyOverride: deltaKey, silent });
        if (t === 'breakthrough') return this._breakthroughImpl({ realm: p.realm, stage: p.stage }, { recordAction: record, deltaKeyOverride: deltaKey, silent });
        return false;
    },

    runUntilTick: function(targetTick, opts) {
        const o = opts && typeof opts === 'object' ? opts : {};
        const target = Number.isFinite(Number(targetTick)) ? Math.max(0, Math.floor(Number(targetTick))) : 0;
        if (typeof gameState.captureReplayBaseline === 'function' && !gameState._replayBaseline) gameState.captureReplayBaseline('runUntilTick');
        if (typeof gameState.restoreReplayBaseline === 'function') gameState.restoreReplayBaseline();

        this._stopHangingSilently();

        const replay = gameState.replay && typeof gameState.replay === 'object' ? gameState.replay : null;
        const actions = replay && Array.isArray(replay.actions) ? replay.actions : [];
        const savedReplayEnabled = replay && replay.enabled === true;
        if (replay) replay.enabled = false;

        const silent = true;
        for (let i = 0; i < actions.length; i++) {
            if (gameState.story && Number.isFinite(Number(gameState.story.tick)) && Math.floor(Number(gameState.story.tick)) >= target) break;
            this.applyReplayAction(actions[i], { record: false, silent });
        }

        if (replay) replay.enabled = savedReplayEnabled;

        if (o.render !== false && typeof UI !== 'undefined' && UI) {
            if (typeof UI.updateStatsUI === 'function') UI.updateStatsUI();
            if (typeof UI.renderMapList === 'function') UI.renderMapList();
            if (typeof UI.renderMapInfo === 'function') UI.renderMapInfo();
            if (typeof UI.renderLeftPanel === 'function') UI.renderLeftPanel();
            if (typeof UI.renderInventory === 'function') UI.renderInventory();
            if (typeof UI.updateHangingStatus === 'function') UI.updateHangingStatus();
        }

        const reached = gameState.story && Number.isFinite(Number(gameState.story.tick)) ? Math.floor(Number(gameState.story.tick)) : 0;
        return { ok: reached >= target, reachedTick: reached, targetTick: target };
    },

    // 3. 核心游戏循环
    gameLoop: function() {
        try {
            if (!gameState.isHanging) return;

            const holdUntil = Number(this._uiHoldUntilTs) || 0;
            if (holdUntil && Date.now() < holdUntil) return;
            
            // 如果遇到事件暂停
            if (gameState.settings.pauseOnEvent && document.getElementById('event-modal') && !document.getElementById('event-modal').classList.contains('hidden')) {
                return;
            }

            const kind = gameState.combat ? 'combat' : 'explore';
            const storyTick = gameState.story && typeof gameState.story.tick === 'number' ? gameState.story.tick : (Number(gameState.story && gameState.story.tick) || 0);
            const combatRound = gameState.combat && typeof gameState.combat.round === 'number' ? gameState.combat.round : (Number(gameState.combat && gameState.combat.round) || 0);
            const tickAction = (typeof gameState !== 'undefined' && gameState && typeof gameState.recordAction === 'function')
                ? gameState.recordAction('tick', { kind, storyTick, combatRound })
                : null;
            const tickDeltaKey = (tickAction && typeof tickAction.deltaKey === 'string' && tickAction.deltaKey.trim())
                ? tickAction.deltaKey
                : (typeof gameState.makeDeltaKey === 'function' ? gameState.makeDeltaKey('tick') : 'tick#0');
            const runRes = this._runOneTickCore(tickDeltaKey, { allowEventModal: true, stopOnLose: false });

            if (gameState && gameState.replay && gameState.replay.enabled === true && typeof gameState.hashSnapshot === 'function' && typeof gameState.snapshot === 'function') {
                const t = (gameState.story && Number.isFinite(Number(gameState.story.tick))) ? Math.floor(Number(gameState.story.tick)) : 0;
                if (!gameState.replay.expectedTickHashes || typeof gameState.replay.expectedTickHashes !== 'object') gameState.replay.expectedTickHashes = {};
                if (!gameState.replay.expectedTickDeltaKeys || typeof gameState.replay.expectedTickDeltaKeys !== 'object') gameState.replay.expectedTickDeltaKeys = {};
                if (!gameState.replay.expectedTickCore || typeof gameState.replay.expectedTickCore !== 'object') gameState.replay.expectedTickCore = {};
                try {
                    const h = gameState.hashSnapshot(gameState.snapshot());
                    gameState.replay.expectedTickHashes[String(t)] = h;
                    if (typeof tickDeltaKey === 'string' && tickDeltaKey.trim()) gameState.replay.expectedTickDeltaKeys[String(t)] = tickDeltaKey.trim();
                    if (typeof window !== 'undefined' && typeof window.getReplayCoreSnapshot === 'function') {
                        const core = window.getReplayCoreSnapshot(gameState);
                        if (core) gameState.replay.expectedTickCore[String(t)] = core;
                    }
                } catch (e) {
                }
            }

            if (runRes && runRes.paused === true) return;
            if (runRes && runRes.combatResult === 'lose') {
                this.requestStopHanging();
                return;
            }
        } catch (e) {
            console.error("Game Loop Critical Error:", e);
            this.requestStopHanging();
            if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') {
                UI.addLog(`游戏循环异常停止: ${e.message}`, 'sys');
            }
            alert(`游戏发生严重错误，已停止运行。\n错误信息: ${e.message}\n如果是 Replay 模式，可能是录像与当前逻辑不一致。`);
        }
    },

    // 4. 物品使用
    resolveEvent: function(payload) {
        this._resolveEventImpl(payload, { recordAction: true, silent: false });
    },

    requestUseItem: function(itemName) {
        this._useItemImpl(itemName, { recordAction: true, silent: false });
    },

    // 5. 请求突破
    requestBreakthrough: function() {
        if (gameState.exp < gameState.maxExp) {
            UI.addLog("修为不足，无法突破。", "sys");
            return;
        }
        const ev = (typeof Rules !== 'undefined' && Rules && typeof Rules.getEventById === 'function')
            ? Rules.getEventById('event_breakthrough_attempt_01')
            : null;
        if (!ev) {
            UI.addLog("突破事件未就绪。", "sys");
            return;
        }
        if (typeof UI !== 'undefined' && UI && typeof UI.showEventModal === 'function') UI.showEventModal(ev);
    },

    requestBreakthroughPrepare: function() {
        const ev = (typeof Rules !== 'undefined' && Rules && typeof Rules.getEventById === 'function')
            ? Rules.getEventById('event_breakthrough_prepare_01')
            : null;
        if (!ev) {
            if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog("破境准备事件未就绪。", "sys");
            return;
        }
        if (typeof UI !== 'undefined' && UI && typeof UI.showEventModal === 'function') UI.showEventModal(ev);
    },
    
    // 6. 触发事件 (Debug/Test)
    requestTriggerEvent: function() {
        const events = (typeof GameData !== 'undefined' && GameData && Array.isArray(GameData.events)) ? GameData.events : [];
        if (!events.length) {
            UI.addLog("暂无可用事件。", "sys");
            return;
        }
        const storyFlags = (gameState.story && typeof gameState.story === 'object' && gameState.story.flags && typeof gameState.story.flags === 'object') ? gameState.story.flags : {};
        const world = gameState.world && typeof gameState.world === 'object' ? gameState.world : null;
        const candidates = events.filter(e => e && typeof e.id === 'string' && !e.id.startsWith('story_'));
        const available = (typeof Rules !== 'undefined' && Rules && typeof Rules.isEventAvailable === 'function')
            ? candidates.filter(e => Rules.isEventAvailable(e, world))
            : candidates.slice();
        if (!available.length) {
            UI.addLog("暂无可用事件。", "sys");
            return;
        }
        const weights = available.map(e => {
            const w = (typeof Rules !== 'undefined' && Rules && typeof Rules.getEventWeight === 'function')
                ? Number(Rules.getEventWeight(e, storyFlags, world))
                : 1;
            return Number.isFinite(w) && w > 0 ? w : 0;
        });
        const sum = weights.reduce((a, b) => a + b, 0);
        gameState._lastRngConsumerTag = 'debug.event.pick';
        const r = sum > 0 ? (gameState.rng() * sum) : (gameState.rng() * available.length);
        let pick = available[0];
        if (sum > 0) {
            let acc = 0;
            for (let i = 0; i < available.length; i++) {
                acc += weights[i];
                if (r <= acc) { pick = available[i]; break; }
            }
        } else {
            gameState._lastRngConsumerTag = 'debug.event.pick';
            pick = available[Math.floor(r)] || available[0];
        }
        if (typeof UI !== 'undefined' && UI && typeof UI.showEventModal === 'function') UI.showEventModal(pick);
    }
};

if (typeof window !== 'undefined') {
    window.Logic = Logic;
}
