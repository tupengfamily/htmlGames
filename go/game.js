class GoGame {
    constructor() {
        this.boardSize = 19;
        this.gameMode = 'pvp';
        this.aiPlayer = null;
        this.difficulty = 'medium';
        this.STORAGE_KEY = 'go_game_2048';

        this.resetState();
        this.setupEventListeners();
        this.updateDifficultyVisibility();

        this.tryRestoreGame();
    }

    resetState() {
        this.board = Array.from({ length: this.boardSize }, () =>
            Array(this.boardSize).fill(null)
        );
        this.currentPlayer = 'black';
        this.capturedByBlack = 0;
        this.capturedByWhite = 0;
        this.moveHistory = [];
        this.lastMovePos = null;
        this.consecutivePasses = 0;
        this.gameOver = false;
        this.koPoint = null;
        this.moveNumber = 0;
    }

    tryRestoreGame() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (!saved) {
            this.initBoard();
            return;
        }

        try {
            const data = JSON.parse(saved);
            if (!data.board || data.board.length !== this.boardSize) {
                this.initBoard();
                return;
            }

            this.board = data.board;
            this.currentPlayer = data.currentPlayer || 'black';
            this.capturedByBlack = data.capturedByBlack || 0;
            this.capturedByWhite = data.capturedByWhite || 0;
            this.moveHistory = data.moveHistory || [];
            this.lastMovePos = data.lastMovePos || null;
            this.consecutivePasses = data.consecutivePasses || 0;
            this.gameOver = data.gameOver || false;
            this.koPoint = data.koPoint || null;
            this.moveNumber = data.moveNumber || 0;
            this.gameMode = data.gameMode || 'pvp';
            this.aiPlayer = data.aiPlayer || null;
            this.difficulty = data.difficulty || 'medium';

            this.renderBoard();
            this.updateUI();
            this.updateModeButton();

            if (this.aiPlayer && this.currentPlayer === this.aiPlayer && !this.gameOver) {
                this.scheduleAIMove();
            }
        } catch {
            this.initBoard();
        }
    }

    saveGame() {
        const data = {
            board: this.board,
            currentPlayer: this.currentPlayer,
            capturedByBlack: this.capturedByBlack,
            capturedByWhite: this.capturedByWhite,
            moveHistory: this.moveHistory.slice(-20),
            lastMovePos: this.lastMovePos,
            consecutivePasses: this.consecutivePasses,
            gameOver: this.gameOver,
            koPoint: this.koPoint,
            moveNumber: this.moveNumber,
            gameMode: this.gameMode,
            aiPlayer: this.aiPlayer,
            difficulty: this.difficulty,
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }

    initBoard() {
        this.renderBoard();
        this.updateUI();
        this.updateModeButton();
    }

    setupEventListeners() {
        document.getElementById('pass-btn').addEventListener('click', () => this.pass());
        document.getElementById('resign-btn').addEventListener('click', () => this.resign());
        document.getElementById('new-game-btn').addEventListener('click', () => this.confirmNewGame());
        document.getElementById('rules-btn').addEventListener('click', () => this.showRules());
        document.getElementById('close-rules').addEventListener('click', () => this.hideRules());
        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.hideGameOverModal();
            this.startNewGame();
        });
        document.getElementById('confirm-yes').addEventListener('click', () => {
            this.hideConfirmModal();
            this.startNewGame();
        });
        document.getElementById('confirm-no').addEventListener('click', () => {
            this.hideConfirmModal();
        });
        document.getElementById('mode-btn').addEventListener('click', () => this.toggleMode());
        document.getElementById('difficulty-select').addEventListener('change', (e) => {
            this.difficulty = e.target.value;
            this.saveGame();
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideRules();
                this.hideGameOverModal();
                this.hideConfirmModal();
            }
        });
    }

    updateModeButton() {
        const btn = document.getElementById('mode-btn');
        if (this.gameMode === 'ai') {
            btn.textContent = '切换为: 人人对战';
            btn.classList.remove('mode-pvp');
            btn.classList.add('mode-ai');
        } else {
            btn.textContent = '切换为: 人机对战';
            btn.classList.remove('mode-ai');
            btn.classList.add('mode-pvp');
        }
        this.updateDifficultyVisibility();
    }

    updateDifficultyVisibility() {
        const select = document.getElementById('difficulty-select');
        if (this.gameMode === 'ai') {
            select.classList.remove('hidden');
            select.value = this.difficulty;
        } else {
            select.classList.add('hidden');
        }
    }

    toggleMode() {
        if (this.moveNumber > 0 && !this.gameOver) {
            if (!confirm('切换模式将开始新游戏，确定吗？')) return;
        }
        this.clearStorage();
        this.gameMode = this.gameMode === 'pvp' ? 'ai' : 'pvp';
        this.resetState();
        this.aiPlayer = this.gameMode === 'ai' ? 'white' : null;
        this.updateModeButton();
        this.renderBoard();
        this.updateUI();
        this.saveGame();
    }

    confirmNewGame() {
        if (this.moveNumber > 0 && !this.gameOver) {
            this.showConfirmModal();
        } else {
            this.startNewGame();
        }
    }

    startNewGame() {
        this.clearStorage();
        const savedMode = this.gameMode;
        const savedDifficulty = this.difficulty;
        this.resetState();
        this.gameMode = savedMode;
        this.difficulty = savedDifficulty;
        this.aiPlayer = savedMode === 'ai' ? 'white' : null;
        this.renderBoard();
        this.updateUI();
        this.updateModeButton();
        this.saveGame();
    }

    clearStorage() {
        localStorage.removeItem(this.STORAGE_KEY);
    }

    renderBoard() {
        const boardEl = document.getElementById('board');
        boardEl.innerHTML = '';

        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                const intersection = document.createElement('div');
                intersection.className = 'intersection';
                intersection.dataset.row = i;
                intersection.dataset.col = j;

                if (i === 0) intersection.classList.add('top-row');
                if (i === this.boardSize - 1) intersection.classList.add('bottom-row');
                if (j === 0) intersection.classList.add('left-col');
                if (j === this.boardSize - 1) intersection.classList.add('right-col');

                if (this.isStarPoint(i, j)) {
                    intersection.classList.add('star-point');
                    const starDot = document.createElement('div');
                    starDot.className = 'star-dot';
                    intersection.appendChild(starDot);
                }

                if (this.board[i][j]) {
                    const stone = this.createStoneElement(this.board[i][j], false);
                    intersection.appendChild(stone);
                }

                intersection.addEventListener('click', () => this.handleClick(i, j));
                boardEl.appendChild(intersection);
            }
        }
    }

    createStoneElement(color, animate) {
        const stone = document.createElement('div');
        stone.className = `stone ${color}`;
        if (animate) {
            stone.classList.add('placing');
        }
        return stone;
    }

    updateCell(row, col) {
        const boardEl = document.getElementById('board');
        const index = row * this.boardSize + col;
        const intersection = boardEl.children[index];
        if (!intersection) return;

        const existingStone = intersection.querySelector('.stone');
        const existingIndicator = intersection.querySelector('.last-move-indicator');

        if (existingStone) existingStone.remove();
        if (existingIndicator) existingIndicator.remove();

        if (this.board[row][col]) {
            const isNewMove = this.lastMovePos && this.lastMovePos.row === row && this.lastMovePos.col === col;
            const stone = this.createStoneElement(this.board[row][col], isNewMove);
            intersection.appendChild(stone);
        }

        if (this.lastMovePos && this.lastMovePos.row === row && this.lastMovePos.col === col) {
            const indicator = document.createElement('div');
            indicator.className = 'last-move-indicator';
            intersection.appendChild(indicator);
        }
    }

    clearLastMoveIndicator() {
        const boardEl = document.getElementById('board');
        const prevIndicator = boardEl.querySelector('.last-move-indicator');
        if (prevIndicator) prevIndicator.remove();
    }

    isStarPoint(row, col) {
        const starPoints = [
            [3, 3], [3, 9], [3, 15],
            [9, 3], [9, 9], [9, 15],
            [15, 3], [15, 9], [15, 15]
        ];
        return starPoints.some(([r, c]) => r === row && c === col);
    }

    handleClick(row, col) {
        if (this.gameOver) return;
        if (this.aiPlayer && this.currentPlayer === this.aiPlayer) return;
        if (this.board[row][col]) return;
        if (this.koPoint && this.koPoint.row === row && this.koPoint.col === col) {
            alert('打劫！不能在此处落子');
            return;
        }

        if (!this.isValidMove(row, col, this.currentPlayer)) {
            return;
        }

        this.placeStone(row, col, this.currentPlayer);
    }

    testMove(row, col, player) {
        this.board[row][col] = player;
        const opponent = player === 'black' ? 'white' : 'black';
        const captures = this.findCapturedStones(opponent);

        if (captures.length > 0) {
            captures.forEach(([r, c]) => { this.board[r][c] = null; });
            const liberties = this.getGroupLiberties(row, col);
            if (liberties < 1) {
                captures.forEach(([r, c]) => { this.board[r][c] = opponent; });
                this.board[row][col] = null;
                return { valid: false, captures: 0, liberties: 0 };
            }
            captures.forEach(([r, c]) => { this.board[r][c] = opponent; });
            this.board[row][col] = null;
            return { valid: true, captures: captures.length, liberties };
        }

        const liberties = this.getGroupLiberties(row, col);
        this.board[row][col] = null;
        return {
            valid: liberties > 0,
            captures: 0,
            liberties
        };
    }

    isValidMove(row, col, player) {
        const opponent = player === 'black' ? 'white' : 'black';
        this.board[row][col] = player;
        const capturedStones = this.findCapturedStones(opponent);

        if (capturedStones.length > 0) {
            this.board[row][col] = null;
            return true;
        }

        const liberties = this.getGroupLiberties(row, col);
        if (liberties > 0) {
            this.board[row][col] = null;
            return true;
        }

        this.board[row][col] = null;
        return false;
    }

    placeStone(row, col, player) {
        const opponent = player === 'black' ? 'white' : 'black';
        this.board[row][col] = player;
        this.moveNumber++;

        this.clearLastMoveIndicator();

        const capturedStones = this.findCapturedStones(opponent);
        let capturedCount = 0;

        if (capturedStones.length > 0) {
            capturedCount = capturedStones.length;
            capturedStones.forEach(([r, c]) => {
                this.board[r][c] = null;
            });

            if (capturedCount === 1) {
                const capturedPos = capturedStones[0];
                const tempKoPoint = { row: capturedPos[0], col: capturedPos[1] };

                this.board[row][col] = null;
                const surroundOpponent = this.findCapturedStones(player);
                this.board[row][col] = player;

                if (surroundOpponent.length === 1) {
                    const koStone = surroundOpponent[0];
                    const koStoneGroup = this.getGroup(koStone[0], koStone[1]);
                    const koStoneLiberties = this.countGroupLiberties(koStoneGroup);

                    if (koStoneLiberties === 1 && this.moveHistory.length > 0) {
                        const lastMove = this.moveHistory[this.moveHistory.length - 1];
                        if (lastMove.capturedCount === 1 &&
                            lastMove.row === koStone[0] &&
                            lastMove.col === koStone[1]) {
                            this.koPoint = tempKoPoint;
                        }
                    }
                }
            }
        }

        if (player === 'black') {
            this.capturedByBlack += capturedCount;
        } else {
            this.capturedByWhite += capturedCount;
        }

        this.moveHistory.push({
            row,
            col,
            player,
            capturedCount,
            koPoint: this.koPoint ? { ...this.koPoint } : null
        });

        this.lastMovePos = { row, col };
        this.consecutivePasses = 0;
        this.updateUI();

        if (capturedStones.length > 0) {
            capturedStones.forEach(([r, c]) => this.updateCell(r, c));
        }
        this.updateCell(row, col);

        this.saveGame();

        if (this.checkGameEnd()) {
            return;
        }

        this.currentPlayer = opponent;
        this.updateUI();
        this.saveGame();

        if (this.aiPlayer && this.currentPlayer === this.aiPlayer && !this.gameOver) {
            this.scheduleAIMove();
        }
    }

    findCapturedStones(player) {
        const captured = [];
        const visited = new Set();

        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board[i][j] === player && !visited.has(`${i},${j}`)) {
                    const group = this.getGroup(i, j);
                    group.forEach(([r, c]) => visited.add(`${r},${c}`));

                    if (this.countGroupLiberties(group) === 0) {
                        captured.push(...group);
                    }
                }
            }
        }

        return captured;
    }

    getGroup(row, col) {
        const player = this.board[row][col];
        if (!player) return [];

        const group = [];
        const visited = new Set();
        const stack = [[row, col]];

        while (stack.length > 0) {
            const [r, c] = stack.pop();
            const key = `${r},${c}`;

            if (visited.has(key)) continue;
            if (this.board[r][c] !== player) continue;

            visited.add(key);
            group.push([r, c]);

            const neighbors = this.getNeighbors(r, c);
            for (const [nr, nc] of neighbors) {
                if (!visited.has(`${nr},${nc}`)) {
                    stack.push([nr, nc]);
                }
            }
        }

        return group;
    }

    getNeighbors(row, col) {
        const neighbors = [];
        if (row > 0) neighbors.push([row - 1, col]);
        if (row < this.boardSize - 1) neighbors.push([row + 1, col]);
        if (col > 0) neighbors.push([row, col - 1]);
        if (col < this.boardSize - 1) neighbors.push([row, col + 1]);
        return neighbors;
    }

    countGroupLiberties(group) {
        const liberties = new Set();
        for (const [row, col] of group) {
            const neighbors = this.getNeighbors(row, col);
            for (const [nr, nc] of neighbors) {
                if (this.board[nr][nc] === null) {
                    liberties.add(`${nr},${nc}`);
                }
            }
        }
        return liberties.size;
    }

    getGroupLiberties(row, col) {
        const group = this.getGroup(row, col);
        return this.countGroupLiberties(group);
    }

    scheduleAIMove() {
        const delay = this.difficulty === 'hell' ? 500 : 300;
        setTimeout(() => {
            if (this.gameOver) return;
            if (this.currentPlayer !== this.aiPlayer) return;
            this.aiMove();
        }, delay);
    }

    aiMove() {
        const player = this.aiPlayer;
        const opponent = player === 'black' ? 'white' : 'black';

        const allMoves = [];
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board[i][j]) continue;
                if (this.koPoint && this.koPoint.row === i && this.koPoint.col === j) continue;
                const result = this.testMove(i, j, player);
                if (!result.valid) continue;
                allMoves.push({ row: i, col: j, captures: result.captures, liberties: result.liberties });
            }
        }

        if (allMoves.length === 0) {
            this.pass();
            return;
        }

        let pick;
        switch (this.difficulty) {
            case 'easy':
                pick = this.aiEasy(allMoves, player, opponent);
                break;
            case 'hard':
                pick = this.aiHard(allMoves, player, opponent);
                break;
            case 'hell':
                pick = this.aiHell(allMoves, player, opponent);
                break;
            default:
                pick = this.aiMedium(allMoves, player, opponent);
                break;
        }

        this.placeStone(pick.row, pick.col, player);
    }

    aiEasy(moves, player, opponent) {
        const captureMoves = moves.filter(m => m.captures > 0);
        if (captureMoves.length > 0 && Math.random() < 0.5) {
            return captureMoves[Math.floor(Math.random() * captureMoves.length)];
        }
        if (Math.random() < 0.3 && moves.length > 3) {
            const scored = this.scoreMoves(moves, player, opponent, 0.2);
            scored.sort((a, b) => b.score - a.score);
            const top = scored.filter(c => c.score >= scored[0].score - 15);
            return top[Math.floor(Math.random() * top.length)];
        }
        return moves[Math.floor(Math.random() * moves.length)];
    }

    aiMedium(moves, player, opponent) {
        const scored = this.scoreMoves(moves, player, opponent, 1);
        scored.sort((a, b) => b.score - a.score);
        const topScore = scored[0].score;
        const top = scored.filter(c => c.score >= topScore - 10);
        return top[Math.floor(Math.random() * top.length)];
    }

    aiHard(moves, player, opponent) {
        const scored = this.scoreMoves(moves, player, opponent, 1.5);

        for (const m of scored) {
            const oppNearby = this.countNearbyOpponent(m.row, m.col, opponent);
            if (this.moveNumber > 30 && oppNearby === 0 && m.captures === 0) {
                m.score -= 30;
            }
            const center = Math.abs(m.row - 9) + Math.abs(m.col - 9);
            if (this.moveNumber < 8) {
                m.score += (18 - center) * 0.8;
            }
            const libs = m.liberties || 3;
            if (libs === 1) {
                m.score -= 25;
            }
            if (m.captures >= 3) {
                m.score += 30;
            }
        }

        scored.sort((a, b) => b.score - a.score);
        const topScore = scored[0].score;
        const top = scored.filter(c => c.score >= topScore - 8);
        return top[Math.floor(Math.random() * top.length)];
    }

    aiHell(moves, player, opponent) {
        const scored = this.scoreMoves(moves, player, opponent, 2);

        for (const m of scored) {
            const oppNearby = this.countNearbyOpponent(m.row, m.col, opponent);
            if (this.moveNumber > 20 && oppNearby === 0 && m.captures === 0) {
                m.score -= 40;
            }
            const center = Math.abs(m.row - 9) + Math.abs(m.col - 9);
            if (this.moveNumber < 12) {
                m.score += (18 - center) * 1.2;
            }

            const oppScore = this.evaluateOpponentResponse(m.row, m.col, player, opponent);
            m.score -= oppScore * 15;
        }

        scored.sort((a, b) => b.score - a.score);
        const topScore = scored[0].score;
        const top = scored.filter(c => c.score >= topScore - 5);
        return top[Math.floor(Math.random() * top.length)];
    }

    scoreMoves(moves, player, opponent, scale) {
        return moves.map(m => {
            let score = 0;

            if (m.captures > 0) {
                score += m.captures * 100 * scale;
            }

            const group = this.getGroupAfterTest(m.row, m.col, player);
            const libs = this.countGroupLiberties(group);

            if (libs === 1) {
                score -= 50 * scale;
            } else if (libs === 2) {
                score -= 10 * scale;
            } else {
                score += libs * 3 * scale;
            }

            const neighbors = this.getNeighbors(m.row, m.col);
            for (const [nr, nc] of neighbors) {
                if (this.board[nr][nc] === opponent) {
                    const oppGroup = this.getGroup(nr, nc);
                    const oppLibs = this.countGroupLiberties(oppGroup);
                    if (oppLibs === 1) {
                        score += 80 * scale;
                    } else if (oppLibs === 2) {
                        score += 25 * scale;
                    } else {
                        score += 4 * scale;
                    }
                }
                if (this.board[nr][nc] === player) {
                    score += 8 * scale;
                }
            }

            const centerDist = Math.abs(m.row - 9) + Math.abs(m.col - 9);
            if (this.moveNumber < 10) {
                score += (18 - centerDist) * scale;
            }

            return { row: m.row, col: m.col, score: Math.round(score), captures: m.captures, liberties: libs };
        });
    }

    evaluateOpponentResponse(row, col, player, opponent) {
        this.board[row][col] = player;
        const capturedByUs = this.findCapturedStones(opponent);

        if (capturedByUs.length > 0) {
            capturedByUs.forEach(([r, c]) => { this.board[r][c] = null; });
        }

        let maxOppScore = 0;
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board[i][j]) continue;
                if (this.koPoint && this.koPoint.row === i && this.koPoint.col === j) continue;
                const result = this.testMove(i, j, opponent);
                if (!result.valid) continue;
                if (result.captures > maxOppScore) maxOppScore = result.captures;
            }
        }

        if (capturedByUs.length > 0) {
            capturedByUs.forEach(([r, c]) => { this.board[r][c] = opponent; });
        }
        this.board[row][col] = null;
        return maxOppScore;
    }

    countNearbyOpponent(row, col, opponent) {
        let count = 0;
        const checked = new Set();
        const queue = [[row, col]];
        checked.add(`${row},${col}`);

        while (queue.length > 0) {
            const [r, c] = queue.shift();
            for (const [nr, nc] of this.getNeighbors(r, c)) {
                if (checked.has(`${nr},${nc}`)) continue;
                if (this.board[nr][nc] === opponent) {
                    count++;
                    checked.add(`${nr},${nc}`);
                } else if (this.board[nr][nc] === null) {
                    checked.add(`${nr},${nc}`);
                    if (checked.size < 15) {
                        queue.push([nr, nc]);
                    }
                }
            }
        }
        return count;
    }

    getGroupAfterTest(row, col, player) {
        this.board[row][col] = player;
        const group = this.getGroup(row, col);
        this.board[row][col] = null;
        return group;
    }

    pass() {
        if (this.gameOver) return;

        this.consecutivePasses++;
        this.lastMovePos = null;
        this.koPoint = null;
        this.moveHistory.push({ pass: true, player: this.currentPlayer });

        if (this.consecutivePasses >= 2) {
            this.endGame();
            return;
        }

        this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        this.updateUI();
        this.clearLastMoveIndicator();
        this.saveGame();

        if (this.aiPlayer && this.currentPlayer === this.aiPlayer && !this.gameOver) {
            this.scheduleAIMove();
        }
    }

    resign() {
        if (this.gameOver) return;

        const winner = this.currentPlayer === 'black' ? '白方' : '黑方';
        this.gameOver = true;
        this.clearStorage();
        document.getElementById('game-result').innerHTML =
            `<span class="winner-name">${winner}</span> 获胜！<br>对方认输`;
        this.showGameOverModal();
    }

    checkGameEnd() {
        if (this.consecutivePasses >= 2) {
            this.endGame();
            return true;
        }
        return false;
    }

    endGame() {
        this.gameOver = true;
        this.clearStorage();
        const result = this.calculateScore();
        document.getElementById('game-result').innerHTML = result;
        this.showGameOverModal();
    }

    calculateScore() {
        let blackTerritory = 0;
        let whiteTerritory = 0;
        let blackStones = 0;
        let whiteStones = 0;

        const visited = new Set();

        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (visited.has(`${i},${j}`)) continue;

                const cell = this.board[i][j];

                if (cell === 'black') {
                    blackStones++;
                    visited.add(`${i},${j}`);
                } else if (cell === 'white') {
                    whiteStones++;
                    visited.add(`${i},${j}`);
                } else {
                    const territory = this.floodFillTerritory(i, j, visited);
                    if (territory.owner === 'black') {
                        blackTerritory += territory.size;
                    } else if (territory.owner === 'white') {
                        whiteTerritory += territory.size;
                    } else {
                        blackTerritory += Math.floor(territory.size / 2);
                        whiteTerritory += Math.ceil(territory.size / 2);
                    }
                }
            }
        }

        const komi = 6.5;
        const blackScore = blackTerritory + blackStones;
        const whiteScore = whiteTerritory + whiteStones + komi;

        const blackFinal = blackScore - komi;
        const whiteFinal = whiteScore;

        let resultHtml = `<strong>黑方:</strong> 地 + 子 = ${blackTerritory} + ${blackStones} = <strong>${blackScore}</strong><br>`;
        resultHtml += `<strong>白方:</strong> 地 + 子 + 贴目 = ${whiteTerritory} + ${whiteStones} + ${komi} = <strong>${whiteScore}</strong><br><br>`;

        if (blackFinal > whiteFinal) {
            resultHtml += `<span class="winner-name">黑方</span> 胜 ${(blackFinal - whiteFinal).toFixed(1)} 目`;
        } else {
            resultHtml += `<span class="winner-name">白方</span> 胜 ${(whiteFinal - blackFinal).toFixed(1)} 目`;
        }

        return resultHtml;
    }

    floodFillTerritory(startRow, startCol, visited) {
        const territory = [];
        const stack = [[startRow, startCol]];
        let touchesBlack = false;
        let touchesWhite = false;

        while (stack.length > 0) {
            const [row, col] = stack.pop();
            const key = `${row},${col}`;

            if (visited.has(key)) continue;

            const cell = this.board[row][col];
            if (cell === 'black') {
                touchesBlack = true;
                continue;
            }
            if (cell === 'white') {
                touchesWhite = true;
                continue;
            }

            visited.add(key);
            territory.push([row, col]);

            const neighbors = this.getNeighbors(row, col);
            for (const [nr, nc] of neighbors) {
                if (!visited.has(`${nr},${nc}`)) {
                    stack.push([nr, nc]);
                }
            }
        }

        let owner = null;
        if (touchesBlack && !touchesWhite) owner = 'black';
        else if (touchesWhite && !touchesBlack) owner = 'white';

        return { size: territory.length, owner };
    }

    updateUI() {
        const playerEl = document.getElementById('current-player');
        const aiTurn = this.gameMode === 'ai' && this.currentPlayer === this.aiPlayer;
        const colorName = this.currentPlayer === 'black' ? '黑方' : '白方';
        playerEl.textContent = aiTurn ? `${colorName}回合 (AI思考中...)` : `${colorName}回合`;
        playerEl.className = this.currentPlayer === 'black' ? 'black-turn' : 'white-turn';

        const capturedEl = document.getElementById('captured-stones');
        capturedEl.textContent = `黑方提子: ${this.capturedByBlack} | 白方提子: ${this.capturedByWhite}`;

        const isAIThinking = aiTurn && !this.gameOver;
        document.getElementById('pass-btn').disabled = isAIThinking;
        document.getElementById('resign-btn').disabled = isAIThinking;
    }

    showRules() {
        document.getElementById('rules-modal').classList.add('show');
    }

    hideRules() {
        document.getElementById('rules-modal').classList.remove('show');
    }

    showGameOverModal() {
        document.getElementById('game-over-modal').classList.add('show');
    }

    hideGameOverModal() {
        document.getElementById('game-over-modal').classList.remove('show');
    }

    showConfirmModal() {
        document.getElementById('confirm-modal').classList.add('show');
    }

    hideConfirmModal() {
        document.getElementById('confirm-modal').classList.remove('show');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GoGame();
});