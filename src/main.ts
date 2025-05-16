import './style.css'
import Renderer from './renderer';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
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
      } 
    </style>
    <canvas id="void"></canvas>
  </div>
`

const canvas = document.querySelector<HTMLCanvasElement>('#void')!;
const renderer = new Renderer(canvas);
