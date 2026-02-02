(function() {
    if (typeof GameData === 'undefined' || !GameData) return;
    if (!GameData.skillConfig || typeof GameData.skillConfig !== 'object') GameData.skillConfig = {};
    GameData.skillConfig['乾坤道'] = [
        {
            id: 'q_1',
            name: '急破',
            realm: '寻道',
            type: 'active',
            mpCost: 30,
            baseDmg: 30,
            heal: 0,
            text: '百神归命，万将随行！',
            chant: '“百神归命，万将随行！”',
            cost: { mp: 30 },
            omenDelta: 0,
            chaosDelta: 0,
            tags: ['physical', 'aoe'],
            sourceDao: '乾坤道',
            category: 'core'
        },
        {
            id: 'q_2',
            name: '羽破',
            realm: '寻道',
            type: 'active',
            mpCost: 35,
            baseDmg: 20,
            heal: 0,
            text: '双击如羽，破阵不回。',
            chant: '“双击如羽，破阵不回。”',
            cost: { mp: 35 },
            omenDelta: 0,
            chaosDelta: 0,
            tags: ['physical', 'double_hit'],
            sourceDao: '乾坤道',
            category: 'core'
        },
        {
            id: 'q_3',
            name: '惊魂',
            realm: '寻道',
            type: 'active',
            mpCost: 15,
            baseDmg: 30,
            heal: 0,
            text: '军势压境，魂胆自乱。',
            chant: '“军势压境，魂胆自乱。”',
            cost: { mp: 15 },
            omenDelta: 0,
            chaosDelta: 0,
            tags: ['physical', 'control'],
            sourceDao: '乾坤道',
            category: 'core'
        },
        {
            id: 'q_4',
            name: '踏破',
            realm: '入道',
            type: 'active',
            mpCost: 80,
            baseDmg: 60,
            heal: 0,
            text: '踏破虚妄，军阵归一。',
            chant: '“踏破虚妄，军阵归一。”',
            cost: { mp: 80 },
            omenDelta: 0,
            chaosDelta: 0,
            tags: ['physical', 'finisher', 'spirit_bonus'],
            sourceDao: '乾坤道',
            category: 'core'
        }
    ];
})();
