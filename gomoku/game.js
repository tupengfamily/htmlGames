/**
 * 五子棋游戏类 - 实现国际比赛规则
 * 包含禁手检测（三三、四四、长连）、对局记录、历史回放、人机对战等功能
 */
class Gomoku {
    constructor() {
        this.size = 15;                    // 棋盘尺寸 15x15
        this.board = [];                   // 棋盘状态数组
        this.currentPlayer = 'black';      // 当前玩家，黑棋先行
        this.gameOver = false;             // 游戏是否结束
        this.moveHistory = [];             // 落子历史记录
        this.startTime = null;             // 对局开始时间
        this.moveCount = 0;                // 总落子数
        this.winLine = null;               // 获胜连线信息
        this.lastMove = null;              // 最后一步落子位置

        // 人机对战相关属性
        this.gameMode = 'pvp';             // 游戏模式：pvp(双人), pve-easy(简单), pve-medium(中等), pve-hard(困难)
        this.aiColor = 'white';            // AI执棋颜色
        this.isAIThinking = false;         // AI是否正在思考

        this.stats = this.loadStats();     // 加载胜负统计

        // DOM元素引用
        this.boardElement = document.getElementById('board');
        this.statusElement = document.getElementById('status');
        this.turnCountElement = document.getElementById('turn-count');
        this.blackWinsElement = document.getElementById('black-wins');
        this.whiteWinsElement = document.getElementById('white-wins');
        this.forbiddenHint = document.getElementById('forbidden-hint');

        this.init();
        this.setupEventListeners();
    }

    /**
     * 初始化游戏状态
     * 尝试从localStorage恢复保存的游戏状态，如果没有则创建新游戏
     */
    init() {
        // 尝试从localStorage恢复游戏状态
        const savedState = localStorage.getItem('gomokuGameState');
        
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                this.board = state.board;
                this.currentPlayer = state.currentPlayer;
                this.gameOver = state.gameOver;
                this.moveHistory = state.moveHistory;
                this.startTime = state.startTime;
                this.moveCount = state.moveCount;
                this.winLine = state.winLine;
                this.lastMove = state.lastMove;
                this.gameMode = state.gameMode || 'pvp';
                this.aiColor = state.aiColor || 'white';
                this.isAIThinking = false;

                // 恢复模式选择UI状态
                this.restoreModeUI();
            } catch (e) {
                console.error('恢复游戏状态失败:', e);
                this.resetGameState();
            }
        } else {
            this.resetGameState();
        }

        this.updateStatsDisplay();
        this.render();
        this.updateStatus();

        // 如果是人机模式且轮到AI，触发AI思考
        if (this.isAITurn()) {
            setTimeout(() => this.aiMove(), 500);
        }
    }

    /**
     * 重置游戏状态到初始值
     */
    resetGameState() {
        this.board = Array.from({ length: this.size }, () => Array(this.size).fill(null));
        this.currentPlayer = 'black';
        this.gameOver = false;
        this.moveHistory = [];
        this.startTime = Date.now();
        this.moveCount = 0;
        this.winLine = null;
        this.lastMove = null;
        this.isAIThinking = false;
    }

    /**
     * 恢复模式选择UI状态
     */
    restoreModeUI() {
        // 更新模式按钮样式
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === this.gameMode);
        });

        // 显示/隐藏AI颜色选择器
        const colorSelector = document.getElementById('ai-color-selector');
        colorSelector.style.display = this.gameMode.startsWith('pve') ? 'flex' : 'none';

        // 更新颜色按钮样式
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === this.aiColor);
        });
    }

    /**
     * 保存当前游戏状态到localStorage
     */
    saveGameState() {
        const state = {
            board: this.board,
            currentPlayer: this.currentPlayer,
            gameOver: this.gameOver,
            moveHistory: this.moveHistory,
            startTime: this.startTime,
            moveCount: this.moveCount,
            winLine: this.winLine,
            lastMove: this.lastMove,
            gameMode: this.gameMode,
            aiColor: this.aiColor
        };
        localStorage.setItem('gomokuGameState', JSON.stringify(state));
    }

    /**
     * 清除保存的游戏状态
     */
    clearGameState() {
        localStorage.removeItem('gomokuGameState');
    }

    /**
     * 设置所有事件监听器
     * 包括棋盘点击、鼠标移动、按钮点击、模式选择等
     */
    setupEventListeners() {
        // 棋盘相关事件
        this.boardElement.addEventListener('click', (e) => this.handleClick(e));
        this.boardElement.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.boardElement.addEventListener('mouseleave', () => this.clearPreview());
        
        // 游戏控制按钮事件
        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('history-btn').addEventListener('click', () => this.showHistory());
        document.getElementById('rules-btn').addEventListener('click', () => this.showRules());
        
        // 历史记录模态框事件
        document.getElementById('close-history').addEventListener('click', () => this.hideHistory());
        document.getElementById('history-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.hideHistory();
        });
        
        // 规则说明模态框事件
        document.getElementById('close-rules').addEventListener('click', () => this.hideRules());
        document.getElementById('rules-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.hideRules();
        });

        // 游戏模式选择事件
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectGameMode(e.target.dataset.mode));
        });

        // AI执棋颜色选择事件
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectAIColor(e.target.dataset.color));
        });
    }

    /**
     * 渲染棋盘
     * 创建网格单元格，显示棋子，标记最后落子位置，显示星位
     */
    render() {
        // 星位坐标（天元和四个角星）
        const starPoints = [
            { row: 7, col: 7 },   // 天元（中心）
            { row: 3, col: 3 },   // 左上角星
            { row: 3, col: 11 },  // 右上角星
            { row: 11, col: 3 },  // 左下角星
            { row: 11, col: 11 }  // 右下角星
        ];

        this.boardElement.innerHTML = '';
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r;
                cell.dataset.col = c;

                // 检查是否为星位
                const isStarPoint = starPoints.some(p => p.row === r && p.col === c);
                if (isStarPoint) {
                    const star = document.createElement('div');
                    star.className = 'star-point';
                    cell.appendChild(star);
                }

                // 添加预览元素（鼠标悬停时显示）
                const preview = document.createElement('div');
                preview.className = `preview ${this.currentPlayer}`;
                cell.appendChild(preview);

                // 如果该位置有棋子，创建棋子元素
                if (this.board[r][c]) {
                    const stone = document.createElement('div');
                    stone.className = `stone ${this.board[r][c]}`;
                    // 标记最后落子位置
                    if (this.lastMove && this.lastMove.row === r && this.lastMove.col === c) {
                        stone.classList.add('last-move');
                    }
                    cell.appendChild(stone);
                }

                this.boardElement.appendChild(cell);
            }
        }

        // 如果游戏结束且有获胜连线，绘制连线
        if (this.winLine) {
            this.drawWinLine();
        }
    }

    /**
     * 处理棋盘点击事件
     * @param {Event} e - 点击事件对象
     */
    handleClick(e) {
        if (this.gameOver || this.isAIThinking) return;

        // 如果是人机模式且轮到AI，阻止人类玩家落子
        if (this.isAITurn()) return;

        const cell = e.target.closest('.cell');
        if (!cell) return;

        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        // 该位置已有棋子，忽略点击
        if (this.board[row][col]) return;

        // 黑棋禁手检测：如果当前位置是禁手位置，显示提示并阻止落子
        if (this.currentPlayer === 'black' && this.isForbidden(row, col)) {
            this.showForbiddenHint(row, col);
            return;
        }

        this.makeMove(row, col);
    }

    /**
     * 处理鼠标在棋盘上移动事件
     * 显示落子预览，禁手位置显示红色提示
     * @param {Event} e - 鼠标移动事件对象
     */
    handleMouseMove(e) {
        if (this.gameOver) return;

        const cell = e.target.closest('.cell');
        if (!cell) return;

        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        this.clearPreview();

        // 该位置为空时显示预览
        if (!this.board[row][col]) {
            const preview = cell.querySelector('.preview');
            if (preview) {
                // 黑棋禁手位置显示红色预览
                if (this.currentPlayer === 'black' && this.isForbidden(row, col)) {
                    preview.style.background = 'rgba(231, 76, 60, 0.4)';
                } else {
                    preview.style.background = this.currentPlayer === 'black' 
                        ? 'rgba(0, 0, 0, 0.3)' 
                        : 'rgba(200, 200, 200, 0.5)';
                }
                preview.style.opacity = '0.5';
            }
        }
    }

    clearPreview() {
        const previews = this.boardElement.querySelectorAll('.preview');
        previews.forEach(p => p.style.opacity = '0');
    }

    /**
     * 执行落子操作
     * @param {number} row - 落子行号
     * @param {number} col - 落子列号
     */
    makeMove(row, col) {
        // 在棋盘上放置棋子
        this.board[row][col] = this.currentPlayer;
        this.moveCount++;
        this.lastMove = { row, col };
        
        // 记录落子历史
        this.moveHistory.push({
            row,
            col,
            player: this.currentPlayer,
            moveNumber: this.moveCount
        });

        // 检查是否获胜（五连）
        if (this.checkWin(row, col)) {
            // 形成五连，无论是否是禁手位置都获胜（禁手失效规则）
            this.gameOver = true;
            this.winLine = this.getWinLine(row, col);
            this.saveGameRecord(this.currentPlayer);
            this.updateStats(this.currentPlayer);
            this.saveGameState();
            this.render();
            this.showWinMessage(this.currentPlayer);
            return;
        }

        // 检查黑棋禁手（只有在不能获胜的情况下才检查禁手）
        if (this.currentPlayer === 'black' && this.isForbidden(row, col)) {
            this.showForbiddenHint(row, col);
            // 移除刚放置的棋子（禁手位置不能落子）
            this.board[row][col] = null;
            this.moveCount--;
            this.moveHistory.pop();
            return;
        }

        // 检查是否平局（棋盘已满）
        if (this.moveCount === this.size * this.size) {
            this.gameOver = true;
            this.saveGameRecord('draw');
            this.saveGameState();
            this.render();
            this.showDrawMessage();
            return;
        }

        // 切换玩家
        this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        this.render();
        this.updateStatus();

        // 保存游戏状态
        this.saveGameState();

        // 如果是人机模式且轮到AI，触发AI思考
        if (this.isAITurn()) {
            setTimeout(() => this.aiMove(), 100);
        }
    }

    /**
     * 检查是否形成五连（获胜条件）
     * @param {number} row - 最后落子的行号
     * @param {number} col - 最后落子的列号
     * @returns {boolean} 是否形成五连
     */
    checkWin(row, col) {
        // 四个方向：水平、垂直、两条对角线
        const directions = [
            [0, 1],   // 水平
            [1, 0],   // 垂直
            [1, 1],   // 右下对角线
            [1, -1]   // 左下对角线
        ];

        for (const [dr, dc] of directions) {
            let count = 1;  // 包含当前落子
            // 向正方向计数
            count += this.countDirection(row, col, dr, dc);
            // 向反方向计数
            count += this.countDirection(row, col, -dr, -dc);
            // 五连或以上即获胜
            if (count >= 5) return true;
        }

        return false;
    }

    /**
     * 沿指定方向计数连续同色棋子数量
     * @param {number} row - 起始行号
     * @param {number} col - 起始列号
     * @param {number} dr - 行方向增量
     * @param {number} dc - 列方向增量
     * @returns {number} 连续同色棋子数量
     */
    countDirection(row, col, dr, dc) {
        const player = this.board[row][col];
        let count = 0;
        let r = row + dr;
        let c = col + dc;

        while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
            count++;
            r += dr;
            c += dc;
        }

        return count;
    }

    /**
     * 获取获胜连线信息
     * @param {number} row - 最后落子的行号
     * @param {number} col - 最后落子的列号
     * @returns {Object|null} 连线起止点和方向信息
     */
    getWinLine(row, col) {
        const directions = [
            [0, 1],   // 水平
            [1, 0],   // 垂直
            [1, 1],   // 右下对角线
            [1, -1]   // 左下对角线
        ];

        for (const [dr, dc] of directions) {
            let count = 1;
            let stones = [{ row, col }];

            // 收集正方向的棋子
            count += this.countDirection(row, col, dr, dc);
            stones = stones.concat(this.getStonesInDirection(row, col, dr, dc));

            // 收集反方向的棋子
            count += this.countDirection(row, col, -dr, -dc);
            stones = stones.concat(this.getStonesInDirection(row, col, -dr, -dc));

            // 五连或以上，返回连线信息
            if (count >= 5) {
                return {
                    start: stones[0],
                    end: stones[stones.length - 1],
                    direction: [dr, dc]
                };
            }
        }

        return null;
    }

    /**
     * 获取指定方向的所有同色棋子位置
     * @param {number} row - 起始行号
     * @param {number} col - 起始列号
     * @param {number} dr - 行方向增量
     * @param {number} dc - 列方向增量
     * @returns {Array} 棋子位置数组
     */
    getStonesInDirection(row, col, dr, dc) {
        const player = this.board[row][col];
        const stones = [];
        let r = row + dr;
        let c = col + dc;

        while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
            stones.push({ row: r, col: c });
            r += dr;
            c += dc;
        }

        return stones;
    }

/**
     * 绘制获胜连线
     */
    drawWinLine() {
        if (!this.winLine) return;

        const { start, end } = this.winLine;
        
        // 从CSS变量获取单元格大小
        const style = getComputedStyle(this.boardElement);
        const cellSizeStr = style.getPropertyValue('--cell-size').trim();
        let cellSize = parseFloat(cellSizeStr);
        const padding = parseFloat(style.padding) || cellSize * 0.3;
        
        // 如果无法获取有效值，使用默认值
        if (isNaN(cellSize) || cellSize === 0) {
            cellSize = 40;
        }

        const startX = start.col * cellSize + cellSize / 2 + padding;
        const startY = start.row * cellSize + cellSize / 2 + padding;
        const endX = end.col * cellSize + cellSize / 2 + padding;
        const endY = end.row * cellSize + cellSize / 2 + padding;

        const line = document.createElement('div');
        line.className = 'win-line';
        line.style.position = 'absolute';

        const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        const angle = Math.atan2(endY - startY, endX - startX);

        line.style.width = `${length}px`;
        line.style.height = `${cellSize * 0.15}px`;
        line.style.left = `${startX}px`;
        line.style.top = `${startY - cellSize * 0.075}px`;
        line.style.transform = `rotate(${angle}rad)`;
        line.style.transformOrigin = '0 50%';

        this.boardElement.appendChild(line);
    }

    /**
     * 检测指定位置是否为禁手位置
     * 禁手规则仅适用于黑棋，包括：三三、四四、长连
     * @param {number} row - 检测位置行号
     * @param {number} col - 检测位置列号
     * @returns {boolean} 是否为禁手位置
     */
    isForbidden(row, col) {
        // 该位置已有棋子，不是禁手
        if (this.board[row][col]) return false;

        // 临时放置黑棋进行检测
        this.board[row][col] = 'black';

        let openThrees = 0;   // 活三数量
        let fours = 0;        // 四的数量（包括活四和冲四）
        let overline = false; // 是否长连

        // 四个方向：水平、垂直、两条对角线
        const directions = [
            [0, 1],   // 水平
            [1, 0],   // 垂直
            [1, 1],   // 右下对角线
            [1, -1]   // 左下对角线
        ];

        // 分析每个方向的棋型
        for (const [dr, dc] of directions) {
            const pattern = this.getLinePattern(row, col, dr, dc);
            const result = this.analyzePattern(pattern);

            if (result.isOverline) overline = true;
            if (result.isFour) fours++;
            if (result.isOpenThree) openThrees++;
        }

        // 移除临时放置的棋子
        this.board[row][col] = null;

        // 判断禁手类型
        if (overline) return true;      // 长连禁手
        if (fours >= 2) return true;    // 四四禁手
        if (openThrees >= 2) return true; // 三三禁手

        return false;
    }

    /**
     * 获取指定方向的棋型信息
     * @param {number} row - 起始行号
     * @param {number} col - 起始列号
     * @param {number} dr - 行方向增量
     * @param {number} dc - 列方向增量
     * @returns {Object} 棋型信息，包括棋子模式、两端空位情况
     */
    getLinePattern(row, col, dr, dc) {
        const player = this.board[row][col];
        let stones = [1];      // 棋子模式数组，1表示有棋子
        let emptyBefore = 0;   // 前端是否有空位
        let emptyAfter = 0;    // 后端是否有空位

        // 向负方向扫描
        let r = row - dr;
        let c = col - dc;
        while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
            stones.unshift(1);
            r -= dr;
            c -= dc;
        }
        // 检查负方向末端是否有空位
        if (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === null) {
            emptyBefore = 1;
        }

        // 向正方向扫描
        r = row + dr;
        c = col + dc;
        while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
            stones.push(1);
            r += dr;
            c += dc;
        }
        // 检查正方向末端是否有空位
        if (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === null) {
            emptyAfter = 1;
        }

        return {
            pattern: stones,
            emptyBefore,
            emptyAfter,
            length: stones.length
        };
    }

    /**
     * 分析棋型，判断是否形成活三、四、长连等
     * @param {Object} lineInfo - 棋型信息
     * @returns {Object} 分析结果，包括是否活三、四、长连
     */
    analyzePattern(lineInfo) {
        const { length, emptyBefore, emptyAfter } = lineInfo;

        // 长连：五颗以上同色棋子连成一线
        const isOverline = length > 5;

        // 四：连续四颗棋子，至少一端有空位
        const isFour = length === 4 && (emptyBefore || emptyAfter);

        // 活三：连续三颗棋子，两端都有空位（可发展为活四）
        const isOpenThree = length === 3 && emptyBefore && emptyAfter;

        // 眠三：连续三颗棋子，只有一端有空位
        const isClosedThree = length === 3 && (emptyBefore || emptyAfter) && !(emptyBefore && emptyAfter);

        return {
            isOverline,
            isFour,
            isOpenThree,
            isClosedThree
        };
    }

    /**
     * 显示禁手违规提示
     * 根据禁手类型显示不同的提示信息
     * @param {number} row - 禁手位置行号
     * @param {number} col - 禁手位置列号
     */
    showForbiddenHint(row, col) {
        const forbiddenTypes = this.getForbiddenTypes(row, col);
        const typeMessages = {
            '长连': '长连禁手：黑棋不能形成六子或以上连线',
            '四四': '四四禁手：黑棋不能同时形成两个四',
            '三三': '三三禁手：黑棋不能同时形成两个活三'
        };
        
        // 构建详细提示信息
        const types = forbiddenTypes.split('+');
        const detailedMessage = types.map(t => typeMessages[t] || t).join('\n');
        
        this.forbiddenHint.innerHTML = `<strong>⚠️ 禁手违规</strong><br>${detailedMessage}`;
        this.forbiddenHint.style.display = 'block';

        // 定位提示框在禁手位置上方
        const rect = this.boardElement.getBoundingClientRect();
        const cellSize = 40;
        const x = rect.left + col * cellSize + cellSize / 2;
        const y = rect.top + row * cellSize;

        this.forbiddenHint.style.left = `${x}px`;
        this.forbiddenHint.style.top = `${y - 80}px`;
        this.forbiddenHint.style.transform = 'translateX(-50%)';

        // 3秒后自动隐藏
        setTimeout(() => {
            this.forbiddenHint.style.display = 'none';
        }, 3000);
    }

    /**
     * 获取禁手位置的禁手类型
     * @param {number} row - 检测位置行号
     * @param {number} col - 检测位置列号
     * @returns {string} 禁手类型字符串，多个禁手用+连接
     */
    getForbiddenTypes(row, col) {
        const types = [];

        // 临时放置黑棋进行检测
        this.board[row][col] = 'black';

        let openThrees = 0;   // 活三数量
        let fours = 0;        // 四的数量
        let overline = false; // 是否长连

        // 四个方向：水平、垂直、两条对角线
        const directions = [
            [0, 1],   // 水平
            [1, 0],   // 垂直
            [1, 1],   // 右下对角线
            [1, -1]   // 左下对角线
        ];

        // 分析每个方向的棋型
        for (const [dr, dc] of directions) {
            const pattern = this.getLinePattern(row, col, dr, dc);
            const result = this.analyzePattern(pattern);

            if (result.isOverline) overline = true;
            if (result.isFour) fours++;
            if (result.isOpenThree) openThrees++;
        }

        // 移除临时放置的棋子
        this.board[row][col] = null;

        // 判断禁手类型
        if (overline) types.push('长连');
        if (fours >= 2) types.push('四四');
        if (openThrees >= 2) types.push('三三');

        return types.join('+');
    }

    /**
     * 悔棋功能
     * 撤销最后一步落子，恢复到上一步状态
     */
    undo() {
        if (this.moveHistory.length === 0 || this.isAIThinking) return;
        
        // 如果游戏已结束，先重置游戏状态
        if (this.gameOver) {
            this.gameOver = false;
            this.winLine = null;
        }

        // 在人机模式下，撤销两步（人类和AI各一步）
        if (this.gameMode.startsWith('pve') && this.moveHistory.length >= 2) {
            const lastMove1 = this.moveHistory.pop();
            this.board[lastMove1.row][lastMove1.col] = null;
            this.moveCount--;
            
            const lastMove2 = this.moveHistory.pop();
            this.board[lastMove2.row][lastMove2.col] = null;
            this.moveCount--;
            
            this.currentPlayer = lastMove2.player;
        } else {
            // 双人模式或只剩一步时，撤销一步
            const lastMove = this.moveHistory.pop();
            this.board[lastMove.row][lastMove.col] = null;
            this.moveCount--;
            this.currentPlayer = lastMove.player;
        }
        
        // 更新最后落子位置标记
        this.lastMove = this.moveHistory.length > 0 
            ? this.moveHistory[this.moveHistory.length - 1] 
            : null;

        this.render();
        this.updateStatus();
        
        // 保存游戏状态
        this.saveGameState();
    }

    /**
     * 开始新游戏
     * 如果当前有未完成的对局，提示用户并保存记录
     */
    newGame() {
        if (this.moveHistory.length > 0 && !this.gameOver) {
            if (!confirm('确定要开始新游戏吗？当前对局将被记录。')) {
                return;
            }
            this.saveGameRecord('interrupted');
        }
        // 清除保存的游戏状态
        this.clearGameState();
        this.resetGameState();
        this.updateStatsDisplay();
        this.render();
        this.updateStatus();

        // 如果是人机模式且AI执黑（先手），触发AI思考
        if (this.isAITurn()) {
            setTimeout(() => this.aiMove(), 500);
        }
    }

    /**
     * 更新游戏状态显示
     * 显示当前玩家和回合数
     */
    updateStatus() {
        if (this.isAIThinking) {
            this.statusElement.textContent = 'AI思考中...';
            return;
        }

        const isAI = this.gameMode.startsWith('pve') && this.currentPlayer === this.aiColor;
        const playerName = this.currentPlayer === 'black' ? '黑棋' : '白棋';
        
        if (isAI) {
            this.statusElement.textContent = 'AI落子';
        } else {
            this.statusElement.textContent = `${playerName}落子`;
        }
        
        this.statusElement.classList.toggle('white-turn', this.currentPlayer === 'white');
        this.turnCountElement.textContent = Math.floor(this.moveCount / 2) + 1;
    }

    /**
     * 显示获胜消息
     * @param {string} winner - 获胜方 ('black' 或 'white')
     */
    showWinMessage(winner) {
        const winnerName = winner === 'black' ? '黑棋' : '白棋';
        this.statusElement.textContent = `${winnerName}获胜！`;
        this.statusElement.classList.toggle('white-turn', winner === 'white');
        setTimeout(() => {
            alert(`恭喜！${winnerName}获胜！\n共${this.moveCount}手`);
        }, 100);
    }

    /**
     * 显示平局消息
     */
    showDrawMessage() {
        this.statusElement.textContent = '平局！';
        setTimeout(() => {
            alert('平局！棋盘已满。');
        }, 100);
    }

    /**
     * 保存对局记录到本地存储
     * @param {string} result - 对局结果 ('black', 'white', 'draw', 'interrupted')
     */
    saveGameRecord(result) {
        const history = JSON.parse(localStorage.getItem('gomokuHistory') || '[]');
        const record = {
            id: Date.now(),
            date: new Date().toLocaleString('zh-CN'),
            result: result,
            moves: [...this.moveHistory],
            totalMoves: this.moveCount,
            duration: Math.floor((Date.now() - this.startTime) / 1000)
        };

        // 保存记录，最多保留10条
        history.unshift(record);
        if (history.length > 10) history.pop();
        localStorage.setItem('gomokuHistory', JSON.stringify(history));
    }

    /**
     * 从本地存储加载胜负统计
     * @returns {Object} 胜负统计数据
     */
    loadStats() {
        return JSON.parse(localStorage.getItem('gomokuStats') || '{"black":0,"white":0,"draw":0}');
    }

    /**
     * 保存胜负统计到本地存储
     */
    saveStats() {
        localStorage.setItem('gomokuStats', JSON.stringify(this.stats));
    }

    /**
     * 更新胜负统计
     * @param {string} winner - 获胜方 ('black', 'white', 'draw')
     */
    updateStats(winner) {
        this.stats[winner]++;
        this.saveStats();
        this.updateStatsDisplay();
    }

    /**
     * 更新胜负统计显示
     */
    updateStatsDisplay() {
        this.blackWinsElement.textContent = `${this.stats.black}胜`;
        this.whiteWinsElement.textContent = `${this.stats.white}胜`;
    }

    /**
     * 显示历史记录模态框
     * 展示最近10局对局记录，支持回放
     */
    showHistory() {
        const history = JSON.parse(localStorage.getItem('gomokuHistory') || '[]');
        const modal = document.getElementById('history-modal');
        const list = document.getElementById('history-list');

        if (history.length === 0) {
            list.innerHTML = '<p class="no-history">暂无历史记录</p>';
        } else {
            list.innerHTML = history.map((record, index) => {
                let resultText = '';
                let resultClass = '';
                
                if (record.result === 'black') {
                    resultText = '黑棋胜';
                    resultClass = 'black-win';
                } else if (record.result === 'white') {
                    resultText = '白棋胜';
                    resultClass = 'white-win';
                } else if (record.result === 'draw') {
                    resultText = '平局';
                    resultClass = 'draw';
                } else {
                    resultText = '未完成';
                    resultClass = '';
                }

                const duration = record.duration 
                    ? `${Math.floor(record.duration / 60)}分${record.duration % 60}秒` 
                    : '未知';

                return `
                    <div class="history-item">
                        <span class="history-rank">#${index + 1}</span>
                        <div class="history-info">
                            <div class="history-date">${record.date}</div>
                            <div class="history-result ${resultClass}">${resultText}</div>
                        </div>
                        <div class="history-details">
                            <div class="history-moves">${record.totalMoves}手</div>
                            <div class="history-duration">${duration}</div>
                        </div>
                        <button class="view-record-btn" data-index="${index}">回放</button>
                    </div>
                `;
            }).join('');

            list.querySelectorAll('.view-record-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    this.replayGame(history[index]);
                });
            });
        }

        modal.classList.add('active');
    }

    hideHistory() {
        document.getElementById('history-modal').classList.remove('active');
    }

    /**
     * 显示规则说明模态框
     */
    showRules() {
        document.getElementById('rules-modal').classList.add('active');
    }

    /**
     * 隐藏规则说明模态框
     */
    hideRules() {
        document.getElementById('rules-modal').classList.remove('active');
    }

    replayGame(record) {
        this.hideHistory();

        const replayContainer = document.createElement('div');
        replayContainer.className = 'replay-container active';
        replayContainer.innerHTML = `
            <div class="replay-info">
                <div>对局回放 - ${record.date}</div>
                <div>${record.result === 'black' ? '黑棋胜' : record.result === 'white' ? '白棋胜' : '平局'} | ${record.totalMoves}手</div>
            </div>
            <div class="replay-board">
                <div id="replay-board-inner" class="board" style="grid-template-columns: repeat(15, 30px); grid-template-rows: repeat(15, 30px);"></div>
            </div>
            <div class="replay-controls">
                <button id="replay-prev">上一步</button>
                <button id="replay-auto">自动播放</button>
                <button id="replay-next">下一步</button>
                <button id="replay-close">关闭</button>
            </div>
        `;

        document.body.appendChild(replayContainer);

        const boardInner = document.getElementById('replay-board-inner');
        let currentStep = 0;
        let autoPlayInterval = null;

        const renderReplayBoard = () => {
            boardInner.innerHTML = '';
            for (let r = 0; r < this.size; r++) {
                for (let c = 0; c < this.size; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'cell';
                    cell.style.width = '30px';
                    cell.style.height = '30px';

                    const preview = document.createElement('div');
                    preview.className = 'preview';
                    preview.style.width = '26px';
                    preview.style.height = '26px';
                    cell.appendChild(preview);

                    boardInner.appendChild(cell);
                }
            }

            for (let i = 0; i < currentStep && i < record.moves.length; i++) {
                const move = record.moves[i];
                const cellIndex = move.row * this.size + move.col;
                const cell = boardInner.children[cellIndex];
                
                const stone = document.createElement('div');
                stone.className = `stone ${move.player}`;
                stone.style.width = '26px';
                stone.style.height = '26px';
                
                if (i === currentStep - 1) {
                    stone.classList.add('last-move');
                }
                
                cell.appendChild(stone);
            }
        };

        const updateStep = (step) => {
            currentStep = Math.max(0, Math.min(step, record.moves.length));
            renderReplayBoard();
        };

        document.getElementById('replay-prev').addEventListener('click', () => {
            updateStep(currentStep - 1);
        });

        document.getElementById('replay-next').addEventListener('click', () => {
            updateStep(currentStep + 1);
        });

        document.getElementById('replay-auto').addEventListener('click', () => {
            if (autoPlayInterval) {
                clearInterval(autoPlayInterval);
                autoPlayInterval = null;
                document.getElementById('replay-auto').textContent = '自动播放';
            } else {
                autoPlayInterval = setInterval(() => {
                    if (currentStep >= record.moves.length) {
                        clearInterval(autoPlayInterval);
                        autoPlayInterval = null;
                        document.getElementById('replay-auto').textContent = '自动播放';
                    } else {
                        updateStep(currentStep + 1);
                    }
                }, 500);
                document.getElementById('replay-auto').textContent = '暂停';
            }
        });

        document.getElementById('replay-close').addEventListener('click', () => {
            if (autoPlayInterval) {
                clearInterval(autoPlayInterval);
            }
            replayContainer.remove();
        });

        renderReplayBoard();
    }

    /**
     * 选择游戏模式
     * @param {string} mode - 游戏模式 (pvp, pve-easy, pve-medium, pve-hard)
     */
    selectGameMode(mode) {
        this.gameMode = mode;
        
        // 更新模式按钮样式
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // 显示/隐藏AI颜色选择器
        const colorSelector = document.getElementById('ai-color-selector');
        colorSelector.style.display = mode.startsWith('pve') ? 'flex' : 'none';

        // 开始新游戏
        this.newGame();
    }

    /**
     * 选择AI执棋颜色
     * @param {string} color - AI执棋颜色 (black, white)
     */
    selectAIColor(color) {
        this.aiColor = color;
        
        // 更新颜色按钮样式
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === color);
        });

        this.newGame();
    }

    /**
     * 检查当前是否轮到AI行动
     * @returns {boolean} 是否轮到AI
     */
    isAITurn() {
        return this.gameMode.startsWith('pve') && this.currentPlayer === this.aiColor && !this.gameOver;
    }

    /**
     * AI思考并落子
     * 根据游戏模式选择不同的AI策略
     */
    async aiMove() {
        if (this.isAIThinking || this.gameOver) return;
        
        this.isAIThinking = true;
        this.statusElement.textContent = 'AI思考中...';
        
        // 添加延迟，让用户能看到AI在"思考"
        await new Promise(resolve => setTimeout(resolve, 300));
        
        let move;
        switch (this.gameMode) {
            case 'pve-easy':
                move = this.aiEasy();
                break;
            case 'pve-medium':
                move = this.aiMedium();
                break;
            case 'pve-hard':
                move = this.aiHard();
                break;
            default:
                move = this.aiEasy();
        }

        if (move) {
            this.makeMove(move.row, move.col);
        }
        
        this.isAIThinking = false;
    }

    /**
     * 简单难度AI
     * 随机落子，但会优先选择靠近已有棋子的位置
     * @returns {Object|null} 落子位置 {row, col}
     */
    aiEasy() {
        const emptyCells = this.getEmptyCells();
        if (emptyCells.length === 0) return null;

        // 如果是第一步，随机选择中心区域
        if (this.moveCount === 0) {
            const center = Math.floor(this.size / 2);
            const offset = Math.floor(Math.random() * 3) - 1;
            return { row: center + offset, col: center + offset };
        }

        // 收集所有可能的落子位置（靠近已有棋子）
        const candidates = [];
        for (const cell of emptyCells) {
            if (this.hasNeighbor(cell.row, cell.col, 2)) {
                candidates.push(cell);
            }
        }

        // 如果没有靠近的位置，随机选择
        const targetCells = candidates.length > 0 ? candidates : emptyCells;
        return targetCells[Math.floor(Math.random() * targetCells.length)];
    }

    /**
     * 中等难度AI
     * 基于评分函数选择最佳位置
     * @returns {Object|null} 落子位置 {row, col}
     */
    aiMedium() {
        const emptyCells = this.getEmptyCells();
        if (emptyCells.length === 0) return null;

        let bestScore = -Infinity;
        let bestMove = null;

        for (const cell of emptyCells) {
            // 只考虑靠近已有棋子的位置
            if (!this.hasNeighbor(cell.row, cell.col, 2)) continue;

            const score = this.evaluatePosition(cell.row, cell.col);
            if (score > bestScore) {
                bestScore = score;
                bestMove = cell;
            }
        }

        // 如果没有找到好的位置，使用简单AI
        return bestMove || this.aiEasy();
    }

    /**
     * 困难难度AI
     * 使用威胁空间搜索和更复杂的评估
     * @returns {Object|null} 落子位置 {row, col}
     */
    aiHard() {
        const emptyCells = this.getEmptyCells();
        if (emptyCells.length === 0) return null;

        // 检查是否有立即获胜的位置
        for (const cell of emptyCells) {
            if (this.isWinningMove(cell.row, cell.col)) {
                return cell;
            }
        }

        // 检查是否需要防守（对手有立即获胜的位置）
        const opponent = this.currentPlayer === 'black' ? 'white' : 'black';
        for (const cell of emptyCells) {
            if (this.isWinningMoveFor(cell.row, cell.col, opponent)) {
                return cell;
            }
        }

        // 使用评分函数选择最佳位置
        let bestScore = -Infinity;
        let bestMove = null;
        const candidates = [];

        for (const cell of emptyCells) {
            if (!this.hasNeighbor(cell.row, cell.col, 2)) continue;

            const score = this.evaluatePositionAdvanced(cell.row, cell.col);
            candidates.push({ ...cell, score });

            if (score > bestScore) {
                bestScore = score;
                bestMove = cell;
            }
        }

        // 如果有多个高分位置，随机选择一个（增加变化性）
        if (candidates.length > 0) {
            const topCandidates = candidates
                .filter(c => c.score >= bestScore * 0.9)
                .sort((a, b) => b.score - a.score);
            
            if (topCandidates.length > 1) {
                return topCandidates[Math.floor(Math.random() * Math.min(3, topCandidates.length))];
            }
        }

        return bestMove || this.aiEasy();
    }

    /**
     * 获取所有空位置
     * @returns {Array} 空位置数组
     */
    getEmptyCells() {
        const cells = [];
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (!this.board[r][c]) {
                    cells.push({ row: r, col: c });
                }
            }
        }
        return cells;
    }

    /**
     * 检查指定位置是否有邻居棋子
     * @param {number} row - 行号
     * @param {number} col - 列号
     * @param {number} distance - 检查距离
     * @returns {boolean} 是否有邻居
     */
    hasNeighbor(row, col, distance) {
        for (let dr = -distance; dr <= distance; dr++) {
            for (let dc = -distance; dc <= distance; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c]) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 检查落子是否能立即获胜
     * @param {number} row - 行号
     * @param {number} col - 列号
     * @returns {boolean} 是否能获胜
     */
    isWinningMove(row, col) {
        return this.isWinningMoveFor(row, col, this.currentPlayer);
    }

    /**
     * 检查指定颜色落子是否能立即获胜
     * @param {number} row - 行号
     * @param {number} col - 列号
     * @param {string} player - 玩家颜色
     * @returns {boolean} 是否能获胜
     */
    isWinningMoveFor(row, col, player) {
        this.board[row][col] = player;
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        
        for (const [dr, dc] of directions) {
            let count = 1;
            count += this.countDirectionFor(row, col, dr, dc, player);
            count += this.countDirectionFor(row, col, -dr, -dc, player);
            if (count >= 5) {
                this.board[row][col] = null;
                return true;
            }
        }
        
        this.board[row][col] = null;
        return false;
    }

    /**
     * 沿指定方向计数连续同色棋子
     * @param {number} row - 起始行号
     * @param {number} col - 起始列号
     * @param {number} dr - 行方向增量
     * @param {number} dc - 列方向增量
     * @param {string} player - 玩家颜色
     * @returns {number} 连续棋子数量
     */
    countDirectionFor(row, col, dr, dc, player) {
        let count = 0;
        let r = row + dr;
        let c = col + dc;

        while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
            count++;
            r += dr;
            c += dc;
        }

        return count;
    }

    /**
     * 评估位置分数（中等难度）
     * @param {number} row - 行号
     * @param {number} col - 列号
     * @returns {number} 位置分数
     */
    evaluatePosition(row, col) {
        let score = 0;
        const player = this.currentPlayer;
        const opponent = player === 'black' ? 'white' : 'black';

        // 临时放置棋子
        this.board[row][col] = player;

        // 评估四个方向的棋型
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (const [dr, dc] of directions) {
            const myPattern = this.getLinePatternFor(row, col, dr, dc, player);
            const myScore = this.evaluatePattern(myPattern);
            score += myScore;
        }

        // 移除临时棋子
        this.board[row][col] = null;

        // 评估防守分数（对手在这个位置的分数）
        this.board[row][col] = opponent;
        for (const [dr, dc] of directions) {
            const oppPattern = this.getLinePatternFor(row, col, dr, dc, opponent);
            const oppScore = this.evaluatePattern(oppPattern);
            score += oppScore * 0.9; // 防守分数略低
        }
        this.board[row][col] = null;

        // 中心位置加分
        const center = Math.floor(this.size / 2);
        const distance = Math.abs(row - center) + Math.abs(col - center);
        score += Math.max(0, 10 - distance);

        return score;
    }

    /**
     * 评估位置分数（困难难度）
     * @param {number} row - 行号
     * @param {number} col - 列号
     * @returns {number} 位置分数
     */
    evaluatePositionAdvanced(row, col) {
        let score = 0;
        const player = this.currentPlayer;
        const opponent = player === 'black' ? 'white' : 'black';

        // 临时放置棋子
        this.board[row][col] = player;

        // 评估四个方向的棋型
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (const [dr, dc] of directions) {
            const myPattern = this.getLinePatternFor(row, col, dr, dc, player);
            const myScore = this.evaluatePatternAdvanced(myPattern);
            score += myScore;
        }

        // 移除临时棋子
        this.board[row][col] = null;

        // 评估防守分数
        this.board[row][col] = opponent;
        for (const [dr, dc] of directions) {
            const oppPattern = this.getLinePatternFor(row, col, dr, dc, opponent);
            const oppScore = this.evaluatePatternAdvanced(oppPattern);
            score += oppScore * 0.95;
        }
        this.board[row][col] = null;

        // 检查是否形成禁手（如果AI是黑棋）
        if (player === 'black' && this.isForbidden(row, col)) {
            score -= 10000;
        }

        // 中心位置加分
        const center = Math.floor(this.size / 2);
        const distance = Math.abs(row - center) + Math.abs(col - center);
        score += Math.max(0, 15 - distance);

        return score;
    }

    /**
     * 获取指定方向的棋型信息
     * @param {number} row - 起始行号
     * @param {number} col - 起始列号
     * @param {number} dr - 行方向增量
     * @param {number} dc - 列方向增量
     * @param {string} player - 玩家颜色
     * @returns {Object} 棋型信息
     */
    getLinePatternFor(row, col, dr, dc, player) {
        let stones = [1];
        let emptyBefore = 0;
        let emptyAfter = 0;

        let r = row - dr;
        let c = col - dc;
        while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
            stones.unshift(1);
            r -= dr;
            c -= dc;
        }
        if (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === null) {
            emptyBefore = 1;
        }

        r = row + dr;
        c = col + dc;
        while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
            stones.push(1);
            r += dr;
            c += dc;
        }
        if (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === null) {
            emptyAfter = 1;
        }

        return {
            length: stones.length,
            emptyBefore,
            emptyAfter
        };
    }

    /**
     * 评估棋型分数（中等难度）
     * @param {Object} pattern - 棋型信息
     * @returns {number} 棋型分数
     */
    evaluatePattern(pattern) {
        const { length, emptyBefore, emptyAfter } = pattern;
        const totalEmpty = emptyBefore + emptyAfter;

        if (length >= 5) return 100000;  // 五连
        if (length === 4 && totalEmpty === 2) return 10000;  // 活四
        if (length === 4 && totalEmpty === 1) return 5000;   // 冲四
        if (length === 3 && totalEmpty === 2) return 1000;   // 活三
        if (length === 3 && totalEmpty === 1) return 500;    // 眠三
        if (length === 2 && totalEmpty === 2) return 100;    // 活二
        if (length === 2 && totalEmpty === 1) return 50;     // 眠二
        if (length === 1 && totalEmpty === 2) return 10;     // 活一

        return 0;
    }

    /**
     * 评估棋型分数（困难难度）
     * @param {Object} pattern - 棋型信息
     * @returns {number} 棋型分数
     */
    evaluatePatternAdvanced(pattern) {
        const { length, emptyBefore, emptyAfter } = pattern;
        const totalEmpty = emptyBefore + emptyAfter;

        if (length >= 5) return 1000000;  // 五连
        if (length === 4 && totalEmpty === 2) return 100000;  // 活四
        if (length === 4 && totalEmpty === 1) return 50000;   // 冲四
        if (length === 3 && totalEmpty === 2) return 10000;   // 活三
        if (length === 3 && totalEmpty === 1) return 5000;    // 眠三
        if (length === 2 && totalEmpty === 2) return 1000;    // 活二
        if (length === 2 && totalEmpty === 1) return 500;     // 眠二
        if (length === 1 && totalEmpty === 2) return 100;     // 活一

        return 0;
    }
}

document.addEventListener('DOMContentLoaded', () => new Gomoku());
