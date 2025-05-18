export interface GeometryData {

  vertices: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  uvs: Float32Array;

}

export default class GeometryPrimitive {

  public get_geometry(): GeometryData {
    return {
      vertices: new Float32Array(),
      indices: new Uint32Array(),
      normals: new Float32Array(),
      uvs: new Float32Array()
    };
  }

}


