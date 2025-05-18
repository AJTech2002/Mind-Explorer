import * as THREE from "three/webgpu";
import Renderer from "../../core/renderer.ts";
import GeometryOutput from "../nodes/output.ts";
import PlanePrimitive from "../nodes/primitives/plane.ts";
import GeometrySubdivider from "../nodes/functional/subdivider.ts";
import { float, floor, Fn, mix, mx_noise_float, normalLocal, positionLocal, uniform, vec3 } from "three/tsl";
import { mx_perlin_noise_float, mx_perlin_noise_vec3 } from "three/src/nodes/materialx/lib/mx_noise.js";

export default class SubdivisionRendererExample extends Renderer {

  // time uniform
  uniformTime = uniform(float(5))
  material: THREE.MeshBasicNodeMaterial;

  override async onStart() {
    // add a plane to test the Renderer
    //const geometry = new THREE.PlaneGeometry(1, 1);

    let planeGeom = new PlanePrimitive().get_geometry();
    planeGeom = await new GeometrySubdivider().get_geometry(this.renderer, planeGeom, 9);
    const geometry = new GeometryOutput().get_geometry(planeGeom);

    // add directional light
    const light = new THREE.DirectionalLight(0xffffff, 4);
    light.position.set(2, 2, 2)
    light.lookAt(0, 0, 0);
    light.castShadow = true;

    this.scene.add(light);

    const material = new THREE.MeshBasicNodeMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
      wireframe: false,
    });

    this.material = material;

    const position = positionLocal.xyz;
    const samplePosition = position.add(vec3(this.uniformTime, 0, 0));
    const frequency = 4;
    const warp = 0.2

    const steps = 7;

    const noiseInput = samplePosition.mul(frequency);
    const elevation = mx_noise_float(noiseInput)
    const steppedElevation = floor(elevation.mul(steps)).div(steps).mul(warp)

    console.log("elevation", elevation, mx_perlin_noise_float);

    // Color eaach step with a different color and cycle through the colors
    let aColor = vec3(0, 0, 0).div(255);
    let bColor = vec3(255, 25, 25).div(255);

    material.colorNode = mix(
      aColor,
      bColor,
      (elevation.mul(steps).mul(2)).div(steps).add(0.5)
    );



    material.positionNode = vec3(position.x, steppedElevation, position.z);

    material.onBeforeCompile = (shader) => {
      console.log(shader);
    };

    this.camera.position.set(2, 2, 2);
    this.camera.lookAt(0, 0, 0);

    const plane = new THREE.Mesh(geometry, material);
    //plane.geometry.computeVertexNormals();
    //plane.geometry.attributes.position.needsUpdate = true;
    //plane.castShadow = true;
    //plane.receiveShadow = true;

    //plane.rotateX(Math.PI / 2);


    plane.position.set(0, 0, 0);
    //plane.scale.set(2, 2, 2);

    this.scene.add(plane);
  }

  override onUpdate() {
    this.uniformTime.value += 0.01;
    this.material.needsUpdate = true;
    console.log(this.uniformTime);
    this.renderer.render(this.scene, this.camera);
  }

}
