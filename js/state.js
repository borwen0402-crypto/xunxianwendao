/**
 * 游戏全局状态管理
 * 包含：玩家数据、存档/读档逻辑
 */

const gameState = {
    // === 玩家基础信息 ===
    username: "",
    race: "人族", // 种族
    rng: (() => {
        let st = 1;
        return () => {
            st = st % 2147483647;
            if (st <= 0) st += 2147483646;
            st = (st * 48271) % 2147483647;
            return (st - 1) / 2147483646;
        };
    })(),
    rngSeed: null,
    _rngState: null,
    _deltaSeq: 0,

    makeDeltaKey: function(source) {
        const s = typeof source === 'string' && source.trim() ? source.trim() : 'delta';
        this._deltaSeq = (Number(this._deltaSeq) || 0) + 1;
        return `${s}#${this._deltaSeq}`;
    },

    createSeededRng: function(seed) {
        let s = seed % 2147483647;
        if (s <= 0) s += 2147483646;
        return function() {
            s = (s * 48271) % 2147483647;
            return (s - 1) / 2147483646;
        };
    },

    seedRng: function(seed) {
        const raw = Number(seed);
        let s = Number.isFinite(raw) ? Math.floor(raw) : 0;
        s = s % 2147483647;
        if (s <= 0) s += 2147483646;
        this.rngSeed = s;
        this._rngState = s;
        this.rng = () => {
            let st = Number(this._rngState) || 1;
            st = st % 2147483647;
            if (st <= 0) st += 2147483646;
            st = (st * 48271) % 2147483647;
            this._rngState = st;
            return (st - 1) / 2147483646;
        };
        return s;
    },

    snapshot: function() {
        const map = this.currentMap && typeof this.currentMap === 'object' ? this.currentMap : null;
        const wt = this.world && typeof this.world === 'object' && this.world.tendencies && typeof this.world.tendencies === 'object'
            ? { order: Number(this.world.tendencies.order) || 0, chaos: Number(this.world.tendencies.chaos) || 0, omen: Number(this.world.tendencies.omen) || 0 }
            : { order: 0, chaos: 0, omen: 0 };
        return {
            username: this.username,
            race: this.race,
            hp: this.hp,
            mp: this.mp,
            maxHp: this.maxHp,
            maxMp: this.maxMp,
            exp: this.exp,
            maxExp: this.maxExp,
            realm: this.realm,
            stage: this.stage,
            level: this.level,
            activeDao: this.activeDao,
            daoType: this.daoType ?? null,
            daoBranch: this.daoBranch ?? null,
            daoLocked: this.daoLocked === true,
            ghosts: Array.isArray(this.ghosts) ? this.ghosts : [],
            soulUrn: (this.soulUrn && typeof this.soulUrn === 'object') ? this.soulUrn : null,
            mapStates: (this.mapStates && typeof this.mapStates === 'object') ? this.mapStates : null,
            currentMap: map && typeof map.id === 'string' ? { id: map.id, env: map.env, difficulty: map.difficulty } : null,
            world: { tendencies: wt },
            _deltaSeq: this._deltaSeq
        };
    },

    stableStringify: function(value) {
        const seen = new WeakSet();
        const encode = (v) => {
            if (v === null) return 'null';
            const t = typeof v;
            if (t === 'number') return Number.isFinite(v) ? String(v) : 'null';
            if (t === 'string') return JSON.stringify(v);
            if (t === 'boolean') return v ? 'true' : 'false';
            if (t === 'undefined' || t === 'function') return 'null';
            if (Array.isArray(v)) return '[' + v.map(encode).join(',') + ']';
            if (t === 'object') {
                if (seen.has(v)) return 'null';
                seen.add(v);
                const keys = Object.keys(v).sort();
                const parts = [];
                for (let i = 0; i < keys.length; i++) {
                    const k = keys[i];
                    const vv = v[k];
                    if (typeof vv === 'function' || typeof vv === 'undefined') continue;
                    parts.push(JSON.stringify(k) + ':' + encode(vv));
                }
                return '{' + parts.join(',') + '}';
            }
            return 'null';
        };
        return encode(value);
    },

    hashFNV1a32: function(str) {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return ('00000000' + (h >>> 0).toString(16)).slice(-8);
    },

    hashSnapshot: function(snapshot) {
        return this.hashFNV1a32(this.stableStringify(snapshot));
    },

    verifyConsistency: function(rounds = 5) {
        if (typeof Rules === 'undefined' || typeof Rules.processExploration !== 'function') {
            console.error("[Consistency] Rules not available.");
            return false;
        }
        const seed = 123456;
        const originalRng = this.rng;

        const backupState = JSON.stringify(this, (k, v) => {
            if (typeof v === 'function') return undefined;
            if (k === 'rng') return undefined;
            return v;
        });

        const runSimulation = (seed0) => {
            const data = JSON.parse(backupState);
            Object.assign(this, data);
            this.rng = this.createSeededRng(seed0);

            const hashes = [];
            for (let i = 0; i < rounds; i++) {
                Rules.processExploration();
                hashes.push(this.hashSnapshot(this.snapshot()));
            }
            return hashes;
        };

        const a = runSimulation(seed);
        const b = runSimulation(seed);

        const restore = JSON.parse(backupState);
        Object.assign(this, restore);
        this.rng = originalRng;

        let consistent = (a.length === b.length);
        if (consistent) {
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) {
                    consistent = false;
                    console.error(`[Consistency] Mismatch at round ${i + 1}: ${a[i]} !== ${b[i]}`);
                    break;
                }
            }
        }
        console.log(`[Consistency] Result: ${consistent ? 'PASS' : 'FAIL'}`);
        return consistent;
    },

    replay: {
        enabled: false,
        seq: 0,
        seed: null,
        actions: [],
        lastAction: null
    },

    /**
     * Replay Action Schema (V2.0 Freeze)
     * 
     * Actions recorded in gameState.replay.actions must follow this schema:
     * {
     *   seq: number,           // Monotonically increasing sequence number (1-based)
     *   type: string,          // Action type (e.g., 'move', 'combat_start', 'event_choice')
     *   payload: object,       // JSON-serializable parameters (NO circular refs, NO functions)
     *   deltaKey: string       // Unique ID for state transition traceability
     * }
     * 
     * Constraints:
     * - Immutable once recorded.
     * - Must be sufficient to reproduce the state transition deterministically given the same RNG seed.
     * - Payload must not contain circular references or non-serializable objects (functions, etc.).
     */
    recordAction: function(type, payload, meta) {
        if (!this.replay || this.replay.enabled !== true) return null;
        const t = typeof type === 'string' && type.trim() ? type.trim() : 'action';
        const p = payload && typeof payload === 'object' ? payload : {};
        const m = meta && typeof meta === 'object' ? meta : {};
        const action = {
            seq: (Number(this.replay.seq) || 0) + 1,
            type: t,
            payload: JSON.parse(JSON.stringify(p)),
            deltaKey: typeof m.deltaKey === 'string' && m.deltaKey.trim() ? m.deltaKey.trim() : (typeof this.makeDeltaKey === 'function' ? this.makeDeltaKey(`Action:${t}`) : null)
        };
        this.replay.seq = action.seq;
        this.replay.lastAction = action;
        if (Array.isArray(this.replay.actions)) this.replay.actions.push(action);
        return action;
    },

    setReplayEnabled: function(enabled, seed) {
        if (!this.replay || typeof this.replay !== 'object') this.replay = { enabled: false, seq: 0, seed: null, actions: [], lastAction: null };
        this.replay.enabled = enabled === true;
        if (seed !== undefined) this.replay.seed = seed;
        if (this.replay.enabled) {
            if (!Array.isArray(this.replay.actions)) this.replay.actions = [];
            if (!this._replayBaseline) this.captureReplayBaseline('setReplayEnabled');
        }
        return this.replay.enabled;
    },

    _replayBaseline: null,

    captureReplayBaseline: function(reason) {
        const deepClone = (v) => JSON.parse(JSON.stringify(v ?? null));
        const mapName = this.currentMap && typeof this.currentMap === 'object' ? (this.currentMap.name ?? null) : null;
        const baseline = {
            reason: typeof reason === 'string' ? reason : null,
            username: this.username ?? "",
            race: this.race ?? "人族",
            rngSeed: Number.isFinite(Number(this.rngSeed)) ? Number(this.rngSeed) : null,
            _rngState: Number.isFinite(Number(this._rngState)) ? Number(this._rngState) : null,
            _deltaSeq: Number.isFinite(Number(this._deltaSeq)) ? Number(this._deltaSeq) : 0,
            hp: Number(this.hp) || 0,
            maxHp: Number(this.maxHp) || 0,
            mp: Number(this.mp) || 0,
            maxMp: Number(this.maxMp) || 0,
            exp: Number(this.exp) || 0,
            maxExp: Number(this.maxExp) || 0,
            atk: Number(this.atk) || 0,
            matk: Number(this.matk) || 0,
            speed: Number(this.speed) || 10,
            attributePoints: Number(this.attributePoints) || 0,
            allocatedStats: deepClone(this.allocatedStats && typeof this.allocatedStats === 'object' ? this.allocatedStats : { atk: 0, matk: 0, hp: 0, mp: 0, speed: 0 }),
            realm: this.realm ?? "凡人",
            subRealm: this.subRealm ?? "前期",
            stage: this.stage ?? "锻炼期",
            level: Number(this.level) || 1,
            isOrthodox: this.isOrthodox === true,
            currentMapName: typeof mapName === 'string' ? mapName : null,
            environmentTag: this.environmentTag ?? "凡俗",
            activeDao: this.activeDao ?? "随机",
            daoAffinity: deepClone(this.daoAffinity && typeof this.daoAffinity === 'object' ? this.daoAffinity : {}),
            inventory: deepClone(this.inventory && typeof this.inventory === 'object' ? this.inventory : {}),
            settings: deepClone(this.settings && typeof this.settings === 'object' ? this.settings : { pauseOnEvent: true }),
            story: deepClone(this.story && typeof this.story === 'object' ? this.story : {}),
            world: deepClone(this.world && typeof this.world === 'object' ? this.world : { tendencies: { order: 0, chaos: 0, omen: 0 } })
        };
        this._replayBaseline = baseline;
        return baseline;
    },

    restoreReplayBaseline: function() {
        const b = this._replayBaseline && typeof this._replayBaseline === 'object' ? this._replayBaseline : null;
        if (!b) return false;

        this.username = b.username ?? "";
        this.race = b.race ?? "人族";

        this.hp = Number(b.hp) || 0;
        this.maxHp = Number(b.maxHp) || 0;
        this.mp = Number(b.mp) || 0;
        this.maxMp = Number(b.maxMp) || 0;
        this.exp = Number(b.exp) || 0;
        this.maxExp = Number(b.maxExp) || 0;
        this.atk = Number(b.atk) || 0;
        this.matk = Number(b.matk) || 0;
        this.speed = Number(b.speed) || 10;
        this.attributePoints = Number(b.attributePoints) || 0;
        this.allocatedStats = b.allocatedStats && typeof b.allocatedStats === 'object' ? JSON.parse(JSON.stringify(b.allocatedStats)) : { atk: 0, matk: 0, hp: 0, mp: 0, speed: 0 };

        this.realm = b.realm ?? "凡人";
        this.subRealm = b.subRealm ?? "前期";
        this.stage = b.stage ?? "凡人前期";
        this.level = Number(b.level) || 1;
        this.isOrthodox = b.isOrthodox === true;

        const mapName = typeof b.currentMapName === 'string' && b.currentMapName.trim() ? b.currentMapName.trim() : null;
        this.currentMap = (typeof GameData !== 'undefined' && GameData && GameData.mapConfig && mapName && GameData.mapConfig[mapName]) ? GameData.mapConfig[mapName] : null;
        this.environmentTag = b.environmentTag ?? "凡俗";
        this.activeDao = b.activeDao ?? "随机";

        this.daoAffinity = b.daoAffinity && typeof b.daoAffinity === 'object' ? JSON.parse(JSON.stringify(b.daoAffinity)) : {};
        this.inventory = b.inventory && typeof b.inventory === 'object' ? JSON.parse(JSON.stringify(b.inventory)) : {};
        this.settings = b.settings && typeof b.settings === 'object' ? JSON.parse(JSON.stringify(b.settings)) : { pauseOnEvent: true };
        this.story = b.story && typeof b.story === 'object' ? JSON.parse(JSON.stringify(b.story)) : {};
        this.world = b.world && typeof b.world === 'object' ? JSON.parse(JSON.stringify(b.world)) : { tendencies: { order: 0, chaos: 0, omen: 0 } };

        this.combat = null;

        this._deltaSeq = Number.isFinite(Number(b._deltaSeq)) ? Number(b._deltaSeq) : 0;

        const seed = Number.isFinite(Number(b.rngSeed)) ? Number(b.rngSeed) : null;
        const st0 = Number.isFinite(Number(b._rngState)) ? Number(b._rngState) : null;
        if (seed !== null) {
            this.rngSeed = seed;
            this._rngState = st0 !== null ? st0 : seed;
            this.rng = () => {
                let st = Number(this._rngState) || 1;
                st = st % 2147483647;
                if (st <= 0) st += 2147483646;
                st = (st * 48271) % 2147483647;
                this._rngState = st;
                return (st - 1) / 2147483646;
            };
        }
        return true;
    },
    
    // === 核心属性 ===
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    exp: 0,
    maxExp: 100,
    atk: 10,
    matk: 10,
    speed: 10,
    attributePoints: 0, // 自由属性点
    allocatedStats: { atk: 0, matk: 0, hp: 0, mp: 0, speed: 0 }, // 已分配点数
    
    // === 境界信息 ===
    realm: "凡人",
    subRealm: "凡俗", // V1.4+
    stage: "凡人",
    level: 1,
    isOrthodox: false, // 是否正统
    
    // === 位置与状态 ===
    currentMap: null, 
    mapStates: {},
    environmentTag: "凡俗",
    activeDao: "随机",
    daoType: null,
    daoBranch: null,
    daoLocked: false,
    daoAffinity: {}, // 道统亲和
    ghosts: [],
    soulUrn: { level: 1, capacity: 1, efficiency: 1, stability: 50 },
    inventory: {}, // 背包
    settings: { pauseOnEvent: true }, // 设置

    story: {
        chainId: null,
        day: 0,
        step: 0,
        tick: 0,
        nextAtTick: 0,
        nextEventId: null,
        flags: {},
        completed: false
    },

    world: {
        tendencies: { order: 0, chaos: 0, omen: 0 }
    },
    
    // === 存档系统 ===
    save: function() {
        if (!this.username) return;
        const data = {
            version: '2.0',
            username: this.username,
            hp: this.hp,
            maxHp: this.maxHp,
            mp: this.mp,
            maxMp: this.maxMp,
            exp: this.exp,
            maxExp: this.maxExp,
            atk: this.atk,
            matk: this.matk,
            speed: this.speed,
            attributePoints: this.attributePoints,
            allocatedStats: this.allocatedStats,
            realm: this.realm,
            subRealm: this.subRealm,
            stage: this.stage,
            level: this.level,
            isOrthodox: this.isOrthodox,
            currentMap: this.currentMap,
            mapStates: this.mapStates,
            environmentTag: this.environmentTag,
            activeDao: this.activeDao,
            daoType: this.daoType ?? null,
            daoBranch: this.daoBranch ?? null,
            daoLocked: this.daoLocked === true,
            daoAffinity: this.daoAffinity,
            ghosts: this.ghosts,
            soulUrn: this.soulUrn,
            inventory: this.inventory,
            settings: this.settings,
            story: this.story,
            world: this.world,
            rngSeed: this.rngSeed,
            _rngState: this._rngState,
            replay: (this.replay && typeof this.replay === 'object')
                ? {
                    enabled: this.replay.enabled === true,
                    seq: Number(this.replay.seq) || 0,
                    seed: this.replay.seed ?? null,
                    actions: Array.isArray(this.replay.actions) && this.replay.actions.length <= 500 ? this.replay.actions : []
                }
                : undefined
        };
        try {
            localStorage.setItem(`cultivation_save_${this.username}`, JSON.stringify(data));
        } catch (e) {
            console.error("Save failed:", e);
        }
    },
    
    load: function(username) {
        const key = `cultivation_save_${username}`;
        const dataStr = localStorage.getItem(key);
        if (dataStr) {
            try {
                const data = JSON.parse(dataStr);
                Object.assign(this, data);
                
                // 兼容性修复：确保核心对象存在
                if (!this.inventory || typeof this.inventory !== 'object') this.inventory = {};
                if (!this.daoAffinity || typeof this.daoAffinity !== 'object') this.daoAffinity = {};
                if (!this.settings) this.settings = { pauseOnEvent: true };
                if (!this.world || typeof this.world !== 'object') this.world = { tendencies: { order: 0, chaos: 0, omen: 0 } };
                if (!this.world.tendencies || typeof this.world.tendencies !== 'object') this.world.tendencies = { order: 0, chaos: 0, omen: 0 };
                if (!Object.prototype.hasOwnProperty.call(this, 'daoType')) this.daoType = null;
                if (!Object.prototype.hasOwnProperty.call(this, 'daoBranch')) this.daoBranch = null;
                this.daoLocked = this.daoLocked === true;
                if (!Array.isArray(this.ghosts)) this.ghosts = [];
                if (!this.soulUrn || typeof this.soulUrn !== 'object') this.soulUrn = { level: 1, capacity: 1, efficiency: 1, stability: 50 };
                if (!this.mapStates || typeof this.mapStates !== 'object') this.mapStates = {};
                if (!this.replay || typeof this.replay !== 'object') this.replay = { enabled: false, seq: 0, seed: null, actions: [], lastAction: null };
                if (!Array.isArray(this.replay.actions)) this.replay.actions = [];
                this.replay.enabled = this.replay.enabled === true;
                this.replay.seq = Number(this.replay.seq) || 0;
                this.replay.lastAction = null;
                const wt = this.world.tendencies;
                const clamp = (v) => {
                    const n = Number(v);
                    if (!Number.isFinite(n)) return 0;
                    return Math.max(-5, Math.min(5, Math.trunc(n)));
                };
                wt.order = clamp(wt.order);
                wt.chaos = clamp(wt.chaos);
                wt.omen = clamp(wt.omen);

                const seed = Number(this.rngSeed);
                const st = Number(this._rngState);
                if (Number.isFinite(seed) && Number.isFinite(st) && seed > 0 && st > 0) {
                    this.rngSeed = Math.floor(seed);
                    this._rngState = Math.floor(st);
                    this.rng = () => {
                        let st = Number(this._rngState) || 1;
                        st = st % 2147483647;
                        if (st <= 0) st += 2147483646;
                        st = (st * 48271) % 2147483647;
                        this._rngState = st;
                        return (st - 1) / 2147483646;
                    };
                } else {
                    this.rngSeed = null;
                    this._rngState = null;
                    if (typeof this.rng !== 'function') this.rng = this.createSeededRng(1);
                }
                
                // V2.33 迁移：悟道旧档迁移到悟道初期
                if (this.realm === "悟道" && this.stage === "悟道") {
                     this.stage = "悟道初期";
                     this.subRealm = "初期";
                     // 调整数值以匹配新基准，避免卡死
                     if (this.maxExp === 100000) this.maxExp = 70000;
                }
                
                this.username = username;
                UI.addLog(`欢迎回来，${username}。`, "sys");
                return true;
            } catch (e) {
                console.error("Load failed:", e);
            }
        }
        return false;
    },

    applyWorldUpdate: function(update, meta) {
        const u = update && typeof update === 'object' ? update : null;
        if (!u) return;

        const m = meta && typeof meta === 'object' ? meta : {};
        const source = typeof m.source === 'string' && m.source.trim() ? m.source.trim() : 'World';
        const deltaKey = typeof m.deltaKey === 'string' && m.deltaKey.trim() ? m.deltaKey.trim() : this.makeDeltaKey(source);

        if (!this.world || typeof this.world !== 'object') this.world = {};
        if (!this.world.tendencies || typeof this.world.tendencies !== 'object') this.world.tendencies = { order: 0, chaos: 0, omen: 0 };
        const t = this.world.tendencies;
        const before = { order: Number(t.order) || 0, chaos: Number(t.chaos) || 0, omen: Number(t.omen) || 0 };

        const clamp = (v) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return null;
            return Math.max(-5, Math.min(5, Math.trunc(n)));
        };

        const applySet = (src) => {
            if (!src || typeof src !== 'object') return;
            if (Object.prototype.hasOwnProperty.call(src, 'order')) {
                const v = clamp(src.order);
                if (v !== null) t.order = v;
            }
            if (Object.prototype.hasOwnProperty.call(src, 'chaos')) {
                const v = clamp(src.chaos);
                if (v !== null) t.chaos = v;
            }
            if (Object.prototype.hasOwnProperty.call(src, 'omen')) {
                const v = clamp(src.omen);
                if (v !== null) t.omen = v;
            }
        };

        const applyDelta = (src) => {
            if (!src || typeof src !== 'object') return;
            if (Object.prototype.hasOwnProperty.call(src, 'order')) {
                const dv = clamp(src.order);
                if (dv !== null) t.order = Math.max(-5, Math.min(5, Math.trunc((Number(t.order) || 0) + dv)));
            }
            if (Object.prototype.hasOwnProperty.call(src, 'chaos')) {
                const dv = clamp(src.chaos);
                if (dv !== null) t.chaos = Math.max(-5, Math.min(5, Math.trunc((Number(t.chaos) || 0) + dv)));
            }
            if (Object.prototype.hasOwnProperty.call(src, 'omen')) {
                const dv = clamp(src.omen);
                if (dv !== null) t.omen = Math.max(-5, Math.min(5, Math.trunc((Number(t.omen) || 0) + dv)));
            }
        };

        if (u.tendencies && typeof u.tendencies === 'object') applySet(u.tendencies);
        if (u.tendenciesDelta && typeof u.tendenciesDelta === 'object') applyDelta(u.tendenciesDelta);

        const after = { order: Number(t.order) || 0, chaos: Number(t.chaos) || 0, omen: Number(t.omen) || 0 };
        this.lastWorldMeta = { deltaKey, source, tendencies: { ...after } };
        this.lastMeta = { source, tick: (this.story && this.story.tick) || 0, payload: { tendencies: { ...after } } };

        const crossedUp = (b, a) => b < 3 && a >= 3;
        const crossedDown = (b, a) => b > -3 && a <= -3;
        const emit = (text) => {
            if (typeof UI !== 'undefined' && UI && typeof UI.addLog === 'function') UI.addLog(text, 'sys');
        };

        if (crossedUp(before.chaos, after.chaos) || crossedDown(before.chaos, after.chaos)) {
            emit('近来天地气机，似有躁动。');
        } else if (crossedUp(before.omen, after.omen) || crossedDown(before.omen, after.omen)) {
            emit('夜里风声多了些不该有的音节。');
        } else if (crossedUp(before.order, after.order) || crossedDown(before.order, after.order)) {
            emit('近来门规似更森严了些。');
        }
    },

    applyStoryUpdate: function(update, meta) {
        const u = update && typeof update === 'object' ? update : null;
        if (!u) return;

        const m = meta && typeof meta === 'object' ? meta : {};
        const source = typeof m.source === 'string' && m.source.trim() ? m.source.trim() : 'Story';
        const deltaKey = typeof m.deltaKey === 'string' && m.deltaKey.trim() ? m.deltaKey.trim() : this.makeDeltaKey(source);

        if (!this.story || typeof this.story !== 'object') this.story = {};
        const s = this.story;

        if (typeof u.chainId === 'string') s.chainId = u.chainId;
        if (typeof u.dayDelta === 'number' && Number.isFinite(u.dayDelta)) s.day = Math.max(0, (Number(s.day) || 0) + Math.floor(u.dayDelta));
        if (typeof u.stepDelta === 'number' && Number.isFinite(u.stepDelta)) s.step = Math.max(0, (Number(s.step) || 0) + Math.floor(u.stepDelta));
        if (typeof u.step === 'number' && Number.isFinite(u.step)) s.step = Math.max(0, Math.floor(u.step));
        if (typeof u.day === 'number' && Number.isFinite(u.day)) s.day = Math.max(0, Math.floor(u.day));
        if (typeof u.tickDelta === 'number' && Number.isFinite(u.tickDelta)) s.tick = Math.max(0, (Number(s.tick) || 0) + Math.floor(u.tickDelta));
        if (typeof u.tick === 'number' && Number.isFinite(u.tick)) s.tick = Math.max(0, Math.floor(u.tick));

        const delayTicks = (typeof u.delayTicks === 'number' && Number.isFinite(u.delayTicks)) ? Math.max(0, Math.floor(u.delayTicks)) : null;
        if (delayTicks !== null) s.nextAtTick = Math.max(0, (Number(s.tick) || 0) + delayTicks);

        if (Object.prototype.hasOwnProperty.call(u, 'nextEventId')) {
            s.nextEventId = (typeof u.nextEventId === 'string' && u.nextEventId.trim()) ? u.nextEventId.trim() : null;
        }

        if (!s.flags || typeof s.flags !== 'object') s.flags = {};
        if (u.setFlags && typeof u.setFlags === 'object') {
            Object.keys(u.setFlags).forEach(k => {
                if (!k) return;
                const v = u.setFlags[k];
                if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string' || v === null) s.flags[k] = v;
            });
        }
        if (u.setFlags && typeof u.setFlags === 'object') {
            const f = u.setFlags;
            const nextDaoType = (typeof f.daoType === 'string' && f.daoType.trim()) ? f.daoType.trim() : null;
            const nextDaoBranch = (typeof f.daoBranch === 'string' && f.daoBranch.trim()) ? f.daoBranch.trim() : null;
            const nextDaoLocked = f.daoLocked === true;
            if (nextDaoType && this.daoLocked !== true) {
                this.daoType = nextDaoType;
                this.activeDao = nextDaoType;
            }
            if (nextDaoBranch && this.daoLocked !== true) {
                this.daoBranch = nextDaoBranch;
            }
            if (nextDaoLocked) {
                this.daoLocked = true;
            }
        }

        if (u.complete === true) {
            s.completed = true;
            s.nextEventId = null;
        }

        this.lastStoryMeta = { deltaKey, source, chainId: s.chainId || null, day: s.day, step: s.step, nextAtTick: s.nextAtTick, nextEventId: s.nextEventId };
        this.lastMeta = { source, tick: s.tick, payload: { chainId: s.chainId || null, day: s.day, step: s.step, nextEventId: s.nextEventId } };
    },

    applyPlayerDelta: function(delta, meta) {
        if (!delta || typeof delta !== 'object') return;

        const m = meta && typeof meta === 'object' ? meta : {};
        const source = typeof m.source === 'string' && m.source.trim() ? m.source.trim() : 'applyPlayerDelta';
        const rule = typeof m.rule === 'string' && m.rule.trim() ? m.rule.trim() : null;
        const deltaKey = typeof m.deltaKey === 'string' && m.deltaKey.trim() ? m.deltaKey.trim() : this.makeDeltaKey(source);
        this.lastDeltaMeta = { deltaKey, source, rule, keys: Object.keys(delta) };
        this.lastMeta = { source, tick: (this.story && this.story.tick) || 0, payload: delta };

        const isFiniteNumber = (v) => {
            if (v === undefined || v === null) return true;
            const n = Number(v);
            return Number.isFinite(n) && !Number.isNaN(n);
        };

        const numericKeys = ['playerHp', 'playerMp', 'expDelta', 'maxHpDelta', 'maxMpDelta'];
        for (let i = 0; i < numericKeys.length; i++) {
            const k = numericKeys[i];
            if (!Object.prototype.hasOwnProperty.call(delta, k)) continue;
            if (!isFiniteNumber(delta[k])) {
                const srcLabel = rule ? `${source}(${rule})` : source;
                const msg = `[系统警告] 状态更新被拦截: ${deltaKey} ${srcLabel} 非法数值 ${k}=${delta[k]}`;
                console.error(msg, delta);
                if (typeof UI !== 'undefined' && typeof UI.addLog === 'function') UI.addLog(msg, 'sys');
                return;
            }
        }

        const deltaHp = Number(delta.playerHp) || 0;
        const deltaMp = Number(delta.playerMp) || 0;
        const deltaExp = Number(delta.expDelta) || 0;
        const deltaMaxHp = Number(delta.maxHpDelta) || 0;
        const deltaMaxMp = Number(delta.maxMpDelta) || 0;

        if (deltaMaxHp !== 0) this.maxHp = Math.max(1, this.maxHp + deltaMaxHp);
        if (deltaMaxMp !== 0) this.maxMp = Math.max(1, this.maxMp + deltaMaxMp);

        if (deltaHp !== 0) this.hp = Math.min(this.maxHp, Math.max(0, this.hp + deltaHp));
        if (deltaMp !== 0) this.mp = Math.min(this.maxMp, Math.max(0, this.mp + deltaMp));
        
        if (deltaExp !== 0) {
            this.exp = Math.max(0, this.exp + deltaExp);
        }
    },

    // V2.0 境界突破专用状态变更 (原子化/校验)
    applyBreakthroughAdvance: function(nextConfig) {
        if (!nextConfig || typeof nextConfig !== 'object') return false;
        
        // 校验：必须是 GameData 配置中的有效项
        // (此处简化为存在性检查)
        if (!nextConfig.realm || !nextConfig.stage || !nextConfig.maxExp) {
             console.error("[Breakthrough] Invalid config:", nextConfig);
             return false;
        }

        // 应用变更
        const curExp = Number(this.exp) || 0;
        const curMax = Number(this.maxExp) || 0;
        const overflowExp = Math.max(0, curExp - curMax);
        console.log(`[Breakthrough] ${this.realm} -> ${nextConfig.realm}: Exp ${curExp}/${curMax} -> Overflow ${overflowExp}`);

        this.realm = nextConfig.realm;
        this.stage = nextConfig.stage;
        this.subRealm = nextConfig.subRealm || ""; // V1.6+ 支持子境界
        this.maxExp = nextConfig.maxExp;
        this.exp = overflowExp; // 突破后保留溢出经验
        
        // 属性加成 (如果有)
        if (nextConfig.hpBonus) {
            this.maxHp += nextConfig.hpBonus;
            this.hp = this.maxHp; // 突破回满血
        }
        if (nextConfig.atkBonus) {
            this.atk += nextConfig.atkBonus;
        }
        if (nextConfig.matkBonus) {
            this.matk = (this.matk || 0) + nextConfig.matkBonus;
        }
        if (this.daoType === '乾坤道') {
            this.atk = (Number(this.atk) || 0) + 2;
            this.maxHp = (Number(this.maxHp) || 0) + 10;
            this.hp = this.maxHp;
        }
        
        // V2.4 Attribute Points System
        this.attributePoints = (this.attributePoints || 0) + 1;
        
        this._deltaSeq++; // 增加版本号
        return true;
    },

    allocatePoint: function(statType) {
        if ((this.attributePoints || 0) <= 0) return false;
        
        // Initialize if missing
        if (!this.allocatedStats) this.allocatedStats = { atk: 0, matk: 0, hp: 0, mp: 0, speed: 0 };
        
        if (statType === 'atk') {
            this.atk = (this.atk || 0) + 1; // 1 point = 1 Atk
            this.allocatedStats.atk = (this.allocatedStats.atk || 0) + 1;
        } else if (statType === 'matk') {
            this.matk = (this.matk || 0) + 1; // 1 point = 1 Matk
            this.allocatedStats.matk = (this.allocatedStats.matk || 0) + 1;
        } else if (statType === 'hp') {
            this.maxHp = (this.maxHp || 0) + 10; // 1 point = 10 MaxHP
            this.hp = Math.min(this.maxHp, (this.hp || 0) + 10);
            this.allocatedStats.hp = (this.allocatedStats.hp || 0) + 1;
        } else if (statType === 'mp') {
            this.maxMp = (this.maxMp || 0) + 10; // 1 point = 10 MaxMP
            this.mp = Math.min(this.maxMp, (this.mp || 0) + 10);
            this.allocatedStats.mp = (this.allocatedStats.mp || 0) + 1;
        } else if (statType === 'speed') {
            this.speed = (this.speed || 10) + 1; // 1 point = 1 Speed
            this.allocatedStats.speed = (this.allocatedStats.speed || 0) + 1;
        } else {
            return false;
        }
        
        this.attributePoints--;
        this.save();
        return true;
    },

    getGhostCapacity: function() {
        const urn = this.soulUrn && typeof this.soulUrn === 'object' ? this.soulUrn : { level: 1, capacity: 1, efficiency: 1, stability: 50 };
        const baseCap = Number.isFinite(Number(urn.capacity)) ? Math.max(0, Math.floor(Number(urn.capacity))) : 0;
        const idx = (typeof GameData !== 'undefined' && GameData.realms && this.realm && GameData.realms[this.realm] && Number.isFinite(Number(GameData.realms[this.realm].index)))
            ? Math.max(1, Math.min(10, Math.floor(Number(GameData.realms[this.realm].index))))
            : 1;
        const realmBonus = idx >= 4 ? 2 : (idx >= 3 ? 1 : 0);
        return Math.max(0, baseCap + realmBonus);
    },

    addGhost: function(ghost) {
        if (!ghost || typeof ghost !== 'object') return false;
        if (!Array.isArray(this.ghosts)) this.ghosts = [];
        const cap = this.getGhostCapacity();
        if (cap > 0 && this.ghosts.length >= cap) return false;
        this.ghosts.push(ghost);
        return true;
    },

    tickGhosts: function(deltaKey) {
        if (!Array.isArray(this.ghosts) || !this.ghosts.length) return;
        const urn = this.soulUrn && typeof this.soulUrn === 'object' ? this.soulUrn : { level: 1, capacity: 1, efficiency: 1, stability: 50 };
        const eff = Number.isFinite(Number(urn.efficiency)) ? Math.max(0, Number(urn.efficiency)) : 1;
        const threshold = 100;
        for (let i = 0; i < this.ghosts.length; i++) {
            const g = this.ghosts[i];
            if (!g || typeof g !== 'object') continue;
            g.exp = Math.max(0, Math.floor(Number(g.exp) || 0) + Math.max(1, Math.floor(1 * eff)));
            if (g.exp < threshold) continue;
            const roll = (typeof this.rng === 'function') ? this.rng() : Math.random();
            if (roll < 0.25) {
                g.exp = 0;
                if (!this.story || typeof this.story !== 'object') this.story = { flags: {} };
                if (!this.story.flags || typeof this.story.flags !== 'object') this.story.flags = {};
                if (typeof this.story.nextEventId !== 'string' || !this.story.nextEventId) {
                    this.story.flags.ghost_fail_id = typeof g.id === 'string' ? g.id : null;
                    this.story.nextEventId = 'event_ghost_advance_fail_01';
                    this.story.nextAtTick = Math.max(0, Number(this.story.tick) || 0);
                }
            } else {
                const rank = typeof g.rank === 'string' ? g.rank : '厉鬼';
                g.rank = rank === '厉鬼' ? '鬼王' : (rank === '鬼王' ? '鬼皇' : rank);
                g.exp = 0;
            }
        }
        this.lastMeta = { source: 'tickGhosts', tick: (this.story && this.story.tick) || 0, payload: { deltaKey } };
    },
    
    // === 核心属性 ===

    getEventExport: function() {
        if (this.lastEventExport) return this.lastEventExport;
        return null;
    },

    applyCombatResult: function(result) {
        if (!result || !result.delta) return;

        const deltaHp = Number(result.delta.playerHp) || 0;
        const deltaMp = Number(result.delta.playerMp) || 0;
        const deltaMonsterHp = Number(result.delta.monsterHp) || 0;

        this.hp = (Number(this.hp) || 0) + deltaHp;
        this.mp = (Number(this.mp) || 0) + deltaMp;

        if (typeof this.maxHp === 'number') {
            this.hp = Math.min(this.maxHp, this.hp);
        }
        if (typeof this.maxMp === 'number') {
            this.mp = Math.min(this.maxMp, this.mp);
        }

        this.hp = Math.max(0, this.hp);
        this.mp = Math.max(0, this.mp);

        if (this.combat) {
            const monstersDelta = Array.isArray(result.delta.monsters) ? result.delta.monsters : null;
            if (monstersDelta && Array.isArray(this.combat.monsters) && this.combat.monsters.length) {
                for (let i = 0; i < monstersDelta.length; i++) {
                    const d = monstersDelta[i];
                    if (!d) continue;
                    const id = typeof d.id === 'string' ? d.id : null;
                    if (!id) continue;
                    const hpDelta = Number(d.hpDelta) || 0;
                    const target = this.combat.monsters.find(m => m && m.id === id);
                    if (target) {
                        target.hp = (Number(target.hp) || 0) + hpDelta;
                        target.hp = Math.max(0, target.hp);
                    }
                }
                if (this.combat.monster && typeof this.combat.monster.id === 'string') {
                    const found = this.combat.monsters.find(m => m && m.id === this.combat.monster.id);
                    if (found) this.combat.monster = found;
                } else if (this.combat.monsters.length) {
                    this.combat.monster = this.combat.monsters[0];
                }
            } else if (this.combat.monster) {
                this.combat.monster.hp = (Number(this.combat.monster.hp) || 0) + deltaMonsterHp;
                this.combat.monster.hp = Math.max(0, this.combat.monster.hp);
            }
        }

        if (Array.isArray(result.statusChanges) && this.combat) {
            this.applyStatusChanges(result.statusChanges);
        }

        if (Array.isArray(result.effects) && result.effects.length) {
            this.applyExternalEffects(result.effects);
        }

        if (result.flags && result.flags.seriousInjury) {
            this.hp = 1;
        }
    },

    applySubRealmAdvance: function(payload, meta) {
        if (!payload || typeof payload !== 'object') return false;

        const m = meta && typeof meta === 'object' ? meta : {};
        const source = typeof m.source === 'string' && m.source.trim() ? m.source.trim() : 'applySubRealmAdvance';
        const rule = typeof m.rule === 'string' && m.rule.trim() ? m.rule.trim() : null;
        const deltaKey = typeof m.deltaKey === 'string' && m.deltaKey.trim() ? m.deltaKey.trim() : this.makeDeltaKey(source);

        // Safety Check
        if (Object.prototype.hasOwnProperty.call(payload, 'expDelta')) {
             const v = payload.expDelta;
             if (v !== undefined && v !== null) {
                 const n = Number(v);
                 if (Number.isNaN(n) || !Number.isFinite(n)) {
                     const srcLabel = rule ? `${source}(${rule})` : source;
                     const msg = `[系统警告] 突破更新被拦截: ${deltaKey} ${srcLabel} 非法数值 expDelta=${v}`;
                     console.error(msg, payload);
                     if (typeof UI !== 'undefined' && typeof UI.addLog === 'function') UI.addLog(msg, 'sys');
                     return false;
                 }
             }
        }

        const nextSubRealm = typeof payload.nextSubRealm === 'string' ? payload.nextSubRealm : null;
        if (!nextSubRealm) return false;

        this.subRealm = nextSubRealm;
        const deltaExp = Number(payload.expDelta) || 0;
        if (deltaExp !== 0) this.exp = (Number(this.exp) || 0) + deltaExp;
        this.exp = Math.max(0, Number(this.exp) || 0);

        if (typeof this.updateStats === 'function') this.updateStats();
        if (payload.fullRecover) {
            this.hp = this.maxHp;
            this.mp = this.maxMp;
        }
        return true;
    },

    applyStatusChanges: function(statusChanges) {
        if (!Array.isArray(statusChanges) || !this.combat) return;

        for (let i = 0; i < statusChanges.length; i++) {
            const ch = statusChanges[i];
            if (!ch || typeof ch !== 'object') continue;
            const op = ch.op;
            const status = ch.status;
            if (!op) continue;

            let list = null;
            if (ch.target === 'player') {
                list = Array.isArray(this.combat.playerStatuses) ? this.combat.playerStatuses : (this.combat.playerStatuses = []);
            } else if (ch.target && typeof ch.target === 'object' && typeof ch.target.monsterId === 'string') {
                const m = Array.isArray(this.combat.monsters) ? this.combat.monsters.find(x => x && x.id === ch.target.monsterId) : null;
                if (m) list = Array.isArray(m.statuses) ? m.statuses : (m.statuses = []);
            }
            if (!list) continue;

            const key = status && typeof status === 'object'
                ? (typeof status.id === 'string' ? status.id : (typeof status.name === 'string' ? status.name : null))
                : null;

            const findIndex = () => {
                if (!key) return -1;
                for (let j = 0; j < list.length; j++) {
                    const s = list[j];
                    const sk = s && typeof s === 'object'
                        ? (typeof s.id === 'string' ? s.id : (typeof s.name === 'string' ? s.name : null))
                        : null;
                    if (sk && sk === key) return j;
                }
                return -1;
            };

            const idx = findIndex();
            if (op === 'add') {
                if (idx === -1 && status) list.push(status);
            } else if (op === 'remove' || op === 'expire') {
                if (idx !== -1) list.splice(idx, 1);
            } else if (op === 'refresh') {
                if (idx !== -1) list[idx] = status;
                else if (status) list.push(status);
            } else if (op === 'tick') {
                if (idx !== -1 && status) list[idx] = status;
            }
        }
    },

    applyExternalEffects: function(effects, meta) {
        if (!Array.isArray(effects) || !effects.length) return;
        const m = meta && typeof meta === 'object' ? meta : {};
        const source = typeof m.source === 'string' && m.source.trim() ? m.source.trim() : 'applyExternalEffects';
        const rule = typeof m.rule === 'string' && m.rule.trim() ? m.rule.trim() : null;
        const deltaKey = typeof m.deltaKey === 'string' && m.deltaKey.trim() ? m.deltaKey.trim() : (typeof this.makeDeltaKey === 'function' ? this.makeDeltaKey(source) : null);
        let applied = 0;

        for (let i = 0; i < effects.length; i++) {
            const ef = effects[i];
            if (!ef || typeof ef !== 'object') continue;
            const meta = ef.meta && typeof ef.meta === 'object' ? ef.meta : null;
            if (!meta || meta.external !== true) continue;

            if (ef.target === 'ghosts') {
                const t = ef.type;
                if (!Array.isArray(this.ghosts)) this.ghosts = [];
                if (t === 'add' && ef.payload && typeof ef.payload === 'object') {
                    const cap = typeof this.getGhostCapacity === 'function' ? this.getGhostCapacity() : 0;
                    if (cap > 0 && this.ghosts.length >= cap) {
                        if (!this.inventory || typeof this.inventory !== 'object') this.inventory = {};
                        this.inventory['魂力碎片'] = (Number(this.inventory['魂力碎片']) || 0) + 1;
                    } else {
                        this.ghosts.push(ef.payload);
                    }
                    applied++;
                    continue;
                }
                if (t === 'healAll') {
                    const pct = Number(ef.value);
                    if (Number.isFinite(pct) && pct > 0) {
                        for (let gi = 0; gi < this.ghosts.length; gi++) {
                            const g = this.ghosts[gi];
                            if (!g || typeof g !== 'object') continue;
                            const maxHp = Number(g.maxHp) || 0;
                            if (maxHp <= 0) continue;
                            const heal = Math.max(0, Math.floor(maxHp * pct));
                            if (heal <= 0) continue;
                            g.hp = Math.max(0, Math.min(maxHp, (Number(g.hp) || 0) + heal));
                        }
                        applied++;
                    }
                    continue;
                }
            }

            if (ef.target === 'inventory' && ef.type === 'item' && ef.payload && typeof ef.payload === 'object') {
                const name = (typeof ef.payload.name === 'string' && ef.payload.name.trim()) ? ef.payload.name.trim() : null;
                const dv = Number(ef.payload.countDelta);
                if (name && Number.isFinite(dv) && dv !== 0) {
                    if (!this.inventory || typeof this.inventory !== 'object') this.inventory = {};
                    const next = (Number(this.inventory[name]) || 0) + Math.floor(dv);
                    if (next <= 0) delete this.inventory[name];
                    else this.inventory[name] = next;
                    applied++;
                }
                continue;
            }

            if (ef.target === 'mapState' && ef.type === 'invertYinYang' && ef.payload && typeof ef.payload === 'object') {
                const mapId = (typeof ef.payload.mapId === 'string' && ef.payload.mapId.trim()) ? ef.payload.mapId.trim() : null;
                if (mapId) {
                    if (!this.mapStates || typeof this.mapStates !== 'object') this.mapStates = {};
                    const cur = this.mapStates[mapId] && typeof this.mapStates[mapId] === 'object' ? this.mapStates[mapId] : {};
                    const yy0 = Number(cur.yinYang) || 0;
                    const yy1 = yy0 === 0 ? 1 : -yy0;
                    this.mapStates[mapId] = Object.assign({}, cur, { yinYang: yy1 });
                    applied++;
                }
                continue;
            }

            if (ef.target === 'world' && ef.type === 'tendenciesDelta' && ef.payload && typeof ef.payload === 'object') {
                if (typeof this.applyWorldUpdate === 'function') {
                    this.applyWorldUpdate({ tendenciesDelta: ef.payload }, { source, rule, deltaKey: deltaKey || undefined });
                    applied++;
                }
                continue;
            }

            const type = ef.type;
            const raw = Number(ef.value);
            if (!Number.isFinite(raw) || Number.isNaN(raw)) continue;
            const value = raw;
            if (value === 0) continue;
            if (ef.target === 'player') {
                if (type === 'hp') this.hp = Math.max(0, Math.min(this.maxHp, (Number(this.hp) || 0) + value));
                if (type === 'mp') this.mp = Math.max(0, Math.min(this.maxMp, (Number(this.mp) || 0) + value));
                if (type === 'exp') this.exp = Math.max(0, (Number(this.exp) || 0) + value);
                if (type === 'maxHp') {
                    this.maxHp = Math.max(1, (Number(this.maxHp) || 1) + value);
                    this.hp = Math.max(0, Math.min(this.maxHp, Number(this.hp) || 0));
                }
                if (type === 'maxMp') {
                    this.maxMp = Math.max(1, (Number(this.maxMp) || 1) + value);
                    this.mp = Math.max(0, Math.min(this.maxMp, Number(this.mp) || 0));
                }
                applied++;
            } else if (ef.target && typeof ef.target === 'object' && typeof ef.target.monsterId === 'string') {
                if (this.combat && Array.isArray(this.combat.monsters)) {
                     const m = this.combat.monsters.find(x => x && x.id === ef.target.monsterId);
                     if (m && type === 'hp') {
                         m.hp = Math.max(0, (Number(m.hp) || 0) + value);
                         applied++;
                     }
                }
            }
            
            // Stats tracking
            if (ef.source && ef.source.monsterId && ef.target === 'player' && this.behaviorStats) {
                const damage = -value;
                if (damage > 0) {
                     const tag = meta.kind === 'damage' ? 'dmg' : (meta.kind === 'skill' ? 'skill' : null);
                     if (tag === 'dmg') this.behaviorStats.dmgFromBasic = (Number(this.behaviorStats.dmgFromBasic) || 0) + damage;
                     else if (tag === 'skill') this.behaviorStats.dmgFromSkill = (Number(this.behaviorStats.dmgFromSkill) || 0) + damage;
                }
            }
        }
        if (applied > 0) {
            this.lastMeta = { source, tick: (this.story && this.story.tick) || 0, payload: { deltaKey, rule, applied } };
        }
    },

    /**
     * EventSystem Output Schema (V2.0 Freeze)
     * 
     * applyEventResult(eventResult) consumes this schema:
     * {
     *   result: 'success' | 'failure',
     *   delta: {                 // Inventory-only delta (no player numeric stats)
     *     inventoryDelta?: []
     *   },
     *   effects: [               // Numeric changes MUST go through external effects
     *     { target:'player', type:'hp'|'mp'|'exp'|'maxHp'|'maxMp', value:number, meta:{ external:true } },
     *     ...
     *   ],
     *   statusChanges: [],
     *   flags: {                 // State flag updates
     *     story: { ... },        // Narrative flags (mf_*, etc.)
     *     world: { ... }         // World tendency updates (Day 5 only)
     *   },
     *   logs: [],                // Narrative logs
     *   exported: {              // Replay/Debug snapshot
     *     eventType,
     *     eventId,
     *     optionId,
     *     deltaKey,
     *     source: 'EventSystem'
     *   }
     * }
     */
    applyEventResult: function(eventResult) {
        if (!eventResult || typeof eventResult !== 'object') return;
        const delta = eventResult.delta && typeof eventResult.delta === 'object' ? eventResult.delta : {};
        const exported = eventResult.exported && typeof eventResult.exported === 'object' ? eventResult.exported : null;
        const deltaKey = exported && typeof exported.deltaKey === 'string' ? exported.deltaKey : (eventResult.deltaKey || null);
        const eventId = exported && typeof exported.eventId === 'string' ? exported.eventId : null;
        const dk = typeof deltaKey === 'string' ? deltaKey : undefined;

        if (Array.isArray(delta.inventoryDelta) && delta.inventoryDelta.length) {
            const inv = this.inventory;
            for (let i = 0; i < delta.inventoryDelta.length; i++) {
                const it = delta.inventoryDelta[i];
                if (!it) continue;
                const name = typeof it.name === 'string' ? it.name : (typeof it.item === 'string' ? it.item : null);
                const n = Math.floor(Number(it.countDelta ?? it.delta ?? it.count) || 0);
                // ... [Logic to update inventory] ...
            }
        }

        if (Array.isArray(eventResult.statusChanges) && eventResult.statusChanges.length) {
            this.applyStatusChanges(eventResult.statusChanges);
        }

        if (Array.isArray(eventResult.effects) && eventResult.effects.length) {
            this.applyExternalEffects(eventResult.effects, { source: 'EventSystem', rule: eventId ? `Event:${eventId}` : null, deltaKey: dk });
        }

        if (eventResult.flags && typeof eventResult.flags === 'object' && eventResult.flags.story) {
            this.applyStoryUpdate(eventResult.flags.story, { source: 'EventSystem', deltaKey: dk });
        }

        if (eventResult.flags && typeof eventResult.flags === 'object' && eventResult.flags.world) {
            if (typeof this.applyWorldUpdate === 'function') {
                this.applyWorldUpdate(eventResult.flags.world, { source: 'EventSystem', deltaKey: dk });
            }
        }

        if (exported) this.lastEventExport = exported;
    }
    
    // ... [MISSING CODE LINES 542-862] ...
};

const HeartDemonSystem = {
    generateProfile: function(behaviorStats, player) {
        const stats = behaviorStats && typeof behaviorStats === 'object' ? behaviorStats : {};
        const uses = stats.skillUses && typeof stats.skillUses === 'object' ? stats.skillUses : {};
        const entries = Object.keys(uses).map(k => ({ name: k, w: Number(uses[k]) || 0 })).filter(x => x.w > 0);
        entries.sort((a, b) => b.w - a.w);
        const top = entries.slice(0, 4);

        let mimicSkills = top.map(x => ({ name: x.name, weight: x.w }));
        if (!mimicSkills.length && typeof GameData !== 'undefined' && GameData.skillConfig) {
            const dao = player && typeof player.activeDao === 'string' ? player.activeDao : "随机";
            const pool = (dao !== "随机" && Array.isArray(GameData.skillConfig[dao])) ? GameData.skillConfig[dao] : [];
            mimicSkills = pool.slice(0, 3).map(s => ({ name: s.name, weight: 1 }));
        }
        if (!mimicSkills.length) mimicSkills = [{ name: "控魂", weight: 1 }];

        const dmgSkill = Number(stats.dmgFromSkill) || 0;
        const dmgBasic = Number(stats.dmgFromBasic) || 0;
        const ratio = (dmgSkill + dmgBasic) > 0 ? (dmgSkill / (dmgSkill + dmgBasic)) : 0.5;
        const chainSteps = Number(stats.chainSteps) || 0;
        const chainFactor = chainSteps > 60 ? 1.15 : (chainSteps > 20 ? 1.05 : 1);
        
        // ... [MISSING PROFILE GENERATION LOGIC] ...
        return {
             mimicSkills,
             aggression: 1.0 // Placeholder
        };
    },
    
    determineBattlePhase: function(input) {
        // ... [Reconstructed from snippet] ...
        const round = input && typeof input.round === 'number' ? input.round : 0;
        const maxRound = input && typeof input.maxRound === 'number' ? input.maxRound : 60;
        const playerHpPct = typeof input && typeof input.playerHpPct === 'number' ? input.playerHpPct : 1;
        const monstersHpPct = typeof input && typeof input.monstersHpPct === 'number' ? input.monstersHpPct : 1;

        const executeByHp = monstersHpPct <= 0.2;
        const executeByRound = round >= Math.ceil(maxRound * 0.7);
        if (executeByHp || executeByRound) return 'execute';

        const pressureByRound = round >= 2 && round <= Math.floor(maxRound * 0.7);
        const pressureByHp = playerHpPct <= 0.8 || monstersHpPct <= 0.8;
        if (pressureByRound || pressureByHp) return 'pressure';

        return 'opening';
    },

    runHeartDemonEvent: function(context, rng, options) {
        const ctx = context && typeof context === 'object' ? context : {};
        const baseOpts = options && typeof options === 'object' ? options : {};
        const deltaKey = (typeof ctx.deltaKey === 'string' && ctx.deltaKey.trim())
            ? ctx.deltaKey.trim()
            : ((typeof baseOpts.deltaKey === 'string' && baseOpts.deltaKey.trim())
                ? baseOpts.deltaKey.trim()
                : (typeof gameState !== 'undefined' && gameState && typeof gameState.makeDeltaKey === 'function'
                    ? gameState.makeDeltaKey('HeartDemonSystem')
                    : 'HeartDemonSystem#0'));
        if (typeof rng !== 'function') {
            const logs = [{ type: 'sys', tag: 'rng_missing', text: '[HeartDemon] RNG missing: explicit failure.' }];
            const exported = { version: "V2.0", eventType: "heartDemon", deltaKey, source: 'HeartDemonSystem', error: 'RNG_REQUIRED', logs: logs.slice() };
            return { result: 'failure', delta: { playerHp: 0, playerMp: 0 }, logs, flags: { invalidRng: true }, statusChanges: [], effects: [], exported };
        }
        const random = rng;
        const player0 = ctx.player && typeof ctx.player === 'object' ? ctx.player : {};
        const env0 = ctx.env && typeof ctx.env === 'object' ? ctx.env : { mapId: "心魔", difficulty: 1 };
        const maxRounds = Math.max(1, Math.floor(Number(ctx.maxRounds) || 60));
        const effectLimitPerRound = Math.max(0, Math.floor(Number((baseOpts.effectLimitPerRound ?? ctx.effectLimitPerRound)) || 3));
        const maxStatusDuration = Math.max(1, Math.floor(Number((baseOpts.maxStatusDuration ?? ctx.maxStatusDuration)) || 3));
        if (baseOpts.maxStatusDuration !== undefined) {
             // Debug log to confirm parameter passing
             console.log(`[HeartDemon] maxStatusDuration set to ${maxStatusDuration} (req: ${baseOpts.maxStatusDuration})`);
        }

        const profile = ctx.demonProfile && typeof ctx.demonProfile === 'object'
            ? ctx.demonProfile
            : this.generateProfile(ctx.behaviorStats, player0);

        const maxHp = Math.max(1, Number(player0.maxHp) || 100);
        const maxMp = Math.max(0, Number(player0.maxMp) || 0);
        const baseAtk = Math.max(1, Number(player0.atk) || 10);
        const powerBudgetPerRound = (() => {
            const b = Number(baseOpts.powerBudgetPerRound ?? ctx.powerBudgetPerRound);
            if (Number.isFinite(b) && b > 0) return b;
            return Math.max(1, Math.floor(baseAtk * 1.1 + maxHp * 0.08));
        })();
        const demonHp = Math.max(1, Math.floor(maxHp * (0.95 + random() * 0.25)));
        const demonId = "hd1";

        const state = {
            player: {
                hp: Math.max(1, Number(player0.hp) || maxHp),
                mp: Math.max(0, Number(player0.mp) || maxMp),
                maxHp,
                maxMp,
                atk: baseAtk,
                realm: player0.realm || player0.realmStage || "寻道",
                subRealm: player0.subRealm || "初期",
                activeDao: player0.activeDao || "随机",
                statuses: Array.isArray(player0.statuses) ? player0.statuses.slice() : []
            },
            combat: {
                monsters: [{
                    id: demonId,
                    name: "心魔",
                    hp: demonHp,
                    maxHp: demonHp,
                    atk: 0,
                    dangerLevel: 1,
                    aiProfile: "heart_demon",
                    statuses: []
                }],
                activeTargetId: demonId,
                playerStatuses: Array.isArray(player0.statuses) ? player0.statuses.slice() : []
            }
        };

        const logs = [];
        const allStatusChanges = [];
        const allEffects = [];
        const flags = { heartDemonTriggered: true };

        const traceMeta = { deltaKey, source: 'HeartDemonSystem' };

        // Personality & Dialogue Mapping
        const btMethod = baseOpts.bt_method || ctx.bt_method || (ctx.story && ctx.story.flags ? ctx.story.flags.bt_method : 'normal');
        let derivedPersonality = 'balanced';
        if (btMethod === 'blood') derivedPersonality = 'aggressive';
        if (btMethod === 'celestial') derivedPersonality = 'control';

        const personalityRaw = (typeof baseOpts.personality === 'string' && baseOpts.personality.trim())
            ? baseOpts.personality.trim()
            : ((typeof ctx.personality === 'string' && ctx.personality.trim()) ? ctx.personality.trim() : derivedPersonality);
        const personality = ['balanced', 'aggressive', 'control', 'drain', 'trickster', 'mirror', 'greed'].includes(personalityRaw) ? personalityRaw : 'balanced';
        
        logs.push({ type: 'sys', tag: 'debug_heartdemon', text: `[HeartDemon] Personality: ${personality} (Method: ${btMethod})` });

        const dialogueSets = {
            balanced: {
                start: [
                    { speaker: 'sys', text: '灵台震荡，你的意识被强行拉入内景。' },
                    { speaker: 'narrator', text: '四周一片空寂，仿佛站在自己的影子里。' },
                    { speaker: 'demon', text: '……终于肯面对我了？' },
                    { speaker: 'demon', text: '你以为修行是在向前？不，你只是在逃。' }
                ],
                p1: [
                    { speaker: 'player', text: '你是什么东西？' },
                    { speaker: 'demon', text: '我是你不敢承认的部分。' },
                    { speaker: 'demon', text: '是你每一次犹豫、每一次退缩、每一次假装“顺其自然”。' },
                    { speaker: 'demon', text: '你嘴上说“稳扎稳打”，其实是怕失败。' },
                    { speaker: 'sys', text: '心魔发动【映心】——你的攻击被部分反噬。' }
                ],
                p2: [
                    { speaker: 'demon', text: '还记得那次机会吗？' },
                    { speaker: 'demon', text: '明明可以赌一把，你却选择了“等下次”。' },
                    { speaker: 'narrator', text: '心魔的身形逐渐清晰，与你的轮廓重合。' },
                    { speaker: 'demon', text: '你修的是道，还是安全感？' },
                    { speaker: 'sys', text: '心魔进入【共鸣】状态，你的灵力波动紊乱。' }
                ],
                p3: [
                    { speaker: 'player', text: '……闭嘴。' },
                    { speaker: 'demon', text: '我说错了吗？' },
                    { speaker: 'demon', text: '你害怕的不是我，是“如果拼尽全力，还是失败怎么办”。' },
                    { speaker: 'narrator', text: '你的意识开始崩裂，记忆碎片浮现。' },
                    { speaker: 'player', text: '我承认。' },
                    { speaker: 'player', text: '我怕过，也退过。' },
                    { speaker: 'player', text: '但我没有停下。' }
                ],
                final: [
                     { speaker: 'demon', text: '你杀了我，又能怎样？' },
                     { speaker: 'demon', text: '明天你还是会怀疑自己。' },
                     { speaker: 'player', text: '我不需要没有怀疑的人生。' },
                     { speaker: 'player', text: '我只需要在怀疑时，继续走。' },
                     { speaker: 'narrator', text: '心魔露出一瞬间的错愕。' },
                     { speaker: 'sys', text: '你对心魔造成了致命一击。' }
                ],
                win: [
                    { speaker: 'demon', text: '……原来如此。' },
                    { speaker: 'demon', text: '你不是要消灭我。' },
                    { speaker: 'demon', text: '你只是，不再让我掌舵。' },
                    { speaker: 'narrator', text: '心魔化作碎影，融入你的意识深处。' },
                    { speaker: 'sys', text: '心魔战斗结束。' },
                    { speaker: 'sys', text: '你获得了【心境：自知】' },
                    { speaker: 'sys', text: '修为上限小幅提升。' }
                ],
                lose: [
                    { speaker: 'narrator', text: '你的意识被黑暗吞没。' },
                    { speaker: 'demon', text: '没关系。' },
                    { speaker: 'demon', text: '我们下次，还会再见。' },
                    { speaker: 'sys', text: '心魔反噬，你的心境暂时受损。' }
                ]
            },
            greed: {
                start: [
                    { speaker: 'sys', text: '心境异常波动。' },
                    { speaker: 'narrator', text: '你尚未运转功法，内景却自行展开。' },
                    { speaker: 'demon', text: '……这一次，不是我来找你。' },
                    { speaker: 'demon', text: '是你，把我叫出来的。' }
                ],
                p1: [
                    { speaker: 'player', text: '你比上次更清晰了。' },
                    { speaker: 'demon', text: '因为你比上次更强了。' },
                    { speaker: 'demon', text: '强到开始觉得——' },
                    { speaker: 'demon', text: '别人，已经配不上你的谨慎。' },
                    { speaker: 'sys', text: '心魔发动【欲衡】——你获得的增益被放大，同时消耗也被放大。' }
                ],
                p2: [
                     { speaker: 'demon', text: '你真的只是想“变强”吗？' },
                     { speaker: 'demon', text: '还是想证明——' },
                     { speaker: 'demon', text: '当初轻视你的人，都错了。' },
                     { speaker: 'narrator', text: '心魔身后浮现出你曾渴望却未得到的一切。' },
                     { speaker: 'demon', text: '多拿一点，不是应该的吗？' },
                     { speaker: 'sys', text: '心魔进入【膨胀】状态，你的暴击率上升，但心境稳定下降。' }
                ],
                p3: [
                     { speaker: 'player', text: '……你在引我失控。' },
                     { speaker: 'demon', text: '不。' },
                     { speaker: 'demon', text: '我只是把你不敢说的话，说出来。' },
                     { speaker: 'demon', text: '你已经开始不耐烦了。' },
                     { speaker: 'demon', text: '不耐烦弱者，不耐烦慢的路，' },
                     { speaker: 'demon', text: '不耐烦——还要压着自己的时候。' },
                     { speaker: 'narrator', text: '心魔的面容与你完全重合。' }
                ],
                final: [
                     { speaker: 'player', text: '我想要更多。' },
                     { speaker: 'player', text: '但不是现在，不是用你这种方式。' },
                     { speaker: 'demon', text: '……你拒绝我？' },
                     { speaker: 'player', text: '我拒绝被你推着走。' },
                     { speaker: 'sys', text: '你击溃了心魔，但未将其抹除。' }
                ],
                win: [
                    { speaker: 'sys', text: '心魔并未消散。' },
                    { speaker: 'sys', text: '你获得心境【自制】' },
                    { speaker: 'sys', text: '高收益行为的风险提示增强。' }
                ],
                lose: [
                    { speaker: 'demon', text: '看来你还是需要我。' }
                ]
            },
            aggressive: {
                start: [{ speaker: 'demon', text: "鲜血的味道……真是令人陶醉。你为了力量，连命都可以不要，还在乎心魔？" }],
                p1: [{ speaker: 'demon', text: "痛吗？这才是活着的证明！把你的软弱都割掉，剩下的就是神！" }],
                p2: [{ speaker: 'demon', text: "看看你的手，沾满了自己的血。你以为牺牲就能换来救赎？别做梦了！" }],
                p3: [{ speaker: 'demon', text: "还不够！还要更多！把你的灵魂也献祭给我！" }],
                win: [{ speaker: 'demon', text: "切……算你命硬。但这种饥渴，会永远伴随你。" }],
                lose: [{ speaker: 'demon', text: "哈哈哈哈！你的身体归我了！我会用它杀出一条血路！" }]
            },
            control: {
                start: [{ speaker: 'demon', text: "（无声的注视）星轨已乱。你强行改变了轨迹，因果已生。" }],
                p1: [{ speaker: 'demon', text: "凡人妄图窥天，终究是徒劳。你所见的星辰，不过是亿万年前的幻影。" }],
                p2: [{ speaker: 'demon', text: "顺势而为？不，你在逆流而上。天道无情，你却心存侥幸。" }],
                p3: [{ speaker: 'demon', text: "星光黯淡了。你的命数，本该止步于此。" }],
                win: [{ speaker: 'demon', text: "星轨重归寂静。既然你执意前行，那便去吧。" }],
                lose: [{ speaker: 'demon', text: "回归尘土吧。这才是你原本的归宿。" }]
            }
        };
        const dialogues = dialogueSets[personality] || dialogueSets.balanced;
        
        // Template Fallback for Greed
        const templates = {
            balanced: { dmg: 0.65, status: 0.2, drain: 0.15 },
            aggressive: { dmg: 0.85, status: 0.1, drain: 0.05 },
            control: { dmg: 0.45, status: 0.45, drain: 0.1 },
            drain: { dmg: 0.5, status: 0.15, drain: 0.35 },
            trickster: { dmg: 0.55, status: 0.25, drain: 0.2 },
            mirror: { dmg: 0.6, status: 0.25, drain: 0.15 },
            greed: { dmg: 0.7, status: 0.3, drain: 0.0 } // Greed: High dmg/status, no drain
        };
        const tpl = templates[personality] || templates.balanced;
        
        // ... [MISSING INTERNAL HELPERS: normalizeDuration, etc.] ...
        const normalizeDuration = (s) => {
             // Reconstructed simple version + debug hook
             if (!s || typeof s !== 'object') return s;
             const original = Number(s.duration) || 0;
             const dur = Math.min(original, maxStatusDuration);
             
             if (original > dur) {
                 return { ...s, duration: dur, _debugCapped: true, _debugOriginal: original };
             }
             return { ...s, duration: dur };
        };

        const enforceDemonOutput = (out, battlePhase, round) => {
            const res = out && typeof out === 'object' ? out : { logs: [], effects: [], statusChanges: [] };
            const phaseMult = battlePhase === 'execute' ? 1.15 : (battlePhase === 'opening' ? 0.9 : 1);
            const originalBudget = Math.floor(powerBudgetPerRound * phaseMult);
            let remainingBudget = Math.max(0, originalBudget);
            let capped = false;

            if (Array.isArray(res.statusChanges)) {
                for (let i = 0; i < res.statusChanges.length; i++) {
                    const ch = res.statusChanges[i];
                    if (!ch || typeof ch !== 'object') continue;
                    if (ch.status && typeof ch.status === 'object') {
                        const normalized = normalizeDuration(ch.status);
                        if (normalized._debugCapped) {
                             capped = true;
                             const list = Array.isArray(res.logs) ? res.logs : (res.logs = []);
                             list.push({ type: 'sys', tag: 'debug_heartdemon', text: `[HeartDemon] Status ${normalized.id || normalized.name || 'unknown'} duration capped: ${normalized._debugOriginal} -> ${normalized.duration}` });
                             // Clean up internal flags
                             delete normalized._debugCapped;
                             delete normalized._debugOriginal;
                        }
                        // Explicitly replace the status object
                        res.statusChanges[i] = { ...ch, status: normalized };
                    }
                }
            }

            if (Array.isArray(res.effects) && res.effects.length) {
                const next = [];
                for (let i = 0; i < res.effects.length; i++) {
                    if (effectLimitPerRound > 0 && next.length >= effectLimitPerRound) {
                        capped = true;
                        const list = Array.isArray(res.logs) ? res.logs : (res.logs = []);
                        list.push({ type: 'sys', tag: 'debug_heartdemon', text: `[HeartDemon] Effect limit reached (${effectLimitPerRound}). Dropping remaining effects.` });
                        break;
                    }
                    const ef = res.effects[i];
                    if (!ef || typeof ef !== 'object') continue;
                    const value0 = Number(ef.value) || 0;
                    if (value0 === 0) continue;
                    const cost = Math.abs(value0);
                    if (remainingBudget <= 0) {
                        capped = true;
                        const list = Array.isArray(res.logs) ? res.logs : (res.logs = []);
                        list.push({ type: 'sys', tag: 'debug_heartdemon', text: `[HeartDemon] Budget exhausted. Dropping effect.` });
                        break;
                    }
                    if (cost <= remainingBudget) {
                        next.push(ef);
                        remainingBudget -= cost;
                    } else {
                        const sign = value0 > 0 ? 1 : -1;
                        const allowed = remainingBudget;
                        next.push({ ...ef, value: sign * allowed, meta: { ...(ef.meta && typeof ef.meta === 'object' ? ef.meta : {}), capped: true } });
                        
                        const list = Array.isArray(res.logs) ? res.logs : (res.logs = []);
                        list.push({ type: 'sys', tag: 'debug_heartdemon', text: `[HeartDemon] Effect clipped: cost ${cost} > remaining ${remainingBudget}` });
                        
                        remainingBudget = 0;
                        capped = true;
                        break;
                    }
                }
                res.effects = next;
            }

            if (capped) {
                const list = Array.isArray(res.logs) ? res.logs : (res.logs = []);
                list.push({ type: 'battle', tag: 'heartDemon_capped', round, text: '心魔之力受限，攻势被压制。' });
            }
            const list = Array.isArray(res.logs) ? res.logs : (res.logs = []);
            list.push({ type: 'sys', tag: 'debug_heartdemon', text: `[HeartDemon] Round ${round} Budget: used ${originalBudget - remainingBudget}/${originalBudget}` });
            return res;
        };
        
        // ... [MISSING DEMON AI LOOP LOGIC] ...
        // Dummy result calculation
        const sumMonsterHp = (list) => list.reduce((a,b) => a + (Number(b.hp)||0), 0);

        // Heart Demon Battle Loop
        const shownPhases = new Set();
        const maxDemonHp = state.combat.monsters[0].maxHp;

        for (let r = 1; r <= maxRounds; r++) {
            const currentDemonHp = state.combat.monsters[0].hp;
            const demonHpPct = currentDemonHp / maxDemonHp;
            const phase = this.determineBattlePhase({ round: r, maxRound: maxRounds, playerHpPct: state.player.hp/state.player.maxHp, monstersHpPct: demonHpPct });
            
            // Dialogue Injection
            const tryDialogue = (key, content) => {
                if (!shownPhases.has(key) && content) {
                    const lines = Array.isArray(content) ? content : [{ speaker: 'demon', text: content }];
                    lines.forEach(line => {
                         let type = 'battle';
                         let tag = 'narrative';
                         if (line.speaker === 'demon') tag = `demon_say_${key}`;
                         if (line.speaker === 'player') tag = `player_say_${key}`;
                         if (line.speaker === 'sys') { type = 'sys'; tag = 'battle_sys'; }
                         if (line.speaker === 'narrator') { type = 'battle'; tag = 'narrator'; }
                         
                         // Formatted text
                         let text = line.text;
                         if (line.speaker === 'player') text = `你：${text}`;
                         if (line.speaker === 'demon') text = `心魔：${text}`;
                         if (line.speaker === 'narrator') text = `（${text}）`;
                         
                         logs.push({ type, tag, round: r, text });
                    });
                    shownPhases.add(key);
                }
            };

            if (r === 1) tryDialogue('start', dialogues.start);
            if (r === 2 && demonHpPct >= 0.7) tryDialogue('p1', dialogues.p1);
            if (demonHpPct < 0.7 && demonHpPct >= 0.4) tryDialogue('p2', dialogues.p2);
            if (demonHpPct < 0.4 && demonHpPct > 0.1) tryDialogue('p3', dialogues.p3);
            if (demonHpPct <= 0.1) tryDialogue('final', dialogues.final);

            // Simulate Player Damage (Auto-Battle)
            const playerAtk = state.player.atk;
            const playerDmg = Math.max(1, Math.floor(playerAtk * (0.8 + random() * 0.4)));
            state.combat.monsters[0].hp = Math.max(0, currentDemonHp - playerDmg);
            logs.push({ type: 'battle', tag: 'player_atk', round: r, text: `你发起攻击，造成 ${playerDmg} 点伤害。` });
            
            // Generate raw demon actions (Simulated AI)
            const rawOutput = {
                logs: [],
                effects: [],
                statusChanges: []
            };

            const dmg = Math.max(1, Math.floor(powerBudgetPerRound * tpl.dmg));
            rawOutput.effects.push({ target: 'player', type: 'hp', value: -dmg, meta: { kind: 'damage', external: true, personality } });
            rawOutput.logs.push({ type: 'battle', tag: 'demon_atk', round: r, text: `心魔发动攻击，造成 ${dmg} 点伤害。` });

            const statusChance = Math.max(0, Math.min(1, Number(tpl.status) || 0));
            const drainChance = Math.max(0, Math.min(1, Number(tpl.drain) || 0));

            if (statusChance > 0 && random() < statusChance) {
                const statusId = personality === 'trickster' ? 'confuse' : 'fear';
                const statusName = statusId === 'confuse' ? '迷乱' : '恐惧';
                rawOutput.statusChanges.push({
                    target: 'player',
                    op: 'add',
                    status: { id: statusId, name: statusName, duration: maxStatusDuration + 2 }
                });
                rawOutput.logs.push({ type: 'battle', tag: 'demon_skill', round: r, text: `心魔释放【${statusName}】。` });
            }

            if (drainChance > 0 && random() < drainChance) {
                const mpLoss = Math.max(1, Math.floor(powerBudgetPerRound * drainChance));
                rawOutput.effects.push({ target: 'player', type: 'mp', value: -mpLoss, meta: { kind: 'skill', external: true, personality } });
                rawOutput.logs.push({ type: 'battle', tag: 'demon_drain', round: r, text: `心魔牵引灵力，你损失 ${mpLoss} 点灵力。` });
            }

            if (r === 3) {
                const kind = personality === 'aggressive' ? 'hp' : 'mp';
                rawOutput.effects.push({ target: 'player', type: kind, value: -(powerBudgetPerRound * 2), meta: { kind: 'skill', external: true, personality } });
                rawOutput.logs.push({ type: 'battle', tag: 'demon_ult', round: r, text: `心魔释放大招！` });
            }

            // Enforce Limits & Debug Logs
            const safeOutput = enforceDemonOutput(rawOutput, phase, r);
            
            // Apply Results
            if (safeOutput.logs) logs.push(...safeOutput.logs);
            if (safeOutput.statusChanges) allStatusChanges.push(...safeOutput.statusChanges);
            if (safeOutput.effects) {
                allEffects.push(...safeOutput.effects);
                // Apply damage to temp state for loop condition
                safeOutput.effects.forEach(ef => {
                    if (ef.target === 'player' && ef.type === 'hp') {
                        state.player.hp += (Number(ef.value) || 0);
                    }
                });
            }

            if (state.player.hp <= 0) break;
            if (sumMonsterHp(state.combat.monsters) <= 0) break;
        }
        
        const win = sumMonsterHp(state.combat.monsters) <= 0 && state.player.hp > 0;
        const lose = state.player.hp <= 0;
        const result = win ? 'success' : (lose ? 'failure' : 'partial');
        if (result !== 'success') flags.breakthroughFailed = true;
        if (result === 'partial') flags.partialSuccess = true;

        const endText = win ? `心魔崩解，你守住了本心。` : (lose ? `心神溃散，渡劫受阻。` : `心魔未灭，勉强稳住心神。`);
        // Note: end logs are handled by tryDialogue('win'/'lose') if available, else fallback
        
        if (win && dialogues.win) {
             const lines = Array.isArray(dialogues.win) ? dialogues.win : [{ speaker: 'demon', text: dialogues.win }];
             lines.forEach(line => {
                 let type = 'battle';
                 let text = line.text;
                 if (line.speaker === 'sys') type = 'sys';
                 if (line.speaker === 'demon') text = `心魔：${text}`;
                 logs.push({ type, tag: 'demon_end_win', text });
             });
        }
        
        if (lose && dialogues.lose) {
             const lines = Array.isArray(dialogues.lose) ? dialogues.lose : [{ speaker: 'demon', text: dialogues.lose }];
             lines.forEach(line => {
                 let type = 'battle';
                 let text = line.text;
                 if (line.speaker === 'sys') type = 'sys';
                 if (line.speaker === 'demon') text = `心魔：${text}`;
                 logs.push({ type, tag: 'demon_end_lose', text });
             });
        }
        
        logs.push({ type: 'sys', tag: 'event_end', text: endText, meta: { eventType: 'heartDemon' } });

        for (let i = 0; i < logs.length; i++) {
            const e = logs[i];
            if (!e || typeof e !== 'object') continue;
            const em = e.meta && typeof e.meta === 'object' ? e.meta : {};
            e.meta = Object.assign({}, traceMeta, em);
        }
        for (let i = 0; i < allEffects.length; i++) {
            const e = allEffects[i];
            if (!e || typeof e !== 'object') continue;
            const em = e.meta && typeof e.meta === 'object' ? e.meta : {};
            e.meta = Object.assign({}, traceMeta, em);
        }
        for (let i = 0; i < allStatusChanges.length; i++) {
            const e = allStatusChanges[i];
            if (!e || typeof e !== 'object') continue;
            const em = e.meta && typeof e.meta === 'object' ? e.meta : {};
            e.meta = Object.assign({}, traceMeta, em);
        }

        const delta = { playerHp: (Number(state.player.hp) || 0) - (Number(player0.hp) || 0), playerMp: (Number(state.player.mp) || 0) - (Number(player0.mp) || 0) };
        const exported = {
            version: "V1.8+",
            exportedAtTick: (typeof gameState !== 'undefined' && gameState && gameState.story && Number.isFinite(Number(gameState.story.tick))) ? Math.floor(Number(gameState.story.tick)) : 0,
            eventType: "heartDemon",
            deltaKey: traceMeta.deltaKey,
            source: traceMeta.source,
            player: { ...player0 },
            demonProfile: profile,
            result,
            delta,
            flags: { ...flags },
            logs: logs.slice()
        };

        return { result, delta, logs, flags, statusChanges: allStatusChanges, effects: allEffects, exported };
    }
};

/**
 * EventSystem Output Schema (V2.0 Freeze)
 * 
 * applyEventResult(eventResult) consumes this schema:
 * {
 *   result: 'success' | 'failure',
 *   delta: {                 // Inventory-only delta (no player numeric stats)
 *     inventoryDelta?: []
 *   },
 *   effects: [               // Numeric changes MUST go through external effects
 *     { target:'player', type:'hp'|'mp'|'exp'|'maxHp'|'maxMp', value:number, meta:{ external:true } },
 *     ...
 *   ],
 *   statusChanges: [],
 *   flags: {                 // State flag updates
 *     story: { ... },        // Narrative flags (mf_*, etc.)
 *     world: { ... }         // World tendency updates (Day 5 only)
 *   },
 *   logs: [],                // Narrative logs
 *   exported: {              // Replay/Debug snapshot
 *     eventType,
 *     eventId,
 *     optionId,
 *     deltaKey,
 *     source: 'EventSystem'
 *   }
 * }
 */
const EventSystem = {
    sanitizeOption: function(option) {
        const opt = option && typeof option === 'object' ? option : {};
        const forbiddenKeys = { if: true, weight: true, when: true, condition: true };
        for (const k in opt) {
            if (!Object.prototype.hasOwnProperty.call(opt, k)) continue;
            if (forbiddenKeys[k]) return { ok: false, reason: `禁止字段: ${k}` };
            if (typeof opt[k] === 'function') return { ok: false, reason: `禁止函数值: ${k}` };
        }
        return { ok: true };
    },

    runEvent: function(context, rng, options) {
        const ctx = context && typeof context === 'object' ? context : {};
        const eventType = typeof ctx.eventType === 'string' ? ctx.eventType : (ctx.event && typeof ctx.event.eventType === 'string' ? ctx.event.eventType : null);
        // [Fix] Exclude event_heart_demon_combat_01 from generic handler to allow specific logic (nextEventId) to run
        if (eventType === 'heartDemon' && (!ctx.event || ctx.event.id !== 'event_heart_demon_combat_01')) {
            return HeartDemonSystem.runHeartDemonEvent(ctx, rng, options);
        }

        const event = ctx.event && typeof ctx.event === 'object' ? ctx.event : null;
        const option = ctx.option && typeof ctx.option === 'object' ? ctx.option : null;
        const logs = [];
        const flags = {};
        const mergedEffects = [];
        const mergedStatusChanges = [];

        const opts = options && typeof options === 'object' ? options : {};
        const deltaKey = (typeof ctx.deltaKey === 'string' && ctx.deltaKey.trim())
            ? ctx.deltaKey.trim()
            : ((typeof opts.deltaKey === 'string' && opts.deltaKey.trim())
                ? opts.deltaKey.trim()
                : (typeof gameState !== 'undefined' && gameState && typeof gameState.makeDeltaKey === 'function'
                    ? gameState.makeDeltaKey('EventSystem')
                    : 'EventSystem#0'));
        const traceMeta = { deltaKey, source: 'EventSystem', eventType: eventType || 'trial', eventId: event && event.id ? event.id : null };
        if (typeof rng !== 'function') {
            logs.push({ type: 'sys', tag: 'rng_missing', text: '[EventSystem] RNG missing: explicit failure.', meta: { eventType: eventType || 'trial', deltaKey, source: 'EventSystem' } });
            logs.push({ type: 'sys', tag: 'event_end', text: '事件结束。', meta: { eventType: eventType || 'trial', deltaKey, source: 'EventSystem' } });
            for (let i = 0; i < logs.length; i++) {
                const e = logs[i];
                if (!e || typeof e !== 'object') continue;
                const em = e.meta && typeof e.meta === 'object' ? e.meta : {};
                e.meta = Object.assign({}, traceMeta, em);
            }
            const exported = { version: "V2.0", eventType: eventType || 'trial', deltaKey, source: 'EventSystem', error: 'RNG_REQUIRED', logs: logs.slice() };
            return { result: 'failure', delta: { playerHp: 0, playerMp: 0 }, logs, effects: [], statusChanges: [], flags: { invalidRng: true }, meta: traceMeta, exported };
        }

        logs.push({ type: 'sys', tag: 'event_start', text: event && event.title ? `【事件】${event.title}` : '【事件】触发', meta: { eventType: eventType || 'trial', eventId: event && event.id ? event.id : null, deltaKey, source: 'EventSystem' } });

        if (option) {
            const v = this.sanitizeOption(option);
            if (!v.ok) {
                flags.invalidOption = true;
                logs.push({ type: 'sys', tag: 'event_invalid', text: `事件选项不合法：${v.reason}`, meta: { eventType: eventType || 'trial', deltaKey, source: 'EventSystem' } });
                logs.push({ type: 'sys', tag: 'event_end', text: '事件结束。', meta: { eventType: eventType || 'trial', deltaKey, source: 'EventSystem' } });
                for (let i = 0; i < logs.length; i++) {
                    const e = logs[i];
                    if (!e || typeof e !== 'object') continue;
                    const em = e.meta && typeof e.meta === 'object' ? e.meta : {};
                    e.meta = Object.assign({}, traceMeta, em);
                }
                const exported = { version: "V1.8+", exportedAtTick: (typeof gameState !== 'undefined' && gameState && gameState.story && Number.isFinite(Number(gameState.story.tick))) ? Math.floor(Number(gameState.story.tick)) : 0, eventType: eventType || 'trial', deltaKey, source: 'EventSystem', eventId: event && event.id ? event.id : null, optionId: option && option.id ? option.id : null, delta: { playerHp: 0, playerMp: 0 }, logs: logs.slice(), flags: { ...flags } };
                return { result: 'failure', delta: { playerHp: 0, playerMp: 0 }, logs, effects: [], statusChanges: [], flags, meta: traceMeta, exported };
            }
        }

        let delta = {};
        if (option && option.delta && typeof option.delta === 'object') {
            const d = option.delta;
            const hp = Number(d.playerHp) || 0;
            const mp = Number(d.playerMp) || 0;
            const exp = Object.prototype.hasOwnProperty.call(d, 'expDelta') ? (Number(d.expDelta) || 0) : 0;
            const maxHp = Object.prototype.hasOwnProperty.call(d, 'maxHpDelta') ? (Number(d.maxHpDelta) || 0) : 0;
            const maxMp = Object.prototype.hasOwnProperty.call(d, 'maxMpDelta') ? (Number(d.maxMpDelta) || 0) : 0;
            if (hp !== 0) mergedEffects.push({ target: 'player', type: 'hp', value: hp, meta: { external: true, kind: 'event', source: 'EventSystem' } });
            if (mp !== 0) mergedEffects.push({ target: 'player', type: 'mp', value: mp, meta: { external: true, kind: 'event', source: 'EventSystem' } });
            if (exp !== 0) mergedEffects.push({ target: 'player', type: 'exp', value: exp, meta: { external: true, kind: 'event', source: 'EventSystem' } });
            if (maxHp !== 0) mergedEffects.push({ target: 'player', type: 'maxHp', value: maxHp, meta: { external: true, kind: 'event', source: 'EventSystem' } });
            if (maxMp !== 0) mergedEffects.push({ target: 'player', type: 'maxMp', value: maxMp, meta: { external: true, kind: 'event', source: 'EventSystem' } });
            if (Array.isArray(d.inventoryDelta) && d.inventoryDelta.length) delta.inventoryDelta = d.inventoryDelta;
        }

        const result = 'success';
        if (option) {
            const choiceText = (typeof option.log === 'string' && option.log.trim())
                ? option.log.trim()
                : (typeof option.text === 'string' ? option.text : '');
            if (choiceText) logs.push({ type: 'sys', tag: 'event_choice', text: choiceText, meta: { eventType: eventType || 'trial', eventId: event && event.id ? event.id : null, deltaKey, source: 'EventSystem' } });
            const story = option.meta && typeof option.meta === 'object' && option.meta.story && typeof option.meta.story === 'object'
                ? option.meta.story
                : null;
            if (story) {
                const su = {};
                if (typeof story.chainId === 'string' && story.chainId.trim()) su.chainId = story.chainId.trim();
                if (typeof story.dayDelta === 'number' && Number.isFinite(story.dayDelta)) su.dayDelta = Math.floor(story.dayDelta);
                if (typeof story.stepDelta === 'number' && Number.isFinite(story.stepDelta)) su.stepDelta = Math.floor(story.stepDelta);
                if (typeof story.step === 'number' && Number.isFinite(story.step)) su.step = Math.floor(story.step);
                if (typeof story.day === 'number' && Number.isFinite(story.day)) su.day = Math.floor(story.day);
                if (typeof story.delayTicks === 'number' && Number.isFinite(story.delayTicks)) su.delayTicks = Math.floor(story.delayTicks);
                if (Object.prototype.hasOwnProperty.call(story, 'nextEventId')) su.nextEventId = (typeof story.nextEventId === 'string' && story.nextEventId.trim()) ? story.nextEventId.trim() : null;
                if (story.setFlags && typeof story.setFlags === 'object') {
                    const nextFlags = {};
                    const baseFlags = (typeof gameState !== 'undefined' && gameState && gameState.story && gameState.story.flags && typeof gameState.story.flags === 'object')
                        ? gameState.story.flags
                        : {};
                    Object.keys(story.setFlags).forEach(k => {
                        if (!k) return;
                        const v = story.setFlags[k];
                        if (typeof v === 'boolean' || typeof v === 'number' || v === null) {
                            nextFlags[k] = v;
                            return;
                        }
                        if (typeof v === 'string') {
                            const s = v.trim();
                            if (/^[+-]\d+$/.test(s)) {
                                const cur = Number(baseFlags[k]);
                                const base = Number.isFinite(cur) ? cur : 0;
                                const add = Number.parseInt(s, 10);
                                let out = base + add;
                                if (k === 'mf_strain' || k === 'mind_strain') out = Math.max(0, Math.min(5, Math.floor(out)));
                                nextFlags[k] = out;
                                return;
                            }
                            nextFlags[k] = s;
                        }
                    });
                    su.setFlags = nextFlags;
                }
                if (story.complete === true) su.complete = true;
                flags.story = su;
            }
        }

        const eventId = event && typeof event.id === 'string' ? event.id : null;
        const optionId = option && typeof option.id === 'string' ? option.id : null;
        const random = rng;

        const ensureStorySetFlags = () => {
            if (!flags.story || typeof flags.story !== 'object') flags.story = {};
            if (!flags.story.setFlags || typeof flags.story.setFlags !== 'object') flags.story.setFlags = {};
            return flags.story.setFlags;
        };

        const ensureAftermathOnce = (value) => {
            const v = (typeof value === 'string' && value.trim()) ? value.trim() : null;
            if (!v) return false;
            const baseFlags = (typeof gameState !== 'undefined' && gameState && gameState.story && gameState.story.flags && typeof gameState.story.flags === 'object')
                ? gameState.story.flags
                : {};
            const baseAf = (typeof baseFlags.mf_aftermath === 'string' && baseFlags.mf_aftermath.trim()) ? baseFlags.mf_aftermath.trim() : null;
            if (baseAf) return false;
            const sf = ensureStorySetFlags();
            const cur = (typeof sf.mf_aftermath === 'string' && sf.mf_aftermath.trim()) ? sf.mf_aftermath.trim() : null;
            if (cur) return false;
            sf.mf_aftermath = v;
            return true;
        };

        const clearMindfractureStates = () => {
            const sf = ensureStorySetFlags();
            sf.mf_noise = false;
            sf.mf_strain = 0;
            sf.mf_interference = false;
            sf.mf_pressure = false;
            const baseFlags = (typeof gameState !== 'undefined' && gameState && gameState.story && gameState.story.flags && typeof gameState.story.flags === 'object')
                ? gameState.story.flags
                : {};
            if (Object.prototype.hasOwnProperty.call(baseFlags, 'mind_noise')) sf.mind_noise = false;
            if (Object.prototype.hasOwnProperty.call(baseFlags, 'mind_strain')) sf.mind_strain = 0;
        };

        const mergeDemonResult = (demonRes) => {
            if (!demonRes || typeof demonRes !== 'object') return;
            if (Array.isArray(demonRes.logs)) logs.push(...demonRes.logs);
            if (demonRes.delta && typeof demonRes.delta === 'object') {
                const hp = Number(demonRes.delta.playerHp) || 0;
                const mp = Number(demonRes.delta.playerMp) || 0;
                const exp = Object.prototype.hasOwnProperty.call(demonRes.delta, 'expDelta') ? (Number(demonRes.delta.expDelta) || 0) : 0;
                if (hp !== 0) mergedEffects.push({ target: 'player', type: 'hp', value: hp, meta: { external: true, kind: 'event', source: 'HeartDemonSystem' } });
                if (mp !== 0) mergedEffects.push({ target: 'player', type: 'mp', value: mp, meta: { external: true, kind: 'event', source: 'HeartDemonSystem' } });
                if (exp !== 0) mergedEffects.push({ target: 'player', type: 'exp', value: exp, meta: { external: true, kind: 'event', source: 'HeartDemonSystem' } });
                if (Array.isArray(demonRes.delta.inventoryDelta)) {
                    delta.inventoryDelta = Array.isArray(delta.inventoryDelta) ? delta.inventoryDelta.concat(demonRes.delta.inventoryDelta) : demonRes.delta.inventoryDelta.slice();
                }
            }
            if (Array.isArray(demonRes.effects) && demonRes.effects.length) mergedEffects.push(...demonRes.effects);
            if (Array.isArray(demonRes.statusChanges) && demonRes.statusChanges.length) mergedStatusChanges.push(...demonRes.statusChanges);
            if (demonRes.flags && typeof demonRes.flags === 'object') Object.assign(flags, demonRes.flags);
        };

        if (eventId === 'event_breakthrough_attempt_01' && optionId === 'attempt') {
            const sfBase = (typeof gameState !== 'undefined' && gameState && gameState.story && gameState.story.flags && typeof gameState.story.flags === 'object')
                ? gameState.story.flags
                : {};
            const method = (typeof sfBase.bt_method === 'string' && sfBase.bt_method.trim()) ? sfBase.bt_method.trim() : 'normal';
            const bonus = Number(sfBase.bt_success_bonus) || 0;
            const heartSeed = Number(sfBase.bt_heart_seed) || 0;
            const hasDebt = sfBase.bt_debt === true;
            const debtLevel = Math.max(0, Math.floor(Number(sfBase.bt_debt_level) || 0));
            const hpFloor = Object.prototype.hasOwnProperty.call(sfBase, 'bt_hp_floor') ? Number(sfBase.bt_hp_floor) : null;

            const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
            const methodAdj = (m) => {
                if (m === 'intense') return -0.05;
                if (m === 'pill') return 0;
                if (m === 'evil') return 0.1;
                return 0.05;
            };
            const chance = clamp01(0.5 + methodAdj(method) + (bonus / 100));

            const progression = (typeof GameData !== 'undefined' && GameData && Array.isArray(GameData.realmProgression)) ? GameData.realmProgression : [];
            const curRealm = (typeof gameState !== 'undefined' && gameState && typeof gameState.realm === 'string') ? gameState.realm : '';
            const curStage = (typeof gameState !== 'undefined' && gameState && typeof gameState.stage === 'string') ? gameState.stage : '';
            const curIdx = progression.findIndex(v => v && v.realm === curRealm && v.stage === curStage);
            const nextStage = (curIdx !== -1 && curIdx < progression.length - 1) ? progression[curIdx + 1] : null;

            if (!nextStage) {
                logs.push({ type: 'sys', tag: 'breakthrough_invalid', text: '已至臻境，暂无后续境界。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
            } else if (typeof gameState !== 'undefined' && gameState && (Number(gameState.exp) || 0) < (Number(gameState.maxExp) || 0)) {
                logs.push({ type: 'sys', tag: 'breakthrough_blocked', text: '修为不足，无法突破。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
            } else {
                const roll = random();
                const ok = roll < chance;
                const sf = ensureStorySetFlags();
                const scheduleAftershock = (delayTicks) => {
                    if (!flags.story || typeof flags.story !== 'object') flags.story = {};
                    const extraDelay = Number(sfBase.bt_delay_aftershock) || 0;
                    flags.story.delayTicks = Math.max(1, delayTicks + extraDelay);
                    flags.story.nextEventId = 'event_breakthrough_aftershock_01';
                };

                if (ok) {
                    logs.push({ type: 'sys', tag: 'narrative', text: '你踏入关隘，气机一线贯穿，门后之光照进识海。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                    const advanced = (typeof gameState !== 'undefined' && gameState && typeof gameState.applyBreakthroughAdvance === 'function')
                        ? gameState.applyBreakthroughAdvance(nextStage)
                        : false;
                    if (advanced) {
                        if (debtLevel >= 2) {
                             if (!flags.story || typeof flags.story !== 'object') flags.story = {};
                             flags.story.nextEventId = 'event_breakthrough_unstable_01';
                             flags.story.delayTicks = 2;
                        } else {
                            if (hasDebt) sf.bt_debt_due = true;
                            if (heartSeed > 0) {
                                sf.bt_aftershock = true;
                                scheduleAftershock(8);
                            } else {
                                if (!flags.story || typeof flags.story !== 'object') flags.story = {};
                                flags.story.nextEventId = 'event_cycle_complete_01';
                                flags.story.delayTicks = 0;
                            }
                        }
                    } else {
                        logs.push({ type: 'sys', tag: 'breakthrough_apply_failed', text: '突破未能落地：状态更新被拒绝。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                    }
                } else {
                    const fake = method === 'evil' && roll < clamp01(chance + 0.1);
                    if (fake) {
                        sf.bt_fake_realm = true;
                        sf.bt_fake_prev_realm = curRealm || null;
                        sf.bt_fake_prev_stage = curStage || null;
                        logs.push({ type: 'sys', tag: 'narrative', text: '门后之光先一步落在你身上。你似乎已经跨过去了——可那光没有重量。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                        const advanced = (typeof gameState !== 'undefined' && gameState && typeof gameState.applyBreakthroughAdvance === 'function')
                            ? gameState.applyBreakthroughAdvance(nextStage)
                            : false;
                        if (!advanced) {
                            logs.push({ type: 'sys', tag: 'breakthrough_apply_failed', text: '伪突破未能落地：状态更新被拒绝。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                        }
                        sf.bt_aftershock = true;
                        scheduleAftershock(6);
                    } else {
                        logs.push({ type: 'sys', tag: 'narrative', text: '你撞在关隘上，气机散成一片碎响。某个念头在暗处留下种子。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                        
                        // Handle HP Floor (e.g. Blood Sacrifice)
                        if (hpFloor !== null && Number.isFinite(hpFloor)) {
                             const curHp = (typeof gameState !== 'undefined' && gameState) ? (Number(gameState.hp) || 0) : 0;
                             if (curHp > hpFloor) {
                                 const dmg = curHp - hpFloor;
                                 if (typeof gameState !== 'undefined' && gameState && typeof gameState.applyPlayerDelta === 'function') {
                                     gameState.applyPlayerDelta({ playerHp: -dmg }, { source: 'EventSystem', deltaKey, reason: 'breakthrough_backlash' });
                                     logs.push({ type: 'sys', tag: 'damage', text: `反噬攻心，你的气血瞬间衰败至 ${hpFloor}。`, meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                                     logs.push({ type: 'sys', tag: 'narrative', text: '你还活着。收敛心神，退一步，路还在。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                                 }
                             }
                        }

                        sf.bt_heart_seed = Math.max(0, Math.floor(heartSeed)) + 1;
                        sf.bt_aftershock = true;
                        const baseOmen = Number(sfBase.bt_omen_pending) || 0;
                        const curOmen = Number(sf.bt_omen_pending);
                        sf.bt_omen_pending = (Number.isFinite(curOmen) ? curOmen : baseOmen) + 1;
                        if (method === 'pill' && debtLevel > 0) {
                            sf.bt_debt_due = true;
                            sf.bt_debt_due_level = debtLevel;
                        }
                        scheduleAftershock(10);
                    }
                }
            }
        } else if (eventId === 'event_breakthrough_aftershock_01') {
            const sfBase = (typeof gameState !== 'undefined' && gameState && gameState.story && gameState.story.flags && typeof gameState.story.flags === 'object')
                ? gameState.story.flags
                : {};
            const seed = Math.max(0, Math.floor(Number(sfBase.bt_heart_seed) || 0));
            const omenPendingRaw = Number(sfBase.bt_omen_pending) || 0;
            const omenPending = Number.isFinite(omenPendingRaw) ? Math.trunc(omenPendingRaw) : 0;
            const debtDue = sfBase.bt_debt_due === true;
            const debtDueLevel = Math.max(0, Math.floor(Number(sfBase.bt_debt_due_level) || 0));
            const isFake = sfBase.bt_fake_realm === true;
            const method = (typeof sfBase.bt_method === 'string' && sfBase.bt_method.trim()) ? sfBase.bt_method.trim() : null;

            if (!flags.story || typeof flags.story !== 'object') flags.story = {};
            const sf = ensureStorySetFlags();
            sf.bt_aftershock = false;

            if (omenPending !== 0) {
                const dv = Math.max(-5, Math.min(5, omenPending));
                if (dv !== 0) flags.world = { tendenciesDelta: { omen: dv } };
                sf.bt_omen_pending = 0;
            }

            if (debtDue) {
                const level = debtDueLevel > 0 ? debtDueLevel : 1;
                mergedEffects.push({ target: 'player', type: 'exp', value: -10 * level, meta: { external: true, kind: 'event', source: 'EventSystem' } });
                sf.bt_debt_due = false;
                sf.bt_debt_due_level = 0;
            }

            if (isFake) {
                const prevRealm = (typeof sfBase.bt_fake_prev_realm === 'string' && sfBase.bt_fake_prev_realm.trim()) ? sfBase.bt_fake_prev_realm.trim() : null;
                const prevStage = (typeof sfBase.bt_fake_prev_stage === 'string' && sfBase.bt_fake_prev_stage.trim()) ? sfBase.bt_fake_prev_stage.trim() : null;
                const progression = (typeof GameData !== 'undefined' && GameData && Array.isArray(GameData.realmProgression)) ? GameData.realmProgression : [];
                const prevCfg = (prevRealm && prevStage) ? (progression.find(v => v && v.realm === prevRealm && v.stage === prevStage) || null) : null;
                logs.push({ type: 'sys', tag: 'narrative', text: '那道“成功”像薄纸一样裂开。你脚下一空，跌回原处。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                logs.push({ type: 'sys', tag: 'narrative', text: '你没有失败，只是这条路暂时走不通。你仍能继续修行。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                if (prevCfg && typeof gameState !== 'undefined' && gameState && typeof gameState.applyBreakthroughAdvance === 'function') {
                    gameState.applyBreakthroughAdvance(prevCfg);
                }
                sf.bt_fake_realm = false;
                sf.bt_fake_collapsed = true;
                if (!flags.world) flags.world = { tendenciesDelta: { omen: 1 } };
                else if (flags.world && flags.world.tendenciesDelta && typeof flags.world.tendenciesDelta === 'object') {
                    const cur = Number(flags.world.tendenciesDelta.omen) || 0;
                    flags.world.tendenciesDelta.omen = Math.max(-5, Math.min(5, Math.trunc(cur + 1)));
                } else {
                    flags.world = Object.assign({}, flags.world, { tendenciesDelta: { omen: 1 } });
                }
            }

            const shouldBranchDemon = seed > 0 || method === 'intense';
            if (shouldBranchDemon && optionId === 'steady') {
                flags.story.nextEventId = 'event_heart_demon_combat_01';
                flags.story.delayTicks = 0;
                logs.push({ type: 'sys', tag: 'narrative', text: '你以为守住了，可余波在暗处换气。它还没走。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
            } else if (optionId === 'press') {
                flags.story.nextEventId = 'event_breakthrough_stabilized_01';
                flags.story.delayTicks = 0;
            } else {
                flags.story.nextEventId = 'event_cycle_complete_01';
                flags.story.delayTicks = 0;
            }
        } else if (eventId === 'event_heart_demon_combat_01' && optionId === 'fight') {
            const sfBase = (typeof gameState !== 'undefined' && gameState && gameState.story && gameState.story.flags && typeof gameState.story.flags === 'object')
                ? gameState.story.flags
                : {};
            const method = (typeof sfBase.bt_method === 'string' && sfBase.bt_method.trim()) ? sfBase.bt_method.trim() : null;
            const power = method === 'intense' ? 65 : 55;
            const personality = method === 'intense' ? 'aggressive' : 'control';
            logs.push({ type: 'sys', tag: 'narrative', text: '那道影子从缝隙里站起身来。它没有名字，却很熟悉。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
            const demonCtx = {
                eventType: 'heartDemon',
                player: ctx.player && typeof ctx.player === 'object' ? ctx.player : (typeof gameState !== 'undefined' ? gameState : {}),
                env: ctx.env && typeof ctx.env === 'object' ? ctx.env : { mapId: '心境', difficulty: 1 },
                behaviorStats: ctx.behaviorStats && typeof ctx.behaviorStats === 'object' ? ctx.behaviorStats : (typeof gameState !== 'undefined' ? gameState.behaviorStats : null),
                maxRounds: 16,
                deltaKey
            };
            const demonRes = HeartDemonSystem.runHeartDemonEvent(demonCtx, rng, { personality, powerBudgetPerRound: power, effectLimitPerRound: 8, maxStatusDuration: 1, deltaKey });
            mergeDemonResult(demonRes);
            const sf = ensureStorySetFlags();
            if (demonRes && (demonRes.result === 'success' || demonRes.result === 'partial')) {
                const seed = Math.max(0, Math.floor(Number(sfBase.bt_heart_seed) || 0));
                sf.bt_heart_seed = Math.max(0, seed - 1);
                sf.bt_aftershock_resolved = true;
                logs.push({ type: 'sys', tag: 'narrative', text: '你把它按回沉默里。余波散去，像潮退。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
            } else {
                sf.bt_aftershock_failed = true;
                if (!flags.world) flags.world = { tendenciesDelta: { chaos: 1, omen: 1 } };
                else if (!flags.world.tendenciesDelta || typeof flags.world.tendenciesDelta !== 'object') flags.world.tendenciesDelta = { chaos: 1, omen: 1 };
                else {
                    const c0 = Number(flags.world.tendenciesDelta.chaos) || 0;
                    const o0 = Number(flags.world.tendenciesDelta.omen) || 0;
                    flags.world.tendenciesDelta.chaos = Math.max(-5, Math.min(5, Math.trunc(c0 + 1)));
                    flags.world.tendenciesDelta.omen = Math.max(-5, Math.min(5, Math.trunc(o0 + 1)));
                }
                logs.push({ type: 'sys', tag: 'narrative', text: '你没有被判死刑。只是此刻心境不稳，需更谨慎地继续走下去。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
            }
            if (!flags.story || typeof flags.story !== 'object') flags.story = {};
            flags.story.nextEventId = 'event_cycle_complete_01';
            flags.story.delayTicks = 0;
        } else if (eventId === 'event_breakthrough_stabilized_01' && optionId === 'accept') {
            const sf = ensureStorySetFlags();
            const sfBase = (typeof gameState !== 'undefined' && gameState && gameState.story && gameState.story.flags && typeof gameState.story.flags === 'object')
                ? gameState.story.flags
                : {};
            const method = (typeof sfBase.bt_method === 'string' && sfBase.bt_method.trim()) ? sfBase.bt_method.trim() : '';
            const okChance = method === 'pill' ? 0.8 : (method === 'intense' ? 0.55 : 0.7);
            const ok = rng() < okChance;
            if (ok) {
                sf.bt_stabilized = true;
                mergedEffects.push({ target: 'player', type: 'exp', value: 6, meta: { external: true, kind: 'event', source: 'EventSystem' } });
                logs.push({ type: 'sys', tag: 'narrative', text: '你把余波压成一线，气机终于听话。你知道这次稳住了。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                if (!flags.story || typeof flags.story !== 'object') flags.story = {};
                flags.story.nextEventId = 'event_cycle_complete_01';
                flags.story.delayTicks = 0;
            } else {
                sf.bt_stabilized_failed = true;
                if (!flags.story || typeof flags.story !== 'object') flags.story = {};
                flags.story.nextEventId = 'event_heart_demon_combat_01';
                flags.story.delayTicks = 0;
                logs.push({ type: 'sys', tag: 'narrative', text: '你强压余波，却像把火按进灰里。它没灭，只是在等你松手。', meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
            }
        } else if (eventId === 'story_mindfracture_d5_01' && optionId === 'force_breakthrough') {
            const successChance = 0.25;
            const ok = random() < successChance;
            if (ok) {
                logs.push({ type: 'sys', tag: 'narrative', text: "你一口气冲开关隘，裂纹随之散去，像从未存在过。", meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                clearMindfractureStates();
                if (ensureAftermathOnce('scarred')) flags.world = { tendenciesDelta: { order: 1 } };
                const sf = ensureStorySetFlags();
                sf.mf_resolved = 'breakthrough_success';
                mergedEffects.push({ target: 'player', type: 'exp', value: 18, meta: { external: true, kind: 'event', source: 'EventSystem' } });
            } else {
                logs.push({ type: 'sys', tag: 'narrative', text: "你强行冲关，识海却像被撕开一线。裂纹回望你——它要你付出答案。", meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                const demonCtx = {
                    eventType: 'heartDemon',
                    player: ctx.player && typeof ctx.player === 'object' ? ctx.player : (typeof gameState !== 'undefined' ? gameState : {}),
                    env: ctx.env && typeof ctx.env === 'object' ? ctx.env : { mapId: '心境', difficulty: 1 },
                    behaviorStats: ctx.behaviorStats && typeof ctx.behaviorStats === 'object' ? ctx.behaviorStats : (typeof gameState !== 'undefined' ? gameState.behaviorStats : null),
                    maxRounds: 18,
                    deltaKey
                };
                const demonRes = HeartDemonSystem.runHeartDemonEvent(demonCtx, rng, { personality: 'aggressive', powerBudgetPerRound: 55, effectLimitPerRound: 8, maxStatusDuration: 1, deltaKey });
                mergeDemonResult(demonRes);
                if (demonRes && (demonRes.result === 'success' || demonRes.result === 'partial')) {
                    logs.push({ type: 'sys', tag: 'narrative', text: "你在裂意最深处稳住了心神。那道缝隙被你亲手合上。", meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                    clearMindfractureStates();
                    if (ensureAftermathOnce('scarred')) flags.world = { tendenciesDelta: { order: 1 } };
                    const sf = ensureStorySetFlags();
                    sf.mf_resolved = 'breakthrough_survived';
                } else {
                    const sf = ensureStorySetFlags();
                    const cur = Number(sf.mf_strain);
                    const baseFlags = (typeof gameState !== 'undefined' && gameState && gameState.story && gameState.story.flags && typeof gameState.story.flags === 'object')
                        ? gameState.story.flags
                        : {};
                    const baseRaw = Number.isFinite(cur)
                        ? cur
                        : (Number(baseFlags.mf_strain) || Number(baseFlags.mind_strain) || 0);
                    const base = Number.isFinite(baseRaw) ? baseRaw : 0;
                    sf.mf_strain = Math.max(0, Math.min(5, base + 1));
                    if (ensureAftermathOnce('broken')) flags.world = { tendenciesDelta: { chaos: 3, omen: 1 } };
                    sf.mf_resolved = 'breakthrough_failed';
                }
            }
        } else if (eventId === 'story_mindfracture_d5_01' && optionId === 'face_demon') {
            logs.push({ type: 'sys', tag: 'narrative', text: "你不再回避。你把裂纹迎到心前，等它现形。", meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
            const demonCtx = {
                eventType: 'heartDemon',
                player: ctx.player && typeof ctx.player === 'object' ? ctx.player : (typeof gameState !== 'undefined' ? gameState : {}),
                env: ctx.env && typeof ctx.env === 'object' ? ctx.env : { mapId: '心境', difficulty: 2 },
                behaviorStats: ctx.behaviorStats && typeof ctx.behaviorStats === 'object' ? ctx.behaviorStats : (typeof gameState !== 'undefined' ? gameState.behaviorStats : null),
                maxRounds: 22,
                deltaKey
            };
            const demonRes = HeartDemonSystem.runHeartDemonEvent(demonCtx, rng, { personality: 'control', powerBudgetPerRound: 65, effectLimitPerRound: 10, maxStatusDuration: 1, deltaKey });
            mergeDemonResult(demonRes);
            if (demonRes && (demonRes.result === 'success' || demonRes.result === 'partial')) {
                logs.push({ type: 'sys', tag: 'narrative', text: "你直视裂纹，裂纹便失去了藏身之处。它碎成一阵无声的尘。", meta: { eventType: eventType || 'trial', eventId, deltaKey, source: 'EventSystem' } });
                clearMindfractureStates();
                if (ensureAftermathOnce('tempered')) flags.world = { tendenciesDelta: { order: 1, omen: 1 } };
                const sf = ensureStorySetFlags();
                sf.mf_resolved = 'faced_and_won';
                mergedEffects.push({ target: 'player', type: 'exp', value: 25, meta: { external: true, kind: 'event', source: 'EventSystem' } });
                delta.inventoryDelta = Array.isArray(delta.inventoryDelta) ? delta.inventoryDelta : [];
                delta.inventoryDelta.push({ name: "清明心镜", countDelta: 1 });
            } else {
                clearMindfractureStates();
                const sf = ensureStorySetFlags();
                sf.mf_resolved = 'faced_and_lost';
            }
        }

        logs.push({ type: 'sys', tag: 'event_end', text: '事件结束。', meta: { eventType: eventType || 'trial', deltaKey, source: 'EventSystem' } });
        for (let i = 0; i < logs.length; i++) {
            const e = logs[i];
            if (!e || typeof e !== 'object') continue;
            const em = e.meta && typeof e.meta === 'object' ? e.meta : {};
            e.meta = Object.assign({}, traceMeta, em);
        }

        const exported = {
            version: "V1.8+",
            exportedAtTick: (typeof gameState !== 'undefined' && gameState && gameState.story && Number.isFinite(Number(gameState.story.tick))) ? Math.floor(Number(gameState.story.tick)) : 0,
            eventType: eventType || 'trial',
            deltaKey,
            source: 'EventSystem',
            eventId: event && event.id ? event.id : null,
            optionId: option && option.id ? option.id : null,
            delta,
            logs: logs.slice(),
            flags: { ...flags }
        };

        const out = { result, delta, logs, effects: mergedEffects, statusChanges: mergedStatusChanges, flags, meta: traceMeta, exported };
        return out;
    }
};

function buildReplayTimeline(gs) {
    const game = gs && typeof gs === 'object' ? gs : null;
    const issues = [];
    if (!game) return { timeline: [], byTick: {}, maxTick: 0, issues: ['INVALID_GAMESTATE'] };

    const replay = game.replay && typeof game.replay === 'object' ? game.replay : null;
    const actions = replay && Array.isArray(replay.actions) ? replay.actions.slice() : [];
    if (!actions.length) return { timeline: [], byTick: {}, maxTick: 0, issues: [] };

    if (!game._replayBaseline && typeof game.captureReplayBaseline === 'function') {
        game.captureReplayBaseline('buildReplayTimeline');
    }

    const originalRng = game.rng;
    const backupState = JSON.stringify(game, (k, v) => {
        if (typeof v === 'function') return undefined;
        if (k === 'rng') return undefined;
        return v;
    });
    const backupBaseline = game._replayBaseline ? JSON.parse(JSON.stringify(game._replayBaseline)) : null;

    const timeline = [];
    const byTick = {};
    const nodes = new Map();
    const ensureNode = (tick) => {
        const t = Number.isFinite(Number(tick)) ? Math.floor(Number(tick)) : 0;
        const key = String(t);
        const existing = nodes.get(key);
        if (existing) return existing;
        const node = { tick: t, deltaKey: null, actions: [], logs: [], meta: null, stateHash: null };
        nodes.set(key, node);
        byTick[key] = timeline.length;
        timeline.push(node);
        return node;
    };

    const runWithCapture = (fn) => {
        if (typeof UI !== 'undefined' && UI && typeof UI.withLogCapture === 'function') return UI.withLogCapture(fn);
        const ui = (typeof UI !== 'undefined' && UI) ? UI : null;
        if (!ui) {
            issues.push('UI_MISSING_LOGS');
            return fn();
        }
        const origAdd = ui.addLog;
        const origEvent = ui.renderEventLogs;
        const origCombat = ui.renderCombatLogs;
        const safeClone = (obj) => {
            try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
        };
        ui.addLog = function(msg, type = 'normal') {
            const tick = game && game.story && Number.isFinite(Number(game.story.tick)) ? Math.floor(Number(game.story.tick)) : 0;
            const node = ensureNode(tick);
            const text = typeof msg === 'string' ? msg : String(msg ?? '');
            const t = typeof type === 'string' ? type : 'sys';
            const deltaKey = game && game._timelineContext && typeof game._timelineContext.deltaKey === 'string' ? game._timelineContext.deltaKey : null;
            const entry = { type: t === 'normal' ? 'sys' : t, tag: null, text, meta: deltaKey ? { deltaKey, source: 'UI.addLog' } : undefined };
            node.logs.push(entry);
        };
        ui.renderEventLogs = function(entries) {
            const tick = game && game.story && Number.isFinite(Number(game.story.tick)) ? Math.floor(Number(game.story.tick)) : 0;
            const node = ensureNode(tick);
            if (Array.isArray(entries)) node.logs.push(...entries.map(safeClone));
        };
        ui.renderCombatLogs = function(entries) {
            const tick = game && game.story && Number.isFinite(Number(game.story.tick)) ? Math.floor(Number(game.story.tick)) : 0;
            const node = ensureNode(tick);
            if (Array.isArray(entries)) node.logs.push(...entries.map(safeClone));
        };
        try {
            return fn();
        } finally {
            ui.addLog = origAdd;
            ui.renderEventLogs = origEvent;
            ui.renderCombatLogs = origCombat;
        }
    };

    try {
        if (typeof game.restoreReplayBaseline === 'function' && !game.restoreReplayBaseline()) {
            issues.push('BASELINE_MISSING');
        }

        const savedReplayEnabled = replay && replay.enabled === true;
        if (replay) replay.enabled = false;

        runWithCapture(() => {
            for (let i = 0; i < actions.length; i++) {
                const action = actions[i];
                if (!action || typeof action !== 'object') continue;
                const deltaKey = typeof action.deltaKey === 'string' ? action.deltaKey : null;
                game._timelineContext = { deltaKey, type: action.type ?? null };

                if (typeof Logic !== 'undefined' && Logic && typeof Logic.applyReplayAction === 'function') {
                    Logic.applyReplayAction(action, { record: false, silent: true });
                } else {
                    issues.push('LOGIC_REPLAY_EXECUTOR_MISSING');
                    break;
                }

                const tickNow = game && game.story && Number.isFinite(Number(game.story.tick)) ? Math.floor(Number(game.story.tick)) : 0;
                const node = ensureNode(tickNow);
                node.actions.push(action);
                if (action.type === 'tick' && typeof deltaKey === 'string' && deltaKey.trim()) node.deltaKey = deltaKey.trim();

                node.meta = game.lastMeta && typeof game.lastMeta === 'object' ? { ...game.lastMeta } : null;
                if (typeof game.hashSnapshot === 'function' && typeof game.snapshot === 'function') {
                    node.stateHash = game.hashSnapshot(game.snapshot());
                }
            }
        });

        if (replay) replay.enabled = savedReplayEnabled;
    } finally {
        delete game._timelineContext;
        const restore = JSON.parse(backupState);
        Object.assign(game, restore);
        game.rng = originalRng;
        game._replayBaseline = backupBaseline;
    }

    let maxTick = 0;
    for (let i = 0; i < timeline.length; i++) {
        const t = Number(timeline[i].tick) || 0;
        if (t > maxTick) maxTick = t;
    }
    return { timeline, byTick, maxTick, issues };
}

function getReplayCoreSnapshot(gs) {
    const game = gs && typeof gs === 'object' ? gs : null;
    if (!game) return null;

    const mapName = game.currentMap && typeof game.currentMap === 'object'
        ? (typeof game.currentMap.name === 'string' ? game.currentMap.name : null)
        : null;
    const story = game.story && typeof game.story === 'object' ? game.story : {};
    const world = game.world && typeof game.world === 'object' ? game.world : {};
    const tendencies = world.tendencies && typeof world.tendencies === 'object' ? world.tendencies : {};

    const combat = game.combat && typeof game.combat === 'object' ? game.combat : null;
    const playerStatuses = combat && Array.isArray(combat.playerStatuses) ? combat.playerStatuses : [];
    const playerStatusIds = playerStatuses
        .map(s => (s && typeof s === 'object' ? (typeof s.id === 'string' ? s.id : (typeof s.name === 'string' ? s.name : null)) : null))
        .filter(Boolean)
        .slice(0, 8);
    const monsters = combat && Array.isArray(combat.monsters) ? combat.monsters : [];
    const monstersHp = monsters.slice(0, 3).map(m => ({
        id: m && typeof m.id === 'string' ? m.id : null,
        name: m && typeof m.name === 'string' ? m.name : null,
        hp: m ? (Number(m.hp) || 0) : 0,
        maxHp: m ? (Number(m.maxHp) || 0) : 0
    }));

    const inv = game.inventory && typeof game.inventory === 'object' ? game.inventory : {};
    const invKeys = Object.keys(inv).filter(k => (Number(inv[k]) || 0) > 0).sort();
    const invTop = invKeys.slice(0, 6).map(k => ({ name: k, count: Number(inv[k]) || 0 }));

    const lastDeltaMeta = game.lastDeltaMeta && typeof game.lastDeltaMeta === 'object' ? game.lastDeltaMeta : null;
    const lastDeltaKey = lastDeltaMeta && typeof lastDeltaMeta.deltaKey === 'string' ? lastDeltaMeta.deltaKey : null;
    const lastDeltaSource = lastDeltaMeta && typeof lastDeltaMeta.source === 'string' ? lastDeltaMeta.source : null;
    const lastDeltaRule = lastDeltaMeta && typeof lastDeltaMeta.rule === 'string' ? lastDeltaMeta.rule : null;
    const lastDeltaKeys = lastDeltaMeta && Array.isArray(lastDeltaMeta.keys) ? lastDeltaMeta.keys.slice() : null;

    const lastMetaSource = game.lastMeta && typeof game.lastMeta === 'object' && typeof game.lastMeta.source === 'string'
        ? game.lastMeta.source
        : null;

    const lastRngConsumerTag = typeof game._lastRngConsumerTag === 'string' ? game._lastRngConsumerTag : null;

    const lastDamageSourceDeltaKey = (lastDeltaKey && Array.isArray(lastDeltaKeys) && lastDeltaKeys.includes('playerHp')) ? lastDeltaKey : null;

    return {
        hp: Number(game.hp) || 0,
        mp: Number(game.mp) || 0,
        maxHp: Number(game.maxHp) || 0,
        maxMp: Number(game.maxMp) || 0,
        exp: Number(game.exp) || 0,
        maxExp: Number(game.maxExp) || 0,
        atk: Number(game.atk) || 0,
        realm: typeof game.realm === 'string' ? game.realm : null,
        subRealm: typeof game.subRealm === 'string' ? game.subRealm : null,
        stage: typeof game.stage === 'string' ? game.stage : null,
        activeDao: typeof game.activeDao === 'string' ? game.activeDao : null,
        currentMapName: mapName,
        rngSeed: Number.isFinite(Number(game.rngSeed)) ? Number(game.rngSeed) : null,
        _rngState: Number.isFinite(Number(game._rngState)) ? Number(game._rngState) : null,
        _deltaSeq: Number.isFinite(Number(game._deltaSeq)) ? Number(game._deltaSeq) : 0,
        storyTick: Number.isFinite(Number(story.tick)) ? Math.floor(Number(story.tick)) : 0,
        storyDay: Number.isFinite(Number(story.day)) ? Math.floor(Number(story.day)) : 0,
        storyStep: Number.isFinite(Number(story.step)) ? Math.floor(Number(story.step)) : 0,
        storyChainId: typeof story.chainId === 'string' ? story.chainId : null,
        storyNextEventId: typeof story.nextEventId === 'string' ? story.nextEventId : null,
        worldOrder: Number(tendencies.order) || 0,
        worldChaos: Number(tendencies.chaos) || 0,
        worldOmen: Number(tendencies.omen) || 0,
        inCombat: !!combat,
        combatRound: combat && Number.isFinite(Number(combat.round)) ? Math.floor(Number(combat.round)) : 0,
        playerStatusIds,
        monsterCount: monsters.length,
        monstersHp,
        invTop,
        lastDeltaKey,
        lastDeltaSource,
        lastDeltaRule,
        lastDeltaKeys,
        lastMetaSource,
        lastRngConsumerTag,
        lastDamageSourceDeltaKey
    };
}

function verifyReplayMismatch(gs) {
    const game = gs && typeof gs === 'object' ? gs : null;
    const issues = [];
    if (!game) return { ok: false, mismatch: null, issues: ['INVALID_GAMESTATE'] };

    const replay = game.replay && typeof game.replay === 'object' ? game.replay : null;
    const actions = replay && Array.isArray(replay.actions) ? replay.actions.slice() : [];
    if (!actions.length) return { ok: true, mismatch: null, issues: [] };

    const expected = replay && replay.expectedTickHashes && typeof replay.expectedTickHashes === 'object' ? replay.expectedTickHashes : null;
    if (!expected) return { ok: true, mismatch: null, issues: ['EXPECTED_HASHES_MISSING'] };

    if (!game._replayBaseline && typeof game.captureReplayBaseline === 'function') {
        game.captureReplayBaseline('verifyReplayMismatch');
    }

    const originalRng = game.rng;
    const backupState = JSON.stringify(game, (k, v) => {
        if (typeof v === 'function') return undefined;
        if (k === 'rng') return undefined;
        return v;
    });
    const backupBaseline = game._replayBaseline ? JSON.parse(JSON.stringify(game._replayBaseline)) : null;

    const shallowDiff = (expectedCore, actualCore) => {
        const a = actualCore && typeof actualCore === 'object' ? actualCore : null;
        const e = expectedCore && typeof expectedCore === 'object' ? expectedCore : null;
        if (!a || !e) return [];

        const keys = Object.keys(e);
        const diffs = [];
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            const from = e[k];
            const to = a[k];
            const same = (() => {
                if (from === to) return true;
                const tf = typeof from;
                const tt = typeof to;
                if ((tf === 'object' && from !== null) || (tt === 'object' && to !== null)) {
                    try { return JSON.stringify(from) === JSON.stringify(to); } catch { return false; }
                }
                return false;
            })();
            if (!same) {
                diffs.push({ key: k, from, to });
                if (diffs.length >= 10) break;
            }
        }
        return diffs;
    };

    let mismatch = null;
    try {
        if (typeof game.restoreReplayBaseline === 'function' && !game.restoreReplayBaseline()) {
            issues.push('BASELINE_MISSING');
        }

        const savedReplayEnabled = replay && replay.enabled === true;
        if (replay) replay.enabled = false;

        let lastGoodTick = 0;
        let lastCheckedTick = null;

        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            if (!action || typeof action !== 'object') continue;
            const deltaKey = typeof action.deltaKey === 'string' && action.deltaKey.trim() ? action.deltaKey.trim() : null;

            if (typeof Logic !== 'undefined' && Logic && typeof Logic.applyReplayAction === 'function') {
                Logic.applyReplayAction(action, { record: false, silent: true });
            } else {
                issues.push('LOGIC_REPLAY_EXECUTOR_MISSING');
                break;
            }

            if (action.type !== 'tick') continue;

            if (typeof game.hashSnapshot !== 'function' || typeof game.snapshot !== 'function') {
                issues.push('HASH_API_MISSING');
                break;
            }

            const tickNow = game && game.story && Number.isFinite(Number(game.story.tick)) ? Math.floor(Number(game.story.tick)) : 0;
            if (lastCheckedTick !== null && tickNow === lastCheckedTick) continue;
            lastCheckedTick = tickNow;

            const expectedHash = expected[String(tickNow)] || null;
            if (!expectedHash) {
                continue;
            }

            const actualHash = game.hashSnapshot(game.snapshot());
            if (expectedHash !== actualHash) {
                const dk = (() => {
                    const map = replay && replay.expectedTickDeltaKeys && typeof replay.expectedTickDeltaKeys === 'object' ? replay.expectedTickDeltaKeys : null;
                    const fromMap = map && typeof map[String(tickNow)] === 'string' ? map[String(tickNow)] : null;
                    return fromMap || deltaKey;
                })();

                const expectedCore = replay && replay.expectedTickCore && typeof replay.expectedTickCore === 'object'
                    ? (replay.expectedTickCore[String(tickNow)] || null)
                    : null;
                if (!expectedCore) issues.push('EXPECTED_CORE_MISSING');
                const actualCore = getReplayCoreSnapshot(game);
                const diffs = shallowDiff(expectedCore, actualCore);

                mismatch = {
                    mismatchTick: tickNow,
                    lastGoodTick,
                    expectedHash,
                    actualHash,
                    deltaKey: dk,
                    diffs
                };
                break;
            }
            lastGoodTick = tickNow;
        }

        if (replay) replay.enabled = savedReplayEnabled;
    } finally {
        const restore = JSON.parse(backupState);
        Object.assign(game, restore);
        game.rng = originalRng;
        game._replayBaseline = backupBaseline;
    }

    return { ok: !mismatch, mismatch, issues };
}

function runReplayCollectForEngine(gs, engine) {
    const game = gs && typeof gs === 'object' ? gs : null;
    const issues = [];
    if (!game) return { ok: false, tickHashes: {}, tickCore: {}, tickDeltaKeys: {}, issues: ['INVALID_GAMESTATE'] };

    const replay = game.replay && typeof game.replay === 'object' ? game.replay : null;
    const actions = replay && Array.isArray(replay.actions) ? replay.actions.slice() : [];
    if (!actions.length) return { ok: true, tickHashes: {}, tickCore: {}, tickDeltaKeys: {}, issues: [] };

    if (!game._replayBaseline && typeof game.captureReplayBaseline === 'function') {
        game.captureReplayBaseline('runReplayCollectForEngine');
    }

    const tickHashes = {};
    const tickCore = {};
    const tickDeltaKeys = {};

    const originalRng = game.rng;
    const backupState = JSON.stringify(game, (k, v) => {
        if (typeof v === 'function') return undefined;
        if (k === 'rng') return undefined;
        return v;
    });
    const backupBaseline = game._replayBaseline ? JSON.parse(JSON.stringify(game._replayBaseline)) : null;

    const win = (typeof window !== 'undefined') ? window : null;
    const savedEngine = win ? win.CombatEngine : null;

    const runWithCapture = (fn) => {
        if (typeof UI !== 'undefined' && UI && typeof UI.withLogCapture === 'function') return UI.withLogCapture(fn);
        return fn();
    };

    try {
        if (typeof game.restoreReplayBaseline === 'function' && !game.restoreReplayBaseline()) {
            issues.push('BASELINE_MISSING');
        }

        const savedReplayEnabled = replay && replay.enabled === true;
        if (replay) replay.enabled = false;

        if (win) win.CombatEngine = engine;

        runWithCapture(() => {
            let lastCheckedTick = null;
            for (let i = 0; i < actions.length; i++) {
                const action = actions[i];
                if (!action || typeof action !== 'object') continue;
                if (typeof Logic !== 'undefined' && Logic && typeof Logic.applyReplayAction === 'function') {
                    Logic.applyReplayAction(action, { record: false, silent: true });
                } else {
                    issues.push('LOGIC_REPLAY_EXECUTOR_MISSING');
                    break;
                }

                if (action.type !== 'tick') continue;
                if (typeof game.hashSnapshot !== 'function' || typeof game.snapshot !== 'function') {
                    issues.push('HASH_API_MISSING');
                    break;
                }

                const tickNow = game && game.story && Number.isFinite(Number(game.story.tick)) ? Math.floor(Number(game.story.tick)) : 0;
                if (lastCheckedTick !== null && tickNow === lastCheckedTick) continue;
                lastCheckedTick = tickNow;

                const hash = game.hashSnapshot(game.snapshot());
                tickHashes[String(tickNow)] = hash;

                const core = getReplayCoreSnapshot(game);
                if (core) tickCore[String(tickNow)] = core;

                const dk = typeof action.deltaKey === 'string' && action.deltaKey.trim() ? action.deltaKey.trim() : null;
                if (dk) tickDeltaKeys[String(tickNow)] = dk;
            }
        });

        if (replay) replay.enabled = savedReplayEnabled;
    } finally {
        if (win) win.CombatEngine = savedEngine;
        const restore = JSON.parse(backupState);
        Object.assign(game, restore);
        game.rng = originalRng;
        game._replayBaseline = backupBaseline;
    }

    return { ok: issues.length === 0, tickHashes, tickCore, tickDeltaKeys, issues };
}

function shadowRunReplayMismatch(gs, engineKeyA, engineKeyB) {
    const game = gs && typeof gs === 'object' ? gs : null;
    if (!game) return { ok: false, mismatch: null, issues: ['INVALID_GAMESTATE'], engineA: null, engineB: null };

    const win = (typeof window !== 'undefined') ? window : null;
    const reg = (win && win.CombatEngineRegistry && typeof win.CombatEngineRegistry === 'object') ? win.CombatEngineRegistry : {};

    const pickEngineEntry = (key) => {
        const k = typeof key === 'string' ? key : null;
        if (k && reg[k] && reg[k].engine) return { key: k, name: reg[k].name || k, version: reg[k].version || null, engine: reg[k].engine };
        const keys = Object.keys(reg);
        if (keys.length) {
            const e = reg[keys[0]];
            if (e && e.engine) return { key: keys[0], name: e.name || keys[0], version: e.version || null, engine: e.engine };
        }
        return null;
    };

    const entryA = pickEngineEntry(engineKeyA);
    const entryB = pickEngineEntry(engineKeyB);
    if (!entryA || !entryB) return { ok: false, mismatch: null, issues: ['ENGINE_REGISTRY_EMPTY'], engineA: entryA, engineB: entryB };

    const issues = [];

    const collectA = runReplayCollectForEngine(game, entryA.engine);
    if (collectA.issues && collectA.issues.length) issues.push(...collectA.issues.map(x => `A:${x}`));

    const replay = game.replay && typeof game.replay === 'object' ? game.replay : null;
    if (!replay) return { ok: false, mismatch: null, issues: ['REPLAY_MISSING'], engineA: entryA, engineB: entryB };

    const backupExpected = {
        expectedTickHashes: replay.expectedTickHashes,
        expectedTickCore: replay.expectedTickCore,
        expectedTickDeltaKeys: replay.expectedTickDeltaKeys
    };

    const savedEngine = win ? win.CombatEngine : null;
    try {
        replay.expectedTickHashes = collectA.tickHashes;
        replay.expectedTickCore = collectA.tickCore;
        replay.expectedTickDeltaKeys = collectA.tickDeltaKeys;

        if (win) win.CombatEngine = entryB.engine;
        const out = verifyReplayMismatch(game);
        if (out && Array.isArray(out.issues) && out.issues.length) issues.push(...out.issues.map(x => `B:${x}`));

        return { ok: out && out.ok === true, mismatch: out ? out.mismatch : null, issues, engineA: entryA, engineB: entryB };
    } finally {
        if (win) win.CombatEngine = savedEngine;
        replay.expectedTickHashes = backupExpected.expectedTickHashes;
        replay.expectedTickCore = backupExpected.expectedTickCore;
        replay.expectedTickDeltaKeys = backupExpected.expectedTickDeltaKeys;
    }
}

if (typeof window !== 'undefined') {
    window.gameState = gameState;
    window.HeartDemonSystem = HeartDemonSystem;
    window.EventSystem = EventSystem;
    window.buildReplayTimeline = buildReplayTimeline;
    window.verifyReplayMismatch = verifyReplayMismatch;
    window.getReplayCoreSnapshot = getReplayCoreSnapshot;
    window.runReplayCollectForEngine = runReplayCollectForEngine;
    window.shadowRunReplayMismatch = shadowRunReplayMismatch;
    console.log('[System] State.js partially restored (MISSING CONTENT).');
}
