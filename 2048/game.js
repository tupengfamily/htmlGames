class Game2048 {
    constructor() {
        this.board = [];
        this.score = 0;
        this.bestScore = localStorage.getItem('bestScore') || 0;
        this.gameOver = false;
        this.won = false;
        this.size = 4;

        this.boardElement = document.getElementById('game-board');
        this.scoreElement = document.getElementById('score');
        this.bestScoreElement = document.getElementById('best-score');
        this.messageElement = document.getElementById('game-message');
        this.messageText = this.messageElement.querySelector('p');

        this.init();
        this.setupEventListeners();
    }

    init() {
        const savedState = localStorage.getItem('gameState');
        if (savedState) {
            const state = JSON.parse(savedState);
            this.board = state.board;
            this.score = state.score;
            this.gameOver = state.gameOver;
            this.won = state.won;
            if (this.gameOver) {
                this.showMessage('游戏结束！');
            } else if (this.won) {
                this.showMessage('你赢了！', true);
            }
        } else {
            this.board = Array.from({ length: this.size }, () => Array(this.size).fill(0));
            this.score = 0;
            this.gameOver = false;
            this.won = false;
            this.addRandomTile();
            this.addRandomTile();
        }
        this.messageElement.classList.remove('active', 'win');
        this.updateScore();
        this.render();
        this.saveState();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());
        document.getElementById('retry-btn').addEventListener('click', () => this.retry());
    }

    newGame() {
        localStorage.removeItem('gameState');
        this.board = Array.from({ length: this.size }, () => Array(this.size).fill(0));
        this.score = 0;
        this.gameOver = false;
        this.won = false;
        this.messageElement.classList.remove('active', 'win');
        this.addRandomTile();
        this.addRandomTile();
        this.updateScore();
        this.render();
        this.saveState();
    }

    retry() {
        this.messageElement.classList.remove('active', 'win');
        this.gameOver = false;
        this.saveState();
    }

    saveState() {
        const state = {
            board: this.board,
            score: this.score,
            gameOver: this.gameOver,
            won: this.won
        };
        localStorage.setItem('gameState', JSON.stringify(state));
    }

    handleKeydown(e) {
        if (this.gameOver) return;

        const keyMap = {
            'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right',
            'w': 'up', 's': 'down', 'a': 'left', 'd': 'right',
            'W': 'up', 'S': 'down', 'A': 'left', 'D': 'right'
        };

        const direction = keyMap[e.key];
        if (direction) {
            e.preventDefault();
            this.move(direction);
        }
    }

    addRandomTile() {
        const emptyCells = [];
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.board[r][c] === 0) emptyCells.push({ r, c });
            }
        }
        if (emptyCells.length > 0) {
            const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            this.board[r][c] = Math.random() < 0.9 ? 2 : 4;
        }
    }

    move(direction) {
        let moved = false;
        const rotated = this.rotateBoard(direction);

        for (let r = 0; r < this.size; r++) {
            const row = rotated[r].filter(v => v !== 0);
            for (let c = 0; c < row.length - 1; c++) {
                if (row[c] === row[c + 1]) {
                    row[c] *= 2;
                    this.score += row[c];
                    if (row[c] === 2048 && !this.won) {
                        this.won = true;
                        this.showMessage('你赢了！', true);
                    }
                    row.splice(c + 1, 1);
                }
            }
            while (row.length < this.size) row.push(0);
            rotated[r] = row;
        }

        const newBoard = this.unrotateBoard(rotated, direction);
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (newBoard[r][c] !== this.board[r][c]) moved = true;
            }
        }

        if (moved) {
            this.board = newBoard;
            this.addRandomTile();
            this.updateScore();
            this.render();
            this.saveState();
            if (this.isGameOver()) {
                this.gameOver = true;
                this.showMessage('游戏结束！');
                this.saveState();
            }
        }
    }

    rotateBoard(direction) {
        let board = this.board.map(row => [...row]);
        if (direction === 'up') {
            board = this.transpose(board);
        } else if (direction === 'down') {
            board = this.transpose(board);
            board = board.map(row => row.reverse());
        } else if (direction === 'right') {
            board = board.map(row => row.reverse());
        }
        return board;
    }

    unrotateBoard(board, direction) {
        if (direction === 'up') {
            board = this.transpose(board);
        } else if (direction === 'down') {
            board = board.map(row => row.reverse());
            board = this.transpose(board);
        } else if (direction === 'right') {
            board = board.map(row => row.reverse());
        }
        return board;
    }

    transpose(matrix) {
        return matrix[0].map((_, i) => matrix.map(row => row[i]));
    }

    isGameOver() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.board[r][c] === 0) return false;
                if (c < this.size - 1 && this.board[r][c] === this.board[r][c + 1]) return false;
                if (r < this.size - 1 && this.board[r][c] === this.board[r + 1][c]) return false;
            }
        }
        return true;
    }

    showMessage(text, isWin = false) {
        this.messageText.textContent = text;
        this.messageElement.classList.add('active');
        if (isWin) this.messageElement.classList.add('win');
    }

    updateScore() {
        this.scoreElement.textContent = this.score;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('bestScore', this.bestScore);
        }
        this.bestScoreElement.textContent = this.bestScore;
    }

    render() {
        this.boardElement.innerHTML = '';
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                this.boardElement.appendChild(cell);

                if (this.board[r][c] !== 0) {
                    const tile = document.createElement('div');
                    const value = this.board[r][c];
                    tile.className = `tile tile-${value} tile-new`;
                    tile.textContent = value;
                    tile.style.left = `${c * 115 + 15}px`;
                    tile.style.top = `${r * 115 + 15}px`;
                    this.boardElement.appendChild(tile);
                }
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new Game2048());
