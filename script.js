const SIZE = 15;
const EMPTY = 0, P1 = 1, P2 = 2; // P1: Crimson, P2: Cobalt
let board = [];
let currentPlayer = P1;
let myPlayer = P1;
let gameMode = ''; 
let peer = null, conn = null;
let gameOver = false;

const UI = {
    menu: document.getElementById('menu-ui'),
    game: document.getElementById('game-ui'),
    result: document.getElementById('result-screen'),
    board: document.getElementById('board'),
    turn: document.getElementById('turn-display'),
    resTitle: document.getElementById('result-title'),
    resMsg: document.getElementById('result-message')
};

function initBoard() {
    board = Array(SIZE).fill().map(() => Array(SIZE).fill(EMPTY));
    gameOver = false;
    currentPlayer = P1;
    drawBoard();
    updateTurnDisplay();
}

function drawBoard(winningCells = []) {
    UI.board.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            let cell = document.createElement('div');
            cell.className = 'cell';
            cell.onclick = () => handleCellClick(r, c);
            
            if (board[r][c] !== EMPTY) {
                let charge = document.createElement('div');
                charge.className = `charge p${board[r][c]}`;
                if (winningCells.some(w => w.r === r && w.c === c)) {
                    charge.classList.add('win');
                }
                cell.appendChild(charge);
            }
            UI.board.appendChild(cell);
        }
    }
}

function updateTurnDisplay() {
    if (gameOver) return;
    if (gameMode === 'ai' && currentPlayer !== myPlayer) {
        UI.turn.innerText = "AI Processing...";
        UI.turn.style.color = "#aaa";
    } else if (currentPlayer === myPlayer) {
        UI.turn.innerText = "Your Turn";
        UI.turn.style.color = myPlayer === P1 ? "var(--p1-color)" : "var(--p2-color)";
    } else {
        UI.turn.innerText = "Opponent's Turn";
        UI.turn.style.color = "#aaa";
    }
}

function handleCellClick(r, c) {
    if (gameOver || currentPlayer !== myPlayer || board[r][c] !== EMPTY) return;
    executeMove(r, c);
}

function executeMove(r, c) {
    board[r][c] = currentPlayer;
    
    if (gameMode === 'p2p' && currentPlayer === myPlayer) {
        conn.send({ type: 'move', r, c });
    }

    let winCells = checkWin(r, c, currentPlayer);
    
    if (winCells) {
        gameOver = true;
        drawBoard(winCells);
        setTimeout(() => showResult(currentPlayer), 800);
        return;
    }

    if (checkDraw()) {
        gameOver = true;
        drawBoard();
        setTimeout(() => showResult(EMPTY), 800);
        return;
    }

    currentPlayer = currentPlayer === P1 ? P2 : P1;
    drawBoard();
    updateTurnDisplay();

    if (gameMode === 'ai' && currentPlayer !== myPlayer && !gameOver) {
        setTimeout(playAI, 100); 
    }
}

// --- WIN LOGIC ---
function checkWin(r, c, player) {
    const dirs = [[1,0], [0,1], [1,1], [1,-1]];
    
    for (let [dr, dc] of dirs) {
        let cells = [{r, c}];
        
        // Check one direction
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) {
            cells.push({r: nr, c: nc});
            nr += dr; nc += dc;
        }
        
        // Check opposite direction
        nr = r - dr; nc = c - dc;
        while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) {
            cells.push({r: nr, c: nc});
            nr -= dr; nc -= dc;
        }
        
        if (cells.length >= 5) return cells;
    }
    return null;
}

function checkDraw() {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === EMPTY) return false;
        }
    }
    return true;
}

// --- HEURISTIC AI LOGIC ---
function playAI() {
    let bestScore = -Infinity;
    let bestMoves = [];

    // If board is empty, play center
    if (board[7][7] === EMPTY && checkDraw() === false) {
        let isEmpty = true;
        for(let r=0; r<SIZE; r++) for(let c=0; c<SIZE; c++) if(board[r][c] !== EMPTY) isEmpty = false;
        if(isEmpty) { executeMove(7, 7); return; }
    }

    // Evaluate every empty cell
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === EMPTY) {
                // Score for AI making the move (Attack)
                let attackScore = evaluateCell(r, c, P2);
                // Score for preventing Player making the move (Defense)
                let defenseScore = evaluateCell(r, c, P1);
                
                // Favor defense slightly to block player wins
                let totalScore = attackScore + (defenseScore * 1.2); 

                if (totalScore > bestScore) {
                    bestScore = totalScore;
                    bestMoves = [{r, c}];
                } else if (totalScore === bestScore) {
                    bestMoves.push({r, c});
                }
            }
        }
    }

    // Pick random from best moves (adds slight unpredictability if multiple equal options)
    let move = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    executeMove(move.r, move.c);
}

function evaluateCell(r, c, player) {
    let score = 0;
    const dirs = [[1,0], [0,1], [1,1], [1,-1]];
    
    for (let [dr, dc] of dirs) {
        let count = 1; // The piece we are placing
        let openEnds = 0;
        
        // Forward check
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) {
            count++; nr += dr; nc += dc;
        }
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === EMPTY) openEnds++;

        // Backward check
        nr = r - dr; nc = c - dc;
        while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) {
            count++; nr -= dr; nc -= dc;
        }
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === EMPTY) openEnds++;

        // Scoring Rules
        if (count >= 5) score += 100000; // Win
        else if (count === 4 && openEnds === 2) score += 10000; // Unstoppable
        else if (count === 4 && openEnds === 1) score += 1000;  // High threat
        else if (count === 3 && openEnds === 2) score += 1000;  // Strong setup
        else if (count === 3 && openEnds === 1) score += 100;
        else if (count === 2 && openEnds === 2) score += 100;
        else if (count === 2 && openEnds === 1) score += 10;
        else score += 1; // Base value for grouping
    }
    return score;
}

// --- GAME FLOW & NETWORKING ---
function showResult(winner) {
    UI.game.classList.add('hidden');
    UI.result.classList.remove('hidden');
    
    if (winner === EMPTY) {
        UI.resTitle.innerText = "STALEMATE";
        UI.resTitle.style.color = "white";
        UI.resMsg.innerText = "Grid Exhausted.";
    } else if (winner === myPlayer) {
        UI.resTitle.innerText = "VICTORY";
        UI.resTitle.style.color = winner === P1 ? "var(--p1-color)" : "var(--p2-color)";
        UI.resMsg.innerText = gameMode === 'ai' ? "System Defeated." : "Opponent Destroyed.";
    } else {
        UI.resTitle.innerText = "DEFEAT";
        UI.resTitle.style.color = winner === P1 ? "var(--p1-color)" : "var(--p2-color)";
        UI.resMsg.innerText = gameMode === 'ai' ? "System Superiority Proven." : "Opponent Triumphed.";
    }
}

function resetToMenu() {
    UI.result.classList.add('hidden');
    UI.menu.classList.remove('hidden');
    if (conn) { conn.close(); conn = null; }
    if (peer) { peer.destroy(); peer = null; }
}

function startAIGame() {
    gameMode = 'ai'; myPlayer = P1;
    UI.menu.classList.add('hidden');
    UI.game.classList.remove('hidden');
    initBoard();
}

function initPeer(isHost) {
    peer = new Peer();
    peer.on('open', id => { 
        if(isHost) document.getElementById('peer-id-display').innerText = id; 
    });
    peer.on('connection', connection => {
        conn = connection; setupConn();
        myPlayer = P1; startGameP2P();
    });
}

function hostGame() {
    document.getElementById('host-info').classList.remove('hidden');
    initPeer(true);
}

function joinGame() {
    const hostId = document.getElementById('join-id').value;
    if (!hostId) return alert('Enter Node ID');
    peer = new Peer();
    peer.on('open', () => {
        conn = peer.connect(hostId);
        conn.on('open', () => {
            myPlayer = P2; setupConn(); startGameP2P();
        });
    });
}

function setupConn() {
    conn.on('data', data => {
        if (data.type === 'move') {
            executeMove(data.r, data.c);
        }
    });
    conn.on('close', () => { alert("Opponent disconnected."); resetToMenu(); });
}

function startGameP2P() {
    gameMode = 'p2p';
    UI.menu.classList.add('hidden');
    UI.game.classList.remove('hidden');
    initBoard();
}
