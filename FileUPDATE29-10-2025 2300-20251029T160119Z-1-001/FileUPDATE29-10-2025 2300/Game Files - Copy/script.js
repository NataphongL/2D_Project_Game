// === Sounds ===
// Create Audio objects for background music and SFX and set basic properties
const bgMusic = new Audio('background.mp3'); // background music file
bgMusic.loop = true; // keep music looping
bgMusic.volume = 0.15; // initial music volume
const tetrominoImages = {
  'I': new Image(),
  'J': new Image(),
  'L': new Image(),
  'O': new Image(),
  'S': new Image(),
  'T': new Image(),
  'Z': new Image()
};

// Set image sources
tetrominoImages['I'].src = 'Pic4.png';
tetrominoImages['J'].src = 'Pic2.png';
tetrominoImages['L'].src = 'Pic2.png';
tetrominoImages['O'].src = 'Pic4.png';
tetrominoImages['S'].src = 'Pic3.png';
tetrominoImages['T'].src = 'Pic1.png';
tetrominoImages['Z'].src = 'Pic3.png';
const Drop = new Audio('drop.mp3'); // hard-drop sound
Drop.loop = false; // one-shot
Drop.volume = 0.3;

const clear = new Audio("line-clear.mp3"); // line clear sound (separate instance)
clear.loop = false;
clear.volume = 0.3;

// sounds map used by playSound helper (this lets you control volume globally)
const sounds = {
  lineClear: new Audio('line-clear.wav'),
  rotate: new Audio('rotate.wav'),
  move: new Audio('move.wav'),
  gameOver: new Audio('game-over.wav')
};

// Play a named sound from the `sounds` map, applying user volume setting
function playSound(sound) {
  if (sounds[sound]) {
    sounds[sound].volume = soundVolume; // use settings volume
    sounds[sound].currentTime = 0;
    sounds[sound].play();
  }
}

// === Utility Functions ===

// Return random integer between min and max inclusive
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Fill tetrominoSequence with a randomized bag of all 7 tetromino names (7-bag)
function generateSequence() {
  const sequence = ['I','J','L','O','S','T','Z'];
  while (sequence.length) {
    const rand = getRandomInt(0, sequence.length - 1);
    tetrominoSequence.push(sequence.splice(rand, 1)[0]);
  }
}

// Create a new tetromino object with name, matrix, initial row/col
function getNextTetromino() {
  if (tetrominoSequence.length === 0) generateSequence(); // refill bag when empty
  const name = tetrominoSequence.pop(); // take last item (randomized)
  const matrix = tetrominos[name]; // shape matrix
  // center in playfield horizontally; account for tetromino width
  const col = Math.floor(playfield[0].length / 2 - Math.ceil(matrix[0].length / 2));
  // spawn row slightly above visible playfield; 'I' spawns a bit higher
  const row = name === 'I' ? -1 : -2;
  return { name, matrix, row, col };
}

// Rotate a square matrix 90 degrees clockwise and return a new matrix
function rotate(matrix) {
  const N = matrix.length - 1;
  return matrix.map((row,i)=>row.map((val,j)=>matrix[N-j][i]));
}

// Check if a piece matrix can be placed at given row/col without collisions/out-of-bounds
function isValidMove(matrix,row,col) {
  for (let r=0;r<matrix.length;r++) {
    for (let c=0;c<matrix[r].length;c++) {
      if (!matrix[r][c]) continue;
      // horizontal out-of-bounds
      if (col+c<0 || col+c>=playfield[0].length) return false;
      // below bottom - use rows instead of fixed number
      if (row+r>=rows) return false;  // Changed from playfield.length to rows
      // above top: treat as empty (allow spawn above visible area)
      if (row+r < 0) continue;
      // collision with placed block
      if (playfield[row+r][col+c]) return false;
    }
  }
  return true;
}

// === Game Setup ===
const grid = 32; // pixel size of one block cell
const columns = 3; // UI layout uses three vertical columns (left/center/right)
const rows = 25; // visible playfield rows (changed from 20 to 25)
const colWidth = 10 * grid; // width of each UI column = 10 blocks in center column
const canvas = document.getElementById('game'); // canvas element
canvas.width = colWidth * columns; // total canvas width (3 columns)
canvas.height = rows * grid; // canvas height based on rows
const context = canvas.getContext('2d');


const tetrominoSequence=[]; // bag of upcoming pieces
let playfield=[]; // 2D array representing placed blocks and empty cells

// Create/reset the playfield; create only visible rows (spawn positions are handled by negative row values)
function resetPlayfield() {
  playfield = [];
  for (let r = 0; r < rows; r++) {
    playfield[r] = Array(10).fill(0); // each row has 10 columns
  }
}
resetPlayfield();

// Tetromino definitions (matrix of 0/1 where 1 = block)
const tetrominos={
  'I':[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  'J':[[1,0,0],[1,1,1],[0,0,0]],
  'L':[[0,0,1],[1,1,1],[0,0,0]],
  'O':[[1,1],[1,1]],
  'S':[[0,1,1],[1,1,0],[0,0,0]],
  'Z':[[1,1,0],[0,1,1],[0,0,0]],
  'T':[[0,1,0],[1,1,1],[0,0,0]]
};

// Color mapping for each tetromino type
const colors={
  'I':'rgba(255, 255, 255, 1)',
  'O':'rgba(255, 255, 255, 1)',
  'T':'rgba(255, 255, 255, 1)',
  'S':'rgba(255, 255, 255, 1)',
  'Z':'rgba(255, 255, 255, 1)',
  'J':'rgba(255, 255, 255, 1)',
  'L':'rgba(255, 255, 255, 1)'
};

let count=0; // frame counter for gravity timing
let tetromino=getNextTetromino(); // current falling piece
let nextTetromino=getNextTetromino(); // next preview piece
let rAF=null; // requestAnimationFrame id
let gameOver=false; // flag for game over state
let score=0,level=1,linesTotal=0; // scoring and level state
let paused = false; // pause flag
let hardDropEffect = null; // visual effect for hard drop {col, fromRow, toRow, timer}
let lastPlacedCells = []; // used for place effects (glow etc)
let placeEffectTimer = 0; // timer to show place effect frames
let lineClearTexts = []; // visual floating texts for cleared lines {row, text, timer}
let lineClearEffects = []; // white flash effects for cleared rows {row, timer}
let comboCount = 0; // current combo count
let comboMultiplier = 1.0; // damage multiplier based on combo
let comboTexts = []; // visual combo texts {text, timer, x, y}
let comboTimeout = 0; // frames remaining until combo expires (3 seconds = 180 frames)
let lineClearFlashTimer = 0; // screen flash effect for line clears

// === Sound Settings ===
let soundVolume = 1; // global SFX volume 0.0 - 1.0
let musicVolume = 0.15; // music volume
let sliderDragging = false;
let musicSliderDragging = false;

// === New Settings System (Tab-based) ===
let settingsTabOpen = false; // Whether settings tab is expanded
let activeSettingsTab = 'audio'; // Current active tab

// Settings tabs data
const settingsTabs = {
  audio: { name: 'Audio', x: 0, y: 0, width: 0, height: 0, hover: false },
  controls: { name: 'Controls', x: 0, y: 0, width: 0, height: 0, hover: false }
};

// Settings area
const settingsArea = {
  x: colWidth * 2 + 20,
  y: canvas.height - 180, // Position above the old button area
  width: colWidth - 40,
  height: 160,
  tabHeight: 30,
  contentHeight: 130
};

function drawSettingsTab() {
  // Draw settings container
  context.fillStyle = settingsTabOpen ? '#333' : '#222';
  context.fillRect(settingsArea.x, settingsArea.y, settingsArea.width, settingsTabOpen ? settingsArea.height : settingsArea.tabHeight);
  context.strokeStyle = 'white';
  context.lineWidth = 2;
  context.strokeRect(settingsArea.x, settingsArea.y, settingsArea.width, settingsTabOpen ? settingsArea.height : settingsArea.tabHeight);
  
  // Draw tab header
  context.fillStyle = 'white';
  context.font = 'bold 14px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('SETTINGS', settingsArea.x + settingsArea.width / 2, settingsArea.y + settingsArea.tabHeight / 2);
  
  if (settingsTabOpen) {
    // Draw tabs
    const tabWidth = settingsArea.width / 2;
    let tabX = settingsArea.x;
    
    for (const [key, tab] of Object.entries(settingsTabs)) {
      tab.x = tabX;
      tab.y = settingsArea.y + settingsArea.tabHeight;
      tab.width = tabWidth;
      tab.height = 25;
      
      // Tab background
      context.fillStyle = activeSettingsTab === key ? '#555' : '#444';
      context.fillRect(tab.x, tab.y, tab.width, tab.height);
      context.strokeStyle = 'white';
      context.lineWidth = 1;
      context.strokeRect(tab.x, tab.y, tab.width, tab.height);
      
      // Tab text
      context.fillStyle = 'white';
      context.font = 'bold 12px monospace';
      context.textAlign = 'center';
      context.fillText(tab.name, tab.x + tab.width / 2, tab.y + tab.height / 2);
      
      tabX += tabWidth;
    }
    
    // Draw tab content
    const contentY = settingsArea.y + settingsArea.tabHeight + 25;
    
    if (activeSettingsTab === 'audio') {
      drawAudioSettings(contentY);
    } else if (activeSettingsTab === 'controls') {
      drawControlsSettings(contentY);
    }
    
    // Close button
    const closeButton = {
      x: settingsArea.x + settingsArea.width - 70,
      y: settingsArea.y + 5,
      width: 60,
      height: 20
    };
    
    context.fillStyle = '#FF4444';
    context.fillRect(closeButton.x, closeButton.y, closeButton.width, closeButton.height);
    context.fillStyle = 'white';
    context.font = 'bold 12px monospace';
    context.textAlign = 'center';
    context.fillText('CLOSE', closeButton.x + closeButton.width / 2, closeButton.y + closeButton.height / 2);
  }
}

function drawAudioSettings(contentY) {
  const sliderX = settingsArea.x + 20;
  const sliderWidth = settingsArea.width - 40;
  
  // Sound Volume
  context.fillStyle = 'white';
  context.font = 'bold 12px monospace';
  context.textAlign = 'left';
  context.fillText("Sound Volume:", sliderX, contentY + 20);
  
  // Volume percentage
  context.textAlign = 'right';
  context.fillText(Math.round(soundVolume * 100) + "%", settingsArea.x + settingsArea.width - 20, contentY + 20);
  
  // Slider background
  context.fillStyle = '#444';
  context.fillRect(sliderX, contentY + 30, sliderWidth, 8);
  
  // Slider handle
  const handleX = sliderX + (soundVolume * sliderWidth);
  context.fillStyle = '#4CAF50';
  context.fillRect(handleX - 5, contentY + 25, 10, 18);
  
  // Music Volume
  context.textAlign = 'left';
  context.fillText("Music Volume:", sliderX, contentY + 60);
  
  context.textAlign = 'right';
  context.fillText(Math.round(musicVolume * 100) + "%", settingsArea.x + settingsArea.width - 20, contentY + 60);
  
  // Slider background
  context.fillStyle = '#444';
  context.fillRect(sliderX, contentY + 70, sliderWidth, 8);
  
  // Slider handle
  const musicHandleX = sliderX + (musicVolume * sliderWidth);
  context.fillStyle = '#2196F3';
  context.fillRect(musicHandleX - 5, contentY + 65, 10, 18);
}

function drawControlsSettings(contentY) {
  context.fillStyle = 'white';
  context.font = 'bold 11px monospace';
  context.textAlign = 'left';
  
  const controls = [
    "←→ : Move Left/Right",
    "↑ : Rotate Piece",
    "↓ : Soft Drop", 
    "Space : Hard Drop",
    "P : Pause Game",
  ];
  
  controls.forEach((control, index) => {
    context.fillText(control, settingsArea.x + 10, contentY + 20 + (index * 18));
  });
}

// Update volume control functions to work with new slider
function updateVolumeFromMouse(mouseX) {
  const sliderX = settingsArea.x + 20;
  const sliderWidth = settingsArea.width - 40;
  const newVolume = Math.max(0, Math.min(1, (mouseX - sliderX) / sliderWidth));
  soundVolume = newVolume;
  // Update all sound volumes immediately
  for (const sound in sounds) {
    if (sounds[sound]) {
      sounds[sound].volume = soundVolume;
    }
  }
  Drop.volume = soundVolume * 0.3;
  clear.volume = soundVolume * 0.3;
}

function updateMusicVolumeFromMouse(mouseX) {
  const sliderX = settingsArea.x + 20;
  const sliderWidth = settingsArea.width - 40;
  const newVolume = Math.max(0, Math.min(1, (mouseX - sliderX) / sliderWidth));
  musicVolume = newVolume;
  bgMusic.volume = musicVolume;
}

// === Boss Meter System ===
let bossMeter = 0;
let bossMeterMax = 100;
let meterFillRate = 0.08; // Slower fill rate for 20-22 seconds
let currentEvent = null;
let eventDuration = 0;
let bossHealTimer = 0;
let bossHealInterval = 1800; // 30 seconds at 60fps
let bossSpeedTimer = 0;
let bossSpeedInterval = 1800; // 30 seconds at 60fps
let bossSpeedActive = false;
let bossSpeedDuration = 0;
let bossSpeedMaxDuration = 600; // 10 seconds at 60fps
let bossImmuneTimer = 0;
let bossImmuneInterval = 1500; // 25 seconds at 60fps
let bossImmuneActive = false;
let bossImmuneDuration = 0;
let bossImmuneMaxDuration = 480; // 8 seconds at 60fps
let bossTransitionTimer = 0;
let bossTransitionDuration = 180; // 3 seconds at 60fps
let bossAlive = true; // Track if any boss is still alive

// Events definition
const events = {
  HIDE_NEXT_BLOCK: {
    name: "Hide Next Block",
    duration: 300, // 5 seconds at 60fps
    active: false
  }
};

// Event functions
function triggerHideBlock() {
  // If boss is not alive, don't trigger events
  if (!bossAlive) return;
  
  // Trigger hide next block ability
  currentEvent = 'HIDE_NEXT_BLOCK';
  events.HIDE_NEXT_BLOCK.active = true;
  eventDuration = events.HIDE_NEXT_BLOCK.duration;
  
  console.log(`Hide Next Block activated!`);
}

function endEvent(eventKey) {
  events[eventKey].active = false;
  currentEvent = null;
  eventDuration = 0;
}

// === Place Tetromino ===
// Copies current tetromino blocks into the playfield array and handles line clears & scoring
function placeTetromino() {
  lastPlacedCells = []; // reset list of placed cells for visual effect
  // Write piece into playfield; if any block is above visible area -> immediate game over
  for (let r=0;r<tetromino.matrix.length;r++) {
    for (let c=0;c<tetromino.matrix[r].length;c++) {
      if (tetromino.matrix[r][c]) {
        if (tetromino.row+r<0) return showGameOver(); // spawn collision -> game over
        playfield[tetromino.row+r][tetromino.col+c]=tetromino.name; // store piece type
        lastPlacedCells.push({x: tetromino.col+c, y: tetromino.row+r, color: colors[tetromino.name]});
      }
    }
  }

  placeEffectTimer = 10; // show placement effect for a short time (10 frames)

  // ===== Line-clear handling with combo system =====
  let anyLinesCleared = false;
  let totalCleared = 0;
  let totalPoints = 0;

  while (true) {
    // find full rows (scan bottom->top)
    const clearedRows = [];
    for (let r = playfield.length - 1; r >= 0; r--) {
      if (playfield[r].every(cell => !!cell)) {
        clearedRows.push(r);
        // Add white line effect for this cleared row
        lineClearEffects.push({
          row: r,
          timer: 20 // effect duration in frames
        });
      }
    }

    if (clearedRows.length === 0) break; // no more clears

    anyLinesCleared = true;
    
    // === ADD SCREEN FLASH EFFECT FOR LINE CLEARS ===
    if (clearedRows.length > 0) {
      lineClearFlashTimer = 15; // Set flash duration
    }
    
    // === REDUCE BOSS ABILITY TIMERS WHEN CLEARING LINES ===
    if (clearedRows.length > 0 && bossAlive) {
      // Calculate reduction amount (50% less effective when immune ability is active for final boss)
      let reductionMultiplier = 1.0;
      if (currentBoss === 4 && bossImmuneActive) {
        reductionMultiplier = 0.5; // 50% less effective
      }
      
      // Reduce hide block meter
      bossMeter = Math.max(0, bossMeter - (20 * reductionMultiplier));
      
      // Reduce heal/boost ability timer (boss 2+)
      if (currentBoss >= 1) {
        const healReduction = bossHealInterval * 0.20 * reductionMultiplier;
        bossHealTimer = Math.max(0, bossHealTimer - healReduction);
      }
      
      // Reduce speed ability timer (boss 3+)
      if (currentBoss >= 2 && !bossSpeedActive) {
        const speedReduction = bossSpeedInterval * 0.20 * reductionMultiplier;
        bossSpeedTimer = Math.max(0, bossSpeedTimer - speedReduction);
      }
      
      // Reduce immune ability timer (boss 4+)
      if (currentBoss >= 3 && !bossImmuneActive) {
        const immuneReduction = bossImmuneInterval * 0.20 * reductionMultiplier;
        bossImmuneTimer = Math.max(0, bossImmuneTimer - immuneReduction);
      }
    }

    // Combo system: increase combo when clearing lines
    if (comboTimeout > 0) {
      // Continue existing combo
      comboCount++;
    } else {
      // Start new combo
      comboCount = 1;
    }
    comboMultiplier = 1 + (comboCount * 0.1); // 1.1, 1.2, 1.3, etc.
    
    // Reset combo timer to 3 seconds (180 frames)
    comboTimeout = 240;
    
    // Create combo text effect - show simple numbers like 1, 2, 3
    comboTexts.push({
      text: `COMBO ${comboCount}!`,
      timer: 90,
      x: 5 * grid, // center of playfield
      y: 10 * grid  // middle of screen
    });

    // score/damage for this batch of clears
    let pointsThisBatch = 0;
    let damageThisBatch = 0;
    switch (clearedRows.length) {
      case 1:
        pointsThisBatch = 100 * level;
        damageThisBatch = 10;
        clear.playbackRate = 1.5;
        break;
      case 2:
        pointsThisBatch = 300 * level;
        damageThisBatch = 25;
        break;
      case 3:
        pointsThisBatch = 500 * level;
        damageThisBatch = 40;
        break;
      case 4:
        pointsThisBatch = 800 * level;
        damageThisBatch = 60;
        break;
    }
    
    // Apply combo multiplier to damage and INCREASE boss health instead of decreasing
    damageThisBatch = Math.floor(damageThisBatch * comboMultiplier);
    
    // Check if boss is immune (4th boss ability)
    if (!bossImmuneActive || currentBoss < 3) {
      bossHealth += damageThisBatch; // INCREASE boss health
    }

    // create floating text for each cleared row
    const perRowPoints = Math.max(1, Math.floor(pointsThisBatch / clearedRows.length));
    for (let i = 0; i < clearedRows.length; i++) {
      lineClearTexts.push({
        row: clearedRows[i],
        text: `+${perRowPoints}`,
        timer: 100
      });
    }

    // remove rows: sort descending then splice
    clearedRows.sort((a, b) => b - a);
    for (let i = 0; i < clearedRows.length; i++) {
      playfield.splice(clearedRows[i], 1);
    }
    // add same number of empty rows at top
    for (let i = 0; i < clearedRows.length; i++) {
      playfield.unshift(Array(10).fill(0));
    }

    totalCleared += clearedRows.length;
    totalPoints += pointsThisBatch;

    // play sound for this batch
    clear.currentTime = 0;
    clear.play();
  }
  if (comboTimeout > 0 && comboCount > 0) {
    const secondsRemaining = Math.ceil(comboTimeout / 60);
    
    context.save();
    context.translate(colWidth, 0); // Move to playfield coordinates
    
    const alpha = 0.9;
    context.globalAlpha = alpha;

    // Color changes based on time remaining
    if (secondsRemaining === 1) {
      context.fillStyle = '#FF4444'; // Red for 1 second
    } else if (secondsRemaining === 2) {
      context.fillStyle = '#FFAA44'; // Orange for 2 seconds
    } else if (secondsRemaining === 3) {
      context.fillStyle = '#44FF44'; // Green for 3 seconds
    } else {
      context.fillStyle = '#8888FF'; // Blue for >3 seconds (shouldn't happen)
    }
    
    context.font = 'bold 28px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Position at top center of playfield - show exact seconds
    context.fillText(`${secondsRemaining}`, 5 * grid, 2 * grid);
    
    // Also show progress bar
    const barWidth = 8 * grid;
    const barHeight = 8;
    const progress = comboTimeout / 180; // 0 to 1
    
    context.fillStyle = '#333333';
    context.fillRect(5 * grid - barWidth/2, 2 * grid + 25, barWidth, barHeight);
    
    context.fillStyle = secondsRemaining === 1 ? '#FF4444' : 
                       secondsRemaining === 2 ? '#FFAA44' : '#44FF44';
    context.fillRect(5 * grid - barWidth/2, 2 * grid + 25, barWidth * progress, barHeight);
    
    context.restore();
  }

  // Show "COMBO END" when timer expires
  if (comboTimeout === 0 && comboCount > 0) {
    comboTexts.push({
      text: `COMBO END!`,
      timer: 60,
      x: 5 * grid,
      y: 10 * grid
    });
    comboCount = 0;
    comboMultiplier = 1.0;
  }

  // Reset combo if no lines were cleared
  if (!anyLinesCleared && comboTimeout <= 0) {
    comboCount = 0;
    comboMultiplier = 1.0;
  }
  // apply accumulated score/lines/level/boss handling
  if (totalCleared > 0) {
    score += totalPoints;
    linesTotal += totalCleared;
    if (linesTotal >= level * 10) level++;
    // Check if boss health reached max (game progression) - except for final boss
    if (bossHealth >= bossMaxHealth && bossTransitionTimer === 0 && bossAlive && currentBoss < 4) {
      bossTransitionTimer = bossTransitionDuration;
      
      // Show boss defeated text
      comboTexts.push({
        text: `BOSS ${currentBoss + 1} DEFEATED!`,
        timer: 180,
        x: 5 * grid,
        y: 8 * grid
      });
    }
  }

  // Spawn next piece
  tetromino = nextTetromino;
  nextTetromino = getNextTetromino();
}

// === Game Over ===
// Draw a Game Over overlay, stop music/animation and play game over sound
function showGameOver() {
  bgMusic.pause();
  bgMusic.currentTime = 0; // reset music to start
  cancelAnimationFrame(rAF); // stop the main loop
  gameOver = true;
  playSound('gameOver'); // play game over SFX
  

  context.save(); // save canvas state

  // Ensure there's no translation/transform left over from main loop
  context.setTransform(1, 0, 0, 1, 0, 0); 

  // Draw semi-transparent black overlay over the center playfield column
  context.globalAlpha = 0.75;
  context.fillStyle = 'black';
  context.fillRect(colWidth, 0, colWidth, canvas.height); // overlay on middle column
  context.globalAlpha = 1;

  // Draw "GAME OVER" text and retry instruction
  const middleX = colWidth + colWidth / 2;
  context.fillStyle = 'white';
  context.font = 'bold 36px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('GAME OVER!', middleX, canvas.height / 2 - 10);
  context.font = 'bold 15px monospace';
  context.fillText('Press R to play again', middleX, canvas.height / 2 + 25);

  context.restore(); // restore canvas state
}

// === Draw Helpers ===
// Draw a single block cell at grid coords (x,y) with color
function drawCell(x,y,color){
  context.fillStyle=color;
  context.fillRect(x*grid,y*grid,grid-1,grid-1);
}

function drawCellWithImage(x, y, tetrominoType) {
  const image = tetrominoImages[tetrominoType];
  
  // If image is loaded, draw it; otherwise fall back to colored rectangle
  if (image && image.complete && image.naturalHeight !== 0) {
    context.drawImage(image, x * grid, y * grid, grid - 1, grid - 1);
  } else {
    // Fallback to original colored rectangle while images load
    context.fillStyle = colors[tetrominoType];
    context.fillRect(x * grid, y * grid, grid - 1, grid - 1);
  }
}

// Draw the playfield (iterate rows and columns, draw occupied cells)
function drawPlayfield(){
  for(let r=0;r<rows;r++){  // Changed from 20 to rows
    for(let c=0;c<10;c++){
      if(playfield[r][c]) drawCellWithImage(c, r, playfield[r][c]);
    }
  }
}
// Draw a tetromino piece on the playfield (current falling piece)
function drawTetromino(piece){
  context.fillStyle=colors[piece.name];
  for(let r=0;r<piece.matrix.length;r++){
    for(let c=0;c<piece.matrix[r].length;c++){
      if(piece.matrix[r][c])   drawCellWithImage(piece.col+c, piece.row+r, piece.name);
    }
  }
}

// Compute the row where the current piece would land (ghost piece)
function getGhostRow(piece) {
  let ghostRow = piece.row;
  while (isValidMove(piece.matrix, ghostRow + 1, piece.col)) {
    ghostRow++;
  }
  return ghostRow;
}

// === Main Loop ===
function loop() {
  if (!gameStarted) return; // do nothing when game not started
  
  rAF = requestAnimationFrame(loop); // schedule next frame
  context.clearRect(0, 0, canvas.width, canvas.height); // clear whole canvas

  // Handle boss transitions
  if (bossTransitionTimer > 0) {
    bossTransitionTimer--;
    
    // When transition ends, move to next boss or end game
    if (bossTransitionTimer === 0) {
      currentBoss = (currentBoss + 1);
      bossHealth = 0; // Reset to 0 for next boss
      
      // Check if all bosses defeated (no more bosses left)
      if (currentBoss >= bossImages.length) {
        bossAlive = false;
        // Show victory text
        comboTexts.push({
          text: 'ALL BOSSES DEFEATED!',
          timer: 300,
          x: 5 * grid,
          y: 8 * grid
        });
        comboTexts.push({
          text: 'VICTORY!',
          timer: 300,
          x: 5 * grid,
          y: 10 * grid
        });
      } else {
        // Set max health for new boss
        if (currentBoss === 1) {
          bossMaxHealth = 600; // Second boss has 600 max HP
          comboTexts.push({
            text: 'SECOND BOSS APPEAR!',
            timer: 180,
            x: 5 * grid,
            y: 8 * grid
          });
          comboTexts.push({
            text: 'HEALING ABILITY!',
            timer: 180,
            x: 5 * grid,
            y: 10 * grid
          });
        } else if (currentBoss === 2) {
          bossMaxHealth = 700; // Third boss has 800 max HP
          comboTexts.push({
            text: 'THIRD BOSS APPEAR!',
            timer: 180,
            x: 5 * grid,
            y: 8 * grid
          });
          comboTexts.push({
            text: 'HEALING + SPEED UP!',
            timer: 180,
            x: 5 * grid,
            y: 10 * grid
          });
        } else if (currentBoss === 3) {
          bossMaxHealth = 350; // Fourth boss has 1000 max HP
          comboTexts.push({
            text: 'FOURTH BOSS APPEAR!',
            timer: 180,
            x: 5 * grid,
            y: 8 * grid
          });
          comboTexts.push({
            text: 'IMMUNE ABILITY!',
            timer: 180,
            x: 5 * grid,
            y: 10 * grid
          });
        } else if (currentBoss === 4) {
          // Final boss - unkillable
          bossMaxHealth = Infinity;
          comboTexts.push({
            text: 'FINAL BOSS APPEAR!',
            timer: 180,
            x: 5 * grid,
            y: 8 * grid
          });
          comboTexts.push({
            text: 'BOOST + RESISTANCE!',
            timer: 180,
            x: 5 * grid,
            y: 10 * grid
          });
        }
      }
    }
  }

  // Update hide block ability for all bosses
  if (!gameOver && !paused && bossAlive) {
    bossMeter += meterFillRate;
    if (bossMeter >= bossMeterMax) {
      triggerHideBlock();
      bossMeter = 0; // Reset meter after triggering ability
    }
  }

  // Update boss abilities for second, third, and fourth bosses
  if (!gameOver && !paused && currentBoss >= 1 && bossAlive) {
    bossHealTimer++;
    if (bossHealTimer >= bossHealInterval) {
      if (currentBoss === 4) {
        // FINAL BOSS: Boost all other ability meters by 20%
        bossMeter = Math.min(bossMeterMax, bossMeter + (bossMeterMax * 0.20));
        if (!bossSpeedActive) {
          bossSpeedTimer = Math.min(bossSpeedInterval, bossSpeedTimer + (bossSpeedInterval * 0.20));
        }
        if (!bossImmuneActive) {
          bossImmuneTimer = Math.min(bossImmuneInterval, bossImmuneTimer + (bossImmuneInterval * 0.20));
        }
        
        // Show boost effect
        comboTexts.push({
          text: `FINAL BOSS BOOST!`,
          timer: 90,
          x: 5 * grid,
          y: 12 * grid
        });
      } else {
        // BOSSES 1-3: Normal healing ability
        let healAmount = 20;
        if (currentBoss === 2) {
          healAmount = 30;
        } else if (currentBoss === 3) {
          healAmount = 40;
        }
        bossHealth = Math.max(0, bossHealth - healAmount);
      }
      
      bossHealTimer = 0;
    }
  }

  // Update boss speed ability for third boss and higher
  if (!gameOver && !paused && currentBoss >= 2 && bossAlive) {
    bossSpeedTimer++;
    if (bossSpeedTimer >= bossSpeedInterval && !bossSpeedActive) {
      bossSpeedActive = true;
      bossSpeedDuration = currentBoss === 4 ? 900 : bossSpeedMaxDuration; // Enhanced for final boss
      bossSpeedTimer = 0;
    }
    
    // Update speed duration
    if (bossSpeedActive) {
      bossSpeedDuration--;
      if (bossSpeedDuration <= 0) {
        bossSpeedActive = false;
      }
    }
  }

  // Update boss immune ability for fourth boss and higher
  if (!gameOver && !paused && currentBoss >= 3 && bossAlive) {
    bossImmuneTimer++;
    if (bossImmuneTimer >= bossImmuneInterval && !bossImmuneActive) {
      bossImmuneActive = true;
      bossImmuneDuration = currentBoss === 4 ? 900 : bossImmuneMaxDuration; // Enhanced for final boss
      bossImmuneTimer = 0;
    }
    
    // Update immune duration
    if (bossImmuneActive) {
      bossImmuneDuration--;
      if (bossImmuneDuration <= 0) {
        bossImmuneActive = false;
      }
    }
  }

  // Update active event timer (only if boss is alive)
  if (currentEvent && events[currentEvent].active && bossAlive) {
    eventDuration--;
    if (eventDuration <= 0) {
      endEvent(currentEvent);
    }
  }

  // Update combo timer
  if (comboTimeout > 0) {
    comboTimeout--;
    
    // Create visual timer effect when combo is about to expire (last 60 frames = 1 second)
    if (comboTimeout <= 60 && comboCount > 0) {
      const flash = Math.sin(comboTimeout * 0.3) > 0; // blinking effect
      if (flash) {
        comboTexts.push({
          text: `HURRY! ${Math.ceil(comboTimeout / 60)}s`,
          timer: 30,
          x: 5 * grid,
          y: 12 * grid
        });
      }
    }
  }

  // Draw left sidebar background
  context.fillStyle = '#222';
  context.fillRect(0, 0, colWidth, canvas.height);

  // Draw playfield background (center column)
  context.fillStyle = '#111';
  context.fillRect(colWidth, 0, colWidth, canvas.height);

  // Draw right sidebar background
  context.fillStyle = '#222';
  context.fillRect(colWidth * 2, 0, colWidth, canvas.height);

  // Draw playfield contents translated into center column
  context.save();
  context.translate(colWidth, 0); // shift coordinate system to the playfield column
  
  // === LINE CLEAR SCREEN FLASH EFFECT ===
  if (lineClearFlashTimer > 0) {
    context.save();
    const flashAlpha = (lineClearFlashTimer / 15) * 0.4; // Fades from 40% to 0%
    context.globalAlpha = flashAlpha;
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, 10 * grid, canvas.height);
    context.restore();
    lineClearFlashTimer--;
  }
  
  drawPlayfield();

  // Draw placement effect - flash on newly placed pieces
    if (placeEffectTimer > 0) {
    context.save();
    
    // Smooth pulse that fades out
    const pulse = (placeEffectTimer / 10) * 0.9; // Starts at 90% and fades to 0%
    
    // Draw flash effect on each newly placed cell
    for (const cell of lastPlacedCells) {
      const x = cell.x;
      const y = cell.y;
      
      // Bright white flash that fades out
      context.globalAlpha = pulse;
      context.fillStyle = '#FFFFFF';
      context.fillRect(x * grid, y * grid, grid - 1, grid - 1);
      
      // Optional: Add a subtle colored tint from the original block
      context.globalAlpha = pulse * 0.4;
      context.fillStyle = cell.color;
      context.fillRect(x * grid, y * grid, grid - 1, grid - 1);
    }
    
    context.restore();
    placeEffectTimer--;
  }

  // Draw combo texts
  if (comboTexts.length) {
    for (let i = comboTexts.length - 1; i >= 0; i--) {
      const combo = comboTexts[i];
      const alpha = Math.min(1, combo.timer / 30); // fade in then out
      const scale = 1 + (0.5 * (1 - combo.timer / 90)); // scale up effect
      
      context.save();
      context.globalAlpha = alpha;
      
      // Color based on text content
      if (combo.text.includes('HURRY')) {
        context.fillStyle = '#FF4444'; // red for hurry text
      } else if (combo.text.includes('DEFEATED') || combo.text.includes('VICTORY') || combo.text.includes('APPEAR')) {
        context.fillStyle = '#FFD700'; // gold for important messages
        context.font = `bold ${24 * scale}px monospace`;
      } else {
        context.fillStyle = '#FFD700'; // gold for combo text
      }
      
      if (!combo.text.includes('DEFEATED') && !combo.text.includes('VICTORY') && !combo.text.includes('APPEAR')) {
        context.font = `bold ${24 * scale}px monospace`;
      }
      
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      
      // Move upward as timer decreases (only for playfield texts, not sidebar texts)
      let y = combo.y;
      if (!combo.text.includes('DEFEATED') && !combo.text.includes('VICTORY') && !combo.text.includes('APPEAR')) {
        y = combo.y - (90 - combo.timer);
      }
      
      context.fillText(combo.text, combo.x, y);
      
      context.restore();
      
      combo.timer--;
      if (combo.timer <= 0) {
        comboTexts.splice(i, 1);
      }
    }
  }

  // Draw floating line-clear texts (above playfield, aligned to the cleared row)
  if (lineClearTexts.length) {
    for (let i = lineClearTexts.length - 1; i >= 0; i--) {
      const t = lineClearTexts[i];
      const total = 60;
      const progress = 1 - t.timer / total;
      const alpha = Math.max(0, t.timer / total);
      // move text upward a bit as it fades
      const y = (t.row + 0.5) * grid + progress * -30;
      context.globalAlpha = alpha;
      context.fillStyle = 'white';
      context.font = 'bold 20px monospace';
      context.textAlign = 'center';
      context.fillText(t.text, (10 * grid) / 2, y);
      
      context.globalAlpha = 1;
      t.timer--;
      if (t.timer <= 0) lineClearTexts.splice(i, 1);
    }
  }

  // Draw white line effects for cleared rows
   if (lineClearEffects.length) {
    for (let i = lineClearEffects.length - 1; i >= 0; i--) {
      const effect = lineClearEffects[i];
      const alpha = effect.timer / 20; // Single fade out from 1 to 0
      
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = 'white';
      
      // Draw a white rectangle across the entire cleared row
      const y = effect.row * grid;
      context.fillRect(0, y, 10 * grid, grid);
      
      context.restore();
      
      effect.timer--;
      if (effect.timer <= 0) {
        lineClearEffects.splice(i, 1);
      }
    }
  }

  // Draw ghost guide lines from current piece down to its ghost landing position
  if (tetromino) {
    const ghostRow = getGhostRow(tetromino);
    context.save();
    // Change ghost line color to yellow during speed ability
    if (bossSpeedActive) {
      context.strokeStyle = 'rgba(255, 255, 0, 0.6)'; // Yellow during speed ability
    } else {
      context.strokeStyle = 'rgba(255,255,255,0.4)'; // Normal white
    }
    context.lineWidth = 2;
    for (let r = 0; r < tetromino.matrix.length; r++) {
      for (let c = 0; c < tetromino.matrix[r].length; c++) {
        if (tetromino.matrix[r][c]) {
          let x = tetromino.col + c;
          let yStart = tetromino.row + r;
          let yEnd = ghostRow + r;
          // Draw vertical guide lines from block bottom at start to bottom at ghost
          context.beginPath();
          context.moveTo(x * grid, yStart * grid + grid - 2);
          context.lineTo(x * grid, yEnd * grid + grid - 2);
          context.stroke();
          context.beginPath();
          context.moveTo((x + 1) * grid - 2, yStart * grid + grid - 2);
          context.lineTo((x + 1) * grid - 2, yEnd * grid + grid - 2);
          context.stroke();
        }
      }
    }
    context.restore();
  }

  // Draw semi-transparent ghost piece (where the piece would land)
  if (tetromino) {
    const ghostRow = getGhostRow(tetromino);
    context.save();
    context.globalAlpha = bossSpeedActive ? 0.5 : 0.3; // More visible during speed ability
    
    // Apply yellow tint to ghost piece during speed ability
    if (bossSpeedActive) {
      context.fillStyle = 'rgba(255, 255, 0, 0.3)';
      for (let r = 0; r < tetromino.matrix.length; r++) {
        for (let c = 0; c < tetromino.matrix[r].length; c++) {
          if (tetromino.matrix[r][c]) {
            let x = tetromino.col + c;
            let y = ghostRow + r;
            context.fillRect(x * grid, y * grid, grid - 1, grid - 1);
          }
        }
      }
    } else {
      for (let r = 0; r < tetromino.matrix.length; r++) {
        for (let c = 0; c < tetromino.matrix[r].length; c++) {
          if (tetromino.matrix[r][c]) {
            let x = tetromino.col + c;
            let y = ghostRow + r;
            const image = tetrominoImages[tetromino.name];
            if (image && image.complete && image.naturalHeight !== 0) {
              context.drawImage(image, x * grid, y * grid, grid - 1, grid - 1);
            } else {
              context.fillStyle = colors[tetromino.name];
              context.fillRect(x * grid, y * grid, grid - 1, grid - 1);
            }
          }
        }
      }
    }
    context.restore();
  }

  // Update falling tetromino physics and drawing
  if (tetromino && !gameOver) {
    // Only apply gravity if not paused
    if (!paused) {
      let dropFrames = Math.max(5, 35 - (level - 1) * 3); // gravity speed scales with level
      // Apply speed boost if boss speed is active
      if (bossSpeedActive) {
        dropFrames = Math.max(2, dropFrames - 15); // Much faster falling
      }
      if (++count > dropFrames) {
        tetromino.row++;
        count = 0;
        // if the piece collides after moving down, move it back and lock it
        if (!isValidMove(tetromino.matrix, tetromino.row, tetromino.col)) {
          tetromino.row--;
          placeTetromino();
        }
      }
    }
    drawTetromino(tetromino); // render current piece
  }

  // Pause overlay: block left column when paused and show message
  if (paused) {
    context.globalAlpha = 0.7;
    context.fillStyle = 'black';
    context.fillRect(0, 0, colWidth, canvas.height);
    context.globalAlpha = 1;
    context.fillStyle = 'white';
    context.font = 'bold 32px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('Pausing...', colWidth / 2, canvas.height / 2 - 20);
    context.font = 'bold 18px monospace';
    context.fillText('Press P to continue', colWidth / 2, canvas.height / 2 + 20);
  }

  context.restore(); // restore coordinate system back to full canvas

  // === Left Sidebar: Boss image and health bar ===
  context.save();
  const bossImg = bossImages[currentBoss]; // current boss image
  context.drawImage(bossImg, 20, 40, colWidth - 40, colWidth - 40); // draw boss portrait
  
  // Health bar background
  context.fillStyle = '#444';
  context.fillRect(20, colWidth + 20, colWidth - 40, 30);
  
  // Health bar foreground - show "NULL" for final boss
  if (currentBoss === 4) {
    // Final boss - show NULL/ERROR
    context.fillStyle = '#FF0000'; // Red for final boss
    context.fillRect(20, colWidth + 20, colWidth - 40, 30);
    context.fillStyle = 'white';
    context.font = 'bold 16px monospace';
    context.textAlign = 'center';
    context.fillText('NULL', 20 + (colWidth - 40) / 2, colWidth + 35);
  } else if (!bossAlive) {
    context.fillText(`ALL BOSSES DEFEATED!`, 20 + (colWidth - 40) / 2, colWidth + 35);
  } else {
    // Normal boss health bar
    context.fillStyle = '#4CAF50'; // Green color for health
    const healthWidth = Math.max(0, (colWidth - 40) * (bossHealth / bossMaxHealth));
    context.fillRect(20, colWidth + 20, healthWidth, 30);
    context.fillStyle = 'white';
    context.font = 'bold 16px monospace';
    context.textAlign = 'center';
    context.fillText(`Progress: ${bossHealth}/${bossMaxHealth}`, 20 + (colWidth - 40) / 2, colWidth + 35);
  }
  
  // === Boss Meter Bar - Hide Block ===
  const meterY = colWidth + 70; // Position below health bar
  // Meter background
  context.fillStyle = '#333';
  context.fillRect(20, meterY, colWidth - 40, 15);
  // Meter foreground - only show if boss is alive
  if (bossAlive) {
    context.fillStyle = '#3498db'; // Blue color for meter
    const meterWidth = Math.max(0, (colWidth - 40) * (bossMeter / bossMeterMax));
    context.fillRect(20, meterY, meterWidth, 15);
  }
  // Meter text
  context.fillStyle = 'white';
  context.font = 'bold 10px monospace';
  context.textAlign = 'center';
  if (!bossAlive) {
    context.fillText(`NO MORE ATTACKS!`, 20 + (colWidth - 40) / 2, meterY + 10);
  } else {
    context.fillText(`Hide Block: ${Math.floor(bossMeter)}%`, 20 + (colWidth - 40) / 2, meterY + 10);
  }
  
  // === Healing/Boost Ability Bar (Boss 2+) ===
  if (currentBoss >= 1 && bossAlive) {
    const abilityY = meterY + 25; // Position below hide block bar
    // Ability bar background
    context.fillStyle = '#333';
    context.fillRect(20, abilityY, colWidth - 40, 15);
    // Ability bar foreground (healing/boost timer)
    if (currentBoss === 4) {
      context.fillStyle = '#9C27B0'; // Purple color for boost ability (final boss)
    } else {
      context.fillStyle = '#FF4444'; // Red color for healing ability (bosses 1-3)
    }
    const abilityWidth = Math.max(0, (colWidth - 40) * (bossHealTimer / bossHealInterval));
    context.fillRect(20, abilityY, abilityWidth, 15);
    // Ability text
    context.fillStyle = 'white';
    context.font = 'bold 10px monospace';
    context.textAlign = 'center';
    const abilitySeconds = Math.ceil((bossHealInterval - bossHealTimer) / 60);
    if (currentBoss === 4) {
      context.fillText(`Boost: ${abilitySeconds}s`, 20 + (colWidth - 40) / 2, abilityY + 10);
    } else {
      context.fillText(`Heal: ${abilitySeconds}s`, 20 + (colWidth - 40) / 2, abilityY + 10);
    }
  }
  
  // === Speed Ability Bar (Boss 3+) ===
  if (currentBoss >= 2 && bossAlive) {
    const abilityY = meterY + 50; // Position below healing bar
    // Ability bar background
    context.fillStyle = '#333';
    context.fillRect(20, abilityY, colWidth - 40, 15);
    
    // Ability bar foreground (speed timer)
    if (bossSpeedActive) {
      // Show active speed duration
      context.fillStyle = '#FFA500'; // Orange color for speed ability
      const abilityWidth = Math.max(0, (colWidth - 40) * (bossSpeedDuration / (currentBoss === 4 ? 900 : bossSpeedMaxDuration)));
      context.fillRect(20, abilityY, abilityWidth, 15);
      // Ability text
      context.fillStyle = 'white';
      context.font = 'bold 10px monospace';
      context.textAlign = 'center';
      const speedSeconds = Math.ceil(bossSpeedDuration / 60);
      context.fillText(`Speed: ${speedSeconds}s`, 20 + (colWidth - 40) / 2, abilityY + 10);
    } else {
      // Show cooldown timer
      context.fillStyle = '#FFA500'; // Orange color for speed ability
      const abilityWidth = Math.max(0, (colWidth - 40) * (bossSpeedTimer / bossSpeedInterval));
      context.fillRect(20, abilityY, abilityWidth, 15);
      // Ability text
      context.fillStyle = 'white';
      context.font = 'bold 10px monospace';
      context.textAlign = 'center';
      const speedSeconds = Math.ceil((bossSpeedInterval - bossSpeedTimer) / 60);
      context.fillText(`Speed: ${speedSeconds}s`, 20 + (colWidth - 40) / 2, abilityY + 10);
    }
  }
  
  // === Immune/Resistance Ability Bar (Boss 4+) ===
  if (currentBoss >= 3 && bossAlive) {
    const abilityY = meterY + 75; // Position below speed bar
    // Ability bar background
    context.fillStyle = '#333';
    context.fillRect(20, abilityY, colWidth - 40, 15);
    
    // Ability bar foreground (immune timer)
    if (bossImmuneActive) {
      // Show active immune duration
      context.fillStyle = '#9B59B6'; // Purple color for immune ability
      const abilityWidth = Math.max(0, (colWidth - 40) * (bossImmuneDuration / (currentBoss === 4 ? 900 : bossImmuneMaxDuration)));
      context.fillRect(20, abilityY, abilityWidth, 15);
      // Ability text
      context.fillStyle = 'white';
      context.font = 'bold 10px monospace';
      context.textAlign = 'center';
      const immuneSeconds = Math.ceil(bossImmuneDuration / 60);
      if (currentBoss === 4) {
        context.fillText(`Resistance: ${immuneSeconds}s`, 20 + (colWidth - 40) / 2, abilityY + 10);
      } else {
        context.fillText(`Immune: ${immuneSeconds}s`, 20 + (colWidth - 40) / 2, abilityY + 10);
      }
    } else {
      // Show cooldown timer
      context.fillStyle = '#9B59B6'; // Purple color for immune ability
      const abilityWidth = Math.max(0, (colWidth - 40) * (bossImmuneTimer / bossImmuneInterval));
      context.fillRect(20, abilityY, abilityWidth, 15);
      // Ability text
      context.fillStyle = 'white';
      context.font = 'bold 10px monospace';
      context.textAlign = 'center';
      const immuneSeconds = Math.ceil((bossImmuneInterval - bossImmuneTimer) / 60);
      if (currentBoss === 4) {
        context.fillText(`Resistance: ${immuneSeconds}s`, 20 + (colWidth - 40) / 2, abilityY + 10);
      } else {
        context.fillText(`Immune: ${immuneSeconds}s`, 20 + (colWidth - 40) / 2, abilityY + 10);
      }
    }
  }
  
  // Event indicator if active - positioned below ability bars
  if (currentEvent && events[currentEvent].active && bossAlive) {
    const eventY = meterY + (currentBoss >= 3 ? 100 : 75); // Adjust position based on ability bars
    context.fillStyle = '#e74c3c';
    context.font = 'bold 12px monospace';
    context.textAlign = 'center';
    const secondsLeft = Math.ceil(eventDuration / 60);
    context.fillText(`${events[currentEvent].name}: ${secondsLeft}s`, 20 + (colWidth - 40) / 2, eventY);
  }
  
  context.restore();

  // === Right Sidebar: Next piece, Score, Combo, Lines ===
  const sidebarX = colWidth * 2 + 20;
  // Next piece preview box
  const previewBoxWidth = colWidth - 40;
  const previewBoxHeight = previewBoxWidth; // square
  const previewBoxX = sidebarX;
  const previewBoxY = 20;

  // Preview background and label
  context.fillStyle = '#111';
  context.fillRect(previewBoxX, previewBoxY, previewBoxWidth, previewBoxHeight);
  context.strokeStyle = 'white';
  context.lineWidth = 2;
  context.strokeRect(previewBoxX, previewBoxY, previewBoxWidth, previewBoxHeight);
  context.fillStyle = 'white';
  context.font = 'bold 16px monospace';
  context.textAlign = 'center';
  context.fillText("Next", previewBoxX + previewBoxWidth / 2, previewBoxY + 15);

  // Draw next tetromino in the preview area (only if not hidden by event or boss is dead)
  if (!(currentEvent === 'HIDE_NEXT_BLOCK' && events.HIDE_NEXT_BLOCK.active) || !bossAlive) {
    const nextName = nextTetromino.name;
    const matrix = nextTetromino.matrix;
    const previewGrid = Math.floor(grid * 0.6); // scale blocks down
    const pieceWidth = matrix[0].length * previewGrid;
    const pieceHeight = matrix.length * previewGrid;
    const startX = previewBoxX + (previewBoxWidth / 2 - pieceWidth / 2);
    const startY = previewBoxY + (previewBoxHeight / 2 - pieceHeight / 2);

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const x = startX + c * previewGrid;
          const y = startY + r * previewGrid;
          const image = tetrominoImages[nextName];
          if (image && image.complete && image.naturalHeight !== 0) {
            context.drawImage(image, x, y, previewGrid - 1, previewGrid - 1);
          } else {
            context.fillStyle = colors[nextName];
            context.fillRect(x, y, previewGrid - 1, previewGrid - 1);
          }
        }
      }
    }
  } else {
    // Show "?" when next block is hidden
    context.fillStyle = 'rgba(255, 255, 255, 0.5)';
    context.font = 'bold 48px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText("?", previewBoxX + previewBoxWidth / 2, previewBoxY + previewBoxHeight / 2);
  }

  // Score/Combo/Lines information box
  const scoreBoxWidth = colWidth - 40;
  const scoreBoxHeight = 120;
  const scoreBoxX = sidebarX;
  const scoreBoxY = previewBoxY + previewBoxHeight + 20;

  context.fillStyle = '#111';
  context.fillRect(scoreBoxX, scoreBoxY, scoreBoxWidth, scoreBoxHeight);
  context.strokeStyle = 'white';
  context.lineWidth = 2;
  context.strokeRect(scoreBoxX, scoreBoxY, scoreBoxWidth, scoreBoxHeight);

  // Draw score/combo/lines text inside box
  context.fillStyle = 'white';
  context.font = 'bold 18px monospace';
  context.textAlign = 'center';
  context.fillText("Score: " + score, scoreBoxX + scoreBoxWidth / 2, scoreBoxY + 30);
  context.fillText("Combo: " + comboCount, scoreBoxX + scoreBoxWidth / 2, scoreBoxY + 60);
  context.fillText("Lines: " + linesTotal, scoreBoxX + scoreBoxWidth / 2, scoreBoxY + 90);

  // Draw settings tab (always visible when game is started)
  if (gameStarted && !gameOver) {
    drawSettingsTab();
  }
}

// === Controls ===
// Handle keyboard input for movement, rotation, drop, pause and restart
document.addEventListener('keydown',function(e){
  if (!gameStarted) return; // ignore controls when on start screen
  if(gameOver){
    if(e.key==='r'||e.key==='R'){
      // Reset game state and go back to start screen
      score=0;level=1;linesTotal=0;
      comboCount=0;comboMultiplier=1.0;comboTexts=[];
      bossMeter = 0; // Reset meter
      currentEvent = null; // Clear any active event
      events.HIDE_NEXT_BLOCK.active = false; // Reset event state
      bossAlive = true; // Reset boss alive state
      bossTransitionTimer = 0;
      currentBoss = 0;
      bossMaxHealth = 500; // Reset to first boss max health
      bossSpeedActive = false; // Reset speed ability
      bossSpeedTimer = 0;
      bossSpeedDuration = 0;
      bossImmuneActive = false; // Reset immune ability
      bossImmuneTimer = 0;
      bossImmuneDuration = 0;
      resetPlayfield();
      tetromino=getNextTetromino();
      nextTetromino=getNextTetromino();
      gameOver=false;
      gameStarted=false;
      lineClearEffects = [];
      startLoop();
    }
    return;
  }
  // Toggle pause with P: when paused, music also pauses/resumes
  if (e.key === 'p' || e.key === 'P') {
    paused = !paused;
    if (paused) {
      bgMusic.pause();
    } else {
      bgMusic.play();
    }
    return;
  }

  // Prevent movement when paused
  if (paused) return;

  // Left/Right arrow movement (37 left, 39 right). Update column if move valid.
  if(e.which===37||e.which===39){
    const col=e.which===37?tetromino.col-1:tetromino.col+1;
    if(isValidMove(tetromino.matrix,tetromino.row,col)){
      tetromino.col=col;
      playSound('move'); // play move SFX
    }
  }

  // Up arrow rotates the piece (perform rotation matrix and check validity)
  if(e.which===38){
    const matrix=rotate(tetromino.matrix);
    if(isValidMove(matrix,tetromino.row,tetromino.col)){
      tetromino.matrix=matrix;
      playSound('rotate');
    }
  }

  // Down arrow soft drop: move piece down one cell; if collides, lock piece
  if(e.which===40){
    const row=tetromino.row+1;
    if(!isValidMove(tetromino.matrix,row,tetromino.col)){
      tetromino.row=row-1;
      placeTetromino();
      return;
    }
    tetromino.row=row;
  }

  // Hard Drop (Spacebar): instantly move piece to lowest valid row, play drop sound, show effect, lock piece
  if (e.code === 'Space') {
    Drop.currentTime = 0; // restart sound
    Drop.play();
    let fromRow = tetromino.row;
    let toRow = tetromino.row;
    // Find the lowest valid row
    while (isValidMove(tetromino.matrix, toRow + 1, tetromino.col)) {
      toRow++;
    }
    tetromino.row = toRow;
    // Save mini-effect info (used by drawing code if implemented)
    hardDropEffect = {
      col: tetromino.col,
      fromRow: fromRow,
      toRow: toRow,
      timer: 10
    };
    playSound('move');
    placeTetromino();
  }
});

let gameStarted = false; // initial state: showing start screen

// Start button object for start screen UI (position updated at runtime)
let startButton = {
  x: 0,
  y: 0,
  width: 200,
  height: 50,
  hover: false
};

let mouse = { x: 0, y: 0 };

// Track mouse movement to detect hover state on the start button
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;

  // Settings tab hover
  if (gameStarted) {
    const inSettingsArea = 
      mouse.x >= settingsArea.x && 
      mouse.x <= settingsArea.x + settingsArea.width &&
      mouse.y >= settingsArea.y && 
      mouse.y <= settingsArea.y + (settingsTabOpen ? settingsArea.height : settingsArea.tabHeight);
    
    if (inSettingsArea && settingsTabOpen) {
      // Check for tab hovers
      for (const [key, tab] of Object.entries(settingsTabs)) {
        tab.hover = 
          mouse.x >= tab.x && mouse.x <= tab.x + tab.width &&
          mouse.y >= tab.y && mouse.y <= tab.y + tab.height;
      }
    }
  }

  // Start button hover (keep existing)
  startButton.hover = 
    mouse.x >= startButton.x &&
    mouse.x <= startButton.x + startButton.width &&
    mouse.y >= startButton.y &&
    mouse.y <= startButton.y + startButton.height;
});

// Update click handling for new settings system
canvas.addEventListener('click', function(e) {
  if (!gameStarted) {
    // Start screen handling (keep existing)
    if (startButton.hover && !gameStarted) {
      gameStarted = true;
      bossHealth = 0;
      bgMusic.play();
      currentBoss = 0;
      bossAlive = true;
      startLoop();
    }
    return;
  }

  // Settings tab handling
  const inSettingsHeader = 
    mouse.x >= settingsArea.x && 
    mouse.x <= settingsArea.x + settingsArea.width &&
    mouse.y >= settingsArea.y && 
    mouse.y <= settingsArea.y + settingsArea.tabHeight;

  if (inSettingsHeader) {
    // Toggle settings tab
    settingsTabOpen = !settingsTabOpen;
    return;
  }

  if (settingsTabOpen) {
    // Check for tab clicks
    for (const [key, tab] of Object.entries(settingsTabs)) {
      if (tab.hover) {
        activeSettingsTab = key;
        return;
      }
    }

    // Check for close button click
    const closeButton = {
      x: settingsArea.x + settingsArea.width - 70,
      y: settingsArea.y + 5,
      width: 60,
      height: 20
    };
    
    if (mouse.x >= closeButton.x && mouse.x <= closeButton.x + closeButton.width &&
        mouse.y >= closeButton.y && mouse.y <= closeButton.y + closeButton.height) {
      settingsTabOpen = false;
      return;
    }

    // Handle slider clicks in audio tab
    if (activeSettingsTab === 'audio') {
      const sliderX = settingsArea.x + 20;
      const sliderWidth = settingsArea.width - 40;
      
      // Sound volume slider
      if (mouse.y >= settingsArea.y + settingsArea.tabHeight + 45 && 
          mouse.y <= settingsArea.y + settingsArea.tabHeight + 65) {
        updateVolumeFromMouse(mouse.x);
        sliderDragging = true;
      }
      
      // Music volume slider  
      if (mouse.y >= settingsArea.y + settingsArea.tabHeight + 85 && 
          mouse.y <= settingsArea.y + settingsArea.tabHeight + 105) {
        updateMusicVolumeFromMouse(mouse.x);
        musicSliderDragging = true;
      }
    }
  }
});

canvas.addEventListener('mousemove', function(e) {
  if (settingsTabOpen) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    if (sliderDragging) {
      updateVolumeFromMouse(mouseX);
    }
    if (musicSliderDragging) {
      updateMusicVolumeFromMouse(mouseX);
    }
  }
});

canvas.addEventListener('mouseup', function() {
  sliderDragging = false;
  musicSliderDragging = false;
});

// Draw the start screen (title and start button)
function drawStartScreen() {
  context.fillStyle = 'black';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Title text
  context.fillStyle = 'white';
  context.font = 'bold 36px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('TERTRIS:REPAIRING CONNECT', canvas.width / 2, canvas.height / 2 - 60);

  // Setup button positions centered on canvas
  startButton.x = canvas.width / 2 - startButton.width / 2;
  startButton.y = canvas.height / 2;

  // Draw start button (background and border)
  context.fillStyle = startButton.hover ? '#111' : '#333';
  context.fillRect(startButton.x, startButton.y, startButton.width, startButton.height);
  context.strokeStyle = 'white';
  context.lineWidth = 2;
  context.strokeRect(startButton.x, startButton.y, startButton.width, startButton.height);

  // Button label
  context.fillStyle = 'white';
  context.font = 'bold 20px monospace';
  context.fillText('Start Game', canvas.width / 2, startButton.y + startButton.height / 2);
}

// Start screen animation loop: draws start screen until game starts, then begins main loop
function startLoop(){
  if(!gameStarted){
    drawStartScreen();
    rAF = requestAnimationFrame(startLoop);
  } else {
    cancelAnimationFrame(rAF); // stop start screen animation and start game loop
    rAF = requestAnimationFrame(loop);
  }
}

// Additional key handling for debug or boss HP adjustments and restart with different key
document.addEventListener('keydown',function(e){
  if(gameOver&&(e.key==='-')){
    // reset and go to start screen (debug shortcut)
    score=0;level=1;linesTotal=0;
    comboCount=0;comboMultiplier=1.0;comboTexts=[];
    bossMeter = 0; // Reset meter
    currentEvent = null; // Clear any active event
    events.HIDE_NEXT_BLOCK.active = false; // Reset event state
    bossAlive = true; // Reset boss alive state
    bossTransitionTimer = 0;
    currentBoss = 0;
    bossMaxHealth = 500; // Reset to first boss max health
    bossSpeedActive = false; // Reset speed ability
    bossSpeedTimer = 0;
    bossSpeedDuration = 0;
    bossImmuneActive = false; // Reset immune ability
    bossImmuneTimer = 0;
    bossImmuneDuration = 0;
    resetPlayfield();
    tetromino=getNextTetromino();
    nextTetromino=getNextTetromino();
    gameOver=false;
    gameStarted=false;
    lineClearEffects = [];
    startLoop();
  }

  // '-' key decreases boss health (debug)
  if (e.key === '-') {
    if (bossHealth > 0 && currentBoss < 4) {
      bossHealth -= 10;
      console.log("Boss health:", bossHealth);
    }
  }

  // '+' key increases boss health (debug, capped at max)
  if (e.key === '+') {
    if (bossHealth < bossMaxHealth && currentBoss < 4) {
      bossHealth += 10;
      console.log("Boss health:", bossHealth);
      if(bossHealth >= bossMaxHealth && bossTransitionTimer === 0 && bossAlive) {
        bossTransitionTimer = bossTransitionDuration;
      }
    }
  }

  // '1' plays a fast line-clear sound (debug)
  if (e.key === '1') {
   clear.playbackRate = 2.5;
   clear.currentTime = 0; 
   clear.play();
  }
});

startLoop(); // begin by showing start screen

// === Boss assets and state ===
// Load boss images (portraits) for left sidebar
const bossImages = [
  new Image(),
  new Image(),
  new Image(),
  new Image(),
  new Image()
];
bossImages[0].src = 'Bosses1.png';
bossImages[1].src = 'Bosses2.png';
bossImages[2].src = 'Bosses3.png';
bossImages[3].src = 'Bosses4.png';
bossImages[4].src = 'Bosses5.png';

let currentBoss = 0; // index of current boss image
let bossHealth = 0; // current boss hp - START AT 0
let bossMaxHealth = 500; // boss max hp

// previewGrid reused for drawing scaled-down preview in sidebar
const previewGrid = Math.floor(grid * 0.6); // 60% of normal block size

// Return a queue of next pieces (ensure tetrominoSequence has enough items)
function getNextQueue(count = 1) {
  while (tetrominoSequence.length < count) {
    generateSequence(); // refill bag if needed
  }
  return tetrominoSequence.slice(-count).reverse(); // return last `count` items reversed (next first)
}

// Additional canvas click handler (duplicate of start button click handling, safe)
canvas.addEventListener('click', function(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (
    mouseX >= startButton.x &&
    mouseX <= startButton.x + startButton.width &&
    mouseY >= startButton.y &&
    mouseY <= startButton.y + startButton.height
  ) {
    // Start game on click inside button
    gameStarted = true;
    bossHealth = 0; // Start with 0 HP
    currentBoss = 0;
    bossAlive = true;
    bgMusic.play();
    startLoop();
  }
});