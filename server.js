const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static("public"));

const rooms = new Map();
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RED = ["♥","♦"];

function makeDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({suit, rank, id: `${rank}${suit}`});
  for (let i=deck.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]];
  }
  return deck;
}
function roomCode() { return crypto.randomBytes(3).toString("hex").toUpperCase(); }
function nextIndex(room, from=room.turn) {
  let i = (from + room.direction + room.players.length) % room.players.length;
  return i;
}
function publicState(room, socketId) {
  return {
    code: room.code, status: room.status, players: room.players.map((p,i)=>({
      name:p.name, count:p.hand.length, connected: !!io.sockets.sockets.get(p.id),
      isYou:p.id===socketId, isTurn:room.status==="playing" && room.players[room.turn]?.id===p.id,
      index:i
    })),
    top: room.discard[room.discard.length-1] || null,
    suit: room.activeSuit, direction: room.direction, currentPlayer: room.players[room.turn]?.name || "",
    hand: room.players.find(p=>p.id===socketId)?.hand || [],
    drawCount: room.deck.length, message: room.message, winner: room.winner,
    status: room.status
  };
}
function broadcast(room) {
  for (const p of room.players) io.to(p.id).emit("state", publicState(room,p.id));
}
function say(room, msg) { room.message = msg; }
function startGame(room) {
  if (room.players.length !== 4) return false;
  const deck = makeDeck();
  room.players.forEach(p => p.hand = deck.splice(0,7));
  room.deck = deck;
  room.discard = [];
  let first = room.deck.pop();
  while (first.rank === "8") { room.deck.unshift(first); first=room.deck.pop(); }
  room.discard.push(first);
  room.activeSuit = first.suit;
  room.turn = 0; room.direction = 1; room.winner = null; room.status = "playing";
  say(room, `Começou! A carta inicial é ${first.rank}${first.suit}.`);
  return true;
}
function drawOne(room, player) {
  if (!room.deck.length) {
    if (room.discard.length > 1) {
      const top = room.discard.pop();
      room.deck = room.discard.splice(0).sort(()=>Math.random()-.5);
      room.discard = [top];
    } else return null;
  }
  const card=room.deck.pop(); player.hand.push(card); return card;
}
function canPlay(room, card) {
  const top=room.discard[room.discard.length-1];
  return card.rank==="8" || card.suit===room.activeSuit || card.rank===top.rank;
}
function advance(room) { room.turn = (room.turn + room.direction + room.players.length) % room.players.length; }
function findPlayer(room, id) { return room.players.find(p=>p.id===id); }

io.on("connection", socket => {
  socket.on("createRoom", ({name}) => {
    name=String(name||"Jogador").trim().slice(0,18)||"Jogador";
    let code; do { code=roomCode(); } while(rooms.has(code));
    const room={code, players:[{id:socket.id,name,hand:[]}], status:"lobby", deck:[],discard:[],activeSuit:null,turn:0,direction:1,message:"À espera de mais 3 jogadores.",winner:null};
    rooms.set(code,room); socket.join(code); socket.data.room=code;
    socket.emit("joined",{code}); broadcast(room);
  });
  socket.on("joinRoom", ({code,name}) => {
    code=String(code||"").trim().toUpperCase(); name=String(name||"Jogador").trim().slice(0,18)||"Jogador";
    const room=rooms.get(code);
    if(!room) return socket.emit("errorMessage","Sala não encontrada. Confirma o código.");
    if(room.status!=="lobby") return socket.emit("errorMessage","Este jogo já começou.");
    if(room.players.length>=4) return socket.emit("errorMessage","A sala já tem 4 jogadores.");
    if(room.players.some(p=>p.name.toLowerCase()===name.toLowerCase())) name += ` ${room.players.length+1}`;
    room.players.push({id:socket.id,name,hand:[]}); socket.join(code); socket.data.room=code;
    socket.emit("joined",{code});
    say(room,`${name} entrou na sala (${room.players.length}/4).`);
    if(room.players.length===4) startGame(room);
    broadcast(room);
  });
  socket.on("startGame", () => {
    const room=rooms.get(socket.data.room); if(!room) return;
    if(room.players.length!==4) return socket.emit("errorMessage","São precisos 4 jogadores para começar.");
    if(room.status==="lobby"){startGame(room);broadcast(room);}
  });
  socket.on("playCard", ({id,suit}) => {
    const room=rooms.get(socket.data.room); if(!room||room.status!=="playing") return;
    const player=room.players[room.turn];
    if(!player||player.id!==socket.id) return socket.emit("errorMessage","Ainda não é a tua vez.");
    const idx=player.hand.findIndex(c=>c.id===id); if(idx<0) return;
    const card=player.hand[idx];
    if(!canPlay(room,card)) return socket.emit("errorMessage","Joga uma carta do mesmo naipe, valor ou um 8.");
    if(card.rank==="8" && !SUITS.includes(suit)) return socket.emit("errorMessage","Escolhe um naipe para o 8.");
    player.hand.splice(idx,1); room.discard.push(card);
    room.activeSuit=card.rank==="8"?suit:card.suit;
    if(player.hand.length===0){room.status="finished";room.winner=player.name;say(room,`🏆 ${player.name} ganhou!`);broadcast(room);return;}
    if(card.rank==="J"){advance(room);say(room,`${player.name} jogou Valete: o próximo jogador perde a vez.`);advance(room);}
    else if(card.rank==="2"){advance(room);const target=room.players[room.turn];drawOne(room,target);drawOne(room,target);say(room,`${player.name} jogou 2: ${target.name} compra 2 cartas e perde a vez.`);advance(room);}
    else if(card.rank==="A"){room.direction*=-1;say(room,`${player.name} inverteu o sentido!`);advance(room);}
    else {say(room,`${player.name} jogou ${card.rank}${card.suit}.`);advance(room);}
    broadcast(room);
  });
  socket.on("drawCard", () => {
    const room=rooms.get(socket.data.room); if(!room||room.status!=="playing") return;
    const player=room.players[room.turn];
    if(!player||player.id!==socket.id) return socket.emit("errorMessage","Ainda não é a tua vez.");
    const card=drawOne(room,player);
    if(!card) return socket.emit("errorMessage","Não há mais cartas para comprar.");
    say(room,`${player.name} comprou uma carta.`);
    // A carta comprada encerra a vez, para manter o jogo simples e rápido.
    advance(room);broadcast(room);
  });
  socket.on("disconnect", () => {
    const code=socket.data.room, room=rooms.get(code); if(!room)return;
    const idx=room.players.findIndex(p=>p.id===socket.id); if(idx<0)return;
    const [gone]=room.players.splice(idx,1);
    if(room.status==="playing" && room.players.length>0){
      if(idx<room.turn) room.turn--;
      if(room.turn>=room.players.length) room.turn=0;
      say(room,`${gone.name} saiu. A partida foi interrompida; cria uma nova sala para jogar novamente.`);
      room.status="finished";
    } else say(room,`${gone.name} saiu da sala.`);
    if(room.players.length===0) rooms.delete(code); else broadcast(room);
  });
});
server.listen(PORT,()=>console.log(`8 Maluco disponível na porta ${PORT}`));