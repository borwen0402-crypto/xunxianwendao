/**
 * CombatEngine Interface Contract (V2.0 Freeze)
 * 
 * 1. Pure Function: run(context, rng, options) -> Output
 *    - context: Read-only state snapshot (player, monster, etc.)
 *    - rng: Deterministic random number generator function () -> [0, 1)
 *    - options: Configuration (realmRule, maxRounds, etc.)
 * 
 * 2. Output Schema:
 *    {
 *      result: 'win' | 'loss' | 'draw',
 *      delta: { playerHp, playerMp, monsterHp, ... }, // Numeric diffs
 *      logs: [ { type, text, tag, meta } ],          // Structured logs
 *      effects: [],                                  // External effects (visual/delayed)
 *      statusChanges: [],                            // Buff/Debuff applications
 *      meta: { ... }                                 // Traceability metadata
 *    }
 * 
 * 3. Constraints:
 *    - No side effects on global state.
 *    - No direct DOM manipulation.
 *    - Deterministic output for same input + rng sequence.
 */
const CombatEngine = {
    version: "2.0",

    createCombat: function(player, monsters, env) {
        const p = player && typeof player === 'object' ? player : {};
        const list = Array.isArray(monsters) ? monsters : (monsters ? [monsters] : []);
        const normalizedMonsters = list
            .map((m, idx) => {
                const obj = m && typeof m === 'object' ? m : {};
                const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `m${idx}`;
                return {
                    id,
                    name: obj.name || "未知妖物",
                    hp: Number(obj.hp) || 0,
                    maxHp: typeof obj.maxHp === 'number' ? obj.maxHp : (Number(obj.maxHp) || (Number(obj.hp) || 0)),
                    atk: Number(obj.atk) || 0,
                    def: Number(obj.def) || 0,
                    speed: Number(obj.speed) || 0,
                    dangerLevel: typeof obj.dangerLevel === 'number' ? obj.dangerLevel : (Number(obj.dangerLevel) || 0),
                    statuses: Array.isArray(obj.statuses) ? obj.statuses.slice() : [],
                    tags: Array.isArray(obj.tags) ? obj.tags.slice() : [],
                    skills: Array.isArray(obj.skills) ? obj.skills.slice() : [],
                    critRate: Number.isFinite(Number(obj.critRate)) ? Number(obj.critRate) : undefined,
                    critMult: Number.isFinite(Number(obj.critMult)) ? Number(obj.critMult) : undefined,
                    damageReduction: Number.isFinite(Number(obj.damageReduction)) ? Number(obj.damageReduction) : undefined
                };
            })
            .filter(Boolean);
        const e = env && typeof env === 'object' ? env : {};
        const envOut = {
            mapId: e.mapId || "未知",
            difficulty: Number.isFinite(Number(e.difficulty)) ? Number(e.difficulty) : 1,
            yinYang: Number.isFinite(Number(e.yinYang)) ? Number(e.yinYang) : 0,
            world: (typeof e.world === 'string' && e.world.trim()) ? e.world.trim() : 'yang'
        };

        const playerOut = {
            hp: Number(p.hp) || 0,
            mp: Number(p.mp) || 0,
            maxHp: Number.isFinite(Number(p.maxHp)) ? Number(p.maxHp) : null,
            maxMp: Number.isFinite(Number(p.maxMp)) ? Number(p.maxMp) : null,
            atk: Number(p.atk) || 0,
            matk: Number(p.matk) || 0,
            techPower: Number.isFinite(Number(p.techPower)) ? Number(p.techPower) : (Number.isFinite(Number(p.tech)) ? Number(p.tech) : (Number(p.matk) || 0)),
            spellPower: Number.isFinite(Number(p.spellPower)) ? Number(p.spellPower) : (Number.isFinite(Number(p.spellDamage)) ? Number(p.spellDamage) : (Number(p.matk) || 0)),
            speed: Number(p.speed) || 0,
            critRate: Number.isFinite(Number(p.critRate)) ? Number(p.critRate) : undefined,
            critMult: Number.isFinite(Number(p.critMult)) ? Number(p.critMult) : undefined,
            damageReduction: Number.isFinite(Number(p.damageReduction)) ? Number(p.damageReduction) : undefined,
            interruptResist: Number.isFinite(Number(p.interruptResist)) ? Number(p.interruptResist) : undefined,
            realm: p.realm || "寻道",
            subRealm: p.subRealm || "初期",
            activeDao: p.activeDao || "随机",
            name: p.username || p.name || "你",
            statuses: Array.isArray(p.statuses) ? p.statuses.slice() : []
        };

        const firstAlive = normalizedMonsters.find(m => (Number(m.hp) || 0) > 0);
        return {
            round: 0,
            player: playerOut,
            monsters: normalizedMonsters,
            env: envOut,
            activeTargetId: firstAlive ? firstAlive.id : null
        };
    },

    run: function(context, rngOrOptions, maybeOptions) {
        const options = (typeof rngOrOptions === 'function')
            ? (maybeOptions && typeof maybeOptions === 'object' ? maybeOptions : {})
            : (rngOrOptions && typeof rngOrOptions === 'object' ? rngOrOptions : {});
        const rng = typeof rngOrOptions === 'function' ? rngOrOptions : options.rng;
        if (typeof rng !== 'function') {
            return {
                result: 'draw',
                delta: { playerHp: 0, playerMp: 0, monsterHp: 0 },
                logs: [{ type: 'sys', tag: 'engine_error', text: '[CombatEngine] RNG missing: explicit failure.' }],
                effects: [],
                statusChanges: [],
                flags: { invalidRng: true },
                meta: { source: 'CombatEngine', error: 'RNG_REQUIRED' }
            };
        }
        const random = rng;
        const normalized = this.normalizeContext(context, options);
        const player = normalized.player;
        const monsters = normalized.monsters;
        const env = normalized.env;
        const round = normalized.round;
        const battlePhase = normalized.phase;
        const baseCombat = this.buildCombatBase(context, normalized);

        const startingPlayerHp = Number(player.hp) || 0;
        const startingPlayerMp = Number(player.mp) || 0;
        const playerAtk = Number(player.atk) || 0;
        const playerMatk = Number(player.matk) || 0;
        const playerRealm = player.realm || "寻道";
        const playerSubRealm = player.subRealm || "初期";
        const playerActiveDao = player.activeDao || "随机";
        const playerDaoType = typeof player.daoType === 'string' ? player.daoType : null;
        const playerMaxHp = typeof player.maxHp === 'number' ? player.maxHp : null;
        const playerMaxMp = typeof player.maxMp === 'number' ? player.maxMp : null;

        const logs = [];
        const flags = { seriousInjury: false };
        const statusChanges = [];
        const effects = [];
        const traceMeta = (() => {
            const t = options && typeof options.trace === 'object' ? options.trace : null;
            const base = { source: 'CombatEngine' };
            if (t) Object.keys(t).forEach(k => { base[k] = t[k]; });
            if (!(typeof base.deltaKey === 'string' && base.deltaKey.trim())) {
                const ids = Array.isArray(monsters) ? monsters.map(m => (m && typeof m.id === 'string' ? m.id : '')).filter(Boolean).join('.') : '';
                base.deltaKey = `CombatEngine#r${typeof round === 'number' ? round : 0}:${ids || 'm'}`;
            }
            return base;
        })();

        let playerHp = startingPlayerHp;
        let playerMp = startingPlayerMp;
        const monsterHpById = {};
        const startingMonsterHpById = {};
        monsters.forEach(m => {
            const id = m.id;
            const hp = Number(m.hp) || 0;
            monsterHpById[id] = hp;
            startingMonsterHpById[id] = hp;
        });
        const findStatus = (list, id) => {
            if (!Array.isArray(list) || !id) return null;
            for (let i = 0; i < list.length; i++) {
                const s = list[i];
                if (!s || typeof s !== 'object') continue;
                if (s.id === id) return s;
            }
            return null;
        };
        const appendDurationTicks = () => {
            const touched = new Set();
            const targetKeyOf = (t) => {
                if (t === 'player') return 'player';
                if (t && typeof t === 'object' && typeof t.monsterId === 'string') return `m:${t.monsterId}`;
                return '';
            };
            const statusKeyOf = (s) => {
                if (!s || typeof s !== 'object') return '';
                if (typeof s.id === 'string' && s.id) return s.id;
                if (typeof s.name === 'string' && s.name) return s.name;
                return '';
            };
            for (let i = 0; i < statusChanges.length; i++) {
                const ch = statusChanges[i];
                if (!ch || typeof ch !== 'object') continue;
                const tk = targetKeyOf(ch.target);
                const sk = statusKeyOf(ch.status);
                if (!tk || !sk) continue;
                touched.add(`${tk}|${sk}`);
            }
            const pushTick = (target, list) => {
                if (!Array.isArray(list) || !list.length) return;
                const tk = targetKeyOf(target);
                if (!tk) return;
                for (let i = 0; i < list.length; i++) {
                    const s0 = list[i];
                    const sk = statusKeyOf(s0);
                    if (!sk) continue;
                    if (touched.has(`${tk}|${sk}`)) continue;
                    const d = Number(s0.duration);
                    if (!Number.isFinite(d)) continue;
                    const d0 = Math.floor(d);
                    if (d0 <= 0) {
                        statusChanges.push({ target, op: 'expire', status: { id: sk } });
                        continue;
                    }
                    const d1 = d0 - 1;
                    if (d1 <= 0) {
                        statusChanges.push({ target, op: 'expire', status: { id: sk } });
                    } else {
                        statusChanges.push({ target, op: 'tick', status: Object.assign({}, s0, { duration: d1 }) });
                    }
                }
            };
            pushTick('player', player && Array.isArray(player.statuses) ? player.statuses : []);
            for (let i = 0; i < monsters.length; i++) {
                const m = monsters[i];
                if (!m || typeof m !== 'object') continue;
                pushTick({ monsterId: m.id }, Array.isArray(m.statuses) ? m.statuses : []);
            }
        };

        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            if (!m || typeof m !== 'object') continue;
            const hp = Number(monsterHpById[m.id]) || 0;
            if (hp <= 0) continue;
            const burn = findStatus(m.statuses, 'burn');
            if (!burn) continue;
            const maxHp = Number(m.maxHp) || Math.max(1, Number(m.hp) || 1);
            const pct = Number.isFinite(Number(burn.hpPct)) ? Number(burn.hpPct) : 0.05;
            const rawDmg = Math.max(1, Math.floor(maxHp * Math.max(0, Math.min(0.5, pct))));
            const reduction = this.getDamageReduction(m);
            const dmg = Math.max(1, Math.floor(rawDmg * (1 - reduction)));
            monsterHpById[m.id] = Math.max(0, hp - dmg);
            logs.push({ type: 'battle', text: `【${m.name}】灼烧作痛，损失 ${dmg} 气血`, tag: 'dmg', round, sourceId: 'player', targetId: m.id, meta: { action: 'dot', statusId: 'burn', damage: dmg, breakdown: { kind: 'dot', damageType: 'Spell', statusId: 'burn', maxHp, hpPct: pct, rawDamage: rawDmg, damageReduction: reduction, final: dmg } } });
        }

        const target = this.pickTarget(monsters, monsterHpById, normalized.activeTargetId);
        const targetDangerLevel = target ? target.dangerLevel : 0;
        const playerSuppression = this.computeRealmSuppression(
            { playerRealm, playerSubRealm, monsterDangerLevel: targetDangerLevel, envDifficulty: env.difficulty },
            options
        );
        this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, playerSuppression);

        const playerStatusRuleRes = this.callRule(options, 'status', { phase: 'player', battlePhase, player, target, monsters, env, round, rng: random, suppression: playerSuppression });
        this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, playerStatusRuleRes);

        const skill = this.resolveSkill(options, playerActiveDao, playerRealm, playerSubRealm, env, random);
        const baseMpCostMult = (typeof playerSuppression.mpCostMult === 'number' ? playerSuppression.mpCostMult : 1)
            * (playerStatusRuleRes && typeof playerStatusRuleRes.mpCostMult === 'number' ? playerStatusRuleRes.mpCostMult : 1);
        const skillCostRuleRes = this.callRule(options, 'skill', { phase: 'cost', battlePhase, player, skill, target, monsters, env, round, rng: random, suppression: playerSuppression });
        this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, skillCostRuleRes);
        const skillMpCostRaw = skill && skill.cost && typeof skill.cost === 'object' && skill.cost && (skill.cost.mp !== undefined)
            ? Number(skill.cost.mp)
            : (skill && skill.mpCost ? Number(skill.mpCost) : 0);
        const skillMpCostAdjusted = skillCostRuleRes && typeof skillCostRuleRes.mpCost === 'number'
            ? Math.max(0, Math.floor(skillCostRuleRes.mpCost))
            : Math.max(0, Math.floor(skillMpCostRaw * baseMpCostMult * (skillCostRuleRes && typeof skillCostRuleRes.mpCostMult === 'number' ? skillCostRuleRes.mpCostMult : 1)));
        const canCastSkill = !!(skill && skillMpCostAdjusted > 0 && playerMp >= skillMpCostAdjusted);

        if (target) {
            const realmConfig = (typeof GameData !== 'undefined' && GameData.realms && GameData.realms[playerRealm]) ? GameData.realms[playerRealm] : { skillMult: 1 };
            const action = canCastSkill ? 'skill' : 'basic';
            const skillEffectRuleRes = this.callRule(options, 'skill', { phase: 'effect', battlePhase, action, player, skill: canCastSkill ? skill : null, target, monsters, env, round, rng: random, suppression: playerSuppression });
            this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, skillEffectRuleRes);

            const baseSuppressionDamageMult = typeof playerSuppression.damageMult === 'number' ? playerSuppression.damageMult : 1;
            const statusDamageMult = playerStatusRuleRes && typeof playerStatusRuleRes.damageMult === 'number' ? playerStatusRuleRes.damageMult : 1;
            const skillDamageMult = skillEffectRuleRes && typeof skillEffectRuleRes.damageMult === 'number' ? skillEffectRuleRes.damageMult : 1;
            const damageMult = baseSuppressionDamageMult * statusDamageMult * skillDamageMult;
            const flatDamage = skillEffectRuleRes && typeof skillEffectRuleRes.flatDamage === 'number' ? skillEffectRuleRes.flatDamage : 0;

        const dealTo = (monsterId, dmg, hitIdx, usedSkill, actionType, breakdown) => {
            monsterHpById[monsterId] = (Number(monsterHpById[monsterId]) || 0) - dmg;
            effects.push({ source: 'player', target: { monsterId }, type: 'hp', value: -dmg, meta: { kind: 'damage', hit: hitIdx, breakdown: breakdown || undefined } });
            const monsterObj = monsters.find(mm => mm && mm.id === monsterId) || target;
            const afterHp = Number(monsterHpById[monsterId]) || 0;
            if (afterHp <= 0 && monsterObj && Array.isArray(monsterObj.tags) && monsterObj.tags.includes('undying_once') && !findStatus(monsterObj.statuses, 'undying_used')) {
                monsterHpById[monsterId] = 1;
                statusChanges.push({ target: { monsterId }, op: 'refresh', status: { id: 'undying_used', name: '不腐之躯', stacks: 1, duration: 999 } });
                logs.push({ type: 'battle', text: `不腐之躯，残血不倒！`, tag: 'status_undying', round, sourceId: monsterId });
            }
            const playerOnHitRes = this.callRule(options, 'status', { phase: 'onHit', battlePhase, action: actionType, kind: 'damage', amount: dmg, source: 'player', target: { monsterId }, player, skill: usedSkill, monster: monsterObj, monsters, env, round, rng: random, suppression: playerSuppression });
            this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, playerOnHitRes);
        };

        if (canCastSkill) {
                const chant = (skill && typeof skill.chant === 'string' && skill.chant.trim()) ? skill.chant.trim() : '';
                if (chant) logs.push({ type: 'battle', text: chant, tag: 'chant', round, meta: { action: 'skill', skillName: skill.name } });

                const cost = (skill && skill.cost && typeof skill.cost === 'object') ? skill.cost : null;
                const hpPct = cost && Number.isFinite(Number(cost.hpPct)) ? Math.max(0, Number(cost.hpPct)) : 0;
                const hpFlat = cost && Number.isFinite(Number(cost.hp)) ? Math.max(0, Math.floor(Number(cost.hp))) : 0;
                const hpPctCost = hpPct > 0 ? Math.floor(((playerMaxHp !== null ? playerMaxHp : startingPlayerHp) || 0) * hpPct) : 0;
                const totalHpCost = hpPctCost + hpFlat;
                const omenDelta = skill && Number.isFinite(Number(skill.omenDelta)) ? Math.trunc(Number(skill.omenDelta)) : 0;
                const chaosDelta = skill && Number.isFinite(Number(skill.chaosDelta)) ? Math.trunc(Number(skill.chaosDelta)) : 0;
                const omenCost = cost && Number.isFinite(Number(cost.omen)) ? Math.trunc(Number(cost.omen)) : 0;
                const chaosCost = cost && Number.isFinite(Number(cost.chaos)) ? Math.trunc(Number(cost.chaos)) : 0;
                const omenAll = omenDelta + omenCost;
                const chaosAll = chaosDelta + chaosCost;

                playerMp -= skillMpCostAdjusted;
                if (totalHpCost > 0) {
                    playerHp = Math.max(0, playerHp - totalHpCost);
                }
                if (totalHpCost > 0 || skillMpCostAdjusted > 0) {
                    const parts = [];
                    if (skillMpCostAdjusted > 0) parts.push(`MP-${skillMpCostAdjusted}`);
                    if (totalHpCost > 0) parts.push(`HP-${totalHpCost}`);
                    logs.push({ type: 'battle', text: `代价：${parts.join('，')}`, tag: 'skill_cost', round, meta: { action: 'skill', skillName: skill.name } });
                }

                const tags = Array.isArray(skill && skill.tags) ? skill.tags : [];
                const isAoe = tags.includes('aoe');
                const isDoubleHit = tags.includes('double_hit');
                const isSummonGhost = tags.includes('summon') && tags.includes('ghost');
                const isGhostBuff = tags.includes('ghost') && tags.includes('buff');
                const isInvert = tags.includes('invert');
                const isYang = tags.includes('yang');
                const isYin = tags.includes('yin');
                const isSpiritBonus = tags.includes('spirit_bonus');
                const damageSpec = this.normalizeSkillDamageSpec(skill, 'skill');

                if (omenAll !== 0 || chaosAll !== 0) {
                    const payload = {};
                    if (omenAll !== 0) payload.omen = omenAll;
                    if (chaosAll !== 0) payload.chaos = chaosAll;
                    effects.push({ target: 'world', type: 'tendenciesDelta', payload, meta: { external: true } });
                    const parts = [];
                    if (omenAll !== 0) parts.push(`Omen${omenAll > 0 ? `+${omenAll}` : `${omenAll}`}`);
                    if (chaosAll !== 0) parts.push(`Chaos${chaosAll > 0 ? `+${chaosAll}` : `${chaosAll}`}`);
                    logs.push({ type: 'battle', text: `世界代价：${parts.join('，')}`, tag: 'skill_cost', round, sourceId: 'player', meta: { action: 'skill', skillName: skill.name } });
                }

                if (isInvert && env && typeof env.mapId === 'string' && env.mapId.trim()) {
                    effects.push({ target: 'mapState', type: 'invertYinYang', payload: { mapId: env.mapId.trim() }, meta: { external: true } });
                    logs.push({ type: 'battle', text: '阴阳被你拨动，气机翻转。', tag: 'skill', round, sourceId: 'player', meta: { action: 'skill', skillName: skill.name } });
                }

                if (isSummonGhost) {
                    const urn = player && player.soulUrn && typeof player.soulUrn === 'object' ? player.soulUrn : null;
                    const capBase = urn && Number.isFinite(Number(urn.capacity)) ? Math.max(0, Math.floor(Number(urn.capacity))) : 1;
                    const realmIdx = (typeof GameData !== 'undefined' && GameData.realms && playerRealm && GameData.realms[playerRealm] && Number.isFinite(Number(GameData.realms[playerRealm].index)))
                        ? Math.max(1, Math.min(10, Math.floor(Number(GameData.realms[playerRealm].index))))
                        : 1;
                    const cap = capBase + (realmIdx >= 4 ? 2 : (realmIdx >= 3 ? 1 : 0));
                    const list = Array.isArray(player.ghosts) ? player.ghosts : [];
                    player.ghosts = list;
                    if (cap > 0 && list.length >= cap) {
                        logs.push({ type: 'battle', text: '魂瓮已满，鬼影化作一缕魂力。', tag: 'skill', round, sourceId: 'player', meta: { action: 'skill', skillName: skill.name } });
                        effects.push({ target: 'inventory', type: 'item', payload: { name: '魂力碎片', countDelta: 1 }, meta: { external: true } });
                    } else {
                        const types = ['战士', '防御', '动物', '法师', '刺客'];
                        const pick = types[Math.floor(random() * types.length)] || '战士';
                        const isElite = tags.includes('elite');
                        const rank = isElite ? '鬼王' : '厉鬼';
                        const gid = `${traceMeta.deltaKey}:ghost#${list.length + 1}`;
                        const maxHp = Math.max(1, Math.floor(40 + realmIdx * 8 + (isElite ? 25 : 0)));
                        const g = { id: gid, type: pick, rank, level: 1, exp: 0, loyalty: 50, resentment: 0, hp: maxHp, maxHp };
                        list.push(g);
                        logs.push({ type: 'battle', text: `鬼物成形：${rank}·${pick}`, tag: 'skill', round, sourceId: 'player', meta: { action: 'skill', skillName: skill.name } });
                        effects.push({ target: 'ghosts', type: 'add', payload: g, meta: { external: true } });
                    }
                }

                if (isGhostBuff) {
                    effects.push({ target: 'ghosts', type: 'healAll', value: 0.2, meta: { external: true } });
                    logs.push({ type: 'battle', text: '鬼气回涌，鬼物气机稍稳。', tag: 'skill', round, sourceId: 'player', meta: { action: 'skill', skillName: skill.name } });
                }

                const envYinYang = env && Number.isFinite(Number(env.yinYang)) ? Number(env.yinYang) : 0;
                const envMult = (isYang && envYinYang < 0) ? 1.2 : ((isYin && envYinYang > 0) ? 1.2 : 1);
                const computeHit = (mult, spiritMult, defender) => {
                    const systemMult = (Number(realmConfig.skillMult) || 1) * (Number(damageMult) || 1) * (Number(envMult) || 1) * (Number(mult) || 1) * (Number(spiritMult) || 1);
                    return this.computeDamage({
                        attacker: player,
                        defender,
                        spec: damageSpec,
                        rng: random,
                        flatAdd: flatDamage,
                        systemMult,
                        bonusPct: 0
                    });
                };

                if (isAoe) {
                    let total = 0;
                    const hits = [];
                    for (let i = 0; i < monsters.length; i++) {
                        const mm = monsters[i];
                        const mhp = Number(monsterHpById[mm.id]) || 0;
                        if (mhp <= 0) continue;
                        const spiritMult = isSpiritBonus && Array.isArray(mm.tags) && mm.tags.includes('spirit') ? 1.5 : 1;
                        const res = computeHit(0.9, spiritMult, mm);
                        const d = Math.max(0, Number(res.damage) || 0);
                        total += d;
                        hits.push({ targetId: mm.id, damage: d, breakdown: res.breakdown || undefined });
                        if (d > 0) dealTo(mm.id, d, 1, skill, 'skill', res.breakdown);
                    }
                    logs.push({ type: 'battle', text: `[${skill.name}] ${skill.text} 波及全体，造成总计 ${total} 伤害`, tag: 'skill', round, targetId: target.id, sourceId: 'player', meta: { action: 'skill', skillName: skill.name, damage: total, hits } });
                } else if (isDoubleHit) {
                    const spiritMult = isSpiritBonus && Array.isArray(target.tags) && target.tags.includes('spirit') ? 1.5 : 1;
                    const r1 = computeHit(0.8, spiritMult, target);
                    const r2 = computeHit(0.8, spiritMult, target);
                    const d1 = Math.max(0, Number(r1.damage) || 0);
                    const d2 = Math.max(0, Number(r2.damage) || 0);
                    if (d1 > 0) dealTo(target.id, d1, 1, skill, 'skill', r1.breakdown);
                    if (d2 > 0) dealTo(target.id, d2, 2, skill, 'skill', r2.breakdown);
                    const sum = d1 + d2;
                    logs.push({ type: 'battle', text: `[${skill.name}] ${skill.text} 连击两次，造成 ${sum} 伤害`, tag: 'skill', round, targetId: target.id, sourceId: 'player', meta: { action: 'skill', skillName: skill.name, damage: sum, hits: [{ targetId: target.id, damage: d1, breakdown: r1.breakdown || undefined }, { targetId: target.id, damage: d2, breakdown: r2.breakdown || undefined }] } });
                } else if (this.skillHasDamagePotential(damageSpec, flatDamage)) {
                    const spiritMult = isSpiritBonus && Array.isArray(target.tags) && target.tags.includes('spirit') ? 1.5 : 1;
                    const r = computeHit(1, spiritMult, target);
                    const playerDmg = Math.max(0, Number(r.damage) || 0);
                    if (playerDmg > 0) dealTo(target.id, playerDmg, 1, skill, 'skill', r.breakdown);
                    logs.push({ type: 'battle', text: `[${skill.name}] ${skill.text} 造成 ${playerDmg} 伤害`, tag: 'skill', round, targetId: target.id, sourceId: 'player', meta: { action: 'skill', skillName: skill.name, damage: playerDmg, hits: [{ targetId: target.id, damage: playerDmg, breakdown: r.breakdown || undefined }] } });
                } else {
                    logs.push({ type: 'battle', text: `[${skill.name}] ${skill.text}`, tag: 'skill', round, targetId: target.id, sourceId: 'player', meta: { action: 'skill', skillName: skill.name, damage: 0 } });
                }

                if (skill.heal) {
                    const healAmt = Math.floor(skill.heal * realmConfig.skillMult);
                    const healed = healAmt > 0 ? healAmt : 0;
                    if (playerMaxHp !== null) {
                        playerHp = Math.min(playerMaxHp, playerHp + healed);
                    } else {
                        playerHp = playerHp + healed;
                    }
                    effects.push({ source: 'player', target: 'player', type: 'hp', value: healed, meta: { kind: 'heal' } });
                    if (healed > 0) logs.push({ type: 'battle', text: `恢复 ${healed} 气血`, tag: 'skill_heal', round, sourceId: 'player', meta: { action: 'skill', skillName: skill.name, heal: healed } });
                }
            } else {
                const isSpirit = Array.isArray(target.tags) && target.tags.includes('spirit');
                const qiankunMult = (playerDaoType === '乾坤道' && isSpirit) ? 1.2 : 1;
                const basicSpec = this.normalizeSkillDamageSpec(null, 'basic');
                const systemMult = (Number(damageMult) || 1) * (Number(qiankunMult) || 1);
                const r = this.computeDamage({
                    attacker: player,
                    defender: target,
                    spec: basicSpec,
                    rng: random,
                    flatAdd: flatDamage,
                    systemMult,
                    bonusPct: 0
                });
                const playerDmg = Math.max(0, Number(r.damage) || 0);
                if (playerDmg > 0) dealTo(target.id, playerDmg, 1, null, 'basic', r.breakdown);

                logs.push({ type: 'battle', text: `[普攻] 施展基础招式，造成 ${playerDmg} 伤害`, tag: 'dmg', round, targetId: target.id, sourceId: 'player', meta: { action: 'basic', skillName: '普攻', damage: playerDmg, hits: [{ targetId: target.id, damage: playerDmg, breakdown: r.breakdown || undefined }] } });

                const mpRegen = 5;
                if (playerMaxMp !== null) {
                    playerMp = Math.min(playerMaxMp, playerMp + mpRegen);
                } else {
                    playerMp = playerMp + mpRegen;
                }
                effects.push({ source: 'player', target: 'player', type: 'mp', value: mpRegen, meta: { kind: 'regen' } });
            }

            const ghosts = Array.isArray(player && player.ghosts) ? player.ghosts : [];
            if (ghosts.length) {
                const t2 = this.pickTarget(monsters, monsterHpById, normalized.activeTargetId);
                if (t2) {
                    let sum = 0;
                    const hits = [];
                    for (let gi = 0; gi < ghosts.length; gi++) {
                        const g = ghosts[gi];
                        if (!g || typeof g !== 'object') continue;
                        const rank = typeof g.rank === 'string' ? g.rank : '厉鬼';
                        const base = rank === '鬼皇' ? 18 : (rank === '鬼王' ? 14 : 10);
                        const inherit = rank === '鬼皇' ? 0.35 : (rank === '鬼王' ? 0.28 : 0.22);
                        const summonAttacker = {
                            atk: Math.max(0, Math.floor(base + (Number(playerAtk) || 0) * inherit)),
                            techPower: Math.max(0, Math.floor((Number(player.techPower) || Number(playerMatk) || 0) * inherit)),
                            spellPower: Math.max(0, Math.floor((Number(player.spellPower) || Number(playerMatk) || 0) * inherit)),
                            critRate: 0,
                            critMult: (Number(player.critMult) || 1.5),
                            damageReduction: 0
                        };
                        const summonSpec = this.normalizeSkillDamageSpec(null, 'summon');
                        const r = this.computeDamage({
                            attacker: summonAttacker,
                            defender: t2,
                            spec: summonSpec,
                            rng: random,
                            flatAdd: 0,
                            systemMult: 1,
                            bonusPct: 0
                        });
                        const dmg = Math.max(0, Number(r.damage) || 0);
                        sum += dmg;
                        hits.push({ targetId: t2.id, damage: dmg, breakdown: r.breakdown || undefined });
                        if (dmg > 0) dealTo(t2.id, dmg, gi + 1, null, 'summon', r.breakdown);
                    }
                    if (sum > 0) logs.push({ type: 'battle', text: `鬼物出手，造成 ${sum} 伤害`, tag: 'skill', round, targetId: t2.id, sourceId: 'player', meta: { action: 'summon', damage: sum, hits } });
                }
            }
        }

        if (this.allMonstersDefeated(monsters, monsterHpById)) {
            appendDurationTicks();
            return this.buildResult({
                result: "win",
                startingPlayerHp,
                startingPlayerMp,
                playerHp,
                playerMp,
                startingMonsterHpById,
                monsterHpById,
                targetIdForLegacy: target ? target.id : null,
                combat: baseCombat,
                logs,
                flags,
                statusChanges,
                effects,
                traceMeta
            });
        }

        const monsterCountAtStart = monsters.length;
        for (let i = 0; i < monsterCountAtStart; i++) {
            const m = monsters[i];
            const mHp = Number(monsterHpById[m.id]) || 0;
            if (mHp <= 0) continue;

            const sealed = findStatus(m.statuses, 'sealed');
            if (m.name === '山鬼' && !sealed) {
                const chant = findStatus(m.statuses, 'shan_ghost_chant');
                if (!chant && round === 0) {
                    const text = "“叮铃铃，叮铃铃，\n一阵风，一阵铃。\n有人说，有人言：\n雷填填兮，雨冥冥，\n猨啾啾兮，狖夜鸣，\n风飒飒兮，木萧萧，\n思公子兮，徒离忧……”";
                    logs.push({ type: 'battle', text, tag: 'skill_chant', round, sourceId: m.id, meta: { action: 'monster_skill', skillName: '山鬼吟唱', duration: 3 } });
                    statusChanges.push({ target: { monsterId: m.id }, op: 'refresh', status: { id: 'shan_ghost_chant', name: '山鬼吟唱', stacks: 1, duration: 3 } });
                } else if (chant && Number.isFinite(Number(chant.duration))) {
                    const d0 = Math.max(0, Math.floor(Number(chant.duration)));
                    if (d0 <= 1) {
                        statusChanges.push({ target: 'player', op: 'refresh', status: { id: 'fear', name: '恐惧', stacks: 1, duration: 1 } });
                        statusChanges.push({ target: { monsterId: m.id }, op: 'remove', status: { id: 'shan_ghost_chant' } });
                        logs.push({ type: 'battle', text: `吟唱未断，你心神一颤！`, tag: 'status_fear', round, sourceId: m.id, meta: { action: 'monster_skill', skillName: '山鬼吟唱', duration: 1 } });
                    } else {
                        statusChanges.push({ target: { monsterId: m.id }, op: 'tick', status: { id: 'shan_ghost_chant', name: '山鬼吟唱', stacks: 1, duration: d0 - 1 } });
                    }
                }
                if (round === 1) {
                    const hasSoulBeast = monsters.some(mm => mm && mm.name === '魂兽' && (Number(monsterHpById[mm.id]) || 0) > 0);
                    if (!hasSoulBeast) {
                        const summonId = `soulbeast#r${round}`;
                        const s = { id: summonId, name: '魂兽', hp: 200, maxHp: 200, atk: 40, dangerLevel: m.dangerLevel, statuses: [], tags: ['yin', 'beast', 'summon'] };
                        monsters.push(s);
                        if (baseCombat && Array.isArray(baseCombat.monsters)) baseCombat.monsters.push({ ...s });
                        monsterHpById[summonId] = s.hp;
                        startingMonsterHpById[summonId] = s.hp;
                        logs.push({ type: 'battle', text: `召出魂兽！`, tag: 'skill_summon', round, sourceId: m.id, meta: { action: 'monster_skill', skillName: '魂兽召唤', summon: { name: '魂兽', count: 1 } } });
                    }
                }
            }

            if (m.name === '鬼王' && !sealed) {
                const domain = findStatus(m.statuses, 'ghost_domain');
                if (!domain && round === 0) {
                    statusChanges.push({ target: { monsterId: m.id }, op: 'refresh', status: { id: 'ghost_domain', name: '鬼域展开', stacks: 1, duration: 999 } });
                    logs.push({ type: 'battle', text: `鬼域展开，阴气陡盛。`, tag: 'skill_domain', round, sourceId: m.id, meta: { action: 'monster_skill', skillName: '鬼域展开' } });
                }

                const aliveMinions = monsters.filter(mm => mm && mm.id !== m.id && (Number(monsterHpById[mm.id]) || 0) > 0);
                const bossMaxHp = Number(m.maxHp) || Math.max(1, Number(m.hp) || 1);
                const bossHp = Number(monsterHpById[m.id]) || 0;
                if (aliveMinions.length > 0 && bossHp > 0 && bossHp <= bossMaxHp * 0.6 && random() < 0.35) {
                    const victim = aliveMinions[0];
                    monsterHpById[victim.id] = 0;
                    const heal = Math.max(1, Math.floor(bossMaxHp * 0.2));
                    monsterHpById[m.id] = Math.min(bossMaxHp, bossHp + heal);
                    logs.push({ type: 'battle', text: `血祭吞噬随从，恢复 ${heal} 气血`, tag: 'skill_sacrifice', round, sourceId: m.id, meta: { action: 'monster_skill', skillName: '血祭', heal } });
                } else if (aliveMinions.length < 2 && random() < 0.55) {
                    const want = 2 + Math.floor(random() * 3);
                    const cap = 6;
                    const canAdd = Math.max(0, Math.min(want, cap - monsters.length));
                    for (let k = 0; k < canAdd; k++) {
                        const sid = `yin_summon#r${round}#${k + 1}`;
                        const s = { id: sid, name: '阴魂', hp: 120, maxHp: 120, atk: 18, dangerLevel: Math.max(1, m.dangerLevel - 2), statuses: [], tags: ['spirit', 'yin', 'ghost', 'summon'] };
                        monsters.push(s);
                        if (baseCombat && Array.isArray(baseCombat.monsters)) baseCombat.monsters.push({ ...s });
                        monsterHpById[sid] = s.hp;
                        startingMonsterHpById[sid] = s.hp;
                    }
                    if (canAdd > 0) logs.push({ type: 'battle', text: `万鬼朝宗，阴魂应召（${canAdd}）`, tag: 'skill_summon', round, sourceId: m.id, meta: { action: 'monster_skill', skillName: '万鬼朝宗', summon: { name: '阴魂', count: canAdd } } });
                }
            }

            const monsterSuppression = this.computeRealmSuppression(
                { playerRealm, playerSubRealm, monsterDangerLevel: m.dangerLevel, envDifficulty: env.difficulty },
                options
            );
            this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, monsterSuppression);

            const monsterStatusRuleRes = this.callRule(options, 'status', { phase: 'monster', battlePhase, player, monster: m, monsters, env, round, rng: random, suppression: monsterSuppression });
            this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, monsterStatusRuleRes);

            const aiRes = this.callRule(options, 'ai', { phase: 'decide', battlePhase, player, monster: m, monsters, env, round, rng: random, suppression: monsterSuppression });
            this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, aiRes);
            let aiAction = aiRes && typeof aiRes.action === 'string' ? aiRes.action : 'basic';

            // Generic Monster Skill Logic (V2.0.5 Fix)
            if (aiAction === 'basic' && !sealed && m.skills && Array.isArray(m.skills) && m.skills.length > 0 && random() < 0.35) {
                const skillName = m.skills[Math.floor(random() * m.skills.length)];
                logs.push({ 
                    type: 'battle', 
                    text: `施展了【${skillName}】！`, 
                    tag: 'skill', 
                    round, 
                    sourceId: m.id, 
                    meta: { action: 'monster_skill', skillName } 
                });
                aiAction = 'skill'; // Triggers 1.25x damage multiplier
            }

            if (aiAction === 'defend') {
                statusChanges.push({ target: { monsterId: m.id }, op: 'refresh', status: { id: 'defend', stacks: 1, duration: 1 } });
                logs.push({ type: 'battle', text: `摆出防御姿态`, tag: 'ai_defend', round, sourceId: m.id });
                continue;
            }
            if (aiAction === 'switchTarget' && aiRes && typeof aiRes.targetId === 'string' && aiRes.targetId.trim()) {
                flags.nextActiveTargetId = aiRes.targetId.trim();
                logs.push({ type: 'battle', text: `发出挑衅，目标锁定变化`, tag: 'ai_switch', round, sourceId: m.id });
            }

            if (player.activeDao === '阴阳道' && random() < 0.1) {
                logs.push({ type: 'battle', text: "符箓·纸人替身无声燃尽，为你挡下了一次致命杀机。", tag: 'skill', round, sourceId: null });
                continue;
            }

            const baseTakenMult = typeof monsterSuppression.takenMult === 'number' ? monsterSuppression.takenMult : 1;
            const statusTakenMult = monsterStatusRuleRes && typeof monsterStatusRuleRes.takenMult === 'number' ? monsterStatusRuleRes.takenMult : 1;
            const aiTakenMult = aiAction === 'skill' ? 1.25 : 1;
            const takenMult = baseTakenMult * statusTakenMult * aiTakenMult;
            const flatDamage = monsterStatusRuleRes && typeof monsterStatusRuleRes.flatDamage === 'number' ? monsterStatusRuleRes.flatDamage : 0;
            const yinPenalty = (() => {
                if (!env || env.world !== 'yin') return 1;
                if (player && player.activeDao === '阴阳道') return 1;
                if (!Array.isArray(m.tags) || !(m.tags.includes('yin') || m.tags.includes('ghost'))) return 1;
                const cfg = (typeof window !== 'undefined' && window.RulesConfig && typeof window.RulesConfig === 'object') ? window.RulesConfig : null;
                const normalRaw = cfg && Object.prototype.hasOwnProperty.call(cfg, 'yinPenaltyNormal') ? Number(cfg.yinPenaltyNormal) : 1.1;
                const eliteRaw = cfg && Object.prototype.hasOwnProperty.call(cfg, 'yinPenaltyElite') ? Number(cfg.yinPenaltyElite) : 1.25;
                const bossRaw = cfg && Object.prototype.hasOwnProperty.call(cfg, 'yinPenaltyBoss') ? Number(cfg.yinPenaltyBoss) : 1.35;
                const normal = Number.isFinite(normalRaw) ? Math.max(1, Math.min(2, normalRaw)) : 1.1;
                const elite = Number.isFinite(eliteRaw) ? Math.max(1, Math.min(2, eliteRaw)) : 1.25;
                const boss = Number.isFinite(bossRaw) ? Math.max(1, Math.min(2, bossRaw)) : 1.35;
                if (m.tags.includes('boss')) return boss;
                if (m.tags.includes('elite')) return elite;
                return normal;
            })();
            const immune = findStatus(player.statuses, 'immune');
            const monsterSpec = this.normalizeSkillDamageSpec(null, aiAction === 'skill' ? 'monster_skill' : 'monster_basic');
            const r = immune
                ? { damage: 0, breakdown: { kind: 'immune', damageType: monsterSpec.damageType || 'Physical' } }
                : this.computeDamage({
                    attacker: {
                        ...m,
                        atk: Number(m.atk) || 10,
                        techPower: Number(m.techPower) || Number(m.atk) || 5,
                        spellPower: Number(m.spellPower) || Number(m.atk) || 5
                    },
                    defender: player,
                    spec: monsterSpec,
                    rng: random,
                    flatAdd: flatDamage,
                    systemMult: (Number(takenMult) || 1) * (Number(yinPenalty) || 1),
                    bonusPct: 0
                });
            const monsterDmg = Math.max(0, Number(r.damage) || 0);
            playerHp -= monsterDmg;
            effects.push({ source: { monsterId: m.id }, target: 'player', type: 'hp', value: -monsterDmg, meta: { kind: 'damage', breakdown: r.breakdown || undefined } });
            const monsterOnHitRes = this.callRule(options, 'status', { phase: 'onHit', battlePhase, action: aiAction === 'skill' ? 'monster_skill' : 'monster_basic', kind: 'damage', amount: monsterDmg, source: { monsterId: m.id }, target: 'player', player, monster: m, monsters, env, round, rng: random, suppression: monsterSuppression });
            this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, monsterOnHitRes);
            logs.push({ type: 'battle', text: `发起攻击，你受到 ${monsterDmg} 伤害`, tag: 'dmg-taken', round, sourceId: m.id, meta: { action: aiAction === 'skill' ? 'monster_skill' : 'monster_basic', damage: monsterDmg, hits: [{ targetId: 'player', damage: monsterDmg, breakdown: r.breakdown || undefined }] } });

            if (playerHp <= 0) break;
        }

        if (playerHp <= 0) {
            const revive = findStatus(player.statuses, 'talisman_revive');
            if (revive) {
                playerHp = 1;
                statusChanges.push({ target: 'player', op: 'remove', status: { id: 'talisman_revive' } });
                statusChanges.push({ target: 'player', op: 'refresh', status: { id: 'immune', name: '免疫', stacks: 1, duration: 1 } });
                logs.push({ type: 'battle', text: "九转还魂符燃尽，你于残息中归来。", tag: 'skill', round, sourceId: 'player', meta: { action: 'talisman', item: '九转还魂符' } });
                flags.reviveUsed = true;
            } else {
            flags.seriousInjury = true;
            appendDurationTicks();
            return this.buildResult({
                result: "lose",
                startingPlayerHp,
                startingPlayerMp,
                playerHp,
                playerMp,
                startingMonsterHpById,
                monsterHpById,
                targetIdForLegacy: target ? target.id : null,
                combat: baseCombat,
                logs,
                flags,
                statusChanges,
                effects,
                traceMeta
            });
            }
        }

        appendDurationTicks();
        return this.buildResult({
            result: "draw",
            startingPlayerHp,
            startingPlayerMp,
            playerHp,
            playerMp,
            startingMonsterHpById,
            monsterHpById,
            targetIdForLegacy: target ? target.id : null,
            combat: baseCombat,
            logs,
            flags,
            statusChanges,
            effects,
            traceMeta
        });
    },

    resolveSkill: function(options, activeDao, realm, subRealm, env, rng) {
        if (options && options.skill && typeof options.skill === 'object') return options.skill;
        if (options && typeof options.skillName === 'string') {
            const name = options.skillName.trim();
            if (name) {
                const found = this.getSkillByName(name, activeDao);
                if (found) return found;
            }
        }
        return this.getSkill(activeDao, realm, subRealm, env, rng);
    },

    getSkillByName: function(name, activeDao) {
        if (typeof GameData === 'undefined' || !GameData.skillConfig) return null;

        const search = (arr) => {
            if (!Array.isArray(arr)) return null;
            for (let i = 0; i < arr.length; i++) {
                const s = arr[i];
                if (s && s.name === name) return s;
            }
            return null;
        };

        if (activeDao && activeDao !== "随机" && GameData.skillConfig[activeDao]) {
            const inDao = search(GameData.skillConfig[activeDao]);
            if (inDao) return inDao;
        }

        const all = Object.values(GameData.skillConfig);
        for (let i = 0; i < all.length; i++) {
            const found = search(all[i]);
            if (found) return found;
        }
        return null;
    },

    computeRealmSuppression: function(input, options) {
        const resFromRule = this.callRule(options, 'realm', input);
        if (resFromRule) return resFromRule;

        const enabled = !!(options && options.enableRealmSuppression);
        if (!enabled) return { damageMult: 1, takenMult: 1, mpCostMult: 1, logs: [], flags: {} };

        const playerRealm = input && input.playerRealm ? input.playerRealm : "寻道";
        const monsterDangerLevel = input && typeof input.monsterDangerLevel === 'number'
            ? input.monsterDangerLevel
            : (input && Number(input.monsterDangerLevel)) || 1;

        const playerIndex = (typeof GameData !== 'undefined' && GameData.realms && GameData.realms[playerRealm] && typeof GameData.realms[playerRealm].index === 'number')
            ? GameData.realms[playerRealm].index
            : 1;
        const monsterIndex = Math.max(1, Math.min(10, Math.round(monsterDangerLevel)));

        const diff = playerIndex - monsterIndex;

        let damageMult = 1;
        let takenMult = 1;
        let mpCostMult = 1;
        let statusHitMult = 1;
        let skillProcMult = 1;
        const flags = {};
        const logs = [];

        if (diff >= 3) {
            damageMult = 1.45;
            takenMult = 0.78;
            statusHitMult = 1.25;
            skillProcMult = 1.15;
            logs.push({ type: 'battle', text: "境界压制：你如俯瞰蝼蚁，妖物胆寒。", tag: 'suppression' });
        } else if (diff === 2) {
            damageMult = 1.25;
            takenMult = 0.85;
            statusHitMult = 1.15;
            skillProcMult = 1.08;
            logs.push({ type: 'battle', text: "境界压制：你气势如虹，妖物行动迟滞。", tag: 'suppression' });
        } else if (diff === 1) {
            damageMult = 1.1;
            takenMult = 0.95;
            statusHitMult = 1.05;
            skillProcMult = 1.03;
        } else if (diff === -1) {
            damageMult = 0.9;
            takenMult = 1.1;
            mpCostMult = 1.05;
            statusHitMult = 0.95;
            skillProcMult = 0.97;
            flags.suppressed = true;
        } else if (diff === -2) {
            damageMult = 0.8;
            takenMult = 1.25;
            mpCostMult = 1.12;
            statusHitMult = 0.88;
            skillProcMult = 0.92;
            flags.suppressed = true;
            logs.push({ type: 'battle', text: "境界压制：妖气如山，你呼吸沉重。", tag: 'suppression' });
        } else if (diff <= -3) {
            damageMult = 0.72;
            takenMult = 1.45;
            mpCostMult = 1.2;
            statusHitMult = 0.82;
            skillProcMult = 0.88;
            flags.suppressed = true;
            logs.push({ type: 'battle', text: "境界压制：天地如铁，你步步维艰。", tag: 'suppression' });
        }

        damageMult = Math.max(0.6, Math.min(1.6, damageMult));
        takenMult = Math.max(0.6, Math.min(1.6, takenMult));
        mpCostMult = Math.max(0.8, Math.min(1.6, mpCostMult));
        statusHitMult = Math.max(0.5, Math.min(1.6, statusHitMult));
        skillProcMult = Math.max(0.5, Math.min(1.6, skillProcMult));

        return { damageMult, takenMult, mpCostMult, statusHitMult, skillProcMult, logs, flags };
    },

    getSkill: function(activeDao, realm, subRealm, env, rng) {
        if (typeof GameData === 'undefined' || !GameData.skillConfig) return null;

        const random = typeof rng === 'function' ? rng : null;
        let pool = [];

        if (activeDao && activeDao !== "随机" && GameData.skillConfig[activeDao]) {
            pool = GameData.skillConfig[activeDao];
        } else {
            Object.values(GameData.skillConfig).forEach(arr => pool.push(...arr));
        }

        if (activeDao === '天一道' && GameData.skillConfig && typeof GameData.skillConfig === 'object') {
            const otherDaos = Object.keys(GameData.skillConfig).filter(k => k !== '天一道');
            const reproduced = [];
            for (let i = 0; i < otherDaos.length; i++) {
                const k = otherDaos[i];
                const arr = GameData.skillConfig[k];
                if (!Array.isArray(arr)) continue;
                for (let j = 0; j < arr.length; j++) {
                    const s = arr[j];
                    if (!s || typeof s !== 'object') continue;
                    if (s.type === 'passive') continue;
                    const name = typeof s.name === 'string' ? s.name : '';
                    if (!name) continue;
                    const baseMp = (s.cost && typeof s.cost === 'object' && s.cost && s.cost.mp !== undefined) ? Number(s.cost.mp) : Number(s.mpCost);
                    const mpCost = Number.isFinite(baseMp) ? Math.max(0, Math.floor(baseMp * 1.5)) : 0;
                    const baseDmg = Number.isFinite(Number(s.baseDmg)) ? Math.max(0, Math.floor(Number(s.baseDmg) * 0.7)) : 0;
                    const heal = Number.isFinite(Number(s.heal)) ? Math.max(0, Math.floor(Number(s.heal) * 0.7)) : 0;
                    reproduced.push({
                        id: `re_${s.id || name}`,
                        name: `复现·${name}`,
                        realm: s.realm || realm || '寻道',
                        type: 'active',
                        mpCost,
                        baseDmg,
                        heal,
                        text: `复现·${name}`,
                        chant: '',
                        cost: Object.assign({}, (s.cost && typeof s.cost === 'object') ? s.cost : {}, { mp: mpCost }),
                        omenDelta: 0,
                        chaosDelta: 0,
                        tags: (Array.isArray(s.tags) ? s.tags.slice() : []).concat(['reproduce']),
                        sourceDao: s.sourceDao || k,
                        category: 'reproduce',
                        reproduceOf: name
                    });
                }
            }
            pool = pool.concat(reproduced);
        }

        pool = pool.filter(s => s && s.type !== 'passive');
        if (!pool.length) return null;
        if (!random) return pool[0];
        return pool[Math.floor(random() * pool.length)];
    },

    normalizeContext: function(context, options) {
        const c = context && typeof context === 'object' ? context : {};
        const player = c.player && typeof c.player === 'object' ? c.player : {};
        const env = c.env && typeof c.env === 'object' ? c.env : {};

        let monsters = [];
        if (Array.isArray(c.monsters) && c.monsters.length) {
            monsters = c.monsters;
        } else if (c.monster && typeof c.monster === 'object') {
            monsters = [c.monster];
        }

        const normalizedMonsters = monsters
            .map((m, idx) => {
                const obj = m && typeof m === 'object' ? m : {};
                const id = typeof obj.id === 'string' && obj.id.trim()
                    ? obj.id.trim()
                    : `m${idx}`;
                return {
                    id,
                    name: obj.name || "未知妖物",
                    hp: Number(obj.hp) || 0,
                    maxHp: typeof obj.maxHp === 'number' ? obj.maxHp : (Number(obj.maxHp) || null),
                    atk: Number(obj.atk) || 0,
                    def: Number(obj.def) || 0,
                    speed: Number(obj.speed) || 0,
                    dangerLevel: typeof obj.dangerLevel === 'number' ? obj.dangerLevel : (Number(obj.dangerLevel) || 0),
                    statuses: Array.isArray(obj.statuses) ? obj.statuses.slice() : [],
                    tags: Array.isArray(obj.tags) ? obj.tags.slice() : [],
                    skills: Array.isArray(obj.skills) ? obj.skills.slice() : [],
                    critRate: Number.isFinite(Number(obj.critRate)) ? Number(obj.critRate) : undefined,
                    critMult: Number.isFinite(Number(obj.critMult)) ? Number(obj.critMult) : undefined,
                    damageReduction: Number.isFinite(Number(obj.damageReduction)) ? Number(obj.damageReduction) : undefined
                };
            })
            .filter(m => !!m);

        const activeTargetId = (c.activeTargetId && typeof c.activeTargetId === 'string' && c.activeTargetId.trim())
            ? c.activeTargetId.trim()
            : (options && typeof options.activeTargetId === 'string' ? options.activeTargetId : null);
        const round = typeof c.round === 'number' ? c.round : (options && typeof options.round === 'number' ? options.round : 0);
        const phaseRaw = (c.phase && typeof c.phase === 'string') ? c.phase.trim() : null;
        const phase = (phaseRaw === 'opening' || phaseRaw === 'pressure' || phaseRaw === 'execute') ? phaseRaw : null;

        return {
            player,
            env,
            monsters: normalizedMonsters,
            activeTargetId,
            round,
            phase
        };
    },

    buildCombatBase: function(context, normalized) {
        const c = context && typeof context === 'object' ? context : null;
        const n = normalized && typeof normalized === 'object' ? normalized : null;
        if (!n) return null;
        const hasCombatShape = !!(c && (Array.isArray(c.monsters) || (c.monster && typeof c.monster === 'object') || (c.player && typeof c.player === 'object')));
        if (!hasCombatShape) return null;
        const p0 = n.player && typeof n.player === 'object' ? n.player : {};
        const env0 = n.env && typeof n.env === 'object' ? n.env : {};
        return {
            round: n.round,
            player: {
                ...p0,
                statuses: Array.isArray(p0.statuses) ? p0.statuses.slice() : []
            },
            monsters: Array.isArray(n.monsters) ? n.monsters.map(m => ({ ...m, statuses: Array.isArray(m.statuses) ? m.statuses.slice() : [] })) : [],
            env: { ...env0 },
            activeTargetId: n.activeTargetId
        };
    },

    pickTarget: function(monsters, monsterHpById, activeTargetId) {
        if (!Array.isArray(monsters) || monsters.length === 0) return null;
        if (activeTargetId) {
            for (let i = 0; i < monsters.length; i++) {
                const m = monsters[i];
                const hp = Number(monsterHpById[m.id]) || 0;
                if (m.id === activeTargetId && hp > 0) return m;
            }
        }
        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            const hp = Number(monsterHpById[m.id]) || 0;
            if (hp > 0) return m;
        }
        return null;
    },

    allMonstersDefeated: function(monsters, monsterHpById) {
        if (!Array.isArray(monsters) || monsters.length === 0) return true;
        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            const hp = Number(monsterHpById[m.id]) || 0;
            if (hp > 0) return false;
        }
        return true;
    },

    mergeRuleArtifacts: function(out, ruleRes) {
        if (!ruleRes || typeof ruleRes !== 'object') return;
        const trace = ruleRes._trace && typeof ruleRes._trace === 'object' ? ruleRes._trace : null;
        if (Array.isArray(ruleRes.logs) && ruleRes.logs.length) {
            if (trace) {
                for (let i = 0; i < ruleRes.logs.length; i++) {
                    const e = ruleRes.logs[i];
                    if (!e || typeof e !== 'object') continue;
                    const em = e.meta && typeof e.meta === 'object' ? e.meta : {};
                    e.meta = Object.assign({}, trace, em);
                }
            }
            out.logs.push(...ruleRes.logs);
        }
        if (ruleRes.flags && typeof ruleRes.flags === 'object') {
            Object.keys(ruleRes.flags).forEach(k => {
                out.flags[k] = ruleRes.flags[k];
            });
        }
        if (Array.isArray(ruleRes.statusChanges) && ruleRes.statusChanges.length) {
            if (trace) {
                for (let i = 0; i < ruleRes.statusChanges.length; i++) {
                    const e = ruleRes.statusChanges[i];
                    if (!e || typeof e !== 'object') continue;
                    const em = e.meta && typeof e.meta === 'object' ? e.meta : {};
                    e.meta = Object.assign({}, trace, em);
                }
            }
            out.statusChanges.push(...ruleRes.statusChanges);
        }
        if (Array.isArray(ruleRes.effects) && ruleRes.effects.length) {
            if (trace) {
                for (let i = 0; i < ruleRes.effects.length; i++) {
                    const e = ruleRes.effects[i];
                    if (!e || typeof e !== 'object') continue;
                    const em = e.meta && typeof e.meta === 'object' ? e.meta : {};
                    e.meta = Object.assign({}, trace, em);
                }
            }
            out.effects.push(...ruleRes.effects);
        }
    },

    clamp01: function(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(1, n));
    },

    clampNumber: function(v, min, max, fallback) {
        const n = Number(v);
        const lo = Number(min);
        const hi = Number(max);
        if (!Number.isFinite(n) || !Number.isFinite(lo) || !Number.isFinite(hi)) return Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
        return Math.max(lo, Math.min(hi, n));
    },

    normalizeDamageType: function(type) {
        const t0 = typeof type === 'string' ? type.trim() : '';
        if (t0 === 'Physical' || t0 === 'Technique' || t0 === 'Spell' || t0 === 'True') return t0;
        const lower = t0.toLowerCase();
        if (lower === 'physical' || lower === '形') return 'Physical';
        if (lower === 'technique' || lower === '术') return 'Technique';
        if (lower === 'spell' || lower === '法') return 'Spell';
        if (lower === 'true' || lower === '真') return 'True';
        return null;
    },

    getEntityStat: function(entity, keys, fallback) {
        const obj = entity && typeof entity === 'object' ? entity : null;
        const arr = Array.isArray(keys) ? keys : [keys];
        for (let i = 0; i < arr.length; i++) {
            const k = arr[i];
            if (!k) continue;
            const v = obj && Object.prototype.hasOwnProperty.call(obj, k) ? Number(obj[k]) : NaN;
            if (Number.isFinite(v)) return v;
        }
        const fb = Number(fallback);
        return Number.isFinite(fb) ? fb : 0;
    },

    getCritRate: function(attacker) {
        const v = this.getEntityStat(attacker, ['critRate', 'crit'], NaN);
        if (Number.isFinite(v)) return this.clamp01(v);
        return 0;
    },

    getCritMult: function(attacker) {
        const v = this.getEntityStat(attacker, ['critMult', 'critMultiplier'], NaN);
        if (Number.isFinite(v)) return this.clampNumber(v, 1, 5, 1.5);
        return 1.5;
    },

    getDamageReduction: function(defender) {
        const v = this.getEntityStat(defender, ['damageReduction', 'dr', 'reduction'], NaN);
        if (Number.isFinite(v)) return this.clampNumber(v, 0, 0.8, 0);
        const def = this.getEntityStat(defender, ['def'], NaN);
        if (Number.isFinite(def) && def > 0) {
            const r = def / (def + 100);
            return this.clampNumber(r, 0, 0.6, 0);
        }
        return 0;
    },

    normalizeSkillDamageSpec: function(skill, actionType) {
        const act = typeof actionType === 'string' ? actionType : '';
        if (act === 'basic' || act === 'monster_basic' || act === 'monster_skill') {
            return { name: act, damageType: 'Physical', baseDamage: 0, weights: { atk: 1, tech: 0, spell: 0 }, canCrit: true, canDodge: true, tags: ['basic'] };
        }
        if (act === 'summon') {
            return { name: act, damageType: 'Spell', baseDamage: 0, weights: { atk: 1, tech: 0, spell: 0 }, canCrit: false, canDodge: true, tags: ['summon'] };
        }
        if (act === 'dot') {
            return { name: act, damageType: 'Spell', baseDamage: 0, weights: { atk: 0, tech: 0, spell: 0 }, canCrit: false, canDodge: false, tags: ['dot'] };
        }
        const s = skill && typeof skill === 'object' ? skill : {};
        const tags = Array.isArray(s.tags) ? s.tags : [];
        const t = this.normalizeDamageType(s.damageType) || (() => {
            if (tags.includes('true')) return 'True';
            if (tags.includes('technique') || tags.includes('tech') || tags.includes('qi')) return 'Technique';
            if (tags.includes('spell')) return 'Spell';
            if (tags.includes('physical')) return 'Physical';
            return 'Spell';
        })();
        const baseDamage = Number.isFinite(Number(s.baseDamage)) ? Number(s.baseDamage) : (Number.isFinite(Number(s.baseDmg)) ? Number(s.baseDmg) : 0);
        const weightsRaw = (s.weights && typeof s.weights === 'object') ? s.weights : null;
        const w = weightsRaw
            ? {
                atk: this.clampNumber(weightsRaw.atk, 0, 1, 0),
                tech: this.clampNumber(weightsRaw.tech, 0, 1, 0),
                spell: this.clampNumber(weightsRaw.spell, 0, 1, 0)
            }
            : (t === 'Physical'
                ? { atk: 1, tech: 0, spell: 0 }
                : (t === 'Technique'
                    ? { atk: 0, tech: 1, spell: 0 }
                    : (t === 'Spell'
                        ? { atk: 0, tech: 0, spell: 1 }
                        : { atk: 0, tech: 0, spell: 0 })));
        const canCrit = (s.canCrit === false) ? false : true;
        const canDodge = (s.canDodge === false) ? false : true;
        const name = typeof s.name === 'string' ? s.name : (act || 'skill');
        return { name, damageType: t, baseDamage, weights: w, canCrit, canDodge, tags };
    },

    skillHasDamagePotential: function(spec, flatAdd) {
        const s = spec && typeof spec === 'object' ? spec : null;
        if (!s) return false;
        const base = Number(s.baseDamage) || 0;
        const w = s.weights && typeof s.weights === 'object' ? s.weights : {};
        const sumW = (Number(w.atk) || 0) + (Number(w.tech) || 0) + (Number(w.spell) || 0);
        const f = Number(flatAdd) || 0;
        return (base > 0) || (sumW > 0) || (f > 0);
    },

    computeDamage: function(input) {
        const o = input && typeof input === 'object' ? input : {};
        const spec = o.spec && typeof o.spec === 'object' ? o.spec : this.normalizeSkillDamageSpec(null, 'basic');
        const rng = typeof o.rng === 'function' ? o.rng : null;
        const defender = o.defender && typeof o.defender === 'object' ? o.defender : {};
        const attacker = o.attacker && typeof o.attacker === 'object' ? o.attacker : {};

        const baseDamage = Number(spec.baseDamage) || 0;
        const flatAdd = Number.isFinite(Number(o.flatAdd)) ? Number(o.flatAdd) : 0;
        const weights = spec.weights && typeof spec.weights === 'object' ? spec.weights : { atk: 0, tech: 0, spell: 0 };
        const atk = this.getEntityStat(attacker, ['atk'], 0);
        const tech = this.getEntityStat(attacker, ['techPower', 'tech', 'techniquePower', 'matk'], 0);
        const spell = this.getEntityStat(attacker, ['spellPower', 'spellDamage', 'spell', 'matk'], 0);
        const statBonus = (Number(weights.atk) || 0) * atk + (Number(weights.tech) || 0) * tech + (Number(weights.spell) || 0) * spell;
        const preMult = baseDamage + statBonus + flatAdd;

        const damageType = this.normalizeDamageType(spec.damageType) || 'Spell';

        if (preMult <= 0) {
            return { damage: 0, breakdown: { kind: 'no_damage', damageType, baseDamage, statBonus, flatAdd } };
        }

        const systemMult = Number.isFinite(Number(o.systemMult)) ? Math.max(0, Number(o.systemMult)) : 1;
        const bonusPct = Number.isFinite(Number(o.bonusPct)) ? Number(o.bonusPct) : 0;
        const bonusMult = 1 + bonusPct;

        let dmg = preMult * systemMult * bonusMult;
        const breakdown = {
            kind: 'hit',
            damageType,
            baseDamage,
            statBonus,
            flatAdd,
            preMult,
            systemMult,
            bonusPct
        };

        const canCrit = spec.canCrit !== false;
        if (canCrit) {
            if (!rng) return { damage: 0, breakdown: { kind: 'rng_missing', damageType } };
            const critRate = this.getCritRate(attacker);
            const roll = this.clamp01(rng());
            const crit = roll < critRate;
            breakdown.critRate = critRate;
            breakdown.critRoll = roll;
            breakdown.crit = crit;
            if (crit) {
                const mult = this.getCritMult(attacker);
                breakdown.critMult = mult;
                dmg = dmg * mult;
            }
        }

        if (damageType !== 'True') {
            const reduction = this.getDamageReduction(defender);
            breakdown.damageReduction = reduction;
            dmg = dmg * (1 - reduction);
        }

        let final = Math.floor(dmg);
        if (!Number.isFinite(final)) final = 0;
        if (final < 1) final = 1;
        breakdown.final = final;
        return { damage: final, breakdown };
    },

    applyStatusChanges: function(combat, statusChanges) {
        if (!combat || typeof combat !== 'object') return combat;
        if (!Array.isArray(statusChanges) || !statusChanges.length) return combat;

        const next = {
            ...combat,
            player: combat.player && typeof combat.player === 'object' ? { ...combat.player } : { hp: 0, mp: 0 },
            monsters: Array.isArray(combat.monsters) ? combat.monsters.map(m => (m && typeof m === 'object' ? { ...m } : m)) : []
        };

        const getList = (ch) => {
            if (ch.target === 'player') {
                if (!Array.isArray(next.player.statuses)) next.player.statuses = [];
                return next.player.statuses;
            }
            if (ch.target && typeof ch.target === 'object' && typeof ch.target.monsterId === 'string') {
                const m = next.monsters.find(x => x && x.id === ch.target.monsterId);
                if (!m) return null;
                if (!Array.isArray(m.statuses)) m.statuses = [];
                return m.statuses;
            }
            return null;
        };

        const keyOf = (s) => {
            if (!s || typeof s !== 'object') return null;
            if (typeof s.id === 'string' && s.id.trim()) return s.id.trim();
            if (typeof s.name === 'string' && s.name.trim()) return s.name.trim();
            return null;
        };

        for (let i = 0; i < statusChanges.length; i++) {
            const ch = statusChanges[i];
            if (!ch || typeof ch !== 'object') continue;
            const op = ch.op;
            const list = getList(ch);
            if (!list || !op) continue;

            const status = ch.status && typeof ch.status === 'object' ? ch.status : null;
            const key = keyOf(status);
            const idx = key ? list.findIndex(x => keyOf(x) === key) : -1;

            if (op === 'add') {
                if (idx === -1 && status) list.push(status);
            } else if (op === 'remove' || op === 'expire') {
                if (idx !== -1) list.splice(idx, 1);
            } else if (op === 'refresh' || op === 'tick') {
                if (status) {
                    if (idx !== -1) list[idx] = status;
                    else list.push(status);
                }
            }
        }

        return next;
    },

    buildResult: function(params) {
        const playerHpDelta = params.playerHp - params.startingPlayerHp;
        const playerMpDelta = params.playerMp - params.startingPlayerMp;
        const monstersDelta = [];
        const monsterIds = Object.keys(params.startingMonsterHpById || {});
        for (let i = 0; i < monsterIds.length; i++) {
            const id = monsterIds[i];
            const startHp = Number(params.startingMonsterHpById[id]) || 0;
            const endHp = Number(params.monsterHpById[id]) || 0;
            monstersDelta.push({ id, hpDelta: endHp - startHp });
        }

        let legacyMonsterHp = 0;
        if (monsterIds.length === 1) {
            legacyMonsterHp = monstersDelta[0].hpDelta;
        } else if (params.targetIdForLegacy) {
            const found = monstersDelta.find(d => d.id === params.targetIdForLegacy);
            legacyMonsterHp = found ? found.hpDelta : 0;
        }

        const out = {
            result: params.result,
            delta: {
                playerHp: playerHpDelta,
                playerMp: playerMpDelta,
                monsterHp: legacyMonsterHp,
                monsters: monstersDelta
            },
            logs: Array.isArray(params.logs) ? params.logs : [],
            effects: Array.isArray(params.effects) ? params.effects : [],
            statusChanges: Array.isArray(params.statusChanges) ? params.statusChanges : [],
            flags: params.flags && typeof params.flags === 'object' ? params.flags : {}
        };
        const traceMeta = params.traceMeta && typeof params.traceMeta === 'object' ? params.traceMeta : null;
        if (traceMeta) {
            out.meta = traceMeta;
            if (Array.isArray(out.logs)) {
                for (let i = 0; i < out.logs.length; i++) {
                    const e = out.logs[i];
                    if (!e || typeof e !== 'object') continue;
                    const em = e.meta && typeof e.meta === 'object' ? e.meta : {};
                    e.meta = Object.assign({}, traceMeta, em);
                }
            }
            if (Array.isArray(params.effects)) {
                for (let i = 0; i < params.effects.length; i++) {
                    const e = params.effects[i];
                    if (!e || typeof e !== 'object') continue;
                    const em = e.meta && typeof e.meta === 'object' ? e.meta : {};
                    e.meta = Object.assign({}, traceMeta, em);
                }
            }
            if (Array.isArray(params.statusChanges)) {
                for (let i = 0; i < params.statusChanges.length; i++) {
                    const e = params.statusChanges[i];
                    if (!e || typeof e !== 'object') continue;
                    const em = e.meta && typeof e.meta === 'object' ? e.meta : {};
                    e.meta = Object.assign({}, traceMeta, em);
                }
            }
        }
        const baseCombat = params.combat && typeof params.combat === 'object' ? params.combat : null;
        if (baseCombat) {
            const nextCombat = {
                ...baseCombat,
                round: (Number.isFinite(Number(baseCombat.round)) ? Number(baseCombat.round) : 0) + 1,
                player: baseCombat.player && typeof baseCombat.player === 'object'
                    ? { ...baseCombat.player, hp: params.playerHp, mp: params.playerMp }
                    : { hp: params.playerHp, mp: params.playerMp },
                monsters: Array.isArray(baseCombat.monsters)
                    ? baseCombat.monsters.map(m => {
                        if (!m || typeof m !== 'object') return m;
                        const hp = Number(params.monsterHpById && Object.prototype.hasOwnProperty.call(params.monsterHpById, m.id) ? params.monsterHpById[m.id] : m.hp) || 0;
                        return { ...m, hp };
                    })
                    : [],
                activeTargetId: params.flags && typeof params.flags.nextActiveTargetId === 'string'
                    ? params.flags.nextActiveTargetId
                    : (typeof baseCombat.activeTargetId === 'string' ? baseCombat.activeTargetId : null)
            };
            out.combat = this.applyStatusChanges(nextCombat, out.statusChanges);
        }
        return out;
    },

    getRule: function(options, name) {
        const opts = options && typeof options === 'object' ? options : null;
        const rules = opts && opts.rules && typeof opts.rules === 'object' ? opts.rules : null;
        if (rules && typeof rules[name] === 'function') return rules[name];
        if (name === 'realm' && opts && typeof opts.realmRule === 'function') return opts.realmRule;
        if (name === 'skill' && opts && typeof opts.skillRule === 'function') return opts.skillRule;
        if (name === 'status' && opts && typeof opts.statusRule === 'function') return opts.statusRule;
        if (name === 'ai' && opts && typeof opts.aiRule === 'function') return opts.aiRule;
        return null;
    },

    callRule: function(options, name, input) {
        const fn = this.getRule(options, name);
        if (!fn) return null;
        try {
            const res = fn(input);
            if (!res || typeof res !== 'object') return null;
            if (!res._trace || typeof res._trace !== 'object') res._trace = { source: 'CombatEngine.rule', rule: name };
            return res;
        } catch (e) {
            return { logs: [{ type: 'battle', text: `规则执行异常：${e && e.message ? e.message : 'unknown'}`, tag: 'sys', meta: { source: 'CombatEngine.rule', rule: name } }], flags: { ruleError: true }, _trace: { source: 'CombatEngine.rule', rule: name } };
        }
    }
};
