import { Vector3 } from "three"
import SubdivisionRendererExample from "./subdivision";
import { CSS2DObject } from "three/examples/jsm/Addons.js";

export class Idea {
  renderer: SubdivisionRendererExample;
  position: Vector3 = new Vector3(0, 0, 0);
  index: number;
  idea: string;
  generated: boolean = false;
  label: CSS2DObject | null = null;
  radius: number = 0.25; // radius of the point in the scene

  constructor(idea: string, renderer: SubdivisionRendererExample) {
    this.renderer = renderer;
    this.idea = idea;
    this.index = this.renderer.createPoint(this.position, this.radius);


    const earthMassDiv = document.createElement('div');
    earthMassDiv.innerHTML = `
      <div class="flag">
      <!-- <p>Textwdwdwdw</p> -->
      <input type="text" value="New Point"  />
    </div>
    `;

    const earthMassLabel = new CSS2DObject(earthMassDiv);
    earthMassLabel.position.set(0, 0.5, 0);

    // auto focus the input field
    const input = earthMassDiv.querySelector('input') as HTMLInputElement;
    setTimeout(() => {
      input.focus();
      // and highlight the text
      input.select();
    }, 1);

    // key down enter
    input.onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
        this.idea = input.value;
        this.renderer.updatePoint(this.index, this.position);
        earthMassLabel.element.innerHTML = `
          <div class="flag">
          <p>${this.idea}</>
        </div>`
      }
    };

    this.renderer.scene.add(earthMassLabel);

    this.label = earthMassLabel;
  }

  public setRadius(radius: number) {
    this.radius = radius;
    this.renderer.setRadius(this.index, radius);
  }

  public focus() {
    setTimeout(() => {
      if (this.label) {
        this.label.element.querySelector('input')?.focus();
        // and select
        this.label.element.querySelector('input')?.select();
      }
    }, 1);
  }

  public moveToMousePosition(event: MouseEvent) {
    const newPosition = this.renderer.mouseToWorld(event.clientX, event.clientY);

    this.moveTo(newPosition);
    this.renderer.updatePoint(this.index, newPosition);
  }

  public moveTo(position: Vector3) {
    this.position.copy(position);
    this.renderer.updatePoint(this.index, new Vector3(position.x, position.y, 0));



    this.label!.position.copy(new Vector3(position.x, position.z, position.y));

    this.renderer.getElevationAt(new Vector3(position.x, position.y, 0)).then((elevation) => {
      const _elevation = -elevation - 1;
      console.log(_elevation)
      this.label!.position.setY((_elevation * 0.15) + 0.15);
    });

  };

  public recalculatePosition() {
    this.renderer.getElevationAt(this.position).then((position) => {
      const _elevation = -position - 1;
      this.label!.position.setY((_elevation * 0.30) + 0.15);

    console.log(this.renderer.getCameraScale(), 0.8 - _elevation);

      if (this.renderer.getCameraScale() < 0.8 - _elevation * 0.15) {
        this.label!.element.style.display = 'none';
      }
      else {
        this.label!.element.style.display = 'block';
      }

      // distance from camera affects opacity
      const distance = this.renderer.camera.position.distanceTo(this.label!.position);
      console.log(distance, this.label!.position, this.renderer.camera.position);
      const opacity = (1 - ((distance / this.renderer.getCameraScale()) - 2.0) / (5.0 - 2.0));
      console.log(opacity);
      this.label!.element.style.opacity = opacity.toString();
      
    });

    // check camera scale
    
  }

}

export default class IdeaManager {

  public ideas: Idea[] = [];
  public renderer: SubdivisionRendererExample;

  constructor(renderer: SubdivisionRendererExample) {
    this.renderer = renderer;

  }

  public addIdea(idea: string): Idea {
    const newIdea = new Idea(idea, this.renderer);
    this.ideas.push(newIdea);
    return newIdea;
  }

  public update() {
    this.ideas.forEach((idea) => {
      idea.recalculatePosition();
    });
  }
}
