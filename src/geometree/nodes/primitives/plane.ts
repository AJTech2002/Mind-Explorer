import GeometryPrimitive from "./geometryPrimitive";

export default class PlanePrimitive extends GeometryPrimitive {

  public get_geometry() {
    const size = 1;
    const vertices = new Float32Array([
      -size, 0, -size,
      size, 0, -size,
      size, 0, size,
      -size, 0, size
    ]);

    const indices = new Uint32Array([
      0, 1, 2,
      2, 3, 0
    ]);

    const normals = new Float32Array([
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
    ]);

    const uvs = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1
    ]);

    return {
      vertices,
      indices,
      normals,
      uvs
    };
  }

}
