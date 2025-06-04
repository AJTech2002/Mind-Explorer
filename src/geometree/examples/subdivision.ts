import * as THREE from "three/webgpu";
import Renderer from "../../core/renderer.ts";
import GeometryOutput from "../nodes/output.ts";
import PlanePrimitive from "../nodes/primitives/plane.ts";
import GeometrySubdivider from "../nodes/functional/subdivider.ts";
import { abs, array, bool, clamp, dFdx, dFdy, distance, float, floor, Fn, If, int, length, Loop, max, min, mix, mx_noise_float, mx_noise_vec3, normalLocal, positionLocal, positionWorld, pow, rotate, sin, smoothstep, step, uniform, uniformArray, uv, vec3, wgslFn } from "three/tsl";
import { mx_perlin_noise_float, mx_perlin_noise_vec3 } from "three/src/nodes/materialx/lib/mx_noise.js";

export default class SubdivisionRendererExample extends Renderer {

  // time uniform
  uniformZoom = uniform(float(8))
  uniformOffset = uniform(new THREE.Vector2(0, 0));
  uniformTime = uniform(0.0);

  positionLength = uniform(1);

  private material!: THREE.MeshBasicNodeMaterial;
  private transforming = false;
  private terrain!: THREE.Mesh;

  // Raycasting and interaction variables
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private lastHitPoint = new THREE.Vector3();
  private currentHitPoint = new THREE.Vector3();
  private boundingBox = new THREE.Box3();

  private getElevation = Fn((pos) => float(0.0));

  private radiusValues: number[] = [];
  private values: THREE.Vector3[] = [];

  override async onStart() {

    setTimeout(() => {

      this.createTerrain();

    }, 200);

    // this.controls.enableRotate = false;

    // Add event listeners for mouse interaction
    // window.addEventListener('mousedown', this.onMouseDown.bind(this));
    // window.addEventListener('mousemove', this.onMouseMove.bind(this));
    // window.addEventListener('mouseup', this.onMouseUp.bind(this));
    //window.addEventListener('wheel', this.onMouseWheel.bind(this));
  }

  private onMouseDown(e: MouseEvent) {
    // Convert mouse position to normalized device coordinates (-1 to +1)
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // Set up raycaster from camera
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersection = this.raycaster.ray.intersectBox(this.boundingBox, this.currentHitPoint);

    if (intersection) {
      // We hit the terrain - store the hit point
      this.lastHitPoint.copy(intersection);
      this.transforming = true;
      this.controls.rotateSpeed = 0.0; // Disable camera rotation while dragging
    } else {
      this.transforming = false;
      this.controls.rotateSpeed = 1.0; // Allow camera rotation if not dragging terrain
    }
  }

  public mouseToWorld(mouseX: number, mouseY: number): THREE.Vector3 {
    // Convert mouse position to normalized device coordinates (-1 to +1)
    const x = (mouseX / window.innerWidth) * 2 - 1;
    const y = -(mouseY / window.innerHeight) * 2 + 1;

    // Set up raycaster from camera
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

    // Find intersection with the terrain
    const intersection = this.raycaster.ray.intersectBox(this.boundingBox, this.currentHitPoint);
    return new THREE.Vector3(intersection?.x ?? 0, intersection?.z ?? 0, intersection?.y ?? 0) || new THREE.Vector3(0, 0, 0);
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.transforming) return;

    // Update mouse position
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // Cast ray from current mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Create a plane at the same height as the original hit point
    // This helps ensure consistent dragging even if the cursor moves off the terrain
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.lastHitPoint.y);

    // Find where the ray intersects this plane
    const targetPoint = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(dragPlane, targetPoint)) {
      // Calculate the world-space delta between last hit point and current hit
      const delta = new THREE.Vector3().subVectors(targetPoint, this.lastHitPoint);

      // Update the uniform offset based on the world-space movement
      // We only use X and Z components for a top-down terrain
      this.uniformOffset.value.x -= delta.x;
      this.uniformOffset.value.y -= delta.z;

      // Update last hit point for next frame
      this.lastHitPoint.copy(targetPoint);
    }
  }

  private onMouseUp() {
    this.transforming = false;
    this.controls.rotateSpeed = 1.0; // Re-enable camera rotation
  }

  async createTerrain() {
    const light = new THREE.DirectionalLight(0xffffff, 2);
    //light.position.set(2, 2, 2)
    light.lookAt(0, 0, 0);
    light.castShadow = true;

    this.scene.add(light);

    const material = new THREE.MeshBasicNodeMaterial({
      color: 0x000000,
      side: THREE.DoubleSide,
      wireframe: false,
      dithering: true,
    });

    this.material = material;

    const position = positionLocal.xyz;
    const samplePosition = position.add(vec3(this.uniformOffset, 0));
    // const samplePosition = position;
    const frequency = this.uniformZoom;
    const warp = 0.15;
    const noise = mx_noise_vec3(samplePosition.add(vec3(this.uniformTime.mul(0.4), 0, 0))).mul(2.0).sub(1.0);
    const edgeThreshold = float(0.02);
    const uvCoord = uv();
    const edgeDist = min(
      min(uvCoord.x, float(1.0).sub(uvCoord.x)),
      min(uvCoord.y, float(1.0).sub(uvCoord.y))
    );

    let dissolve = step(edgeThreshold, edgeDist);


    const steps = warp * 25;

    let values = [];
    for (let i = 0; i < 100; i++) {
      values.push(new THREE.Vector3(0, 0, 0));
      this.radiusValues.push(Math.random() * 0.35 + 0.1);
    }

    this.positionLength.value = 0;

    this.values = values;

    let positions = uniformArray(values, 'vec3');
    let radii = uniformArray(this.radiusValues, 'float');

    this.scene.background = new THREE.Color(0xFFFFFF);


    const getElevation = Fn(([inputPosition = vec3(0, 0, 0)]) => {
      let t_elevation = float(0.0).toVar();

      Loop({ type: 'int', start: 0, end: this.positionLength, condition: '<' }, ({ i }) => {
        const _position = positions.element(i).xyz;
        const noiseOffset = noise.xyz.mul(0.2).mul(
          clamp(pow(distance(_position.xy, inputPosition.xy), 2), 0, 2)
        );
        const position = _position.add(noiseOffset);
        const radius = radii.element(i);
        const dTo = min(distance(position.xy, inputPosition.xy).div(radius), 1.0);
        t_elevation.subAssign(float(1.0).sub(dTo));
      });

      return t_elevation;
    }
    );

    const getBaseColor = Fn(([inputPosition = vec3(0, 0, 0)]) => {
      const baseCol = vec3(244.0, 44.0, 4.0).div(255);
      const baseColIf = vec3(3, 161, 252).div(50);

      let col = vec3(0, 0, 0).toVar();
      let didntFind = bool(true).toVar();

      Loop({ type: 'int', start: 0, end: this.positionLength, condition: '<' }, ({ i }) => {
        const _position = positions.element(i).xyz;
        const noiseOffset = noise.xyz.mul(0.2).mul(
          clamp(pow(distance(_position.xy, inputPosition.xy), 2), 0, 2)
        );
        const position = _position.add(noiseOffset);
        const radius = radii.element(i);
        
        // check if the length of col < 0.1
        If (didntFind, () => {
          If(distance(position.xy, inputPosition.xy).lessThan(0.03) , () => {
            col.assign( baseColIf );
            didntFind.assign(false);
          }).Else(() => {
            col.assign(baseCol);
          });
      })

      });

      return col;
    }
    );

    this.getElevation = getElevation;


    const noiseInput = samplePosition.mul(frequency);
    let elevation = getElevation(samplePosition);
    let steppedElevation = floor(elevation.mul(steps)).div(steps).mul(warp).mul(dissolve);
    let intensity = (positionWorld.y.div(0.1));
    // let intensity = float(1).sub(positionLocal.z.div(1));

    //const edge = pow(abs(dFdx(intensity)).add(abs(dFdy(intensity))), 0.5);
    let edge = pow(abs(dFdy(intensity)), 0.3);
    let finalIntensity = float(1).sub(smoothstep(0.02, 0.65, edge)).mul(intensity);

    // material.colorNode =  finalIntensity;
    // 
    const baseCol2 = vec3(36, 15, 140).div(200);
    const baseCol = getBaseColor(samplePosition);
    material.colorNode = mix(baseCol2, baseCol, clamp(finalIntensity, 0.0, 1.0)).mul(finalIntensity);
    material.positionNode = vec3(position.x, position.y, steppedElevation);

    this.camera.position.set(2, 2, 2);
    this.camera.lookAt(0, 0, 0);

    // Create terrain mesh
    this.terrain = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.5, 800, 800), material);
    this.terrain.rotateX(Math.PI / 2);
    this.terrain.position.set(0, 0, 0);

    //this.createSidePlanes();
    this.scene.add(this.terrain);

    // create a bounding box from a box to raycast
    const box = new THREE.Box3();
    box.setFromObject(this.terrain);

    this.boundingBox = box;

    this.createSidePlanes();
  }

  createSidePlanes() {
    const group = new THREE.Group();
    const size = 1;
    const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
    const intensity = positionLocal.y;
    // material.colorNode = mix ( vec3(0.0, 0.0, 0.0),  vec3(244.0, 44.0, 4.0).div(255), intensity)
    material.colorNode = vec3(0.0, 0.0, 0.0);
    // material.opacityNode = min(intensity, 1.0);

    material.transparent = true;
    // Front (+Z)
    const front = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    front.position.z = size / 2;
    group.add(front);

    // Back (-Z)
    const back = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    back.position.z = -size / 2;
    back.rotateY(Math.PI); // flip it
    group.add(back);

    // Right (+X)
    const right = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    right.position.x = size / 2;
    right.rotateY(-Math.PI / 2);
    group.add(right);

    // Left (-X)
    const left = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    left.position.x = -size / 2;
    left.rotateY(Math.PI / 2);
    group.add(left);

    // create bottom plane
    const blackMaterial = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
    blackMaterial.colorNode = vec3(0, 0, 0);
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(size, size), blackMaterial);
    bottom.position.y = 0.5;
    bottom.rotateX(Math.PI / 2);
    group.add(bottom);



    group.scale.set(3.5, 0.25, 3.5);
    group.position.set(0, -0.125, 0);
    this.scene.add(group);
  }

  private timer = 0.1;

  public async getElevationAt(position: THREE.Vector3): Promise<number> {
    if (!this.values || !this.positionLength) {
      return 0.0;
    }

    let elevation = 0;
    const radius = 0.15;

    for (let i = 0; i < this.positionLength.value; i++) {
      const basePoint = this.values[i];

      // Only use XY for distance like TSL (ignore Z)
      const dx = basePoint.x - position.x;
      const dy = basePoint.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const dTo = Math.min(dist / radius, 1.0);
      elevation -= (1.0 - dTo);
    }

    return elevation;
  }



  override onUpdate(t) {
    super.onUpdate(t);
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }


    this.uniformTime.value = t / 1000.0;

    // this.renderer.renderAsync(this.scene, this.camera);


    // this.timer -= this.delta;

    // if (this.values && this.values[0] && this.nextValues && this.values.length === this.nextValues.length) {
    //   if (this.material && this.timer < 0) {
    //     for (let i = 0; i < 100; i++) {
    //         this.nextValues[i] = new THREE.Vector3( Math.random() * 5 - 2.5, Math.random() * 5 - 2.5, Math.random() * 2 - 1 );
    //     }
    //     this.timer = 2;
    //   }
    //   else {
    //     // lerp current to next values
    //     for (let i = 0; i < 100; i++) {
    //       const perc = (2.0 - this.timer) / 2.0;
    //       this.values[i] = this.values[i].lerp(this.nextValues[i], 0.25 * this.delta);
    //     }

    //   }
    // }
  }

  public createPoint(position: THREE.Vector3, radius: number): number {
    const index = this.positionLength.value;
    this.values[index] = position.clone();
    this.radiusValues[index] = radius;
    this.positionLength.value = index + 1;
    return index;
  }

  public updatePoint(index: number, newValue: THREE.Vector3) {
    this.values[index] = newValue.clone();
  }

  public getRadius(index: number): number {
    if (index < 0 || index >= this.radiusValues.length) {
      console.warn(`Index ${index} is out of bounds for radiusValues array.`);
      return 0;
    }
    return this.radiusValues[index];
  }

  public setRadius(index: number, radius: number) {
    if (index < 0 || index >= this.radiusValues.length) {
      console.warn(`Index ${index} is out of bounds for radiusValues array.`);
      return;
    }
    this.radiusValues[index] = radius;
  }

  public addRadiusToPoint(index: number, radius: number) {
    if (index < 0 || index >= this.radiusValues.length) {
      console.warn(`Index ${index} is out of bounds for radiusValues array.`);
      return;
    }
    this.radiusValues[index] += radius;
  }

  public updatePointLength(newLength: number) {
    this.positionLength.value = newLength;
  }

  public lockZoom(lock: boolean) {
    this.controls.enableZoom = !lock;
  }
}
