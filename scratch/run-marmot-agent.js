const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

function send(socket, payload) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
    }
}

function callTool(socket, tool, args = {}) {
    return new Promise((resolve, reject) => {
        const id = `tool-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const onMessage = (data) => {
            let message;
            try {
                message = JSON.parse(data.toString());
            } catch (_e) {
                return;
            }
            if (message.type !== 'tool.result' || message.id !== id) return;
            socket.off('message', onMessage);
            resolve(message);
        };
        socket.on('message', onMessage);
        send(socket, { id, type: 'tool.call', tool, args });
    });
}

async function main() {
    console.log('[MarmotAgent] Reading app/bridge-config.json...');
    const configPath = path.join(__dirname, '../app/bridge-config.json');
    if (!fs.existsSync(configPath)) {
        console.error('Error: app/bridge-config.json not found. Make sure eXeLearning is running.');
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const wsUrl = config.wsUrl;
    const token = config.token;
    const projectId = config.activeProjects && config.activeProjects.length > 0 
        ? config.activeProjects[0] 
        : (config.projectId || 'default-project');

    console.log(`[MarmotAgent] Connecting to WS: ${wsUrl} (projectId: ${projectId}, token: ${token})...`);
    
    const socket = new WebSocket(`${wsUrl}?role=agent&projectId=${encodeURIComponent(projectId)}&token=${encodeURIComponent(token)}`);

    await new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
    });

    console.log('[MarmotAgent] Connected to WebSocket bridge successfully.');

    // 1. Read project structure
    console.log('[MarmotAgent] Reading project structure...');
    const structureRes = await callTool(socket, 'read_project_structure');
    console.log('[MarmotAgent] Structure result:', JSON.stringify(structureRes, null, 2));

    // 2. Create Page
    console.log('[MarmotAgent] Creating new page "Le Marmotte Alpine"...');
    const pageRes = await callTool(socket, 'create_page', {
        title: 'Le Marmotte Alpine',
        parentId: null
    });
    console.log('[MarmotAgent] Page result:', JSON.stringify(pageRes, null, 2));
    
    if (!pageRes.ok) {
        console.error('Failed to create page:', pageRes.error);
        socket.close();
        process.exit(1);
    }
    const pageId = pageRes.result.pageId;

    // 3. Create Block
    console.log('[MarmotAgent] Creating new block "Quiz & Puzzle"...');
    const blockRes = await callTool(socket, 'create_block', {
        pageId: pageId,
        title: 'Quiz e Puzzle Interattivo'
    });
    console.log('[MarmotAgent] Block result:', JSON.stringify(blockRes, null, 2));
    if (!blockRes.ok) {
        console.error('Failed to create block:', blockRes.error);
        socket.close();
        process.exit(1);
    }
    const blockId = blockRes.result.blockId;

    // HTML Content for the interactive Marmot Quiz & Puzzle iDevice
    const htmlContent = `<div class="marmot-container" style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f8fafc; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; color: #334155;">
  <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-top: 0; display: flex; align-items: center; gap: 10px;">🐿️ Il Mondo delle Marmotte Alpine</h2>
  
  <!-- Sezione 1: Quiz Vero o Falso -->
  <div style="margin-bottom: 30px; background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
    <h3 style="color: #2563eb; margin-top: 0;">1. Quiz Vero o Falso (5 Domande)</h3>
    <p style="font-size: 14px; color: #64748b;">Metti alla prova le tue conoscenze sulle marmotte alpine selezionando Vero o Falso per ciascuna affermazione.</p>
    
    <div id="quiz-container" style="display: flex; flex-direction: column; gap: 16px; margin-top: 20px;">
      <!-- D1 -->
      <div style="padding: 12px; border-radius: 6px; background: #f1f5f9; border-left: 4px solid #3b82f6;">
        <p style="margin: 0 0 10px 0; font-weight: 600;">1. Le marmotte sono mammiferi roditori appartenenti alla famiglia degli Sciuridi.</p>
        <button onclick="checkAnswer(1, true, this)" style="padding: 6px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer; font-weight: bold; margin-right: 10px;">Vero</button>
        <button onclick="checkAnswer(1, false, this)" style="padding: 6px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Falso</button>
        <div id="feedback-1" style="margin-top: 8px; font-size: 13px; font-weight: bold; display: none;"></div>
      </div>
      <!-- D2 -->
      <div style="padding: 12px; border-radius: 6px; background: #f1f5f9; border-left: 4px solid #3b82f6;">
        <p style="margin: 0 0 10px 0; font-weight: 600;">2. Il letargo invernale delle marmotte alpine può durare fino a 6 mesi all'anno.</p>
        <button onclick="checkAnswer(2, true, this)" style="padding: 6px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer; font-weight: bold; margin-right: 10px;">Vero</button>
        <button onclick="checkAnswer(2, false, this)" style="padding: 6px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Falso</button>
        <div id="feedback-2" style="margin-top: 8px; font-size: 13px; font-weight: bold; display: none;"></div>
      </div>
      <!-- D3 -->
      <div style="padding: 12px; border-radius: 6px; background: #f1f5f9; border-left: 4px solid #3b82f6;">
        <p style="margin: 0 0 10px 0; font-weight: 600;">3. Le marmotte alpine sono abili arrampicatrici e si rifugiano spesso sui rami degli alberi.</p>
        <button onclick="checkAnswer(3, true, this)" style="padding: 6px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer; font-weight: bold; margin-right: 10px;">Vero</button>
        <button onclick="checkAnswer(3, false, this)" style="padding: 6px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Falso</button>
        <div id="feedback-3" style="margin-top: 8px; font-size: 13px; font-weight: bold; display: none;"></div>
      </div>
      <!-- D4 -->
      <div style="padding: 12px; border-radius: 6px; background: #f1f5f9; border-left: 4px solid #3b82f6;">
        <p style="margin: 0 0 10px 0; font-weight: 600;">4. Il fischio acuto delle marmotte sentinelle serve per avvertire il gruppo di un potenziale pericolo.</p>
        <button onclick="checkAnswer(4, true, this)" style="padding: 6px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer; font-weight: bold; margin-right: 10px;">Vero</button>
        <button onclick="checkAnswer(4, false, this)" style="padding: 6px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Falso</button>
        <div id="feedback-4" style="margin-top: 8px; font-size: 13px; font-weight: bold; display: none;"></div>
      </div>
      <!-- D5 -->
      <div style="padding: 12px; border-radius: 6px; background: #f1f5f9; border-left: 4px solid #3b82f6;">
        <p style="margin: 0 0 10px 0; font-weight: 600;">5. Le marmotte sono carnivore e si nutrono principalmente di piccoli rettili e insetti.</p>
        <button onclick="checkAnswer(5, true, this)" style="padding: 6px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer; font-weight: bold; margin-right: 10px;">Vero</button>
        <button onclick="checkAnswer(5, false, this)" style="padding: 6px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Falso</button>
        <div id="feedback-5" style="margin-top: 8px; font-size: 13px; font-weight: bold; display: none;"></div>
      </div>
    </div>
  </div>

  <!-- Sezione 2: Gioco del Puzzle -->
  <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
    <h3 style="color: #2563eb; margin-top: 0;">2. Il Puzzle delle Marmotte Alpine</h3>
    <p style="font-size: 14px; color: #64748b; margin-bottom: 15px;">Clicca sui tasselli adiacenti allo spazio vuoto per spostarli e ricomporre la splendida immagine della marmotta.</p>
    
    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
      <!-- Contenitore del Puzzle -->
      <div id="puzzle-board" style="position: relative; width: 300px; height: 300px; border: 4px solid #1e3a8a; border-radius: 8px; background: #cbd5e1; overflow: hidden; margin: 0 auto;">
        <!-- Tasselli generati via JS -->
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button onclick="shufflePuzzle()" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 13px;">Mescola</button>
        <button onclick="solvePuzzle()" style="padding: 8px 16px; background: #64748b; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 13px;">Risolvi</button>
      </div>
      <div id="puzzle-victory" style="color: #10b981; font-weight: bold; font-size: 18px; margin-top: 10px; display: none; text-align: center;">🏆 Complimenti! Hai ricomposto il puzzle!</div>
    </div>
  </div>
</div>

<script>
  // Script Quiz
  (function() {
    const answers = {
      1: { correct: true, text: "Esatto! Le marmotte sono proprio roditori imparentati con gli scoiattoli alpine." },
      2: { correct: true, text: "Giusto! Durante il letargo invernale rallentano tutti i processi vitali per sopravvivere." },
      3: { correct: false, text: "Risposta errata. Le marmotte alpine vivono a terra o nelle tane sotterranee e non si arrampicano sugli alberi." },
      4: { correct: true, text: "Esatto! La sentinella lancia un fischio acuto prima di fuggire nella tana, allertando tutti." },
      5: { correct: false, text: "Risposta errata. Le marmotte alpine sono prevalentemente erbivore (erba, radici, fiori e foglie)." }
    };
    
    window.checkAnswer = function(qNum, userVal, btn) {
      const feedback = document.getElementById("feedback-" + qNum);
      const siblings = btn.parentNode.querySelectorAll("button");
      siblings.forEach(s => s.disabled = true);
      
      feedback.style.display = "block";
      if (userVal === answers[qNum].correct) {
        btn.style.background = "#10b981";
        btn.style.color = "white";
        feedback.style.color = "#10b981";
        feedback.innerText = "✓ " + answers[qNum].text;
      } else {
        btn.style.background = "#ef4444";
        btn.style.color = "white";
        feedback.style.color = "#ef4444";
        feedback.innerText = "✗ " + answers[qNum].text;
        
        // Evidenzia la risposta corretta
        siblings.forEach(s => {
          if ((s.innerText === "Vero" && answers[qNum].correct) || (s.innerText === "Falso" && !answers[qNum].correct)) {
            s.style.background = "#10b981";
            s.style.color = "white";
          }
        });
      }
    };

    // Script Puzzle
    const boardSize = 300;
    const gridSize = 3;
    const tileSize = boardSize / gridSize;
    const imageSrc = "https://upload.wikimedia.org/wikipedia/commons/e/ec/Marmota_marmota_Alps2.jpg";
    
    let tiles = [];
    let emptyTile = { row: 2, col: 2 };
    
    window.initPuzzle = function() {
      tiles = [];
      emptyTile = { row: 2, col: 2 };
      
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (r === 2 && c === 2) continue; // Spazio vuoto
          tiles.push({
            id: r * gridSize + c,
            correctRow: r,
            correctCol: c,
            row: r,
            col: c
          });
        }
      }
      window.renderPuzzle();
    };
    
    window.renderPuzzle = function() {
      const board = document.getElementById("puzzle-board");
      if (!board) return;
      board.innerHTML = "";
      
      tiles.forEach(tile => {
        const tileDiv = document.createElement("div");
        tileDiv.style.position = "absolute";
        tileDiv.style.width = (tileSize - 2) + "px";
        tileDiv.style.height = (tileSize - 2) + "px";
        tileDiv.style.left = (tile.col * tileSize + 1) + "px";
        tileDiv.style.top = (tile.row * tileSize + 1) + "px";
        tileDiv.style.backgroundImage = "url('" + imageSrc + "')";
        tileDiv.style.backgroundSize = boardSize + "px " + boardSize + "px";
        tileDiv.style.backgroundPosition = "-" + (tile.correctCol * tileSize) + "px -" + (tile.correctRow * tileSize) + "px";
        tileDiv.style.cursor = "pointer";
        tileDiv.style.transition = "left 0.2s, top 0.2s";
        tileDiv.style.border = "1px solid #1e293b";
        tileDiv.style.borderRadius = "4px";
        
        tileDiv.onclick = () => moveTile(tile);
        board.appendChild(tileDiv);
      });
      
      checkVictory();
    };
    
    function moveTile(tile) {
      const dRow = Math.abs(tile.row - emptyTile.row);
      const dCol = Math.abs(tile.col - emptyTile.col);
      
      if ((dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1)) {
        const tempRow = tile.row;
        const tempCol = tile.col;
        
        tile.row = emptyTile.row;
        tile.col = emptyTile.col;
        
        emptyTile.row = tempRow;
        emptyTile.col = tempCol;
        
        window.renderPuzzle();
      }
    }
    
    window.shufflePuzzle = function() {
      document.getElementById("puzzle-victory").style.display = "none";
      for (let i = 0; i < 100; i++) {
        const validMoves = tiles.filter(tile => {
          const dRow = Math.abs(tile.row - emptyTile.row);
          const dCol = Math.abs(tile.col - emptyTile.col);
          return (dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1);
        });
        if (validMoves.length > 0) {
          const randomTile = validMoves[Math.floor(Math.random() * validMoves.length)];
          const tempRow = randomTile.row;
          const tempCol = randomTile.col;
          randomTile.row = emptyTile.row;
          randomTile.col = emptyTile.col;
          emptyTile.row = tempRow;
          emptyTile.col = tempCol;
        }
      }
      window.renderPuzzle();
    };
    
    window.solvePuzzle = function() {
      tiles.forEach(tile => {
        tile.row = tile.correctRow;
        tile.col = tile.correctCol;
      });
      emptyTile = { row: 2, col: 2 };
      window.renderPuzzle();
    };
    
    function checkVictory() {
      const isWon = tiles.every(tile => tile.row === tile.correctRow && tile.col === tile.correctCol);
      const victoryDiv = document.getElementById("puzzle-victory");
      if (isWon && tiles.length > 0 && victoryDiv) {
        victoryDiv.style.display = "block";
      }
    }
    
    // Inizializza subito
    setTimeout(window.initPuzzle, 100);
  })();
</script>`;

    // 4. Create html idevice
    console.log('[MarmotAgent] Creating html iDevice with True/False quiz and Puzzle...');
    const ideviceRes = await callTool(socket, 'create_html_idevice', {
        pageId: pageId,
        blockId: blockId,
        title: 'Quiz e Puzzle delle Marmotte',
        html: htmlContent,
        ideviceType: 'FreeTextIdevice'
    });
    console.log('[MarmotAgent] iDevice result:', JSON.stringify(ideviceRes, null, 2));

    // 5. Send Chat final confirmation
    console.log('[MarmotAgent] Sending chat message confirmation to the sidebar...');
    send(socket, {
        type: 'agent.chat',
        sender: 'Antigravity (Self)',
        role: 'assistant',
        content: 'Ho creato con successo una nuova pagina "Le Marmotte Alpine" contenente un quiz Vero/Falso di 5 domande e un puzzle di tasselli scorrevoli interattivo con l\'immagine caricata da Wikipedia!',
        timestamp: Date.now()
    });

    console.log('[MarmotAgent] Finished successfully. Closing WebSocket.');
    socket.close();
}

main().catch(console.error);
