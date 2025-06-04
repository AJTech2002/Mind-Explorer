import { color, mix, pass, renderOutput, screenUV } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { sobel } from 'three/examples/jsm/tsl/display/SobelOperatorNode.js';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Line2, LineGeometry, LineMaterial } from 'three/examples/jsm/Addons.js';

export default class Renderer {

  protected renderer_2d!: CSS2DRenderer;
  protected canvas: HTMLCanvasElement;
  public camera!: THREE.OrthographicCamera;
  public scene!: THREE.Scene;
  protected renderer!: THREE.WebGPURenderer;
  protected controls!: OrbitControls;

  protected postProcessor!: THREE.PostProcessing;
  protected canvas_2d?: HTMLDivElement;

  constructor(canvas: HTMLCanvasElement, canvas_2d?: HTMLDivElement) {
    this.canvas_2d = canvas_2d;
    this.canvas = canvas;
    this.init();
  }

  public getCameraScale() {
    return this.camera.zoom;
  }

  init() {

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);


    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    this.scene.add(ambientLight);

    const aspect = window.innerWidth / window.innerHeight;
    this.size = 3;

    this.camera = new THREE.OrthographicCamera(
      -this.size * aspect,
      this.size * aspect,
      this.size,
      -this.size,
      0.001,
      1000
    );

    window.addEventListener('resize', () => {
      this.updateCamera();
    });

    this.renderer = new THREE.WebGPURenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      stencil: true,
      // samples: 16,

      powerPreference: 'high-performance',
    });

    this.renderer_2d = new CSS2DRenderer({
      element: this.canvas_2d,
    })

    this.renderer_2d.setSize(window.innerWidth, window.innerHeight);
    this.renderer_2d.domElement.style.position = 'absolute';
    this.renderer_2d.domElement.style.top = '0';



    this.updateCamera();


    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    
    //controls.enableDamping = true;
    controls.dampingFactor = .05;
    // controls.minPolarAngle = Math.PI / 4 + 0.1; // 90 degrees
    // controls.maxPolarAngle = Math.PI / 4 + 0.1; // 180 degrees
    // controls.maxPolarAngle = -0.7; // 90 degrees


    this.controls = controls;
    this.controls.enablePan = false;

    this.postProcessor = new THREE.PostProcessing(this.renderer);
    this.postProcessor.outputColorTransform = false;


    const scenePass = pass(this.scene, this.camera);

    const result = mix(
      color(0.0, 0.0, 0.0),
      renderOutput(scenePass),
      sobel(renderOutput(scenePass))
    );

    this.postProcessor.outputNode = result.add(bloom(result, 0.15, 0.09, 0.05));

    // this.postProcessor.outrenderOutput(scenePass).add (  sobel ( renderOutput ( scenePass )) ) ;

    this.onStart();

    const animate = (t) => {
      this.onUpdate(t);
      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }


  private _size: number = 1;

  public get size() {
    return this._size;
  }

  public set size(value: number) {
    this._size = value;
    this.updateCamera();
  }

  updateCamera() {

    if (!(this.renderer && this.scene && this.camera)) {
      return;
    }

    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = -this.size * aspect;
    this.camera.right = this.size * aspect;
    this.camera.top = this.size;
    this.camera.bottom = -this.size;
    this.camera.updateProjectionMatrix();
    console.log(this.camera.projectionMatrix);

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  protected onStart() {


  }


  protected time = 0;
  protected delta = 0;
  private lastTime = 0;

  protected onUpdate(time: number = 0) {

    if (!(this.renderer && this.scene && this.camera)) {
      return;
    }

    this.time = time / 1000;
    this.delta = this.time - this.lastTime;
    this.lastTime = this.time;

    // this.renderer.renderAsync(this.scene, this.camera);
    this.postProcessor.renderAsync();
    this.renderer_2d.render(this.scene, this.camera);
    this.controls.update();
  }

}

