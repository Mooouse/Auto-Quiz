import { boot } from '../.platform/packages/player/src/boot.ts';
import game from 'virtual:gp/game';
boot(document.querySelector<HTMLCanvasElement>('#game')!, game).catch((error) => {
 const message = document.createElement('p'); message.textContent = `AUTO QUIZ: ${error instanceof Error ? error.message : String(error)}`; document.body.append(message);
});
