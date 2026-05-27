class ChineseChess {
    constructor() {
        this.ROWS = 10;
        this.COLS = 9;
        this.board = [];
        this.currentPlayer = 'red';
        this.gameOver = false;
        this.winner = null;
        this.selectedPiece = null;
        this.validMoves = [];
        this.moveHistory = [];
        this.startTime = Date.now();
        this.gameMode = 'pvp';
        this.aiSide = 'black';
        this.isAIThinking = false;

        this.canvas = document.getElementById('board-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.initGame();
        this.setupEventListeners();
    }

    initGame() {
        const savedState = localStorage.getItem('chessGameState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                this.board = state.board;
                this.currentPlayer = state.currentPlayer;
                this.gameOver = state.gameOver;
                this.winner = state.winner;
                this.moveHistory = state.moveHistory;
                this.startTime = state.startTime;
                this.gameMode = state.gameMode || 'pvp';
                this.aiSide = state.aiSide || 'black';
                this.isAIThinking = false;
                this.restoreModeUI();
            } catch (e) {
                console.error('Failed to restore game:', e);
                this.resetGame();
            }
        } else {
            this.resetGame();
        }

        this.selectedPiece = null;
        this.validMoves = [];
        this.resizeCanvas();
        this.render();
        this.updateStatus();

        if (this.isAITurn()) {
            setTimeout(() => this.aiMove(), 400);
        }
    }

    restoreModeUI() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === this.gameMode);
        });
        const aiSelector = document.getElementById('ai-side-selector');
        aiSelector.style.display = this.gameMode === 'pve' ? 'flex' : 'none';
        document.querySelectorAll('.side-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.side === this.aiSide);
        });
    }

    resetGame() {
        this.board = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
        this.currentPlayer = 'red';
        this.gameOver = false;
        this.winner = null;
        this.selectedPiece = null;
        this.validMoves = [];
        this.moveHistory = [];
        this.startTime = Date.now();
        this.isAIThinking = false;
        this.setupInitialBoard();
    }

    setupInitialBoard() {
        const setup = (row, side) => {
            this.board[row][0] = { type: 'rook', side };
            this.board[row][1] = { type: 'horse', side };
            this.board[row][2] = { type: 'elephant', side };
            this.board[row][3] = { type: 'advisor', side };
            this.board[row][4] = { type: 'king', side };
            this.board[row][5] = { type: 'advisor', side };
            this.board[row][6] = { type: 'elephant', side };
            this.board[row][7] = { type: 'horse', side };
            this.board[row][8] = { type: 'rook', side };
        };

        setup(0, 'black');
        this.board[2][1] = { type: 'cannon', side: 'black' };
        this.board[2][7] = { type: 'cannon', side: 'black' };
        for (let c = 0; c < 9; c += 2) {
            this.board[3][c] = { type: 'pawn', side: 'black' };
        }

        setup(9, 'red');
        this.board[7][1] = { type: 'cannon', side: 'red' };
        this.board[7][7] = { type: 'cannon', side: 'red' };
        for (let c = 0; c < 9; c += 2) {
            this.board[6][c] = { type: 'pawn', side: 'red' };
        }
    }

    saveGameState() {
        const state = {
            board: this.board,
            currentPlayer: this.currentPlayer,
            gameOver: this.gameOver,
            winner: this.winner,
            moveHistory: this.moveHistory.slice(-200),
            startTime: this.startTime,
            gameMode: this.gameMode,
            aiSide: this.aiSide
        };
        localStorage.setItem('chessGameState', JSON.stringify(state));
    }

    clearGameState() {
        localStorage.removeItem('chessGameState');
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));

        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.render();
        });

        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('rules-btn').addEventListener('click', () => this.showRules());
        document.getElementById('history-btn').addEventListener('click', () => this.showHistory());

        document.getElementById('close-rules').addEventListener('click', () => this.hideRules());
        document.getElementById('rules-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.hideRules();
        });

        document.getElementById('close-history').addEventListener('click', () => this.hideHistory());
        document.getElementById('history-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.hideHistory();
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectMode(btn.dataset.mode));
        });

        document.querySelectorAll('.side-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectAISide(btn.dataset.side));
        });
    }

    resizeCanvas() {
        const container = document.querySelector('.board-container');
        const maxW = Math.min(window.innerWidth - 20, 680);
        const maxH = Math.min(window.innerHeight * 0.78, 820);

        const padding = 42;
        const cellW = (maxW - padding * 2) / 8;
        const cellH = (maxH - padding * 2) / 9;
        const cellSize = Math.floor(Math.min(cellW, cellH));

        this.cellSize = Math.max(cellSize, 36);
        this.padding = padding;
        this.canvas.width = this.cellSize * 8 + this.padding * 2;
        this.canvas.height = this.cellSize * 9 + this.padding * 2;
        this.canvas.style.width = (this.cellSize * 8 + this.padding * 2) + 'px';
        this.canvas.style.height = (this.cellSize * 9 + this.padding * 2) + 'px';
    }

    boardX(col) { return this.padding + col * this.cellSize; }
    boardY(row) { return this.padding + row * this.cellSize; }

    handleClick(e) {
        if (this.gameOver || this.isAIThinking) return;
        if (this.isAITurn()) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const col = Math.round((x - this.padding) / this.cellSize);
        const row = Math.round((y - this.padding) / this.cellSize);

        if (col < 0 || col > 8 || row < 0 || row > 9) return;

        const distX = Math.abs(x - this.boardX(col));
        const distY = Math.abs(y - this.boardY(row));
        if (distX > this.cellSize * 0.45 || distY > this.cellSize * 0.45) return;

        this.processClick(row, col);
    }

    processClick(row, col) {
        const piece = this.board[row][col];

        if (this.selectedPiece) {
            if (this.board[row][col] && this.board[row][col].side === this.currentPlayer) {
                this.selectedPiece = { row, col };
                this.validMoves = this.getValidMoves(row, col);
                this.render();
                return;
            }

            const isMove = this.validMoves.some(m => m.row === row && m.col === col);
            if (isMove) {
                this.makeMove(this.selectedPiece.row, this.selectedPiece.col, row, col);
                return;
            }

            this.selectedPiece = null;
            this.validMoves = [];
            this.render();
            return;
        }

        if (piece && piece.side === this.currentPlayer) {
            this.selectedPiece = { row, col };
            this.validMoves = this.getValidMoves(row, col);
            this.render();
        }
    }

    isWithinBoard(row, col) {
        return row >= 0 && row < this.ROWS && col >= 0 && col < this.COLS;
    }

    isInPalace(row, col, side) {
        if (side === 'black') return row >= 0 && row <= 2 && col >= 3 && col <= 5;
        return row >= 7 && row <= 9 && col >= 3 && col <= 5;
    }

    getValidMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];

        let moves = [];

        switch (piece.type) {
            case 'king': moves = this.getKingMoves(row, col, piece.side); break;
            case 'advisor': moves = this.getAdvisorMoves(row, col, piece.side); break;
            case 'elephant': moves = this.getElephantMoves(row, col, piece.side); break;
            case 'horse': moves = this.getHorseMoves(row, col, piece.side); break;
            case 'rook': moves = this.getRookMoves(row, col, piece.side); break;
            case 'cannon': moves = this.getCannonMoves(row, col, piece.side); break;
            case 'pawn': moves = this.getPawnMoves(row, col, piece.side); break;
        }

        return moves.filter(m => {
            const captured = this.board[m.row][m.col];
            this.board[m.row][m.col] = this.board[row][col];
            this.board[row][col] = null;
            const inCheck = this.isKingInCheck(piece.side);
            this.board[row][col] = this.board[m.row][m.col];
            this.board[m.row][m.col] = captured;
            return !inCheck;
        });
    }

    getKingMoves(row, col, side) {
        const moves = [];
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dr, dc] of dirs) {
            const nr = row + dr;
            const nc = col + dc;
            if (this.isInPalace(nr, nc, side)) {
                const target = this.board[nr][nc];
                if (!target || target.side !== side) {
                    moves.push({ row: nr, col: nc });
                }
            }
        }
        return moves;
    }

    getAdvisorMoves(row, col, side) {
        const moves = [];
        const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dr, dc] of dirs) {
            const nr = row + dr;
            const nc = col + dc;
            if (this.isInPalace(nr, nc, side)) {
                const target = this.board[nr][nc];
                if (!target || target.side !== side) {
                    moves.push({ row: nr, col: nc });
                }
            }
        }
        return moves;
    }

    getElephantMoves(row, col, side) {
        const moves = [];
        const dirs = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
        const blocks = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

        for (let i = 0; i < dirs.length; i++) {
            const [dr, dc] = dirs[i];
            const [br, bc] = blocks[i];
            const nr = row + dr;
            const nc = col + dc;
            const blockR = row + br;
            const blockC = col + bc;

            if (this.isWithinBoard(nr, nc)) {
                if (side === 'black' && nr > 4) continue;
                if (side === 'red' && nr < 5) continue;
                if (this.board[blockR][blockC]) continue;
                const target = this.board[nr][nc];
                if (!target || target.side !== side) {
                    moves.push({ row: nr, col: nc });
                }
            }
        }
        return moves;
    }

    getHorseMoves(row, col, side) {
        const moves = [];
        const horseJumps = [
            { dr: -2, dc: -1, br: -1, bc: 0 },
            { dr: -2, dc: 1, br: -1, bc: 0 },
            { dr: 2, dc: -1, br: 1, bc: 0 },
            { dr: 2, dc: 1, br: 1, bc: 0 },
            { dr: -1, dc: -2, br: 0, bc: -1 },
            { dr: -1, dc: 2, br: 0, bc: 1 },
            { dr: 1, dc: -2, br: 0, bc: -1 },
            { dr: 1, dc: 2, br: 0, bc: 1 },
        ];

        for (const j of horseJumps) {
            const nr = row + j.dr;
            const nc = col + j.dc;
            const br = row + j.br;
            const bc = col + j.bc;

            if (this.isWithinBoard(nr, nc) && !this.board[br][bc]) {
                const target = this.board[nr][nc];
                if (!target || target.side !== side) {
                    moves.push({ row: nr, col: nc });
                }
            }
        }
        return moves;
    }

    getRookMoves(row, col, side) {
        return this.getSlidingMoves(row, col, side, [[0, 1], [0, -1], [1, 0], [-1, 0]]);
    }

    getSlidingMoves(row, col, side, dirs) {
        const moves = [];
        for (const [dr, dc] of dirs) {
            let r = row + dr;
            let c = col + dc;
            while (this.isWithinBoard(r, c)) {
                if (this.board[r][c]) {
                    if (this.board[r][c].side !== side) {
                        moves.push({ row: r, col: c });
                    }
                    break;
                }
                moves.push({ row: r, col: c });
                r += dr;
                c += dc;
            }
        }
        return moves;
    }

    getCannonMoves(row, col, side) {
        const moves = [];
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        for (const [dr, dc] of dirs) {
            let r = row + dr;
            let c = col + dc;
            while (this.isWithinBoard(r, c)) {
                if (!this.board[r][c]) {
                    moves.push({ row: r, col: c });
                } else {
                    break;
                }
                r += dr;
                c += dc;
            }

            r += dr;
            c += dc;
            while (this.isWithinBoard(r, c)) {
                if (this.board[r][c]) {
                    if (this.board[r][c].side !== side) {
                        moves.push({ row: r, col: c });
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }
        return moves;
    }

    getPawnMoves(row, col, side) {
        const moves = [];
        const forward = side === 'red' ? -1 : 1;
        const crossed = side === 'red' ? row <= 4 : row >= 5;

        const nr = row + forward;
        if (this.isWithinBoard(nr, col)) {
            const target = this.board[nr][col];
            if (!target || target.side !== side) {
                moves.push({ row: nr, col: col });
            }
        }

        if (crossed) {
            for (const dc of [-1, 1]) {
                const nc = col + dc;
                if (this.isWithinBoard(row, nc)) {
                    const target = this.board[row][nc];
                    if (!target || target.side !== side) {
                        moves.push({ row: row, col: nc });
                    }
                }
            }
        }
        return moves;
    }

    findKing(side) {
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const p = this.board[r][c];
                if (p && p.type === 'king' && p.side === side) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }

    kingsFacing() {
        const redKing = this.findKing('red');
        const blackKing = this.findKing('black');
        if (!redKing || !blackKing) return false;
        if (redKing.col !== blackKing.col) return false;

        const minRow = Math.min(redKing.row, blackKing.row);
        const maxRow = Math.max(redKing.row, blackKing.row);
        for (let r = minRow + 1; r < maxRow; r++) {
            if (this.board[r][redKing.col]) return false;
        }
        return true;
    }

    isKingInCheck(side) {
        if (this.kingsFacing()) return true;

        const king = this.findKing(side);
        if (!king) return true;

        const opponent = side === 'red' ? 'black' : 'red';
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const p = this.board[r][c];
                if (p && p.side === opponent) {
                    const rawMoves = this.getRawMoves(r, c, p);
                    for (const m of rawMoves) {
                        if (m.row === king.row && m.col === king.col) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    getRawMoves(row, col, piece) {
        switch (piece.type) {
            case 'king': return this.getKingMoves(row, col, piece.side);
            case 'advisor': return this.getAdvisorMoves(row, col, piece.side);
            case 'elephant': return this.getElephantMoves(row, col, piece.side);
            case 'horse': return this.getHorseMoves(row, col, piece.side);
            case 'rook': return this.getRookMoves(row, col, piece.side);
            case 'cannon': return this.getCannonMoves(row, col, piece.side);
            case 'pawn': return this.getPawnMoves(row, col, piece.side);
            default: return [];
        }
    }

    hasAnyValidMove(side) {
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const p = this.board[r][c];
                if (p && p.side === side) {
                    if (this.getValidMoves(r, c).length > 0) return true;
                }
            }
        }
        return false;
    }

    isCheckmate(side) {
        return this.isKingInCheck(side) && !this.hasAnyValidMove(side);
    }

    isStalemate(side) {
        return !this.isKingInCheck(side) && !this.hasAnyValidMove(side);
    }

    makeMove(fromRow, fromCol, toRow, toCol, saveRecord = true) {
        const piece = this.board[fromRow][fromCol];
        const captured = this.board[toRow][toCol];

        if (saveRecord) {
            this.moveHistory.push({
                fromRow, fromCol, toRow, toCol,
                piece: { type: piece.type, side: piece.side },
                captured: captured ? { type: captured.type, side: captured.side } : null,
                currentPlayer: this.currentPlayer,
                gameOver: this.gameOver,
                winner: this.winner
            });
        }

        this.board[toRow][toCol] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = null;

        const opponent = this.currentPlayer === 'red' ? 'black' : 'red';

        let isCheck = false;

        if (this.isCheckmate(opponent)) {
            this.gameOver = true;
            this.winner = this.currentPlayer;
        } else if (this.isStalemate(opponent)) {
            this.gameOver = true;
            this.winner = this.currentPlayer;
        } else if (this.isKingInCheck(opponent)) {
            isCheck = true;
        }

        if (saveRecord && this.gameOver) {
            this.saveGameRecord();
        }

        this.currentPlayer = opponent;
        this.selectedPiece = null;
        this.validMoves = [];
        this.saveGameState();
        this.render();
        this.updateStatus();

        if (this.gameOver) {
            const winName = this.winner === 'red' ? '红方' : '黑方';
            setTimeout(() => this.showToast(`${winName}胜！`), 100);
        } else {
            if (isCheck) {
                setTimeout(() => this.showToast('将军！'), 100);
            }
            if (this.isAITurn() && saveRecord) {
                setTimeout(() => this.aiMove(), 150);
            }
        }
    }

    undo() {
        if (this.moveHistory.length === 0 || this.isAIThinking) return;

        if (this.gameMode === 'pve' && this.moveHistory.length >= 2) {
            for (let i = 0; i < 2 && this.moveHistory.length > 0; i++) {
                const last = this.moveHistory.pop();
                this.board[last.fromRow][last.fromCol] = { type: last.piece.type, side: last.piece.side };
                this.board[last.toRow][last.toCol] = last.captured ? { type: last.captured.type, side: last.captured.side } : null;
                this.currentPlayer = last.currentPlayer;
                this.gameOver = last.gameOver;
                this.winner = last.winner;
            }
        } else {
            const last = this.moveHistory.pop();
            this.board[last.fromRow][last.fromCol] = { type: last.piece.type, side: last.piece.side };
            this.board[last.toRow][last.toCol] = last.captured ? { type: last.captured.type, side: last.captured.side } : null;
            this.currentPlayer = last.currentPlayer;
            this.gameOver = last.gameOver;
            this.winner = last.winner;
        }

        this.selectedPiece = null;
        this.validMoves = [];
        this.saveGameState();
        this.render();
        this.updateStatus();
    }

    newGame() {
        if (this.moveHistory.length > 0 && !this.gameOver) {
            if (!confirm('确定要开始新游戏吗？当前对局将被记录。')) return;
            this.saveGameRecord();
        }
        this.clearGameState();
        this.resetGame();
        this.resizeCanvas();
        this.render();
        this.updateStatus();

        if (this.isAITurn()) {
            setTimeout(() => this.aiMove(), 400);
        }
    }

    selectMode(mode) {
        this.gameMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        document.getElementById('ai-side-selector').style.display = mode === 'pve' ? 'flex' : 'none';
        this.newGame();
    }

    selectAISide(side) {
        this.aiSide = side;
        document.querySelectorAll('.side-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.side === side);
        });
        this.newGame();
    }

    isAITurn() {
        return this.gameMode === 'pve' && this.currentPlayer === this.aiSide && !this.gameOver;
    }

    async aiMove() {
        if (this.isAIThinking || this.gameOver) return;
        this.isAIThinking = true;
        this.updateStatus();
        this.render();

        await new Promise(r => setTimeout(r, 200));

        if (!this.isAIThinking || this.gameOver) return;

        let isCheck = false;
        const move = this.findBestMove(3);
        if (move) {
            const piece = this.board[move.fromRow][move.fromCol];
            const captured = this.board[move.toRow][move.toCol];
            this.moveHistory.push({
                fromRow: move.fromRow, fromCol: move.fromCol,
                toRow: move.toRow, toCol: move.toCol,
                piece: { type: piece.type, side: piece.side },
                captured: captured ? { type: captured.type, side: captured.side } : null,
                currentPlayer: this.currentPlayer,
                gameOver: this.gameOver,
                winner: this.winner
            });

            this.board[move.toRow][move.toCol] = this.board[move.fromRow][move.fromCol];
            this.board[move.fromRow][move.fromCol] = null;

            const opponent = this.currentPlayer === 'red' ? 'black' : 'red';
            if (this.isCheckmate(opponent)) {
                this.gameOver = true;
                this.winner = this.currentPlayer;
            } else if (this.isStalemate(opponent)) {
                this.gameOver = true;
                this.winner = this.currentPlayer;
            } else if (this.isKingInCheck(opponent)) {
                isCheck = true;
            }

            if (this.gameOver) {
                this.saveGameRecord();
            }

            this.currentPlayer = opponent;
        }

        this.isAIThinking = false;
        this.selectedPiece = null;
        this.validMoves = [];
        this.saveGameState();
        this.render();
        this.updateStatus();

        if (this.gameOver) {
            const winName = this.winner === 'red' ? '红方' : '黑方';
            setTimeout(() => this.showToast(`${winName}胜！`), 100);
        } else if (isCheck) {
            setTimeout(() => this.showToast('将军！'), 100);
        }
    }

    findBestMove(depth) {
        const side = this.currentPlayer;
        const moves = this.getAllMoves(side);
        if (moves.length === 0) return null;

        this.orderMoves(moves, side);

        let bestMove = moves[0];
        let bestScore = -Infinity;
        const alpha = -Infinity;
        const beta = Infinity;

        for (const move of moves) {
            const piece = this.board[move.fromRow][move.fromCol];
            const captured = this.board[move.toRow][move.toCol];

            this.board[move.toRow][move.toCol] = this.board[move.fromRow][move.fromCol];
            this.board[move.fromRow][move.fromCol] = null;

            const score = this.minimax(depth - 1, alpha, beta, false, side);

            this.board[move.fromRow][move.fromCol] = this.board[move.toRow][move.toCol];
            this.board[move.toRow][move.toCol] = captured;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    minimax(depth, alpha, beta, maximizing, side) {
        const opponent = side === 'red' ? 'black' : 'red';
        const currentSide = maximizing ? side : opponent;

        if (depth === 0) {
            return this.evaluateBoard(side);
        }

        const moves = this.getAllMoves(currentSide);
        if (moves.length === 0) {
            const inCheck = this.isKingInCheck(currentSide);
            if (maximizing) {
                return inCheck ? (-99999 + (4 - depth)) : (-80000 + (4 - depth));
            } else {
                return inCheck ? (99999 - (4 - depth)) : (80000 - (4 - depth));
            }
        }

        this.orderMoves(moves, currentSide);

        if (maximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const piece = this.board[move.fromRow][move.fromCol];
                const captured = this.board[move.toRow][move.toCol];

                this.board[move.toRow][move.toCol] = this.board[move.fromRow][move.fromCol];
                this.board[move.fromRow][move.fromCol] = null;

                const evalScore = this.minimax(depth - 1, alpha, beta, false, side);

                this.board[move.fromRow][move.fromCol] = this.board[move.toRow][move.toCol];
                this.board[move.toRow][move.toCol] = captured;

                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const piece = this.board[move.fromRow][move.fromCol];
                const captured = this.board[move.toRow][move.toCol];

                this.board[move.toRow][move.toCol] = this.board[move.fromRow][move.fromCol];
                this.board[move.fromRow][move.fromCol] = null;

                const evalScore = this.minimax(depth - 1, alpha, beta, true, side);

                this.board[move.fromRow][move.fromCol] = this.board[move.toRow][move.toCol];
                this.board[move.toRow][move.toCol] = captured;

                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    getAllMoves(side) {
        const moves = [];
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const p = this.board[r][c];
                if (p && p.side === side) {
                    const vm = this.getValidMoves(r, c);
                    for (const m of vm) {
                        moves.push({ fromRow: r, fromCol: c, toRow: m.row, toCol: m.col });
                    }
                }
            }
        }
        return moves;
    }

    orderMoves(moves, side) {
        const PIECE_VALUES = { king: 10000, rook: 900, cannon: 450, horse: 400, elephant: 200, advisor: 200, pawn: 100 };
        moves.forEach(m => {
            let score = 0;
            const captured = this.board[m.toRow][m.toCol];
            if (captured) {
                score += PIECE_VALUES[captured.type] || 100;
                score -= (PIECE_VALUES[this.board[m.fromRow][m.fromCol].type] || 100) * 0.5;
            }
            m._order = score;
        });
        moves.sort((a, b) => b._order - a._order);
    }

    evaluateBoard(side) {
        const PIECE_VALUES = { king: 10000, rook: 900, cannon: 450, horse: 400, elephant: 200, advisor: 200, pawn: 100 };

        let score = 0;
        const opponent = side === 'red' ? 'black' : 'red';

        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const p = this.board[r][c];
                if (!p) continue;

                let val = PIECE_VALUES[p.type] || 0;

                if (p.type === 'pawn') {
                    const crossed = p.side === 'red' ? r <= 4 : r >= 5;
                    val = crossed ? 200 : 100;
                    if (crossed) {
                        val += 10;
                    }
                    if (c === 0 || c === 8) val -= 15;
                    if (c === 4) val += 10;
                }

                if (p.side === side) {
                    score += val + this.getPositionBonus(p, r, c);
                } else {
                    score -= val + this.getPositionBonus(p, r, c);
                }
            }
        }

        if (this.isCheckmate(opponent)) score += 100000;
        if (this.isCheckmate(side)) score -= 100000;
        if (this.isKingInCheck(opponent)) score += 50;
        if (this.isKingInCheck(side)) score -= 50;

        return score;
    }

    getPositionBonus(piece, row, col) {
        let bonus = 0;

        if (piece.type === 'rook') {
            if (row === 0 || row === 9) bonus += 10;
            if (col === 0 || col === 8) bonus += 5;
            if (col >= 3 && col <= 5) bonus += 15;
            if ((piece.side === 'red' && row <= 5) || (piece.side === 'black' && row >= 4)) bonus += 20;
        }

        if (piece.type === 'horse') {
            if (col >= 2 && col <= 6 && row >= 2 && row <= 7) bonus += 15;
            if (col === 0 || col === 8) bonus -= 10;
            if (row === 0 || row === 9) bonus -= 5;
        }

        if (piece.type === 'cannon') {
            if (col >= 2 && col <= 6) bonus += 10;
            if (col === 4) bonus += 10;
        }

        if (piece.type === 'king') {
            if (col === 4 && (row === 0 || row === 9)) bonus += 5;
        }

        if (piece.type === 'pawn') {
            if (col === 0 || col === 8) bonus -= 5;
            if (col === 4) bonus += 5;
        }

        return bonus;
    }

    updateStatus() {
        const statusEl = document.getElementById('status');
        const redTag = document.getElementById('red-player');
        const blackTag = document.getElementById('black-player');

        redTag.classList.toggle('active-turn', this.currentPlayer === 'red');
        blackTag.classList.toggle('active-turn', this.currentPlayer === 'black');

        if (this.isAIThinking) {
            statusEl.textContent = 'AI思考中...';
            return;
        }

        if (this.gameOver) {
            const name = this.winner === 'red' ? '红方' : '黑方';
            statusEl.textContent = `${name}获胜`;
        } else {
            const name = this.currentPlayer === 'red' ? '红方' : '黑方';
            const aiMark = (this.gameMode === 'pve' && this.currentPlayer === this.aiSide) ? '(AI)' : '';
            statusEl.textContent = `${name}走棋${aiMark}`;
        }
    }

    showToast(msg) {
        const toast = document.getElementById('message-toast');
        toast.textContent = msg;
        toast.className = 'message-toast show';
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.className = 'message-toast hide';
        }, 2000);
    }

    showRules() {
        document.getElementById('rules-modal').classList.add('active');
    }

    hideRules() {
        document.getElementById('rules-modal').classList.remove('active');
    }

    showHistory() {
        const history = JSON.parse(localStorage.getItem('chessHistory') || '[]');
        const list = document.getElementById('history-list');

        if (history.length === 0) {
            list.innerHTML = '<p class="no-history">暂无历史记录</p>';
        } else {
            list.innerHTML = history.map((record, index) => {
                let resultText = '';
                let resultClass = '';
                if (record.result === 'red') {
                    resultText = '红方胜';
                    resultClass = 'red-win';
                } else if (record.result === 'black') {
                    resultText = '黑方胜';
                    resultClass = 'black-win';
                } else if (record.result === 'draw') {
                    resultText = '平局';
                    resultClass = 'draw';
                } else {
                    resultText = '未完成';
                    resultClass = 'interrupted';
                }

                const duration = record.duration
                    ? `${Math.floor(record.duration / 60)}分${record.duration % 60}秒`
                    : '未知';

                const modeText = record.gameMode === 'pve' ? '人机' : '双人';

                return `
                    <div class="history-item">
                        <span class="history-rank">#${index + 1}</span>
                        <div class="history-info">
                            <div class="history-date">${record.date} | ${modeText}</div>
                            <div class="history-result ${resultClass}">${resultText}</div>
                        </div>
                        <div class="history-details">
                            <div class="history-moves">${record.totalMoves}手</div>
                            <div class="history-duration">${duration}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        document.getElementById('history-modal').classList.add('active');
    }

    hideHistory() {
        document.getElementById('history-modal').classList.remove('active');
    }

    saveGameRecord() {
        const history = JSON.parse(localStorage.getItem('chessHistory') || '[]');
        const record = {
            id: Date.now(),
            date: new Date().toLocaleString('zh-CN'),
            result: this.gameOver ? (this.winner || 'draw') : 'interrupted',
            totalMoves: this.moveHistory.length,
            duration: Math.floor((Date.now() - this.startTime) / 1000),
            gameMode: this.gameMode
        };
        history.unshift(record);
        if (history.length > 20) history.pop();
        localStorage.setItem('chessHistory', JSON.stringify(history));
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cs = this.cellSize;
        const pad = this.padding;

        ctx.clearRect(0, 0, w, h);

        this.drawBoardBackground(ctx, w, h);

        this.drawGridLines(ctx, cs, pad);

        this.drawPalace(ctx, cs, pad);
        this.drawRiver(ctx, cs, pad);

        this.drawCoordinateLabels(ctx, cs, pad);

        this.drawHighlights(ctx, cs, pad);

        this.drawPieces(ctx, cs, pad);
    }

    drawBoardBackground(ctx, w, h) {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#e8c87a');
        grad.addColorStop(0.3, '#d4a55a');
        grad.addColorStop(0.7, '#c9983d');
        grad.addColorStop(1, '#b8862d');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(139, 105, 20, 0.08)';
        for (let i = 0; i < w; i += 30) {
            for (let j = 0; j < h; j += 30) {
                if ((i + j) % 60 === 0) {
                    ctx.fillRect(i, j, 30, 30);
                }
            }
        }
    }

    drawGridLines(ctx, cs, pad) {
        ctx.strokeStyle = '#3d2b1f';
        ctx.lineWidth = 1.2;
        ctx.beginPath();

        for (let c = 0; c <= 8; c++) {
            const x = pad + c * cs;
            if (c === 0 || c === 8) {
                ctx.moveTo(x, pad);
                ctx.lineTo(x, pad + 9 * cs);
            } else {
                ctx.moveTo(x, pad);
                ctx.lineTo(x, pad + 4 * cs);
                ctx.moveTo(x, pad + 5 * cs);
                ctx.lineTo(x, pad + 9 * cs);
            }
        }

        for (let r = 0; r <= 9; r++) {
            const y = pad + r * cs;
            ctx.moveTo(pad, y);
            ctx.lineTo(pad + 8 * cs, y);
        }

        ctx.stroke();

        ctx.strokeStyle = '#5a3d1f';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pad, pad);
        ctx.lineTo(pad + 8 * cs, pad);
        ctx.moveTo(pad, pad + 9 * cs);
        ctx.lineTo(pad + 8 * cs, pad + 9 * cs);
        ctx.stroke();
    }

    drawPalace(ctx, cs, pad) {
        ctx.strokeStyle = '#3d2b1f';
        ctx.lineWidth = 1;
        ctx.beginPath();

        ctx.moveTo(pad + 3 * cs, pad);
        ctx.lineTo(pad + 5 * cs, pad + 2 * cs);
        ctx.moveTo(pad + 5 * cs, pad);
        ctx.lineTo(pad + 3 * cs, pad + 2 * cs);

        ctx.moveTo(pad + 3 * cs, pad + 7 * cs);
        ctx.lineTo(pad + 5 * cs, pad + 9 * cs);
        ctx.moveTo(pad + 5 * cs, pad + 7 * cs);
        ctx.lineTo(pad + 3 * cs, pad + 9 * cs);

        ctx.stroke();
    }

    drawRiver(ctx, cs, pad) {
        ctx.fillStyle = '#3d2b1f';
        ctx.font = `bold ${cs * 0.45}px "Microsoft YaHei", "PingFang SC", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const riverY = pad + 4.5 * cs;

        ctx.fillText('楚  河', pad + 2 * cs, riverY);
        ctx.fillText('汉  界', pad + 6 * cs, riverY);
    }

    drawCoordinateLabels(ctx, cs, pad) {
        ctx.fillStyle = '#6b5b4a';
        ctx.font = `${cs * 0.28}px "Microsoft YaHei", "PingFang SC", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const nums = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        for (let c = 0; c < 9; c++) {
            ctx.fillText(nums[c], pad + c * cs, pad - cs * 0.45);
            ctx.fillText(nums[8 - c], pad + c * cs, pad + 9 * cs + cs * 0.45);
        }
    }

    drawHighlights(ctx, cs, pad) {
        const hlRadius = cs * 0.44;

        if (this.selectedPiece) {
            const sr = this.selectedPiece.row;
            const sc = this.selectedPiece.col;
            const sx = pad + sc * cs;
            const sy = pad + sr * cs;

            ctx.beginPath();
            ctx.arc(sx, sy, hlRadius + 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 215, 0, 0.45)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(200, 150, 0, 0.8)';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            for (const move of this.validMoves) {
                const mx = pad + move.col * cs;
                const my = pad + move.row * cs;

                if (this.board[move.row][move.col]) {
                    ctx.beginPath();
                    ctx.arc(mx, my, hlRadius + 1, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(220, 50, 50, 0.75)';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([5, 3]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                } else {
                    ctx.beginPath();
                    ctx.arc(mx, my, cs * 0.13, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(0, 150, 0, 0.6)';
                    ctx.fill();
                }
            }
        }

        if (this.moveHistory.length > 0) {
            const last = this.moveHistory[this.moveHistory.length - 1];
            const fromX = pad + last.fromCol * cs;
            const fromY = pad + last.fromRow * cs;
            const toX = pad + last.toCol * cs;
            const toY = pad + last.toRow * cs;

            [ { x: fromX, y: fromY }, { x: toX, y: toY } ].forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, cs * 0.12, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 215, 0, 0.55)';
                ctx.fill();
            });
        }
    }

    drawPieces(ctx, cs, pad) {
        const pieceRadius = cs * 0.43;

        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const piece = this.board[r][c];
                if (!piece) continue;

                const x = pad + c * cs;
                const y = pad + r * cs;

                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.4)';
                ctx.shadowBlur = 3;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                const bodyGrad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, pieceRadius);
                bodyGrad.addColorStop(0, '#faf0d7');
                bodyGrad.addColorStop(0.85, '#e8d5a0');
                bodyGrad.addColorStop(1, '#c4a460');
                ctx.fillStyle = bodyGrad;
                ctx.beginPath();
                ctx.arc(x, y, pieceRadius, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                ctx.strokeStyle = piece.side === 'red' ? '#c0392b' : '#1a1a2e';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, pieceRadius - 1, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = piece.side === 'red' ? '#c0392b' : '#1a1a2e';
                const fontSize = pieceRadius * 1.15;
                ctx.font = `bold ${fontSize}px "KaiTi", "STKaiti", "Microsoft YaHei", "PingFang SC", serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const charName = this.getPieceChar(piece.type, piece.side);
                ctx.fillText(charName, x, y + 1);

                ctx.restore();
            }
        }
    }

    getPieceChar(type, side) {
        const redChars = { king: '帅', advisor: '仕', elephant: '相', horse: '馬', rook: '車', cannon: '炮', pawn: '兵' };
        const blackChars = { king: '将', advisor: '士', elephant: '象', horse: '马', rook: '车', cannon: '砲', pawn: '卒' };
        return (side === 'red' ? redChars : blackChars)[type] || '?';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChineseChess();
});
