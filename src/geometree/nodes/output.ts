import * as THREE from 'three';
import { GeometryData } from './primitives/geometryPrimitive';

export default class GeometryOutput {

  public get_geometry(
    geometryData: GeometryData
  ): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute('position', new THREE.BufferAttribute(geometryData.vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(geometryData.indices, 1));
    geometry.setAttribute('normal', new THREE.BufferAttribute(geometryData.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(geometryData.uvs, 2));

    return geometry;
  }

}
