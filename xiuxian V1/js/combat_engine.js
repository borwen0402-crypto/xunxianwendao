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
                    dangerLevel: typeof obj.dangerLevel === 'number' ? obj.dangerLevel : (Number(obj.dangerLevel) || 0),
                    statuses: Array.isArray(obj.statuses) ? obj.statuses.slice() : [],
                    tags: Array.isArray(obj.tags) ? obj.tags.slice() : []
                };
            })
            .filter(Boolean);
        const e = env && typeof env === 'object' ? env : {};
        const envOut = { mapId: e.mapId || "未知", difficulty: Number.isFinite(Number(e.difficulty)) ? Number(e.difficulty) : 1 };

        const playerOut = {
            hp: Number(p.hp) || 0,
            mp: Number(p.mp) || 0,
            maxHp: Number.isFinite(Number(p.maxHp)) ? Number(p.maxHp) : null,
            maxMp: Number.isFinite(Number(p.maxMp)) ? Number(p.maxMp) : null,
            atk: Number(p.atk) || 0,
            matk: Number(p.matk) || 0,
            realm: p.realm || "寻道",
            subRealm: p.subRealm || "初期",
            activeDao: p.activeDao || "随机",
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
                const isPhysical = tags.includes('physical');
                const isAoe = tags.includes('aoe');
                const isDoubleHit = tags.includes('double_hit');
                const isSummonGhost = tags.includes('summon') && tags.includes('ghost');
                const isGhostBuff = tags.includes('ghost') && tags.includes('buff');
                const isInvert = tags.includes('invert');
                const isYang = tags.includes('yang');
                const isYin = tags.includes('yin');
                const isSpiritBonus = tags.includes('spirit_bonus');
                const scaleStat = isPhysical ? playerAtk : playerMatk;
                const baseDmg = (skill.baseDmg || 0) + scaleStat;

                if (omenAll !== 0 || chaosAll !== 0) {
                    const payload = {};
                    if (omenAll !== 0) payload.omen = omenAll;
                    if (chaosAll !== 0) payload.chaos = chaosAll;
                    effects.push({ target: 'world', type: 'tendenciesDelta', payload, meta: { external: true } });
                    const parts = [];
                    if (omenAll !== 0) parts.push(`Omen${omenAll > 0 ? `+${omenAll}` : `${omenAll}`}`);
                    if (chaosAll !== 0) parts.push(`Chaos${chaosAll > 0 ? `+${chaosAll}` : `${chaosAll}`}`);
                    logs.push({ type: 'battle', text: `世界代价：${parts.join('，')}`, tag: 'skill_cost', round, meta: { action: 'skill', skillName: skill.name } });
                }

                if (isInvert && env && typeof env.mapId === 'string' && env.mapId.trim()) {
                    effects.push({ target: 'mapState', type: 'invertYinYang', payload: { mapId: env.mapId.trim() }, meta: { external: true } });
                    logs.push({ type: 'battle', text: '阴阳被你拨动，气机翻转。', tag: 'skill', round, meta: { action: 'skill', skillName: skill.name } });
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
                        logs.push({ type: 'battle', text: '魂瓮已满，鬼影化作一缕魂力。', tag: 'skill', round, meta: { action: 'skill', skillName: skill.name } });
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
                        logs.push({ type: 'battle', text: `鬼物成形：${rank}·${pick}`, tag: 'skill', round, meta: { action: 'skill', skillName: skill.name } });
                        effects.push({ target: 'ghosts', type: 'add', payload: g, meta: { external: true } });
                    }
                }

                if (isGhostBuff) {
                    effects.push({ target: 'ghosts', type: 'healAll', value: 0.2, meta: { external: true } });
                    logs.push({ type: 'battle', text: '鬼气回涌，鬼物气机稍稳。', tag: 'skill', round, meta: { action: 'skill', skillName: skill.name } });
                }

                const dealTo = (monsterId, dmg, hitIdx) => {
                    monsterHpById[monsterId] = (Number(monsterHpById[monsterId]) || 0) - dmg;
                    effects.push({ source: 'player', target: { monsterId }, type: 'hp', value: -dmg, meta: { kind: 'damage', hit: hitIdx } });
                    const monsterObj = monsters.find(mm => mm && mm.id === monsterId) || target;
                    const playerOnHitRes = this.callRule(options, 'status', { phase: 'onHit', battlePhase, action: 'skill', kind: 'damage', amount: dmg, source: 'player', target: { monsterId }, player, skill, monster: monsterObj, monsters, env, round, rng: random, suppression: playerSuppression });
                    this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, playerOnHitRes);
                };

                const envYinYang = env && Number.isFinite(Number(env.yinYang)) ? Number(env.yinYang) : 0;
                const envMult = (isYang && envYinYang < 0) ? 1.2 : ((isYin && envYinYang > 0) ? 1.2 : 1);
                const rollDmg = (mult, spiritMult) => Math.floor(((baseDmg + flatDamage) * realmConfig.skillMult * damageMult * envMult * mult * (spiritMult || 1)) * (0.9 + random() * 0.2));

                if (isAoe) {
                    let total = 0;
                    for (let i = 0; i < monsters.length; i++) {
                        const mm = monsters[i];
                        const mhp = Number(monsterHpById[mm.id]) || 0;
                        if (mhp <= 0) continue;
                        const spiritMult = isSpiritBonus && Array.isArray(mm.tags) && mm.tags.includes('spirit') ? 1.5 : 1;
                        const d = Math.max(0, rollDmg(0.9, spiritMult));
                        total += d;
                        dealTo(mm.id, d, 1);
                    }
                    logs.push({ type: 'battle', text: `[${skill.name}] ${skill.text} 波及全体，造成总计 ${total} 伤害`, tag: 'skill', round, targetId: target.id, meta: { action: 'skill', skillName: skill.name, damage: total } });
                } else if (isDoubleHit) {
                    const spiritMult = isSpiritBonus && Array.isArray(target.tags) && target.tags.includes('spirit') ? 1.5 : 1;
                    const d1 = Math.max(0, rollDmg(0.8, spiritMult));
                    const d2 = Math.max(0, rollDmg(0.8, spiritMult));
                    dealTo(target.id, d1, 1);
                    dealTo(target.id, d2, 2);
                    const sum = d1 + d2;
                    logs.push({ type: 'battle', text: `[${skill.name}] ${skill.text} 连击两次，造成 ${sum} 伤害`, tag: 'skill', round, targetId: target.id, meta: { action: 'skill', skillName: skill.name, damage: sum } });
                } else if (baseDmg > 0) {
                    const spiritMult = isSpiritBonus && Array.isArray(target.tags) && target.tags.includes('spirit') ? 1.5 : 1;
                    const playerDmg = Math.max(0, rollDmg(1, spiritMult));
                    dealTo(target.id, playerDmg, 1);
                    logs.push({ type: 'battle', text: `[${skill.name}] ${skill.text} 造成 ${playerDmg} 伤害`, tag: 'skill', round, targetId: target.id, meta: { action: 'skill', skillName: skill.name, damage: playerDmg } });
                } else {
                    logs.push({ type: 'battle', text: `[${skill.name}] ${skill.text}`, tag: 'skill', round, targetId: target.id, meta: { action: 'skill', skillName: skill.name, damage: 0 } });
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
                    if (healed > 0) logs.push({ type: 'battle', text: `恢复 ${healed} 气血`, tag: 'skill_heal', round, meta: { action: 'skill', skillName: skill.name, heal: healed } });
                }
            } else {
                const isSpirit = Array.isArray(target.tags) && target.tags.includes('spirit');
                const qiankunMult = (playerDaoType === '乾坤道' && isSpirit) ? 1.2 : 1;
                const playerDmg = Math.floor((playerAtk + flatDamage) * damageMult * qiankunMult * (0.9 + random() * 0.2));
                monsterHpById[target.id] = (Number(monsterHpById[target.id]) || 0) - playerDmg;
                effects.push({ source: 'player', target: { monsterId: target.id }, type: 'hp', value: -playerDmg, meta: { kind: 'damage' } });
                const playerOnHitRes = this.callRule(options, 'status', { phase: 'onHit', battlePhase, action: 'basic', kind: 'damage', amount: playerDmg, source: 'player', target: { monsterId: target.id }, player, skill: null, monster: target, monsters, env, round, rng: random, suppression: playerSuppression });
                this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, playerOnHitRes);

                logs.push({ type: 'battle', text: `[普攻] 施展基础招式，造成 ${playerDmg} 伤害`, tag: 'dmg', round, targetId: target.id, meta: { action: 'basic', skillName: '普攻', damage: playerDmg } });

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
                    for (let gi = 0; gi < ghosts.length; gi++) {
                        const g = ghosts[gi];
                        if (!g || typeof g !== 'object') continue;
                        const rank = typeof g.rank === 'string' ? g.rank : '厉鬼';
                        const base = rank === '鬼皇' ? 16 : (rank === '鬼王' ? 12 : 8);
                        const dmg = Math.max(0, Math.floor(base * (0.9 + random() * 0.2)));
                        sum += dmg;
                        monsterHpById[t2.id] = (Number(monsterHpById[t2.id]) || 0) - dmg;
                    }
                    if (sum > 0) logs.push({ type: 'battle', text: `鬼物出手，造成 ${sum} 伤害`, tag: 'skill', round, targetId: t2.id, meta: { action: 'ghost', damage: sum } });
                }
            }
        }

        if (this.allMonstersDefeated(monsters, monsterHpById)) {
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

        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            const mHp = Number(monsterHpById[m.id]) || 0;
            if (mHp <= 0) continue;

            const monsterSuppression = this.computeRealmSuppression(
                { playerRealm, playerSubRealm, monsterDangerLevel: m.dangerLevel, envDifficulty: env.difficulty },
                options
            );
            this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, monsterSuppression);

            const monsterStatusRuleRes = this.callRule(options, 'status', { phase: 'monster', battlePhase, player, monster: m, monsters, env, round, rng: random, suppression: monsterSuppression });
            this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, monsterStatusRuleRes);

            const aiRes = this.callRule(options, 'ai', { phase: 'decide', battlePhase, player, monster: m, monsters, env, round, rng: random, suppression: monsterSuppression });
            this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, aiRes);
            const aiAction = aiRes && typeof aiRes.action === 'string' ? aiRes.action : 'basic';
            if (aiAction === 'defend') {
                statusChanges.push({ target: { monsterId: m.id }, op: 'refresh', status: { id: 'defend', stacks: 1, duration: 1 } });
                logs.push({ type: 'battle', text: `【${m.name}】摆出防御姿态`, tag: 'ai_defend', round, sourceId: m.id });
                continue;
            }
            if (aiAction === 'switchTarget' && aiRes && typeof aiRes.targetId === 'string' && aiRes.targetId.trim()) {
                flags.nextActiveTargetId = aiRes.targetId.trim();
                logs.push({ type: 'battle', text: `【${m.name}】发出挑衅，目标锁定变化`, tag: 'ai_switch', round, sourceId: m.id });
            }

            if (random() < 0.1) {
                logs.push({ type: 'battle', text: "符箓·纸人替身无声燃尽，为你挡下了一次致命杀机。", tag: 'skill', round, sourceId: m.id });
                continue;
            }

            const baseTakenMult = typeof monsterSuppression.takenMult === 'number' ? monsterSuppression.takenMult : 1;
            const statusTakenMult = monsterStatusRuleRes && typeof monsterStatusRuleRes.takenMult === 'number' ? monsterStatusRuleRes.takenMult : 1;
            const aiTakenMult = aiAction === 'skill' ? 1.25 : 1;
            const takenMult = baseTakenMult * statusTakenMult * aiTakenMult;
            const flatDamage = monsterStatusRuleRes && typeof monsterStatusRuleRes.flatDamage === 'number' ? monsterStatusRuleRes.flatDamage : 0;
            const monsterDmg = Math.floor(((Number(m.atk) || 0) + flatDamage) * takenMult * (0.9 + random() * 0.2));
            playerHp -= monsterDmg;
            effects.push({ source: { monsterId: m.id }, target: 'player', type: 'hp', value: -monsterDmg, meta: { kind: 'damage' } });
            const monsterOnHitRes = this.callRule(options, 'status', { phase: 'onHit', battlePhase, action: 'basic', kind: 'damage', amount: monsterDmg, source: { monsterId: m.id }, target: 'player', player, monster: m, monsters, env, round, rng: random, suppression: monsterSuppression });
            this.mergeRuleArtifacts({ logs, flags, statusChanges, effects }, monsterOnHitRes);
            logs.push({ type: 'battle', text: `【${m.name}】发起攻击，你受到 ${monsterDmg} 伤害`, tag: 'dmg-taken', round, sourceId: m.id, meta: { action: 'monster_basic', damage: monsterDmg } });

            if (playerHp <= 0) break;
        }

        if (playerHp <= 0) {
            flags.seriousInjury = true;
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
                    dangerLevel: typeof obj.dangerLevel === 'number' ? obj.dangerLevel : (Number(obj.dangerLevel) || 0),
                    statuses: Array.isArray(obj.statuses) ? obj.statuses.slice() : [],
                    tags: Array.isArray(obj.tags) ? obj.tags.slice() : []
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
