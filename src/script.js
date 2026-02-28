if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}

const Game = (function() {
    let state = {
        yosano: 0,
        totalYosano: 0,
        startTime: Date.now(),
        lastSave: Date.now(),
        prestigePoints: 0,
        buildings: [],
        skills: {},
        stocks: {},     // { id: count }
        stockPrices: {}, // { id: currentPrice }
        stockAvgPrices: {}, // { id: avgBuyPrice }
        priceHistory: {}, // { id: [price1, price2, ...] }
        marketTrend: 0, // 0: stable, 1: bull, -1: bear
        marketTrendDuration: 0
    };

    let selectedSkillId = null;
    let lastMarketUpdate = 0;
    const MARKET_UPDATE_INTERVAL = 1000; // 1 second for real-time feel

    const buildingConfig = [
        { id: 0, name: "短歌", baseCost: 15, baseProd: 0.5 },
        { id: 1, name: "文芸誌", baseCost: 100, baseProd: 4 },
        { id: 2, name: "パリ留学", baseCost: 1100, baseProd: 32 },
        { id: 3, name: "鉄幹", baseCost: 12000, baseProd: 120 },
        { id: 4, name: "婦人運動", baseCost: 130000, baseProd: 500 },
        { id: 5, name: "国会議事堂", baseCost: 1400000, baseProd: 2500 },
        { id: 6, name: "君死にたまふことなかれ砲", baseCost: 20000000, baseProd: 15000 },
        { id: 7, name: "サイバー晶子", baseCost: 330000000, baseProd: 100000 },
        { id: 8, name: "銀河鉄道", baseCost: 5100000000, baseProd: 850000 },
        { id: 9, name: "並行宇宙サロン", baseCost: 100000000000, baseProd: 5000000 },
        { id: 10, name: "ビッグバン万年筆", baseCost: 20000000000000, baseProd: 40000000 },
        { id: 11, name: "アキコバース", baseCost: 500000000000000, baseProd: 300000000 }
    ];

    const stockConfig = [
        { id: 'stk_yosano', name: '株式会社与謝野晶子', symbol: 'YSN', basePrice: 1000, volatility: 0.05 }
    ];

    const skillConfig = [
        // Root
        { id: 'passion_1', name: '情熱の芽生え', cost: 1, desc: '生産量 +10%', type: 'passive', val: 0.1, parents: [], pos: {x: 500, y: 50} },
        
        // Passion Branch
        { id: 'passion_2', name: '情熱の歌', cost: 10, desc: '生産量 +20%', type: 'passive', val: 0.2, parents: ['passion_1'], pos: {x: 500, y: 150} },
        { id: 'passion_3', name: '燃え上がる恋', cost: 100, desc: '生産量 +30%', type: 'passive', val: 0.3, parents: ['passion_2'], pos: {x: 500, y: 250} },
        { id: 'passion_4', name: '無限の情熱', cost: 1000, desc: '生産量 +50%', type: 'passive', val: 0.5, parents: ['passion_3'], pos: {x: 500, y: 350} },
        { id: 'passion_5', name: '宇宙への愛', cost: 10000, desc: '生産量 +100%', type: 'passive', val: 1.0, parents: ['passion_4'], pos: {x: 500, y: 450} },
        { id: 'passion_6', name: 'アカシックレコード', cost: 100000, desc: '生産量 +200%', type: 'passive', val: 2.0, parents: ['passion_5'], pos: {x: 500, y: 600} },

        // Click Branch
        { id: 'click_1', name: '乱れ髪の指先', cost: 5, desc: 'クリック力 +50%', type: 'click', val: 0.5, parents: ['passion_1'], pos: {x: 300, y: 150} },
        { id: 'click_2', name: '速筆', cost: 50, desc: 'クリック力 +50%', type: 'click', val: 0.5, parents: ['click_1'], pos: {x: 300, y: 250} },
        { id: 'click_3', name: '超・乱れ髪', cost: 5000, desc: 'クリック力 +100%', type: 'click', val: 1.0, parents: ['click_2'], pos: {x: 300, y: 350} },
        
        // Crit Sub-branch
        { id: 'crit_1', name: '会心の一撃', cost: 500, desc: 'クリック時 5%で10倍', type: 'crit', val: 0.05, parents: ['click_2'], pos: {x: 150, y: 350} },
        { id: 'crit_2', name: '神速の筆', cost: 5000, desc: '会心率 +5%', type: 'crit', val: 0.05, parents: ['crit_1'], pos: {x: 150, y: 450} },

        // Auto Branch
        { id: 'auto_1', name: '自動執筆', cost: 50, desc: '自動クリック +1/s', type: 'auto', val: 1, parents: ['click_1'], pos: {x: 100, y: 150} },
        { id: 'auto_2', name: 'ゴーストライター', cost: 500, desc: '自動クリック +5/s', type: 'auto', val: 5, parents: ['auto_1'], pos: {x: 100, y: 250} },
        { id: 'auto_3', name: 'AI執筆', cost: 5000, desc: '自動クリック +10/s', type: 'auto', val: 10, parents: ['auto_2'], pos: {x: 100, y: 500} },

        // Facility Branch
        { id: 'discount_1', name: 'あきんど晶子', cost: 20, desc: '施設コスト -5%', type: 'discount', val: 0.05, parents: ['passion_1'], pos: {x: 700, y: 150} },
        { id: 'discount_2', name: '出版交渉', cost: 200, desc: '施設コスト -5%', type: 'discount', val: 0.05, parents: ['discount_1'], pos: {x: 700, y: 250} },
        { id: 'discount_3', name: '国家予算掌握', cost: 5000, desc: '施設コスト -10%', type: 'discount', val: 0.10, parents: ['discount_2'], pos: {x: 700, y: 350} },

        // Specific Facility Buffs
        { id: 'buff_tanka', name: '短歌改良', cost: 50, desc: '短歌 生産2倍', type: 'buff_bldg', val: 2, target: 0, parents: ['discount_1'], pos: {x: 850, y: 150} },
        { id: 'buff_mag', name: '文芸誌増刷', cost: 150, desc: '文芸誌 生産2倍', type: 'buff_bldg', val: 2, target: 1, parents: ['discount_2'], pos: {x: 850, y: 250} },
        { id: 'buff_galaxy', name: '銀河鉄道拡張', cost: 5000, desc: '銀河鉄道 生産2倍', type: 'buff_bldg', val: 2, target: 8, parents: ['discount_3'], pos: {x: 850, y: 350} },

        // Special (Golden Akiko)
        { id: 'golden_1', name: '黄金の晶子', cost: 2000, desc: '落下する晶子をクリック可能に', type: 'golden_unlock', val: 1, parents: ['passion_4'], pos: {x: 500, y: 750} },
        { id: 'golden_2', name: '輝く髪', cost: 10000, desc: '落下頻度アップ', type: 'golden_freq', val: 0.5, parents: ['golden_1'], pos: {x: 400, y: 850} },
        { id: 'golden_3', name: '永遠の輝き', cost: 50000, desc: '落下晶子の報酬アップ', type: 'golden_val', val: 2, parents: ['golden_1'], pos: {x: 600, y: 850} }
    ];

    let cps = 0;
    let lastAutoClick = 0;
    const clickSound = new Audio(); 

    function init() {
        if(localStorage.getItem('yosanoSave')) {
            loadGame();
        } else {
            resetState();
        }
        createShop();
        requestAnimationFrame(loop);
        setInterval(saveGame, 10000); 
        setInterval(spawnBackgroundAkiko, 2000);
        
        document.getElementById('akiko-btn').addEventListener('pointerdown', handleClick);
        document.getElementById('file-input').addEventListener('change', handleFileLoad);

        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') {
                saveGame();
            }
        });
        updateVisuals();
    }

    function resetState() {
        state = {
            yosano: 0,
            totalYosano: 0,
            startTime: Date.now(),
            lastSave: Date.now(),
            prestigePoints: 0,
            buildings: buildingConfig.map(b => ({ id: b.id, count: 0 })),
            skills: {},
            stocks: {},
            stockPrices: {},
            stockAvgPrices: {},
            marketTrend: 0,
            marketTrendDuration: 0
        };
        stockConfig.forEach(s => {
            state.stocks[s.id] = 0;
            state.stockPrices[s.id] = s.basePrice;
            state.stockAvgPrices[s.id] = 0;
        });
        updateCPS();
        updateVisuals();
    }

    function getMultiplier() {
        let mult = 1;
        skillConfig.forEach(s => {
            if (s.type === 'passive' && state.skills[s.id]) {
                mult += s.val;
            }
        });
        return mult;
    }

    function updateCPS() {
        let prod = 0;
        state.buildings.forEach(b => {
            const config = buildingConfig.find(c => c.id === b.id);
            let bProd = config.baseProd;
            
            // Apply building specific buffs
            skillConfig.forEach(s => {
                if (s.type === 'buff_bldg' && s.target === b.id && state.skills[s.id]) {
                    bProd *= s.val;
                }
            });

            prod += b.count * bProd;
        });
        cps = prod * getMultiplier();
        document.getElementById('yosano-cps').innerText = `毎秒: ${formatNumber(cps)} 与謝野`;
    }

    function getClickMultiplier() {
        let mult = 1;
        skillConfig.forEach(s => {
            if (s.type === 'click' && state.skills[s.id]) {
                mult += s.val;
            }
        });
        return mult;
    }

    function handleClick(e) {
        let amount = (1 + (cps * 0.05)) * getMultiplier() * getClickMultiplier(); 
        
        // Crit Logic
        let critChance = 0;
        skillConfig.forEach(s => {
            if (s.type === 'crit' && state.skills[s.id]) {
                critChance += s.val;
            }
        });
        
        let isCrit = false;
        if (Math.random() < critChance) {
            amount *= 10;
            isCrit = true;
        }

        addYosano(amount);
        
        const el = document.getElementById('akiko-btn');
        el.style.transform = `scale(0.9) rotate(${Math.random() * 20 - 10}deg)`;
        setTimeout(() => el.style.transform = 'scale(1) rotate(0deg)', 100);

        showFloatingText(e.clientX, e.clientY, `+${formatNumber(amount)}`, isCrit);
    }

    function addYosano(amount) {
        state.yosano += amount;
        state.totalYosano += amount;
        updateDisplay();
        updateShopButtons();
    }

    function showFloatingText(x, y, text, isCrit = false) {
        const el = document.createElement('div');
        el.className = 'click-effect';
        el.innerText = text;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        if (isCrit) {
            el.style.fontSize = '3rem';
            el.style.color = '#fff';
            el.style.textShadow = '0 0 10px red';
        }
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }

    function spawnBackgroundAkiko() {
        const el = document.createElement('div');
        el.className = 'falling-akiko';
        el.style.left = `${Math.random() * 100}vw`;
        el.style.top = `-50px`;
        el.style.transition = `top ${Math.random() * 3 + 2}s linear, transform 3s linear`;
        
        // Golden Akiko Logic
        if (state.skills['golden_1']) {
            el.style.pointerEvents = 'auto';
            el.style.cursor = 'pointer';
            el.onclick = (e) => {
                e.stopPropagation();
                let reward = cps * 10; // Base reward: 10 seconds of production
                if (reward < 100) reward = 100;
                
                // Bonus multiplier
                if (state.skills['golden_3']) reward *= 3;
                
                addYosano(reward);
                showFloatingText(e.clientX, e.clientY, `+${formatNumber(reward)} (Golden!)`, true);
                el.remove();
            };
        }

        document.body.appendChild(el);
        
        requestAnimationFrame(() => {
            el.style.top = '110vh';
            el.style.transform = `rotate(${Math.random() * 720}deg)`;
        });

        setTimeout(() => el.remove(), 5000);
    }

    function createShop() {
        const container = document.getElementById('shop');
        container.innerHTML = '';
        buildingConfig.forEach(b => {
            const div = document.createElement('div');
            div.className = 'building';
            div.id = `building-${b.id}`;
            div.onclick = () => buyBuilding(b.id);
            div.innerHTML = `
                <div class="b-info">
                    <span class="b-name">${b.name}</span>
                    <span class="b-cost" id="cost-${b.id}">0 与謝野</span>
                    <span style="font-size:0.8rem; color:var(--neon-green);">+${formatNumber(b.baseProd * getMultiplier())}/s</span>
                </div>
                <div class="b-count" id="count-${b.id}">0</div>
            `;
            container.appendChild(div);
        });
    }

    function getCost(id) {
        const config = buildingConfig.find(c => c.id === id);
        const count = state.buildings.find(b => b.id === id).count;
        
        let discount = 1;
        skillConfig.forEach(s => {
            if (s.type === 'discount' && state.skills[s.id]) {
                discount -= s.val;
            }
        });
        if (discount < 0.1) discount = 0.1;

        return Math.floor(config.baseCost * Math.pow(1.15, count) * discount);
    }

    function buyBuilding(id) {
        const cost = getCost(id);
        if(state.yosano >= cost) {
            state.yosano -= cost;
            state.buildings.find(b => b.id === id).count++;
            updateCPS();
            updateDisplay();
            updateShopButtons();
            updateVisuals();
            
            const shopDiv = document.getElementById(`building-${id}`);
            shopDiv.style.backgroundColor = 'var(--neon-pink)';
            setTimeout(() => shopDiv.style.backgroundColor = '', 200);
        }
    }

    function updateShopButtons() {
        state.buildings.forEach(b => {
            const cost = getCost(b.id);
            const el = document.getElementById(`building-${b.id}`);
            const costEl = document.getElementById(`cost-${b.id}`);
            const countEl = document.getElementById(`count-${b.id}`);
            
            costEl.innerText = formatNumber(cost) + " 与謝野";
            countEl.innerText = b.count;
            
            if(state.yosano >= cost) {
                el.classList.remove('disabled');
            } else {
                el.classList.add('disabled');
            }
        });
    }

    function updateDisplay() {
        document.getElementById('yosano-count').innerText = `${formatNumber(Math.floor(state.yosano))} 与謝野`;
    }

    function loop() {
        const now = Date.now();
        const dt = (now - state.lastSave) / 1000;
        
        if (dt > 0.1) {
            if (cps > 0) {
                const gained = cps * dt;
                addYosano(gained);
                if (dt > 10) {
                    showFloatingText(window.innerWidth / 2, window.innerHeight / 3, `おかえりなさい！ +${formatNumber(gained)}`, true);
                }
            }
            state.lastSave = now;
        }

        const autoLevel = state.skills['auto_click'] || 0;
        if (autoLevel > 0) {
            if (now - lastAutoClick >= 1000) {
                const amount = (1 + (cps * 0.05)) * getMultiplier() * getClickMultiplier();
                addYosano(amount);
                lastAutoClick = now;
            }
        }

        if (now - lastMarketUpdate >= MARKET_UPDATE_INTERVAL) {
            updateMarket();
            lastMarketUpdate = now;
        }

        // Auto Click Logic
        let autoRate = 0;
        skillConfig.forEach(s => {
            if (s.type === 'auto' && state.skills[s.id]) {
                autoRate += s.val;
            }
        });

        if (autoRate > 0) {
            const interval = 1000 / autoRate;
            if (now - lastAutoClick >= interval) {
                const amount = (1 + (cps * 0.05)) * getMultiplier() * getClickMultiplier();
                addYosano(amount);
                lastAutoClick = now;
            }
        }
        
        requestAnimationFrame(loop);
    }

    function updateMarket() {
        if (!state.stockPrices) state.stockPrices = {};
        
        // Update Trend
        if (state.marketTrendDuration <= 0) {
            const rand = Math.random();
            if (rand < 0.35) state.marketTrend = 1;      // Bull (35%)
            else if (rand < 0.70) state.marketTrend = -1; // Bear (35%)
            else state.marketTrend = 0;                  // Stable (30%)
            
            state.marketTrendDuration = Math.floor(Math.random() * 20) + 10; // 10-30 ticks
        }
        state.marketTrendDuration--;

        stockConfig.forEach(stock => {
            let current = state.stockPrices[stock.id];
            if (!current) current = stock.basePrice;
            
            // Base volatility
            let change = (Math.random() - 0.5) * 2 * stock.volatility; // -5% to +5%

            // Apply Trend Bias
            if (state.marketTrend === 1) {
                change += 0.03 + (Math.random() * 0.02); // +3% to +5% bias
            } else if (state.marketTrend === -1) {
                change -= 0.03 + (Math.random() * 0.02); // -3% to -5% bias
            }

            // Weak Mean Reversion (0.5%) to allow large drifts
            let pull = (stock.basePrice - current) / stock.basePrice * 0.005; 
            
            let percentChange = change + pull;
            let newPrice = current * (1 + percentChange);
            
            // Clamp minimum price
            if (newPrice < 1) newPrice = 1;
            
            state.stockPrices[stock.id] = newPrice;
        });
        
        // Update History
        if (!state.priceHistory) state.priceHistory = {};
        stockConfig.forEach(stock => {
            if (!state.priceHistory[stock.id]) state.priceHistory[stock.id] = [];
            state.priceHistory[stock.id].push(state.stockPrices[stock.id]);
            // Keep last 50 points
            if (state.priceHistory[stock.id].length > 50) {
                state.priceHistory[stock.id].shift();
            }
        });

        // If the market modal is open (or visible on PC), we should refresh it. 
        const marketModal = document.getElementById('market-modal');
        if (marketModal) {
            const style = window.getComputedStyle(marketModal);
            if (style.display !== 'none') {
                if (typeof Game.renderMarket === 'function') {
                    Game.renderMarket();
                }
            }
        }
    }

    function saveGame() {
        // state.lastSave = Date.now(); // Do NOT update lastSave here, to allow offline progress
        localStorage.setItem('yosanoSave', JSON.stringify(state));
    }

    function loadGame() {
        try {
            const saved = JSON.parse(localStorage.getItem('yosanoSave'));
            if(saved) {
                state = { ...state, ...saved };
                if (!state.skills) state.skills = {};

                // Ensure new buildings are added to saved state
                buildingConfig.forEach(c => {
                    if (!state.buildings.find(b => b.id === c.id)) {
                        state.buildings.push({ id: c.id, count: 0 });
                    }
                });

                if (!state.stocks) state.stocks = {};
                if (!state.stockPrices) state.stockPrices = {};
                if (!state.stockAvgPrices) state.stockAvgPrices = {};
                
                // Init missing stocks
                stockConfig.forEach(s => {
                    if (state.stocks[s.id] === undefined) state.stocks[s.id] = 0;
                    if (state.stockPrices[s.id] === undefined) state.stockPrices[s.id] = s.basePrice;
                    if (state.stockAvgPrices[s.id] === undefined) state.stockAvgPrices[s.id] = 0;
                });

                if (state.marketTrend === undefined) state.marketTrend = 0;
                if (state.marketTrendDuration === undefined) state.marketTrendDuration = 0;

                // Migrate old skills (Refund)
                const oldKeys = ['passion_bonus', 'click_bonus', 'discount', 'auto_click'];
                const oldCosts = { 'passion_bonus': 1, 'click_bonus': 5, 'discount': 20, 'auto_click': 50 };
                let refunded = 0;
                oldKeys.forEach(key => {
                    if (state.skills[key]) {
                        const level = state.skills[key];
                        // Cost formula was base * (1 + 2 + ... + level)
                        const totalCost = oldCosts[key] * (level * (level + 1) / 2);
                        refunded += totalCost;
                        delete state.skills[key];
                    }
                });
                if (refunded > 0) {
                    state.prestigePoints += refunded;
                    alert(`スキルシステムの更新に伴い、旧スキルをリセットしました。\n${formatNumber(refunded)} pt が返却されました。`);
                }
                
                const now = Date.now();
                const diff = (now - state.lastSave) / 1000;
                if(diff > 0) {
                    updateCPS();
                    const gained = cps * diff;
                    state.yosano += gained;
                    state.totalYosano += gained;
                    alert(`おかえりなさい！\n不在の間に ${formatNumber(Math.floor(gained))} 与謝野 が生産されました。`);
                }
                state.lastSave = now;
                updateCPS();
                updateDisplay();
                updateVisuals();
            }
        } catch(e) {
            console.error(e);
            resetState();
        }
    }

    function saveToJSON() {
        saveGame();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "yosano_save_" + Date.now() + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function loadFromJSON() {
        document.getElementById('file-input').click();
    }

    function handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (data.yosano !== undefined) {
                    state = data;
                    if (!state.skills) state.skills = {};
                    state.lastSave = Date.now(); 
                    saveGame();
                    location.reload();
                }
            } catch(err) {
                alert("不正なファイルです");
            }
        };
        reader.readAsText(file);
    }

    function hardReset() {
        if(confirm("本当にデータを全て消しますか？")) {
            localStorage.removeItem('yosanoSave');
            location.reload();
        }
    }

    function openPrestige() {
        const gain = Math.floor(state.totalYosano / 10000000);
        document.getElementById('prestige-gain-display').innerText = `獲得予定: ${formatNumber(gain)} pt`;
        document.getElementById('prestige-current-display').innerText = `現在の情熱: ${formatNumber(state.prestigePoints)} pt`;
        document.getElementById('prestige-modal').style.display = 'flex';
    }

    function doPrestige() {
        const gain = Math.floor(state.totalYosano / 10000000);
        if (gain > 0) {
            state.prestigePoints += gain;
            state.yosano = 0;
            state.totalYosano = 0;
            state.buildings.forEach(b => b.count = 0);
            state.startTime = Date.now();
            
            saveGame();
            
            document.getElementById('prestige-modal').style.display = 'none';
            renderSkillShop();
            document.getElementById('skill-shop-modal').style.display = 'flex';
        } else {
            alert("まだ転生するには情熱が足りません（累計1000万与謝野以上必要です）");
        }
    }

    function renderSkillShop() {
        // Renamed concept to Skill Tree, but function name kept for compatibility with existing calls or renamed?
        // Let's implement renderSkillTree and call it here.
        renderSkillTree();
    }

    function renderSkillTree() {
        const container = document.getElementById('skill-list');
        container.innerHTML = '';
        // container styles are now in HTML
        
        document.getElementById('skill-shop-points').innerText = `情熱ポイント: ${formatNumber(state.prestigePoints)} pt`;

        const treeContainer = document.createElement('div');
        treeContainer.id = 'skill-tree-container';
        container.appendChild(treeContainer);
        
        // Draw Lines (SVG)
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute('class', 'skill-lines');
        treeContainer.appendChild(svg);
        
        skillConfig.forEach(skill => {
            const isPurchased = state.skills[skill.id];
            
            // Draw lines to parents
            skill.parents.forEach(parentId => {
                const parent = skillConfig.find(s => s.id === parentId);
                if (parent) {
                    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line.setAttribute('x1', parent.pos.x + 30); // Center of node (60px / 2)
                    line.setAttribute('y1', parent.pos.y + 30);
                    line.setAttribute('x2', skill.pos.x + 30);
                    line.setAttribute('y2', skill.pos.y + 30);
                    line.setAttribute('stroke', isPurchased ? 'var(--neon-green)' : (state.skills[parentId] ? 'var(--neon-yellow)' : '#555'));
                    line.setAttribute('stroke-width', '2');
                    svg.appendChild(line);
                }
            });
            
            // Create Node
            const div = document.createElement('div');
            div.className = 'skill-node';
            div.style.left = `${skill.pos.x}px`;
            div.style.top = `${skill.pos.y}px`;
            
            // Determine state
            let isLocked = false;
            if (skill.parents.length > 0) {
                if (skill.parents.some(pid => !state.skills[pid])) {
                    isLocked = true;
                }
            }
            
            if (isPurchased) {
                div.classList.add('purchased');
                div.innerHTML = '✔';
            } else if (!isLocked) {
                div.classList.add('available');
                div.innerHTML = '?';
            } else {
                div.classList.add('locked');
                div.innerHTML = '🔒';
            }
            
            if (selectedSkillId === skill.id) {
                div.style.boxShadow = '0 0 15px var(--neon-pink)';
                div.style.borderColor = 'var(--neon-pink)';
                div.style.transform = 'scale(1.3)';
                div.style.zIndex = '100';
            }
            
            div.onclick = () => selectSkill(skill.id);
            treeContainer.appendChild(div);
        });
    }

    function selectSkill(id) {
        selectedSkillId = id;
        renderSkillTree(); // re-render to update highlight
        updateSkillPanel();
    }

    function updateSkillPanel() {
        const nameEl = document.getElementById('skill-detail-name');
        const descEl = document.getElementById('skill-detail-desc');
        const costEl = document.getElementById('skill-detail-cost');
        const btnEl = document.getElementById('skill-detail-btn');
        
        if (!selectedSkillId) {
            nameEl.innerText = "スキルを選択してください";
            descEl.innerText = "アイコンをタップして詳細を表示";
            costEl.innerText = "";
            btnEl.style.display = 'none';
            return;
        }
        
        const skill = skillConfig.find(s => s.id === selectedSkillId);
        const isPurchased = state.skills[skill.id];
        
        nameEl.innerText = skill.name;
        descEl.innerText = skill.desc;
        
        if (isPurchased) {
            costEl.innerText = "取得済み";
            btnEl.style.display = 'none';
        } else {
            // Check locked status
            let isLocked = false;
            if (skill.parents.length > 0) {
                if (skill.parents.some(pid => !state.skills[pid])) {
                    isLocked = true;
                }
            }
            
            if (isLocked) {
                costEl.innerText = `必要: ${formatNumber(skill.cost)} pt (ロック中)`;
                btnEl.style.display = 'none';
            } else {
                costEl.innerText = `必要: ${formatNumber(skill.cost)} pt`;
                btnEl.style.display = 'block';
                btnEl.innerText = "取得する";
                
                if (state.prestigePoints >= skill.cost) {
                    btnEl.classList.remove('disabled');
                    btnEl.onclick = buySelectedSkill;
                } else {
                    btnEl.classList.add('disabled');
                    btnEl.onclick = null;
                }
            }
        }
    }

    function buySelectedSkill() {
        if (!selectedSkillId) return;
        const skill = skillConfig.find(s => s.id === selectedSkillId);
        
        if (state.prestigePoints >= skill.cost) {
            state.prestigePoints -= skill.cost;
            state.skills[selectedSkillId] = 1;
            renderSkillTree();
            updateSkillPanel();
            updateVisuals();
            saveGame();
        }
    }

    function closeSkillShop() {
        document.getElementById('skill-shop-modal').style.display = 'none';
        location.reload(); 
    }

    function openMarket() {
        document.getElementById('market-modal').style.display = 'flex';
        renderMarket();
    }
    
    function closeMarket() {
        document.getElementById('market-modal').style.display = 'none';
    }

    function renderMarket() {
        const container = document.getElementById('stock-list');
        if (!container) return;
        
        // Setup layout if needed (check if canvas exists)
        if (!document.getElementById('market-chart')) {
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'center';
            container.innerHTML = `
                <canvas id="market-chart" width="600" height="300" style="background:#222; border:2px solid var(--neon-blue); margin-bottom:20px; max-width:100%;"></canvas>
                <div id="single-stock-control" style="width:100%; max-width:600px;"></div>
            `;
        }

        const stock = stockConfig[0]; // Only one stock now
        const currentPrice = state.stockPrices[stock.id];
        const owned = state.stocks[stock.id];
        const history = state.priceHistory ? state.priceHistory[stock.id] : [];

        // Draw Graph
        const canvas = document.getElementById('market-chart');
        if (canvas && history && history.length > 1) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Find min/max for scaling
            let minP = Math.min(...history);
            let maxP = Math.max(...history);
            
            // Ensure some range exists
            if (maxP === minP) {
                maxP *= 1.1;
                minP *= 0.9;
            } else {
                const diff = maxP - minP;
                maxP += diff * 0.1;
                minP -= diff * 0.1;
            }
            if (minP < 0) minP = 0;

            const range = maxP - minP;
            
            // Draw Grid
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            // Horizontal lines
            for (let i = 1; i < 5; i++) {
                const y = (canvas.height / 5) * i;
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
            }
            // Vertical lines
            const stepX = canvas.width / (history.length - 1);
            for (let i = 0; i < history.length; i += 10) {
                const x = i * stepX;
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
            }
            ctx.stroke();

            // Draw Area Fill
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, 'rgba(0, 255, 0, 0.2)');
            gradient.addColorStop(1, 'rgba(0, 255, 0, 0)');

            ctx.beginPath();
            history.forEach((price, i) => {
                const x = i * stepX;
                const y = canvas.height - ((price - minP) / range * canvas.height);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();

            // Draw Line
            ctx.beginPath();
            ctx.strokeStyle = 'var(--neon-green)';
            ctx.lineWidth = 2;
            history.forEach((price, i) => {
                const x = i * stepX;
                const y = canvas.height - ((price - minP) / range * canvas.height);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Draw current price line
            const currentPriceVal = history[history.length-1];
            const lastY = canvas.height - ((currentPriceVal - minP) / range * canvas.height);
            ctx.beginPath();
            ctx.strokeStyle = 'var(--neon-pink)';
            ctx.setLineDash([5, 5]);
            ctx.moveTo(0, lastY);
            ctx.lineTo(canvas.width, lastY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Labels
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.fillText(formatNumber(maxP), 5, 15);
            ctx.fillText(formatNumber(minP), 5, canvas.height - 5);
            
            // Current Price Label on the right
            ctx.fillStyle = 'var(--neon-pink)';
            ctx.textAlign = 'right';
            ctx.fillText(formatNumber(currentPriceVal), canvas.width - 10, lastY - 5);
            ctx.textAlign = 'left'; // Reset
        }

        // Render Controls
        const ctrlDiv = document.getElementById('single-stock-control');
        const trendClass = currentPrice >= stock.basePrice ? 'trend-up' : 'trend-down';
        
        let profitDisplay = `<div style="font-size:0.9rem; margin-bottom:10px; color:#666;">取得単価: ---</div>`;
        const avgPrice = state.stockAvgPrices[stock.id] || 0;
        
        if (owned > 0 && avgPrice > 0) {
            const diff = currentPrice - avgPrice;
            const totalDiff = diff * owned;
            const percent = (diff / avgPrice) * 100;
            const sign = diff >= 0 ? "+" : "";
            const color = diff >= 0 ? "#00ff00" : "#ff0000";
            
            profitDisplay = `
                <div style="font-size:0.9rem; margin-bottom:5px; color:#ccc;">
                    取得単価: ${formatNumber(avgPrice)}
                </div>
                <div style="font-size:1.0rem; margin-bottom:10px; color:${color}; font-weight:bold;">
                    損益: ${sign}${formatNumber(totalDiff)} (${sign}${percent.toFixed(1)}%)
                </div>
            `;
        }

        ctrlDiv.innerHTML = `
            <div class="stock-item" style="margin:0;">
                <div class="stock-header" style="font-size:1.5rem; margin-bottom:10px;">
                    <span>${stock.name}</span>
                    <span class="${trendClass}">${formatNumber(currentPrice)} 与謝野</span>
                </div>
                <div class="stock-owned" style="font-size:1.2rem; margin-bottom:5px;">所持数: ${formatNumber(owned)}株</div>
                ${profitDisplay}
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <div style="flex:1;">
                        <div style="color:var(--neon-green); margin-bottom:5px;">購入</div>
                        <div class="stock-controls">
                            <button onclick="Game.buyStock('${stock.id}', 1)">1</button>
                            <button onclick="Game.buyStock('${stock.id}', 10)">10</button>
                            <button onclick="Game.buyStock('${stock.id}', 100)">100</button>
                            <button onclick="Game.buyStock('${stock.id}', -1)">最大</button>
                        </div>
                    </div>
                    <div style="flex:1;">
                        <div style="color:red; margin-bottom:5px;">売却</div>
                        <div class="stock-controls">
                            <button class="danger" onclick="Game.sellStock('${stock.id}', 1)">1</button>
                            <button class="danger" onclick="Game.sellStock('${stock.id}', 10)">10</button>
                            <button class="danger" onclick="Game.sellStock('${stock.id}', 100)">100</button>
                            <button class="danger" onclick="Game.sellStock('${stock.id}', -1)">最大</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('market-info').innerText = `リアルタイム更新中`;
    }

    function buyStock(id, amount) {
        const price = state.stockPrices[id];
        if (amount === -1) {
            amount = Math.floor(state.yosano / price);
        }
        const cost = price * amount;
        
        if (amount > 0 && state.yosano >= cost) {
            state.yosano -= cost;
            
            // Calculate weighted average price
            const currentOwned = state.stocks[id] || 0;
            const currentAvg = state.stockAvgPrices[id] || 0;
            const currentTotalCost = currentOwned * currentAvg;
            const newTotalCost = currentTotalCost + cost;
            const newCount = currentOwned + amount;
            
            if (newCount > 0) {
                state.stockAvgPrices[id] = newTotalCost / newCount;
            }

            state.stocks[id] += amount;
            renderMarket();
            updateDisplay();
        }
    }

    function sellStock(id, amount) {
        const price = state.stockPrices[id];
        if (amount === -1) {
            amount = state.stocks[id];
        }
        
        if (amount > 0 && state.stocks[id] >= amount) {
            const gain = price * amount;
            state.yosano += gain;
            // Do NOT add to totalYosano to prevent exploit
            state.stocks[id] -= amount;
            
            // If sold out, reset avg price
            if (state.stocks[id] === 0) {
                state.stockAvgPrices[id] = 0;
            }

            renderMarket();
            updateDisplay();
        }
    }

    function updateVisuals() {
        const visualsContainer = document.getElementById('facility-visuals');
        const akikoBtn = document.getElementById('akiko-btn');
        if (!visualsContainer || !akikoBtn) return;

        // --- 1. 施設の絵文字表示 ---
        visualsContainer.innerHTML = '';
        const emojis = {
            0: "📜", // 短歌
            1: "📖", // 文芸誌
            2: "🗼", // パリ留学
            3: "👨", // 鉄幹
            4: "🚩", // 婦人運動
            5: "🏛️", // 国会議事堂
            6: "💣", // 君死にたまふことなかれ砲
            7: "🤖", // サイバー晶子
            8: "🚂", // 銀河鉄道
            9: "🌀", // 並行宇宙サロン
            10: "🖋️", // ビッグバン万年筆
            11: "🌌"  // アキコバース
        };

        state.buildings.forEach(b => {
            if (b.count > 0 && emojis[b.id]) {
                const displayCount = Math.min(b.count, 5); // 種類ごとに最大5個まで表示
                for (let i = 0; i < displayCount; i++) {
                    const el = document.createElement('div');
                    el.className = 'facility-emoji';
                    el.innerText = emojis[b.id];
                    // コンテナ内にランダムに配置 (画面端を少し避ける)
                    el.style.left = `${Math.random() * 80 + 10}%`;
                    el.style.top = `${Math.random() * 80 + 10}%`;
                    // アニメーションのタイミングをずらす
                    el.style.animationDelay = `${Math.random() * 5}s`;
                    // サイズに少しばらつきを持たせる
                    const scale = 0.8 + Math.random() * 0.4;
                    el.style.transform = `scale(${scale})`;
                    visualsContainer.appendChild(el);
                }
            }
        });

        // --- 2. 晶子ボタンのエフェクト (スキル・施設による変化) ---
        // 一度すべてのオーラクラスを外す
        akikoBtn.classList.remove('akiko-aura-passion', 'akiko-aura-cyber', 'akiko-aura-universe');

        // 優先順位: universe (id 11所持) > cyber (id 7所持) > passion (スキル passion_6)
        const hasUniverse = state.buildings.find(b => b.id === 11)?.count > 0;
        const hasCyber = state.buildings.find(b => b.id === 7)?.count > 0;
        const hasPassionMax = state.skills['passion_6'];

        if (hasUniverse) {
            akikoBtn.classList.add('akiko-aura-universe');
        } else if (hasCyber) {
            akikoBtn.classList.add('akiko-aura-cyber');
        } else if (hasPassionMax) {
            akikoBtn.classList.add('akiko-aura-passion');
        }
    }

    function formatNumber(num) {
        let sign = "";
        if (num < 0) {
            sign = "-";
            num = Math.abs(num);
        }
        if (num >= 1e12) return sign + (num / 1e12).toFixed(2) + "兆";
        if (num >= 1e8) return sign + (num / 1e8).toFixed(2) + "億";
        if (num >= 1e4) return sign + (num / 1e4).toFixed(2) + "万";
        return sign + Math.floor(num).toString();
    }

    return {
        init,
        saveToJSON,
        loadFromJSON,
        hardReset,
        openPrestige,
        doPrestige,
        closeSkillShop,
        openMarket,
        closeMarket,
        renderMarket,
        buyStock,
        sellStock,
        buySelectedSkill
    };
})();

window.onload = Game.init;
