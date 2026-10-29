# 8 Maluco — jogo online para 4 pessoas

Jogo de cartas responsivo para telemóvel e computador. Cada jogador entra com o seu telemóvel usando o código da mesma sala.

## Testar no computador

1. Instala Node.js 18 ou superior: https://nodejs.org/
2. Extrai o ZIP e abre a pasta `8-maluco`.
3. Num terminal dentro da pasta, executa:
   ```bash
   npm install
   npm start
   ```
4. Abre http://localhost:3000 no navegador.

## Colocar online para os amigos

É necessário alojar o servidor num serviço que suporte aplicações Node.js e WebSockets (por exemplo, Render ou Railway).

1. Cria um repositório Git com estes ficheiros.
2. Cria um novo serviço Web no fornecedor de alojamento e liga o repositório.
3. O comando de instalação é `npm install` e o comando de arranque é `npm start`.
4. Depois de o serviço ficar ativo, partilha o endereço HTTPS com os 3 amigos. Cada pessoa abre o mesmo endereço no telemóvel e entra com o código da sala.

**Importante:** o ZIP contém o código completo do jogo, mas não publica sozinho um endereço público. O servidor tem de ser alojado para permitir partidas entre telemóveis em redes diferentes.

## Regras implementadas

- 4 jogadores por sala; 7 cartas para cada jogador.
- Jogar por naipe ou valor; o 8 permite escolher o naipe.
- Valete salta o próximo jogador; 2 faz o próximo comprar duas cartas e perder a vez; Ás inverte o sentido.
- Comprar uma carta termina a vez.
- O primeiro jogador sem cartas ganha.

Esta é uma implementação inicial. As salas ficam na memória do servidor e uma partida em curso termina se um jogador se desligar. Não há contas, chat ou persistência entre reinícios.
