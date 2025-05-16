import * as THREE from 'three/webgpu';
import { vec3, positionLocal, vec2, float, sub, add, div, dot, greaterThan, uniform, Loop, attributeArray, threshold, step, exp, pow, If, lessThan, mix } from 'three/tsl';
import { Fn, mul, ShaderNode, ShaderNodeObject, uniformArray } from 'three/src/nodes/TSL.js';
import { StorageBufferNode, TSL } from 'three/webgpu';

export default class Renderer {


  maxPoints = 1000;

  canvas: HTMLCanvasElement;
  metaballLength: number = 0;
  metaballF32: Float32Array = new Float32Array();
  metaballColorF32: Float32Array = new Float32Array();

  metaballStorage!: ShaderNodeObject<StorageBufferNode>;
  metaballColorStorage!: ShaderNodeObject<StorageBufferNode>;

  camera!: THREE.OrthographicCamera;
  scene!: THREE.Scene;
  renderer!: THREE.WebGPURenderer;
  screenMaterial!: THREE.MeshBasicNodeMaterial;

  private metaballs: Metaball[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // --- Metaball data
    // 1000 elements, 3 floats per element - empty arry 
    this.metaballF32 = new Float32Array(this.maxPoints * 3);
    this.metaballColorF32 = new Float32Array(this.maxPoints * 3);

    this.metaballStorage = attributeArray(this.metaballF32, 'vec3').label('metaballs');
    this.metaballStorage.setPBO(true);

    this.metaballColorStorage = attributeArray(this.metaballColorF32, 'vec3').label('metaballsColor');
    this.metaballColorStorage.setPBO(true);

    this.metaballLength = 0;


    // create some metaballs (5)
    for (let i = 0; i < 1; i++) {
      const x = Math.random();
      const y = Math.random()
      const r = 0.02
      const color = new THREE.Color(Math.random(), Math.random(), Math.random());

      setTimeout(() => {
        this.metaballs.push(new Metaball(new THREE.Vector2(x, y), r, color));
        this.metaballLength++;
      }, i * 100);
    }


    // event listener, click create metaball at mouse position
    window.addEventListener('mousedown', (event) => {
      const x = event.clientX / window.innerWidth;
      const y = 1.0 - (event.clientY / window.innerHeight);
      // factor in dpi 
      const dpi = window.devicePixelRatio;
      //const metaball = this.createMetaball();
      //console.log(x, y);
      //metaball.setPosition(x, y);
      //console.log(metaball);

      // set first metaball to mouse position 
      //if (this.metaballLength > 0) {
      //  const metaball = this.metaballs[0];
      //  metaball.setPosition(x, y);
      //} else {
      const metaball = this.createMetaball();
      metaball.setPosition(x, y);
      //}
    });

    this.init();
  }

  updateMetaballs() {

    let didUpdate = false;

    for (let i = 0; i < this.metaballLength; i++) {
      const metaball = this.metaballs[i];
      if (metaball.needsUpdate) {
        const base = i * 3;
        this.metaballF32[base] = metaball.position.x;
        this.metaballF32[base + 1] = metaball.position.y;
        this.metaballF32[base + 2] = metaball.radius;

        this.metaballColorF32[base] = metaball.color.r;
        this.metaballColorF32[base + 1] = metaball.color.g;
        this.metaballColorF32[base + 2] = metaball.color.b;

        //console.log(base, metaball);

        metaball.needsUpdate = false;
        didUpdate = true;
      }

    }

    if (!didUpdate) {
      return;
    }

    this.metaballStorage.value.set(this.metaballF32);
    this.metaballColorStorage.value.set(this.metaballColorF32);

    this.metaballStorage.value.needsUpdate = true;
    this.metaballColorStorage.value.needsUpdate = true;

    this.screenMaterial.needsUpdate = true;

  }

  init() {

    // WebGPU Canvas with 2D Ortho Camera
    const canvas = this.canvas;
    const scene = new THREE.Scene();

    //scene.background = new THREE.Color(0xFFFFFF);
    // black background 
    scene.background = new THREE.Color(0x000000);
    // ambient light 
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const size = 1;
    const aspect = window.innerWidth / window.innerHeight;

    const geometry = new THREE.PlaneGeometry(2, 2);
    //geometry.scale(size * aspect, size, 1);
    const material = new THREE.MeshBasicNodeMaterial({
      colorNode: vec3(1, 0, 0),
      positionNode: vec3(positionLocal.x, positionLocal.y, positionLocal.z),
    });

    this.screenMaterial = material;

    this.createShader(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(size * aspect, size, 1);
    scene.add(mesh);


    const camera = new THREE.OrthographicCamera(
      -size * aspect,
      size * aspect,
      size,
      -size,
      0.1,
      1000
    );

    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      camera.left = -size * aspect;
      camera.right = size * aspect;
      camera.top = size;
      camera.bottom = -size;
      camera.updateProjectionMatrix();  // Important: update the projection matrix after modifying camera properties
      renderer.setSize(window.innerWidth, window.innerHeight);  // Update the renderer size
    });

    mesh.position.set(0, 0, -100);
    this.camera = camera;
    this.scene = scene;
    const renderer = new THREE.WebGPURenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.compile(scene, camera).then(() => {
      console.log(material.fragmentNode);
    });


    this.renderer = renderer;

    requestAnimationFrame(this.update.bind(this));
  }


  createShader(material: THREE.MeshBasicNodeMaterial) {
    // correct uv for aspect ratio
    const aspect = window.innerWidth / window.innerHeight;
    const size = 1;
    const uv = add(vec2(positionLocal.x, positionLocal.y), float(1.0)).div(float(2.0));


    const calculateField = Fn(() => {
      let field = float(0).toVar();

      Loop(
        { type: 'int', start: 0, end: this.maxPoints, condition: '<' },
        ({ i }) => {
          const base = mul(i, 3);
          const ball = this.metaballStorage.element(i);
          const x = ball.x;
          const y = ball.y;
          const r = ball.z;

          // Adjust distance calculation for aspect ratio
          const delta = sub(uv, vec2(x, y));
          const scaledDelta = vec2(mul(delta.x, aspect), delta.y);  // Scale only the X component

          let influence = div(mul(r, r), dot(scaledDelta, scaledDelta)); // Influence based on distance

          //If(greaterThan(influence, float(0.99)), () => {
          //  influence.assign(float(0.0));
          //});
          //
          field.addAssign(influence);  // Accumulate total influence
        }
      );

      return field;
    });

    const calculateColorField = Fn(() => {
      let fieldColor = vec3(0).toVar();
      let totalInfluence = float(0).toVar();

      Loop(
        { type: 'int', start: 0, end: 100, condition: '<' },
        ({ i }) => {
          const base = mul(i, 3);
          const ball = this.metaballStorage.element(i);
          const x = ball.x;
          const y = ball.y;
          const r = ball.z;

          // Adjust distance calculation for aspect ratio
          const delta = sub(uv, vec2(x, y));
          const scaledDelta = vec2(mul(delta.x, aspect), delta.y);  // Scale only the X component

          const distSquared = dot(scaledDelta, scaledDelta); // Squared distance

          const distPerc = div(mul(r, r), distSquared);
          //const= pow( 2); // Influence based on distance

          let influence = float(0).toVar();
          //if (distPerc.greaterThan(float(0.7))) {
          //  influence.assign(float(0.0));
          //}
          //else {
          //  influence.assign(float(1.0));
          //}

          If(greaterThan(distPerc, float(0.99)), () => {
            //influence.assign(exp(mul(float(-1.0), distPerc)));
            influence.assign(float(1.0));
          }).ElseIf(lessThan(distPerc, float(0.99)), () => {
            //influence.assign(float(0.0));
            influence.assign(distPerc);
          });

          //influence.assign(div(mul(r, r), distSquared)); // Influence based on distance

          const color = this.metaballColorStorage.element(i);

          fieldColor.addAssign(vec3(color.x, color.y, color.z).mul(influence));
          totalInfluence.addAssign(influence);  // Accumulate total influence
        });

      // Normalize the color based on total influence (so it doesn't collapse to one color)
      //if (totalInfluence.greaterThan(float(0.01))) {  // Prevent division by zero
      //  //fieldColor = div(fieldColor, totalInfluence); // Normalize color contribution
      //  fieldColor.mulAssign(div(float(1.0), totalInfluence)); // Normalize color contribution
      //}
      //

      If(greaterThan(totalInfluence, float(0.1)), () => {
        fieldColor.mulAssign(div(float(1.0), totalInfluence));
      }).Else(() => {
        fieldColor.assign(vec3(0.0, 0.0, 0.0));
      });
      //return vec3(this.metaballColorStorage.element(1).x, this.metaballColorStorage.element(1).y, this.metaballColorStorage.element(1).z);
      return fieldColor;
    });
    // Calculate total influence (field)
    const field = calculateField();

    // --- Threshold the field to get a blob
    const threshold = float(0.0);
    const isInside = greaterThan(field, threshold).and(lessThan(field, float(0.7)));

    // Calculate the color based on the total influence (mixed color field)
    const fieldColor = vec3(isInside);


    // make outline 
    const outlineColor = vec3(1.0, 1.0, 1.0);

    // check if > 0.9 and < 0.99 
    const isOutline = greaterThan(field, float(0.9)).and(lessThan(field, float(1.0)));

    // Combine the color based on whether it's inside the blob or not
    //material.colorNode = fieldColor;
    //material.colorNode = vec3(this.metaballColorStorage.element(0).x, this.metaballColorStorage.element(0).y, this.metaballColorStorage.element(0).z);
    //material.colorNode = fieldColor;

    // Create a FN to calculate the color based on outline or inside 
    const outputColorFn = Fn(() => {
      const color = vec3(0.0, 0.0, 0.0).toVar();
      If(isInside, () => {
        color.assign(calculateColorField());
      }).Else(() => {
        color.assign(vec3(1.0, 1.0, 1.0));
      });
      return color;
    });

    material.colorNode = outputColorFn();
  }

  createMetaball(size: number = 0.01) {
    const newMetaball = new Metaball(new THREE.Vector2(0, 0), size, new THREE.Color(Math.random(), Math.random(), Math.random()));
    this.metaballs.push(newMetaball);
    this.metaballLength++;
    return newMetaball;
  }

  update(time: number) {
    this.renderer.renderAsync(this.scene, this.camera);
    const t = time * 0.001;
    this.updateMetaballs();
    requestAnimationFrame(this.update.bind(this));


    // move all metballs right 
    //for (let i = 0; i < this.metaballLength; i++) {
    //  const metaball = this.metaballs[i];
    //  const x = Math.sin((i % 2 === 0 ? 1.0 : -1.0) * t * 1.0) * 0.1;
    //  metaball.setPosition(x % -t, metaball.position.y);
    // }
  }


}


export class Metaball {

  public position: THREE.Vector2;
  public radius: number;
  public color: THREE.Color;
  public needsUpdate: boolean = true;

  constructor(position: THREE.Vector2, radius: number, color: THREE.Color) {
    this.position = position;
    this.radius = radius;
    this.color = color;
  }

  public setPosition(x: number, y: number) {
    this.position.set(x, y);
    this.needsUpdate = true;
  }

  public setScreenPos(x: number, y: number) {
    this.position.set(x / window.innerWidth, y / window.innerHeight);
    this.needsUpdate = true;
  }

}
