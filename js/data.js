/**
 * 游戏配置数据 V1.5
 * 包含：地图配置、技能配置、环境日志、怪物属性、境界数据
 */

const GameData = {
    // 0. 境界晋升配置 (V1.6 新增 - 符合玄门设计)
    // 凡人(1) -> 修士(1) -> 寻道(5) -> 入道(5) -> 悟道(1) -> 半步地仙(1)
    realmProgression: [
        // === 第一阶：凡俗 ===
        { realm: "凡人", subRealm: "凡俗", stage: "凡人", maxExp: 100, hpBonus: 0, atkBonus: 0, matkBonus: 0 },
        { realm: "修士", subRealm: "入世", stage: "修士", maxExp: 500, hpBonus: 50, atkBonus: 5, matkBonus: 5 },
        
        // === 第二阶：寻道 (五小境界) ===
        { realm: "寻道", subRealm: "初期", stage: "寻道初期", maxExp: 1000, hpBonus: 100, atkBonus: 10, matkBonus: 10 },
        { realm: "寻道", subRealm: "中期", stage: "寻道中期", maxExp: 2000, hpBonus: 100, atkBonus: 10, matkBonus: 10 },
        { realm: "寻道", subRealm: "后期", stage: "寻道后期", maxExp: 3500, hpBonus: 100, atkBonus: 10, matkBonus: 10 },
        { realm: "寻道", subRealm: "巅峰", stage: "寻道巅峰", maxExp: 5000, hpBonus: 150, atkBonus: 15, matkBonus: 15 },
        { realm: "寻道", subRealm: "圆满", stage: "寻道圆满", maxExp: 7500, hpBonus: 200, atkBonus: 20, matkBonus: 20 },
        
        // === 第三阶：入道 (五小境界) ===
        { realm: "入道", subRealm: "初期", stage: "入道初期", maxExp: 12000, hpBonus: 300, atkBonus: 30, matkBonus: 30 },
        { realm: "入道", subRealm: "中期", stage: "入道中期", maxExp: 18000, hpBonus: 300, atkBonus: 30, matkBonus: 30 },
        { realm: "入道", subRealm: "后期", stage: "入道后期", maxExp: 26000, hpBonus: 300, atkBonus: 30, matkBonus: 30 },
        { realm: "入道", subRealm: "巅峰", stage: "入道巅峰", maxExp: 36000, hpBonus: 400, atkBonus: 40, matkBonus: 40 },
        { realm: "入道", subRealm: "圆满", stage: "入道圆满", maxExp: 50000, hpBonus: 500, atkBonus: 50, matkBonus: 50 },

        // === 第四阶：悟道 (五小境界) ===
        { realm: "悟道", subRealm: "初期", stage: "悟道初期", maxExp: 70000, hpBonus: 600, atkBonus: 60, matkBonus: 60 },
        { realm: "悟道", subRealm: "中期", stage: "悟道中期", maxExp: 90000, hpBonus: 600, atkBonus: 60, matkBonus: 60 },
        { realm: "悟道", subRealm: "后期", stage: "悟道后期", maxExp: 120000, hpBonus: 600, atkBonus: 60, matkBonus: 60 },
        { realm: "悟道", subRealm: "巅峰", stage: "悟道巅峰", maxExp: 150000, hpBonus: 800, atkBonus: 80, matkBonus: 80 },
        { realm: "悟道", subRealm: "圆满", stage: "悟道圆满", maxExp: 200000, hpBonus: 1000, atkBonus: 100, matkBonus: 100 },

        // === 第五阶：半步地仙 (无小境界) ===
        { realm: "半步地仙", subRealm: "半仙", stage: "半步地仙", maxExp: 500000, hpBonus: 5000, atkBonus: 500, matkBonus: 500 }
        
        // 地仙暂不开放
    ],

    // 1. 地图配置
    mapConfig: {
        "小义屯": {
            id: "小义屯",
            name: "小义屯",
            desc: "义庄旁的小村落，阴气未散。",
            env: "阴气",
            world: "yang",
            neighbors: ["抗龙村", "大龙县", "思桥"],
            monsterPool: ["阴魂", "走尸"],
            maxMonsters: 2,
            drops: ["阴气残渣", "破损符纸", "回气散", "护脉散", "息灾符", "定心丹", "通阴符"],
            dangerLevel: 1
        },
        "抗龙村": {
            id: "抗龙村",
            name: "抗龙村",
            desc: "凡俗村庄，夜晚偶有异声。",
            env: "凡俗",
            world: "yang",
            neighbors: ["小义屯", "大龙县"],
            monsterPool: [],
            npc: ["普通老人"],
            dangerLevel: 1
        },
        "大龙县": {
            id: "大龙县",
            name: "大龙县",
            desc: "县城气机繁杂，人心比风更急。",
            env: "县城",
            world: "yang",
            neighbors: ["抗龙村", "小义屯", "连城山", "思桥", "引凤镇"],
            monsterPool: ["怨尸"],
            maxMonsters: 1,
            drops: ["回气散", "护脉散", "定心丹", "息灾符"],
            dangerLevel: 2
        },
        "连城山": {
            id: "连城山",
            name: "连城山",
            desc: "山风阴冷，铃声似远似近。",
            env: "山林",
            world: "yang",
            neighbors: ["大龙县", "古桥", "古坟地"],
            monsterPool: ["山鬼", "怨尸"],
            maxMonsters: 2,
            drops: ["定心丹", "息灾符", "五行封印符", "乾坤挪移符"],
            dangerLevel: 3
        },
        "古桥": {
            id: "古桥",
            name: "古桥",
            desc: "旧桥横跨水面，水声像在数你的步子。",
            env: "水域",
            world: "yang",
            neighbors: ["连城山", "思桥"],
            monsterPool: ["浮尸", "水鬼"],
            maxMonsters: 2,
            drops: ["回气散", "天眼通明符", "风火遁形符"],
            dangerLevel: 2
        },
        "古坟地": {
            id: "古坟地",
            name: "古坟地",
            desc: "古坟成群，土里似乎有旧誓在呼吸。",
            env: "坟地",
            world: "yang",
            neighbors: ["连城山"],
            monsterPool: ["血尸", "怨尸"],
            maxMonsters: 2,
            drops: ["怨气结晶", "尸丹", "天罡破煞符", "金光护体符"],
            dangerLevel: 4
        },
        "思桥": {
            id: "思桥",
            name: "思桥",
            desc: "桥下水暗，像有人在替你记路。",
            env: "水域",
            world: "yang",
            neighbors: ["小义屯", "大龙县", "古桥"],
            crossLayerMap: "阴间·思桥下层（运魂之河）",
            monsterPool: ["浮尸", "水鬼"],
            maxMonsters: 2,
            drops: ["天眼通明符", "紫微星辰符", "通阴符"],
            dangerLevel: 2
        },
        "引凤镇": {
            id: "引凤镇",
            name: "引凤镇",
            desc: "镇上香火未断，夜里却多了些不该有的脚印。",
            env: "集镇",
            world: "yang",
            neighbors: ["大龙县", "血云棺地宫"],
            monsterPool: ["怨尸", "血尸"],
            maxMonsters: 2,
            drops: ["紫霞雷鸣符", "万鬼辟易符", "五鬼搬运符"],
            dangerLevel: 5
        },
        "血云棺地宫": {
            id: "血云棺地宫",
            name: "血云棺地宫",
            desc: "血云压顶，棺中有王。",
            env: "地宫",
            world: "yang",
            neighbors: ["引凤镇"],
            monsterPool: ["鬼王"],
            maxMonsters: 1,
            drops: ["九转还魂符", "乾坤挪移符", "万鬼辟易符"],
            dangerLevel: 6
        },

        "阴间·思桥下层（运魂之河）": {
            id: "阴间·思桥下层（运魂之河）",
            name: "阴间·思桥下层（运魂之河）",
            desc: "运魂之河无声流淌，灯火不照人影。",
            env: "阴界",
            world: "yin",
            locked: true,
            neighbors: ["阴间·城隍府"],
            crossLayerMap: "思桥",
            monsterPool: ["阴魂", "浮尸", "水鬼"],
            dangerLevel: 3
        },
        "阴间·城隍府": {
            id: "阴间·城隍府",
            name: "阴间·城隍府",
            desc: "官印森严，阴司旧规未改。",
            env: "阴界",
            world: "yin",
            locked: true,
            neighbors: ["阴间·思桥下层（运魂之河）", "阴兵营"],
            monsterPool: ["阴魂", "走尸", "怨尸"],
            dangerLevel: 4
        },
        "阴兵营": {
            id: "阴兵营",
            name: "阴兵营",
            desc: "甲叶无声，兵影列阵。",
            env: "阴界",
            world: "yin",
            locked: true,
            neighbors: ["阴间·城隍府", "阴司审判殿（未开放）"],
            monsterPool: ["阴兵", "鬼将"],
            dangerLevel: 5
        },
        "阴司审判殿（未开放）": {
            id: "阴司审判殿（未开放）",
            name: "阴司审判殿（未开放）",
            desc: "殿门未开，判词先落。",
            env: "阴界",
            world: "yin",
            locked: true,
            neighbors: ["阴兵营"],
            monsterPool: [],
            dangerLevel: 6
        }
    },

    // 2. 怪物配置 (V1.5 新增)
    monsters: {
        "阴魂": { level: 1, hp: 120, maxHp: 120, mp: 0, atk: 18, def: 2, speed: 12, exp: 8, tags: ["spirit", "yin", "ghost"], skills: ["阴气侵体", "魂触"] },
        "走尸": { level: 2, hp: 260, maxHp: 260, mp: 0, atk: 28, def: 8, speed: 6, exp: 18, tags: ["yin", "corpse", "elite", "undying_once"] },
        "浮尸": { level: 1, hp: 200, maxHp: 200, mp: 0, atk: 22, def: 3, speed: 7, exp: 12, tags: ["yin", "corpse", "water"], skills: ["缠足"] },
        "水鬼": { level: 2, hp: 220, maxHp: 220, mp: 0, atk: 32, def: 4, speed: 10, exp: 16, tags: ["yin", "ghost", "water"], skills: ["溺魂"] },
        "山鬼": { level: 3, hp: 900, maxHp: 900, mp: 0, atk: 95, def: 18, speed: 10, exp: 60, tags: ["yin", "ghost", "elite", "chanter"], skills: ["魂兽召唤", "冰刃", "山鬼吟唱"] },
        "魂兽": { level: 2, hp: 200, maxHp: 200, mp: 0, atk: 40, def: 6, speed: 12, exp: 10, tags: ["yin", "beast", "summon"] },
        "吴正华": { level: 4, hp: 1100, maxHp: 1100, mp: 0, atk: 140, def: 22, speed: 14, exp: 80, tags: ["human", "thunder", "elite"], skills: ["九天雷亟", "全真借法·雷咒", "灭神"] },
        "血尸": { level: 4, hp: 1100, maxHp: 1100, mp: 0, atk: 90, def: 22, speed: 8, exp: 70, tags: ["yin", "corpse", "elite"], skills: ["血污撕咬"] },
        "怨尸": { level: 3, hp: 600, maxHp: 600, mp: 0, atk: 50, def: 12, speed: 9, exp: 45, tags: ["yin", "corpse"], skills: ["怨缠"] },
        "鬼王": { level: 6, hp: 4800, maxHp: 4800, mp: 0, atk: 320, def: 40, speed: 12, exp: 260, tags: ["yin", "ghost", "boss", "chanter"], skills: ["万鬼朝宗", "血祭", "鬼域展开"] }
    },

    // 3. 更新公告 (V1.9 新增)
    releaseNotes: [
        {
            version: "v2.0.5 更新公告",
            date: "2026-02-03",
            title: "阴阳两界与符箓图鉴",
            content: `
                <div style="text-align:left;">
                    <h4 style="color:#e0e0e0; margin:10px 0 5px;">一、地图系统重构</h4>
                    <ul style="padding-left:20px; color:#ccc; list-style-type:disc;">
                        <li><b>阴阳双层世界</b>：新增表里世界切换机制，可通过特定入口（如思桥）借道阴阳。</li>
                        <li><b>三维拓扑结构</b>：地图移动改为上下左右空间导航，不再是线性列表。</li>
                        <li><b>修复与优化</b>：修复了地图无怪的问题，实装了阴间地图的怪物分布。</li>
                    </ul>

                    <h4 style="color:#e0e0e0; margin:10px 0 5px;">二、符箓系统升级</h4>
                    <ul style="padding-left:20px; color:#ccc; list-style-type:disc;">
                        <li><b>符箓图鉴</b>：底部导航栏新增【符箓图鉴】，可查看已收录符箓的详细信息。</li>
                        <li><b>信息完善</b>：图鉴显示符箓阶位、MP消耗、冷却回合及详细效果描述。</li>
                        <li><b>境界对齐</b>：符箓使用等级已调整为“修士-寻道-入道”体系，与角色境界匹配。</li>
                    </ul>

                    <h4 style="color:#e0e0e0; margin:10px 0 5px;">三、体验优化</h4>
                    <ul style="padding-left:20px; color:#ccc; list-style-type:disc;">
                        <li><b>视觉优化</b>：加深了行动日志的背景色，解决默认UI下文字显示过浅的问题。</li>
                        <li><b>UI调整</b>：优化了底部导航栏布局。</li>
                    </ul>
                </div>
            `
        },
        {
            version: "v2.0.0 内测版",
            date: "2026-02-02",
            title: "道统初立",
            content: `
                <div style="text-align:left;">
                    <h4 style="color:#e0e0e0; margin:10px 0 5px;">一、道统系统</h4>
                    <ul style="padding-left:20px; color:#ccc; list-style-type:disc;">
                        <li>新增道统选择机制，道统一经确定不可更换</li>
                        <li>不同道统拥有独立技能体系、成长侧重与属性面板</li>
                        <li>当前开放道统：鬼道、阴阳道、乾坤道、天一道</li>
                    </ul>

                    <h4 style="color:#e0e0e0; margin:10px 0 5px;">二、技能系统</h4>
                    <ul style="padding-left:20px; color:#ccc; list-style-type:disc;">
                        <li>新增多套道统专属技能，不可跨道统使用</li>
                        <li>不同道统在伤害、控制、生存、消耗等方面差异明显</li>
                        <li>战斗与事件中统一使用技能完整名称</li>
                    </ul>

                    <h4 style="color:#e0e0e0; margin:10px 0 5px;">三、鬼道机制</h4>
                    <ul style="padding-left:20px; color:#ccc; list-style-type:disc;">
                        <li>支持召唤与养成鬼物（类型/境界/数量上限）</li>
                        <li>本体属性较低，主要依赖鬼物作战</li>
                        <li>新增魂瓮承载与鬼物成长机制</li>
                    </ul>

                    <h4 style="color:#e0e0e0; margin:10px 0 5px;">四、阴阳道机制</h4>
                    <ul style="padding-left:20px; color:#ccc; list-style-type:disc;">
                        <li>法术型道统，技能多、覆盖广（控制/恢复/封印/转属）</li>
                        <li>可在部分事件中提前获取信息或改变结果</li>
                    </ul>

                    <h4 style="color:#e0e0e0; margin:10px 0 5px;">五、乾坤道机制</h4>
                    <ul style="padding-left:20px; color:#ccc; list-style-type:disc;">
                        <li>物理攻击型，侧重剑修，本体成长高</li>
                        <li>对灵体类敌人具备额外伤害加成</li>
                    </ul>

                    <h4 style="color:#e0e0e0; margin:10px 0 5px;">六、天一道机制</h4>
                    <ul style="padding-left:20px; color:#ccc; list-style-type:disc;">
                        <li>均衡型，可使用已学会的其他道统技能</li>
                        <li>入道后解锁专属技能</li>
                    </ul>

                    <h4 style="color:#e0e0e0; margin:10px 0 5px;">七、世界与事件</h4>
                    <ul style="padding-left:20px; color:#ccc; list-style-type:disc;">
                        <li>新增多条与道统、技能相关的事件分支</li>
                        <li>玩家行为将影响后续事件与探索结果</li>
                    </ul>

                    <h4 style="color:#e0e0e0; margin:10px 0 5px;">八、UI 与体验</h4>
                    <ul style="padding-left:20px; color:#ccc; list-style-type:disc;">
                        <li>新增战斗概览界面</li>
                        <li>技能、装备、物品显示优化</li>
                        <li>突破与心魔事件表现增强</li>
                    </ul>

                    <h4 style="color:#e0e0e0; margin:10px 0 5px;">九、兼容性</h4>
                    <ul style="padding-left:20px; color:#ccc; list-style-type:disc;">
                        <li>旧存档可正常迁移</li>
                        <li>不强制重开，但新周目可体验完整道统流程</li>
                    </ul>
                </div>
            `
        },
        {
            version: "V1.9.0 内测版",
            date: "2026-02-02",
            title: "回响与抉择",
            content: `
                <ul style="margin-bottom:12px; padding-left:20px; list-style-type:disc; color:#ccc;">
                    <li><b>新增语义区域</b>：旧宗遗址、灵脉浅层、血祭残坛。</li>
                    <li><b>世界回响系统</b>：你的历史行为（如伪突破、心魔失败）将被记录，在特定条件下触发回响事件。</li>
                    <li><b>修行倾向暗示</b>：系统根据长期行为给予不同的天地反馈。</li>
                    <li><b>上班摸鱼模式</b>：全黑风格，完美融入办公环境。</li>
                    <li><b>技能图标重绘</b>：动态生成意象图标。</li>
                    <li><b>视觉修复</b>：优化布局，去除冗余按钮。</li>
                    <li>修复怪物掉落物不进背包的问题。</li>
                    <li>修复战斗中HP/MP实时显示延迟。</li>
                    <li>背包面板新增“刷新”按钮。</li>
                    <li><b>内测福利</b>：登录即送 <b>洗髓丹 x1</b> (重置属性点)。</li>
                </ul>
            `
        }
    ],

    // 2.5 物品配置 (V1.9 新增 - 从 Logic 迁移)
    itemConfig: {
        "破损符纸": { hp: 20, mp: 0, desc: "回复了少量气血" },
        "阴气残渣": { hp: -5, mp: 10, desc: "虽然伤身，但回复了灵力" },
        "怨气结晶": { hp: -20, exp: 50, desc: "吞噬怨气，修为大涨，但经脉剧痛" },
        "尸丹": { maxHpDelta: 5, desc: "服用尸丹，体质增强" },

        "回气散": { hp: 40, mp: 25, desc: "气血与灵力快速回稳" },
        "护脉散": { hp: 10, maxHpDelta: 10, desc: "经脉稍稳，突破时不易走偏", setFlags: { bt_success_bonus: "+10" } },
        "息灾符": { mp: 10, desc: "将余波提前封住，避免债务催讨", setFlags: { bt_debt_due: false, bt_debt_due_level: 0 } },
        "定心丹": { mp: 15, desc: "心念更清明，守心更易落点", setFlags: { bt_method: "celestial" }, mfStrainDelta: -1 },
        "洗髓丹": { desc: "逆转经脉，重塑根骨。服用后可重置所有已分配的属性点。", type: "consumable", effect: "respec" },

        "天罡破煞符": { type: "talisman", grade: "黄", reqLevel: "修士", mpCost: 20, cooldown: { kind: "battle", rounds: 3 }, desc: "对鬼物造成 160% 光伤，并驱散 1 个负面状态。", talisman: { kind: "nuke", element: "light", vs: "ghost", mult: 1.6, dispel: 1 } },
        "金光护体符": { type: "talisman", grade: "黄", reqLevel: "修士", mpCost: 20, cooldown: { kind: "battle", rounds: 3 }, desc: "减伤 40%，阴伤额外 -20%，持续 3 回合。", talisman: { kind: "shield", duration: 3, takenMult: 0.6, yinTakenMult: 0.8 } },
        "紫微星辰符": { type: "talisman", grade: "蓝", reqLevel: "寻道", mpCost: 40, cooldown: { kind: "world", oncePerMap: true }, desc: "本次修行 EXP +25%，突破成功率 +5%。", talisman: { kind: "cultivation_boost", expMult: 1.25, setFlags: { bt_success_bonus: "+5" } } },
        "九转还魂符": { type: "talisman", grade: "红", reqLevel: "入道", mpCost: 80, cooldown: { kind: "battle", oncePerBattle: true }, desc: "战斗中濒死时以 1 HP 复活，并免疫 1 回合（每场仅 1 次）。", talisman: { kind: "revive", oncePerBattle: true, hp: 1, immune: 1 } },
        "风火遁形符": { type: "talisman", grade: "蓝", reqLevel: "寻道", mpCost: 40, cooldown: { kind: "battle", rounds: 3 }, desc: "立即脱离战斗，免疫追击；下次战斗伤害 -10%。", talisman: { kind: "escape", setFlags: { next_battle_damage_malus: 0.1 } } },
        "万鬼辟易符": { type: "talisman", grade: "红", reqLevel: "入道", mpCost: 80, cooldown: { kind: "battle", rounds: 3 }, desc: "对鬼物全体造成 150% 光伤，50% 概率恐惧 1 回合。", talisman: { kind: "aoe", element: "light", vs: "ghost", mult: 1.5, fearChance: 0.5, fearDuration: 1 } },
        "天眼通明符": { type: "talisman", grade: "蓝", reqLevel: "寻道", mpCost: 40, cooldown: { kind: "world", oncePerMap: true }, desc: "地图事件提前预览 1 步，隐藏事件发现率 +30%。", talisman: { kind: "explore", previewSteps: 1, hiddenChanceBonus: 0.3 } },
        "五行封印符": { type: "talisman", grade: "蓝", reqLevel: "寻道", mpCost: 40, cooldown: { kind: "battle", rounds: 3 }, desc: "封印目标技能 2 回合（Boss 1 回合）。", talisman: { kind: "seal", duration: 2, bossDuration: 1 } },
        "乾坤挪移符": { type: "talisman", grade: "红", reqLevel: "入道", mpCost: 80, cooldown: { kind: "battle", rounds: 3 }, desc: "重排敌我站位，并打断吟唱。", talisman: { kind: "interrupt" } },
        "紫霞雷鸣符": { type: "talisman", grade: "红", reqLevel: "入道", mpCost: 80, cooldown: { kind: "battle", rounds: 3 }, desc: "全体 140% 雷伤；对鬼物额外 +30%。", talisman: { kind: "aoe", element: "thunder", mult: 1.4, vs: "ghost", bonusMult: 0.3 } },
        "通阴符": { type: "talisman", grade: "黄", reqLevel: "修士", mpCost: 20, cooldown: { kind: "world", oncePerMap: true }, desc: "打开阴间地图；鬼道感悟 +5%。", talisman: { kind: "unlock_yin", setFlags: { ghost_insight_bonus: 0.05 } } },
        "封魂符": { type: "talisman", grade: "蓝", reqLevel: "寻道", mpCost: 40, cooldown: { kind: "battle", rounds: 3 }, desc: "封印目标 2 回合；对强敌成功率更低，可转化为材料。", talisman: { kind: "seal_chance", normal: 0.7, elite: 0.4, boss: 0.15, duration: 2 } },
        "五鬼搬运符": { type: "talisman", grade: "蓝", reqLevel: "寻道", mpCost: 40, cooldown: { kind: "world", oncePerMap: true }, desc: "掉落 +25%，并可偷取一次奖励。", talisman: { kind: "loot_boost", dropMult: 1.25, stealOnce: true } },
        "朱雀火凤符": { type: "talisman", grade: "红", reqLevel: "入道", mpCost: 80, cooldown: { kind: "battle", rounds: 3 }, desc: "造成 130% 火伤，并施加灼烧 2 回合（每回合损失 5% HP）。", talisman: { kind: "dot", element: "fire", mult: 1.3, dot: { id: "burn", duration: 2, hpPct: 0.05 } } },
        "玄武水渊符": { type: "talisman", grade: "红", reqLevel: "入道", mpCost: 80, cooldown: { kind: "battle", rounds: 3 }, desc: "造成 130% 水伤，并获得减伤 +30%（2 回合）。", talisman: { kind: "strike_and_shield", element: "water", mult: 1.3, duration: 2, takenMult: 0.7 } }
    },

    skillConfig: {},

    // 3.5 种族配置 (UI提示用)
    raceConfig: {
        "人族": { desc: "天生道体，悟性尚可，最为平衡的种族。", color: "#2ecc71" }, // Green
        "妖族": { desc: "肉身强横，寿元悠长，但修行艰难。", color: "#e74c3c" }, // Red
        "灵族": { desc: "天地灵气所钟，亲和五行，体质孱弱。", color: "#3498db" } // Blue
    },

    // 4. 环境日志
    environmentLogs: {
        "凡俗": [
            "村庄炊烟袅袅，凡人并未察觉你的存在。",
            "黄犬卧在门槛边打盹，你的脚步声被风吹散。",
            "井口传来一阵清凉气息，像是日常也在修行。"
        ],
        "阴气": [
            "阴风拂过，义庄方向传来低语。",
            "纸钱在路边翻滚，像有人刚走过又折返。",
            "你闻到淡淡的香灰味，回头却只见雾。"
        ],
        "县城": [
            "城门开合，人声如潮，却无人知你是谁。",
            "香火与油烟混在风里，杂念也跟着起伏。"
        ],
        "山林": [
            "风铃声忽远忽近，像有人在林子里替你点名。",
            "山气阴冷，草叶上挂着不该有的湿意。"
        ],
        "水域": [
            "水面浮起一圈圈涟漪，像有人在水下缓慢呼吸。",
            "桥影倒扣，水声像在数你的心跳。"
        ],
        "坟地": [
            "土里有旧誓的味道，像沉了很久的香灰。",
            "坟头草动了一下，又像从未动过。"
        ],
        "集镇": [
            "镇口的灯一直亮着，却照不清来人去处。",
            "你听见巷子尽头有脚步，却看不见人。"
        ],
        "地宫": [
            "墙里渗出冷意，像棺木的呼吸贴在耳后。",
            "火光一跳，影子就多了一层。"
        ],
        "阴界": [
            "灯火不照人影，你的脚步声像借来的。",
            "河风吹过，带着纸钱与判词的味道。"
        ]
    },
    worldTendencyLogs: {
        omen: [
            { min: 1, max: 2, logs: ["天色有些不对劲，云层压得很低。", "空气中有淡淡的铁锈味。"] },
            { min: 3, max: 5, logs: ["天边隐约透出暗红色的光，像是在渗血。", "你感觉周围的阴影似乎有了自己的意识，在你视线死角蠕动。"] },
            { min: -5, max: -1, logs: ["今日云淡风轻，令人心旷神怡。", "瑞气implicitly，似乎有什么好事发生。"] }
        ],
        chaos: [
            { min: 1, max: 5, logs: ["大地偶尔传来轻微的震颤，仿佛某种巨物翻身。", "法则在这里变得有些模糊，风向忽左忽右。"] },
            { min: -5, max: -1, logs: ["四周井然有序，草木生长都显得格外规整。", "你感到一种莫名的安宁，仿佛一切都在既定的轨道上。"] }
        ]
    },

    // 4.5 回响文本 (V2 Mindfracture Echo)
    mfEchoTexts: {
        "tempered": "你忽然意识到，当年的心魔，已经很久没出现了。",
        "scarred": "你偶尔会想，如果当年再慢一步，会不会不同。",
        "broken": "有些路你已经不再看见了，但你说不清从什么时候开始的。"
    },

    // 5. 事件池
    events: [
        {
            id: "event_establish_dao_01",
            eventType: "story",
            title: "立道",
            desc: "你忽然明白：修行不是飘在水面上的漂流。你必须选一条路，并且不再回头。",
            options: [
                {
                    id: "ghost_nurture",
                    text: "入鬼道 · 养鬼道",
                    tooltip: "【鬼道·养鬼】\n以血饲鬼，向死而生。\n核心：消耗HP，培育实体鬼物（可进阶）。\n侧重：鬼物养成，后期上限极高，本体较脆弱。",
                    log: "你以记忆为灯，以代价为薪。魂与怨在你掌心醒来。",
                    meta: { story: { setFlags: { daoType: "鬼道", daoBranch: "养鬼道", daoLocked: true }, nextEventId: "event_cycle_complete_01", delayTicks: 0 } }
                },
                {
                    id: "ghost_summon",
                    text: "入鬼道 · 招鬼道",
                    tooltip: "【鬼道·招鬼】\n叩问阴司，号令自来。\n核心：消耗HP，快速召唤鬼物助战。\n侧重：即时战力，数量压制，无需繁琐养成。",
                    log: "你叩问阴司，号令自来。你听见身后有脚步，却不敢回头。",
                    meta: { story: { setFlags: { daoType: "鬼道", daoBranch: "招鬼道", daoLocked: true }, nextEventId: "event_cycle_complete_01", delayTicks: 0 } }
                },
                {
                    id: "yinyang",
                    text: "入阴阳道",
                    tooltip: "【阴阳道】\n平衡流转，逆乱阴阳。\n核心：切换阴/阳状态，触发连击与护盾。\n侧重：全能型法师（控制/恢复/封印/转属），适应性最强。",
                    log: "你把世界分成两半，又把两半重新揉成一体。你开始seeing“变化”。",
                    meta: { story: { setFlags: { daoType: "阴阳道", daoLocked: true }, nextEventId: "event_cycle_complete_01", delayTicks: 0 } }
                },
                {
                    id: "qiankun",
                    text: "入乾坤道",
                    tooltip: "【乾坤道】\n军阵杀伐，一力破万法。\n核心：纯粹的物理输出，高属性成长。\n侧重：剑修玩法，对灵体类敌人有额外克制。",
                    log: "你把身躯当作军阵，把意志当作号令。你要正面碾过去。",
                    meta: { story: { setFlags: { daoType: "乾坤道", daoLocked: true }, nextEventId: "event_cycle_complete_01", delayTicks: 0 } }
                },
                {
                    id: "tianyi",
                    text: "入天一道",
                    tooltip: "【天一道】\n上善若水，生生不息。\n核心：高续航与净化，可复用其他道统技能。\n侧重：生存能力极强，擅长持久战与防守反击。",
                    log: "你不追求极端，你追求融会。万法皆可复现，但需付出代价。",
                    meta: { story: { setFlags: { daoType: "天一道", daoLocked: true }, nextEventId: "event_cycle_complete_01", delayTicks: 0 } }
                }
            ]
        },
        {
            id: "event_ghost_advance_fail_01",
            eventType: "story",
            title: "鬼物进阶失控",
            desc: "魂瓮里传出细碎的撞击声。鬼物的气机在门槛前骤然散开，怨意像冷雾漫出来。",
            options: [
                {
                    id: "calm",
                    text: "以符压息",
                    log: "你以符压息，怨意被按回瓮底。鬼物暂时安静下来。",
                    meta: { story: { setFlags: { ghost_fail_resolved: true }, nextEventId: "event_cycle_complete_01", delayTicks: 0 } }
                },
                {
                    id: "feed",
                    text: "以怨饲怨",
                    log: "你让它吞下一口更深的怨。它稳住了，却更重了。",
                    meta: { story: { setFlags: { ghost_fail_resolved: true, ghost_feed: true }, nextEventId: "event_cycle_complete_01", delayTicks: 0 } }
                }
            ]
        },
        {
            id: "event_strange_wind",
            eventType: "trial",
            title: "阴风阵阵",
            desc: "一阵阴风吹过，你感觉背脊发凉，似乎有人在窥视你。",
            meta: { tendencyTags: ["chaos"] },
            options: [
                { id: "guard", text: "凝神戒备", log: "你凝神戒备，什么也没有发生。" },
                { id: "rush", text: "快速通过", log: "你加快脚步，离开了这片区域。" }
            ]
        },
        {
            id: "event_broken_stele",
            eventType: "enlightenment",
            title: "残破石碑",
            desc: "路边有一块残破的石碑，上面刻着模糊的符文。",
            meta: { tendencyTags: ["order", "omen"] },
            options: [
                { id: "touch", text: "抚摸石碑", log: "你感受了丝丝微弱的灵力波动。" },
                { id: "ignore", text: "无视", log: "你没有理会石碑，继续前行。" }
            ]
        },
        {
            id: "story_windchain_d1_01",
            eventType: "trial",
            title: "第一夜：阴风入骨",
            desc: "你在阴气渐重的路上停步。风像是从义庄里吹出来的，夹着细碎的哭声。",
            options: [
                {
                    id: "light",
                    text: "点起符火照路",
                    log: "你点起微弱符火，阴影退了半步，但风声更近了。",
                    delta: { playerMp: -5 },
                    meta: { story: { chainId: "windchain", step: 1, dayDelta: 0, setFlags: { litFire: true }, nextEventId: "story_windchain_d1_02", delayTicks: 1 } }
                },
                {
                    id: "hold",
                    text: "屏息潜行",
                    log: "你屏息潜行，脚步无声，但胸口像压着一块石头。",
                    delta: { playerHp: -2 },
                    meta: { story: { chainId: "windchain", step: 1, dayDelta: 0, setFlags: { cautious: true }, nextEventId: "story_windchain_d1_02", delayTicks: 1 } }
                }
            ]
        },
        {
            id: "story_windchain_d1_02",
            eventType: "trial",
            title: "残碑与指痕",
            desc: "路旁残碑被雨水洗得发亮，上面似乎有新鲜的指痕，像有人刚刚抚过。",
            options: [
                {
                    id: "touch",
                    text: "触摸指痕",
                    log: "冰冷从指尖窜入经络，你的灵息紊乱了一瞬。",
                    delta: { playerMp: -8 },
                    meta: { story: { chainId: "windchain", step: 2, dayDelta: 1, setFlags: { marked: true }, nextEventId: "story_windchain_d2_01", delayTicks: 10 } }
                },
                {
                    id: "inscribe",
                    text: "以血点符，压住阴意",
                    log: "你以血点符压住阴意，碑面暗纹退去，掌心却implicitly作痛。",
                    delta: { playerHp: -5 },
                    meta: { story: { chainId: "windchain", step: 2, dayDelta: 1, setFlags: { warded: true }, nextEventId: "story_windchain_d2_01", delayTicks: 10 } }
                }
            ]
        },
        {
            id: "story_windchain_d2_01",
            eventType: "trial",
            title: "第二日：路人不言",
            desc: "白日里，村口老人见你走近，话到嘴边又吞下，只对你摇头。",
            options: [
                {
                    id: "ask",
                    text: "追问老人",
                    log: "老人只说：『义庄门前不要回头。三日后，风会记住你的名字。』",
                    meta: { story: { chainId: "windchain", step: 3, dayDelta: 0, setFlags: { heardWarning: true }, nextEventId: "story_windchain_d2_02", delayTicks: 1 } }
                },
                {
                    id: "leave",
                    text: "不作纠缠",
                    log: "你不作纠缠，老人却在背后低声念了几句听不清的咒。",
                    meta: { story: { chainId: "windchain", step: 3, dayDelta: 0, setFlags: { ignoredWarning: true }, nextEventId: "story_windchain_d2_02", delayTicks: 1 } }
                }
            ]
        },
        {
            id: "story_windchain_d2_02",
            eventType: "trial",
            title: "夜梦：义庄回声",
            desc: "夜里你梦见自己站在义庄门前。门后有人轻敲三下，像是在对你打招呼。",
            options: [
                {
                    id: "meditate",
                    text: "守心观想",
                    log: "你强行守住心神，梦境像潮水退去，只剩耳畔一声叹息。",
                    delta: { playerMp: 5 },
                    meta: { story: { chainId: "windchain", step: 4, dayDelta: 1, setFlags: { steadyMind: true }, nextEventId: "story_windchain_d3_01", delayTicks: 10 } }
                },
                {
                    id: "answer",
                    text: "开口回应",
                    log: "你开口回应，梦里那扇门‘吱呀’开了一线，你看见自己的影子在里面。",
                    delta: { playerHp: -8 },
                    meta: { story: { chainId: "windchain", step: 4, dayDelta: 1, setFlags: { answered: true }, nextEventId: "story_windchain_d3_01", delayTicks: 10 } }
                }
            ]
        },
        {
            id: "story_windchain_d3_01",
            eventType: "trial",
            title: "第三日：义庄门前",
            desc: "你来到义庄门前。门钉锈红，像是凝着旧血。风停了，反而更冷。",
            options: [
                {
                    id: "enter",
                    text: "推门而入",
                    log: "你推门而入，阴气像潮水涌来，你的心跳慢了半拍。",
                    delta: { playerHp: -12 },
                    meta: { story: { chainId: "windchain", step: 5, dayDelta: 0, setFlags: { steppedIn: true }, nextEventId: "story_windchain_d3_02", delayTicks: 1 } }
                },
                {
                    id: "circle",
                    text: "绕墙探查",
                    log: "你绕墙探查，发现墙角埋着一截破木牌，上书：『回头者死』。",
                    meta: { story: { chainId: "windchain", step: 5, dayDelta: 0, setFlags: { foundPlaque: true }, nextEventId: "story_windchain_d3_02", delayTicks: 1 } }
                }
            ]
        },
        {
            id: "story_windchain_d3_02",
            eventType: "trial",
            title: "风记名",
            desc: "你忽然意识到：这几日的风声，像在一遍遍念你的名字。它不是风，是‘记忆’。",
            options: [
                {
                    id: "cut",
                    text: "斩断回声",
                    log: "你强行斩断回声，代价是气血翻涌，但那股被窥视的感觉弱了。",
                    delta: { playerHp: -10 },
                    meta: { story: { chainId: "windchain", step: 6, dayDelta: 1, setFlags: { cutEcho: true }, nextEventId: "story_windchain_d4_01", delayTicks: 10 } }
                },
                {
                    id: "bear",
                    text: "任其铭刻",
                    log: "你任其铭刻，耳畔风声渐清，像在教你一段陌生的吐纳法。",
                    delta: { playerMp: 8 },
                    meta: { story: { chainId: "windchain", step: 6, dayDelta: 1, setFlags: { acceptedMark: true }, nextEventId: "story_windchain_d4_01", delayTicks: 10 } }
                }
            ]
        },
        {
            id: "story_windchain_d4_01",
            eventType: "trial",
            title: "第四日：阴路收账",
            desc: "你走在阴路上，忽觉脚下泥土松动，像有什么东西在跟着你。",
            options: [
                {
                    id: "pay_mp",
                    text: "以灵息偿还",
                    log: "你吐出一口灵息，泥土下的动静安静了些。",
                    delta: { playerMp: -12 },
                    meta: { story: { chainId: "windchain", step: 7, dayDelta: 1, setFlags: { paid: true }, nextEventId: "story_windchain_d5_01", delayTicks: 10 } }
                },
                {
                    id: "pay_hp",
                    text: "以血气偿还",
                    log: "你咬破舌尖，以血气偿还，阴路似乎对你更‘熟悉’了。",
                    delta: { playerHp: -15 },
                    meta: { story: { chainId: "windchain", step: 7, dayDelta: 1, setFlags: { paid: true }, nextEventId: "story_windchain_d5_01", delayTicks: 10 } }
                }
            ]
        },
        {
            id: "story_windchain_d5_01",
            eventType: "trial",
            title: "第五日：回声归位",
            desc: "五日已满。你再次听见那熟悉的风声，这次它不再喊你的名字，而是问你：『你是谁？』",
            options: [
                {
                    id: "name",
                    text: "报上道号",
                    log: "你报上道号，风声像是记住了答案。你感到某种束缚松开了一线。",
                    delta: { expDelta: 15, playerMp: 5 },
                    meta: { story: { chainId: "windchain", step: 8, dayDelta: 0, setFlags: { resolved: true }, nextEventId: null, delayTicks: 0, complete: true } }
                },
                {
                    id: "silence",
                    text: "沉默不答",
                    log: "你沉默不答，风声停了一瞬，随后化作一声冷笑。你知道它还会再来。",
                    delta: { expDelta: 5, playerHp: -5 },
                    meta: { story: { chainId: "windchain", step: 8, dayDelta: 0, setFlags: { unresolved: true }, nextEventId: null, delayTicks: 0, complete: true } }
                }
            ]
        },
        {
            id: "story_mindfracture_d1_01",
            eventType: "narrative",
            title: "第一日：异样",
            desc: "杂念频生，入定不稳。明明灵息如常，却总像隔着一层薄薄的裂纹。",
            options: [
                {
                    id: "endure",
                    text: "忍耐",
                    log: "你按下那点异样，装作无事。只是心头的回声并未散去。",
                    meta: { story: { chainId: "mindfracture", day: 1, step: 1, setFlags: { mf_noise: true, mf_strain: 0, mf_day: 1 }, nextEventId: "story_mindfracture_d2_01", delayTicks: 10 } }
                }
            ]
        },
        {
            id: "story_mindfracture_d2_01",
            eventType: "narrative",
            title: "第二日：干扰",
            desc: "你试图再次入定，却总像有人在你耳边轻轻拨动一根弦。那声音不大，却让你无法忽视。",
            options: [
                {
                    id: "continue",
                    text: "继续入定",
                    log: "你强迫心神归位。裂纹没有扩大，却开始‘干扰’你。",
                    meta: { story: { chainId: "mindfracture", day: 2, step: 2, dayDelta: 1, setFlags: { mf_interference: true, mf_day: 2 }, nextEventId: "story_mindfracture_d3_01", delayTicks: 10 } }
                }
            ]
        },
        {
            id: "story_mindfracture_d3_01",
            eventType: "narrative",
            title: "第三日：裂意",
            desc: "裂纹像一道极细的缝，沿着你的念头滑行。你越想压下它，它越像在等待你先崩。",
            options: [
                {
                    id: "ignore",
                    text: "强忍不理",
                    log: "你强忍不理，胸口却像被针轻轻戳了一下。",
                    meta: { story: { chainId: "mindfracture", day: 3, step: 3, dayDelta: 1, setFlags: { mf_strain: "+1", mf_day: 3 }, nextEventId: "story_mindfracture_d4_01", delayTicks: 10 } }
                },
                {
                    id: "rest",
                    text: "暂且收功",
                    log: "你暂且收功，不与它争。裂纹像失去目标般沉默了片刻。",
                    meta: { story: { chainId: "mindfracture", day: 3, step: 3, dayDelta: 1, setFlags: { mf_day: 3 }, nextEventId: "story_mindfracture_d4_01", delayTicks: 10 } }
                }
            ]
        },
        {
            id: "story_mindfracture_d4_01",
            eventType: "narrative",
            title: "第四日：压力",
            desc: "你开始察觉，裂纹并不急着摧毁你。它更像是在施压——逼你承认某件事。",
            options: [
                {
                    id: "continue",
                    text: "继续撑下去",
                    log: "你继续撑下去，心口的压力却像潮水一样涨了上来。",
                    meta: { story: { chainId: "mindfracture", day: 4, step: 4, dayDelta: 1, setFlags: { mf_pressure: true, mf_day: 4 }, nextEventId: "story_mindfracture_d5_01", delayTicks: 10 } }
                }
            ]
        },
        {
            id: "story_mindfracture_d5_01",
            eventType: "trial",
            title: "第五日：裂纹现形",
            desc: "五日已至。裂纹不再潜伏，它站在你的念头里，像一面不肯碎的镜。",
            options: [
                {
                    id: "face_demon",
                    text: "直面心魔",
                    log: "你抬眼看向那道裂纹，等它露出真正的形状。",
                    meta: { story: { chainId: "mindfracture", day: 5, step: 5, dayDelta: 1, setFlags: { mf_day: 5 }, nextEventId: null, delayTicks: 0, complete: true } }
                },
                {
                    id: "force_breakthrough",
                    text: "强行突破",
                    log: "你不与它对视，你要以更快的速度冲开关隘，把裂纹甩在身后。",
                    meta: { story: { chainId: "mindfracture", day: 5, step: 5, dayDelta: 1, setFlags: { mf_day: 5 }, nextEventId: null, delayTicks: 0, complete: true } }
                }
            ]
        },
        {
            id: "event_breakthrough_prepare_01",
            eventType: "trial",
            title: "破境前夕",
            desc: "修行至此，灵台震颤，真气自发运转。你很清楚——继续闭关，只是徒耗岁月。破境之机，已在眼前。",
            meta: { rarity: "common" },
            options: [
                {
                    id: "normal",
                    text: "稳扎稳打",
                    log: "你收敛心神，反复运转吐纳之法。不争一时之快，只求气机圆融。破境，不是赌命，而是顺势。",
                    meta: { story: { setFlags: { bt_method: "normal", bt_success_bonus: "+5", bt_heart_seed: 0, bt_debt: false, bt_debt_level: 0, bt_fake_realm: false, bt_omen_pending: 0 } } }
                },
                {
                    id: "intense_hanging",
                    text: "高强度挂机",
                    log: "你放弃调息，强行引导灵气灌入经脉。丹田震荡，神识发热，灵气在体内奔涌不休。你隐约察觉到某种不属于你的意志在暗中回应——但此刻，已经无法停下。",
                    meta: { story: { setFlags: { bt_method: "intense", bt_success_bonus: "-10", bt_heart_seed: "+2", bt_debt: false, bt_debt_level: 0, bt_fake_realm: false, bt_omen_pending: "+1" } } }
                },
                {
                    id: "pill",
                    text: "速成丹服用",
                    log: "丹力如潮，推着你向前。你隐约感觉到有东西被一并带了上来。",
                    meta: { story: { setFlags: { bt_method: "pill", bt_success_bonus: "+25", bt_heart_seed: 0, bt_debt: true, bt_debt_level: 2, bt_fake_realm: false, bt_omen_pending: 0 } } }
                },
                {
                    id: "evil_guidance",
                    text: "邪修指点",
                    log: "那人话不多，却每一句都像刀口。你听懂了，也欠下了什么。",
                    meta: { story: { setFlags: { bt_method: "evil", bt_success_bonus: "+25", bt_heart_seed: 0, bt_debt: true, bt_debt_level: 1, bt_fake_realm: false, bt_omen_pending: 0, bt_false_success_forced: false } } }
                },
                {
                    id: "celestial",
                    text: "天象参悟",
                    log: "夜半，你仰观星斗。天穹低垂，星轨缓缓轮转，仿佛某种古老意志正在注视凡间。你并未强行引动灵气，只是静坐其下，让自身气机与天地呼吸同步。若天意允你前行，自会放行。若不允……你也不会逆天而上。",
                    meta: { story: { setFlags: { bt_method: "celestial", bt_success_bonus: "+5", bt_heart_seed: 0, bt_debt: false, bt_debt_level: 0, bt_fake_realm: false, bt_omen_pending: -1, bt_delay_aftershock: 1 } } }
                },
                {
                    id: "blood",
                    text: "血祭阵法",
                    log: "阵纹在地面亮起，你以精血为引，强行构筑破境之阵。剧痛自四肢百骸传来，生命力被迅速抽离。你很清楚，这不是修行之道——但你同样清楚，成功率会高得惊人。至于代价……你选择现在不去想。",
                    meta: { story: { setFlags: { bt_method: "blood", bt_success_bonus: "+25", bt_heart_seed: 0, bt_debt: true, bt_debt_level: 3, bt_fake_realm: false, bt_omen_pending: 0, bt_hp_floor: 1 } } }
                }
            ]
        },
        {
            id: "event_breakthrough_attempt_01",
            eventType: "trial",
            title: "破境",
            desc: "灵气汇聚，天地仿佛屏住了呼吸。这一刻，你可以选择——",
            meta: { rarity: "common" },
            options: [
                { id: "attempt", text: "开始突破", log: "你放开心防，引动所有积蓄的力量。真气冲击瓶颈，经脉发出细微的破裂声。成败，将在此刻揭晓。" },
                { id: "cancel", text: "暂缓", log: "你强行中止气机运转。虽然错失良机，但至少——你还活着。" }
            ]
        },
        {
            id: "event_breakthrough_aftershock_01",
            eventType: "trial",
            title: "余波",
            desc: "气机溃散的瞬间，你强行稳住心神。然而，失败并未就此结束。你没有失败，只是这条路暂时走不通。",
            meta: { rarity: "common" },
            options: [
                { id: "steady", text: "守心", log: "你闭目凝神，死死守住灵台最后一线清明。若能撑过这一刻，或许还能全身而退。", meta: { story: { nextEventId: "event_heart_demon_combat_01", delayTicks: 0 } } },
                { id: "press", text: "强压", log: "你选择继续施压，试图以意志压制紊乱的气机。这是最危险的做法。成功，便是气机归一。失败——后果不堪设想。", meta: { story: { nextEventId: "event_breakthrough_stabilized_01", delayTicks: 0 } } }
            ]
        },
        {
            id: "event_heart_demon_combat_01",
            eventType: "heartDemon",
            title: "心魔乘隙",
            desc: "灵台震荡，一道与你一模一样的身影浮现。\n【旁白】你察觉到，它并不陌生。\n【旁白】它的气息，与你完全一致。",
            meta: { rarity: "common", story: { setFlags: { heart_demon_seen: 1, bt_aftershock_branch: "steady_fail" } } },
            options: [
                { id: "fight", text: "迎战", log: "你把那道影子迎到心前。此战不为胜负，只为不让它占据你。" }
            ]
        },
        {
            id: "event_heart_demon_dialogue_01",
            eventType: "trial",
            title: "心魔低语",
            desc: "它没有立刻出手。\n【心魔】你不是第一次这么做。\n【心魔】你心里很清楚，这一步会走到哪里。\n【心魔】可你还是选了它。",
            meta: { rarity: "common", requiredFlags: ["heart_demon_seen"] },
            options: [
                { 
                    id: "deny", 
                    text: "这是必要的代价。", 
                    log: "你试图说服自己。但那个声音并没有消失，只是暂时隐没。",
                    meta: { story: { setFlags: { heart_demon_denied: 1 } } } 
                },
                { 
                    id: "accept", 
                    text: "……我知道。", 
                    log: "你承认了。那道影子似乎点了点头，变得更加清晰。",
                    meta: { story: { setFlags: { heart_demon_accepted: 1 } } } 
                }
            ]
        },
        {
            id: "event_heart_demon_combat_02",
            eventType: "heartDemon",
            title: "心魔·贪念",
            desc: "你尚未运转功法，内景却自行展开。这一次，不是它来找你，是你把它叫出来的。",
            meta: { rarity: "common", personality: "greed" },
            options: [
                { id: "fight", text: "直面", log: "你看着那个更清晰的自己。它说得对，你确实想要更多。", meta: { story: { setFlags: { bt_heart_demon_phase: 2 } } } }
            ]
        },
        {
            id: "event_heart_demon_inner_view_01",
            eventType: "trial",
            title: "内观",
            desc: "你已分不清它是否仍是“心魔”。\n【内观】如果现在继续，你会成功。\n【内观】但你会失去之后的一部分可能性。\n【内观】这不是警告。\n【内观】这是确认。",
            meta: { rarity: "special", requiredFlags: ["heart_demon_phase_3"] },
            options: [
                { 
                    id: "extreme", 
                    text: "我知道后果。", 
                    log: "你不是不知道后果。你只是不想等了。功法运转成功。但你清楚地感觉到——有什么东西，被你亲手跳过了。", 
                    meta: { 
                        story: { 
                            setFlags: { usedExtremeOnce: true, route_closed_future: true, world_omen_delta: 2, bt_efficiency_malus: 0.2, heart_demon_phase: 3 },
                            nextEventId: "event_cycle_complete_01",
                            delayTicks: 0
                        } 
                    } 
                },
                { 
                    id: "withdraw", 
                    text: "我再等等。", 
                    log: "你停下了。这次机会没了，但路还在。", 
                    meta: { 
                        story: { 
                            setFlags: { refusedExtremeOnce: true },
                            nextEventId: "event_cycle_complete_01",
                            delayTicks: 0
                        } 
                    } 
                }
            ]
        },
        {
            id: "event_heart_demon_final",
            eventType: "trial",
            title: "内景·终局",
            desc: "你进入内景。没有异象，没有压迫。心魔站在那里，像是在等你。\n【心魔】你现在，已经不需要我来考验你了。\n【玩家】那你为什么还在？\n【心魔】因为你每一次选择，都是在问同一个问题。“值不值得。”",
            meta: { rarity: "special", requiredFlags: ["usedExtremeOnce", "refusedExtremeOnce"] },
            options: [
                { 
                    id: "release", 
                    text: "完全放下", 
                    log: "你不再需要提醒。心魔消失。你做的每一个决定，都再也没有借口。", 
                    meta: { story: { setFlags: { heart_demon_gone: true } } } 
                },
                { 
                    id: "keep", 
                    text: "保留内观", 
                    log: "留下来吧。不是为了诱惑，而是为了记得我在选择什么。心魔不再出现，但每一次重大抉择前，你都会停顿一瞬。", 
                    meta: { story: { setFlags: { heart_demon_integrated: true } } } 
                }
            ]
        },
        {
            id: "event_breakthrough_stabilized_01",
            eventType: "trial",
            title: "气机归一",
            desc: "你强压余波，硬生生把散乱的气机捏回一线。疼痛像钉子，却也像界碑。",
            meta: { rarity: "common" },
            options: [
                { id: "accept", text: "收束", log: "你把一切杂音留在门外。气机归一，心神却更沉。", meta: { story: { setFlags: { bt_aftershock_branch: "press_success" } } } }
            ]
        },
        {
            id: "event_breakthrough_unstable_01",
            eventType: "trial",
            title: "气机紊乱",
            desc: "灵台骤然一空。下一瞬，你感到一种意想不到的“广阔”。——境界，确实提升了。但很快，你察觉到不对。气机并未完全归一。灵气运转时，总有细微的滞涩与反噬。你明白了。这不是一次干净的突破。你能继续修行。你也会比旁人走得更远。但这条路上——你将永远背负这一次选择的余波。",
            meta: { rarity: "common" },
            options: [
                {
                    id: "endure",
                    text: "默默承受",
                    log: "远处，天空隐约泛起异样的光晕。某种不祥的预兆，悄然在世界中沉淀。",
                    meta: {
                        story: {
                            setFlags: {
                                bt_aftershock_branch: "unstable_success",
                                bt_efficiency_malus: 0.2,
                                world_omen_delta: 1
                            },
                            nextEventId: "event_cycle_complete_01",
                            delayTicks: 0
                        }
                    }
                }
            ]
        },
        {
            id: "event_cycle_complete_01",
            eventType: "trial",
            title: "此轮已毕",
            desc: "你收束气机，回望这一轮走过的路：选择、代价、以及那些尚未显形的回响。\n你可以继续向前，也可以暂时停下。",
            meta: { rarity: "common" },
            options: [
                {
                    id: "continue",
                    text: "继续 (结束)",
                    log: "你没有急着忘记刚才的感觉。你只是把它收进心里，然后继续走。突破已完成。",
                    meta: { story: { setFlags: { cycle_complete_choice: "continue" }, nextEventId: null, delayTicks: 0 } }
                },
                {
                    id: "pause",
                    text: "暂时停下",
                    log: "你决定暂时收功。不是退缩，而是给自己一个能继续走下去的呼吸。",
                    meta: { story: { setFlags: { cycle_complete_choice: "pause" }, nextEventId: null, delayTicks: 0 } }
                }
            ]
        },
        {
            id: "event_world_chaos_03",
            eventType: "trial",
            title: "躁风异兆",
            desc: "近来风里多了些不安分的声响。你走在路上，竟听见树影在低声相互指认。",
            meta: { worldGate: { chaosGte: 3 }, tendencyTags: ["chaos", "omen"], rarity: "rare" },
            options: [
                { id: "observe", text: "驻足片刻", log: "你驻足片刻，风声忽然安静了一瞬。", delta: { expDelta: 3 } },
                { id: "leave", text: "不作停留", log: "你不作停留，像从未听见过。", delta: { expDelta: 0 } }
            ]
        }
    ],
    
    // 4. 世界趋势日志 (V1.2 新增 - 解释层)
    worldTendencyLogs: {
        omen: [
            { min: 1, max: 2, logs: ["空气中有淡淡的铁锈味。", "云层压得很低，像是在酝酿什么。", "天空裂开了一道细缝，像一只闭不上的眼。"] },
            { min: 3, max: 4, logs: ["路边的石像似乎在当你转身时改变了表情。", "风里隐约传来不属于这个季节的蝉鸣。"] },
            { min: 5, max: 5, logs: ["天空裂开了一道细缝，像一只闭不上的眼。", "你感觉每一步都踩在某种活物上，尽管脚下只是泥土。"] }
        ],
        chaos: [
            { min: 1, max: 2, logs: ["灵气有些躁动，经脉中偶尔传来细微的刺痛。"] },
            { min: 3, max: 5, logs: ["因果律在此地变得稀薄，你看见昨天的雨落在今天。", "法则的边界在模糊，所有的声音都像是重音。"] }
        ],
        order: [
            { min: 1, max: 2, logs: ["四周静得有些不自然，连风都像是被安排好的。"] },
            { min: 3, max: 5, logs: ["世界的轮廓过于清晰，像是一幅画好的牢笼。", "万物循规蹈矩，连落叶都沿着既定的轨迹飘落。"] }
        ]
    }
};