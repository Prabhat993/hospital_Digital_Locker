// src/components/Plane.jsx

import React, { forwardRef } from 'react';
import { useGLTF } from '@react-three/drei';

export const Plane = forwardRef(function Plane(props, ref) {
  const { nodes, materials } = useGLTF('/models/plane_low_poly.glb'); // Corrected path
  return (
    <group ref={ref} {...props} dispose={null}>
      <group scale={0.01}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.plane_low_poly_Material_0.geometry}
          material={materials.Material}
          position={[-60.402, 85.262, -82.302]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={100}
        />
      </group>
    </group>
  );
});

useGLTF.preload('/models/plane_low_poly.glb'); // Corrected path