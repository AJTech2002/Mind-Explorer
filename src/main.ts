import './style.css'
import Renderer from "./geometree/examples/subdivision";
import IdeaManager, { Idea } from './geometree/examples/ideamanager';

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <style>
      body {
        margin: 0;
        overflow: hidden;
      }

      #void {
        position: absolute;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 0;
      } 

      #void-2d {
        position: absolute;
        top: 0;
        z-index: 1;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none; /* Allow clicks to pass through */
      } 

      .flag {
        position: absolute;
        // border: 2px solid white;
        border-right: 0;
        border-bottom: 0;
        border-top: 0;
        z-index: 2;
        height: 30px;
        width: 100px;
        bottom: 15px;
        // right: 25%;
        transform: translateX(-50%);
      }

     .flag input {
        position: absolute;
        left: 5px;
        top: 0px;
        text-align: left;
        background: black;
      }
  
      .flag p {
        position: absolute;
        // left: 6px;
        // top: -10px;
        font-size: 12px;
        text-align: center;
        font-weight: bold;
        width: 100%;
        background-color:rgba(60, 60, 60, 0.5);

        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);

        color: white;
      }
    </style>
   
    <div class="" id="void-2d"></div>
    <canvas id="void"></canvas>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#void')!;
const canvas_2d = document.querySelector<HTMLDivElement>('#void-2d')!;
const renderer = new Renderer(canvas, canvas_2d);
const ideaManager = new IdeaManager(renderer);

let creatingPoint: Idea | null = null;

canvas.addEventListener('pointerdown', (event) => {
  if (event.button === 0 && creatingPoint === null) { // Left mouse button
    creatingPoint = ideaManager.addIdea("New Idea");
    creatingPoint.moveToMousePosition(event);
    renderer.lockZoom(true);
  }

  if (creatingPoint !== null) {
    creatingPoint.focus();
  }
});

canvas.addEventListener('wheel', (event) => {
  let delta = event.deltaY;
  creatingPoint?.setRadius(creatingPoint.radius - delta * 0.001);
});

canvas.addEventListener('pointermove', (event) => {
  if (creatingPoint !== null) {
    creatingPoint.moveToMousePosition(event);

  }
});

const render = () => {
  ideaManager.update();
  requestAnimationFrame(render);
};

render();

// check on enter key
document.addEventListener('keydown', (event) => {
  console.log("Creating point completed");
  if (event.key === 'Enter' && creatingPoint !== null) {
    creatingPoint = null;
    renderer.lockZoom(false);
  }
});
