'use client';

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { Suspense, useRef, useEffect, useState } from "react";
import * as THREE from 'three';

import { Sky } from './Sky';
import { Island } from './Island';
import { Plane } from './Plane';

function AnimatedPlane({ animationState, setAnimationState }) {
  const planeRef = useRef();
  const animationClock = useRef(new THREE.Clock());
  const [animationStartTime, setAnimationStartTime] = useState(0);
  const [rotationCount, setRotationCount] = useState(0);
  const [lastRotationCheck, setLastRotationCheck] = useState(0);

  // Plane scale and animation settings
  const PLANE_SCALE = 0.9;
  const ANIMATION_SPEEDS = {
    landing: 3,           // Speed for circling
    landingDuration: 6,   // Total time for approach + 2 circles
    takeoffDuration: 2    // Quick takeoff
  };

  useEffect(() => {
    if (animationState === 'landing' || animationState === 'takingOff') {
      animationClock.current.start();
      setAnimationStartTime(animationClock.current.getElapsedTime());
      setRotationCount(0);
      setLastRotationCheck(0);
    }
  }, [animationState]);

  useFrame((state, delta) => {
    if (!planeRef.current) return;

    const elapsedTime = animationClock.current.getElapsedTime();
    const animationElapsed = elapsedTime - animationStartTime;

    if (animationState === 'landing') {
      // Phase 1: Initial approach (first half second)
      if (animationElapsed < 0.5) {
        // Start from a distance and approach the circling path
        const approachProgress = animationElapsed / 0.5;
        const startX = 20;
        const startY = 8;
        const startZ = -15;
        
        const targetX = Math.sin(0) * 12;
        const targetY = 4;
        const targetZ = Math.cos(0) * 12;
        
        planeRef.current.position.x = startX + (targetX - startX) * approachProgress;
        planeRef.current.position.y = startY + (targetY - startY) * approachProgress;
        planeRef.current.position.z = startZ + (targetZ - startZ) * approachProgress;
        
        planeRef.current.lookAt(0, 0, 0);
        planeRef.current.rotateY(Math.PI);
        
      } 
      // Phase 2: Circle the island twice
      else if (animationElapsed < 7) {
        const circlingTime = animationElapsed - 0.5;
        const circlesToMake = 2;
        const totalCirclingTime = 6.5; // Time for 2 complete circles
        
        // Calculate position on circular path
        const angle = circlingTime * ANIMATION_SPEEDS.landing;
        const radius = 12;
        const altitude = 4 - (circlingTime / totalCirclingTime) * 2; // Gradually descend
        
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const y = altitude;
        
        planeRef.current.position.set(x, y, z);
        
        // Make the plane look towards the direction of travel
        const lookAheadAngle = angle + Math.PI * 0.1; // Look slightly ahead
        const lookX = Math.sin(lookAheadAngle) * radius;
        const lookZ = Math.cos(lookAheadAngle) * radius;
        
        planeRef.current.lookAt(lookX, y, lookZ);
        planeRef.current.rotateY(Math.PI); // Adjust for model orientation
        
        // Add banking effect during turns
        const bankAngle = Math.sin(angle * 2) * 0.4;
        planeRef.current.rotation.z = bankAngle;
        
        // Count rotations (each 2π radians is one full circle)
        const currentRotation = Math.floor(angle / (2 * Math.PI));
        if (currentRotation > rotationCount) {
          setRotationCount(currentRotation);
          console.log(`Completed circle ${currentRotation} of ${circlesToMake}`);
        }
        
      } 
      // Phase 3: Final approach and landing
      else if (animationElapsed < ANIMATION_SPEEDS.landingDuration) {
        const finalApproachTime = animationElapsed - 7;
        const finalApproachDuration = 1; // 1 second for final approach
        
        if (finalApproachTime < finalApproachDuration) {
          const finalProgress = finalApproachTime / finalApproachDuration;
          
          // Start from last circling position
          const startX = Math.sin(7 * ANIMATION_SPEEDS.landing) * 12;
          const startZ = Math.cos(7 * ANIMATION_SPEEDS.landing) * 12;
          const startY = 2;
          
          // End at landing position
          const endX = 0;
          const endZ = 8;
          const endY = -1;
          
          planeRef.current.position.x = startX + (endX - startX) * finalProgress;
          planeRef.current.position.y = startY + (endY - startY) * finalProgress;
          planeRef.current.position.z = startZ + (endZ - startZ) * finalProgress;
          
          // Smoothly rotate to final landing orientation
          planeRef.current.rotation.y = THREE.MathUtils.lerp(
            planeRef.current.rotation.y,
            Math.PI,
            finalProgress
          );
          planeRef.current.rotation.z = THREE.MathUtils.lerp(
            planeRef.current.rotation.z,
            0,
            finalProgress
          );
        }
        
        if (animationElapsed >= ANIMATION_SPEEDS.landingDuration) {
          setAnimationState('landed');
          console.log('Landing complete!');
        }
      }
      
    } else if (animationState === 'takingOff') {
      // Quick takeoff sequence
      const speed = 5;
      
      if (animationElapsed < 0.3) {
        // Instant lift-off
        planeRef.current.position.y = -1 + (animationElapsed * 15);
        planeRef.current.rotation.x = -animationElapsed * 1;
      } else {
        // Rapid climb and departure
        const climbProgress = (animationElapsed - 0.3) / 1.2;
        planeRef.current.position.y = 3.5 + (climbProgress * 30);
        planeRef.current.position.z = 8 + (climbProgress * 50);
        planeRef.current.position.x = climbProgress * 20;
        planeRef.current.rotation.x = -0.3 + (climbProgress * -0.3);
        planeRef.current.rotation.y = climbProgress * 2;
      }

      if (animationElapsed > ANIMATION_SPEEDS.takeoffDuration) {
        setAnimationState('gone');
        animationClock.current.stop();
      }
      
    } else if (animationState === 'landed') {
      // Ensure precise landing position
      const targetPosition = new THREE.Vector3(0, -1, 8);
      planeRef.current.position.lerp(targetPosition, delta * 8);
      planeRef.current.rotation.set(0, Math.PI, 0);
      
    } else if (animationState === 'gone') {
      // Hide the plane
      planeRef.current.position.set(1000, 1000, 1000);
      
    } else if (animationState === 'idle') {
      // Parked position
      planeRef.current.position.set(0, -1, 8);
      planeRef.current.rotation.set(0, Math.PI, 0);
    }
  });

  return <Plane ref={planeRef} scale={PLANE_SCALE} />;
}

export default function LockerScene({ planeAnimation, setPlaneAnimation }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 15], fov: 75 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1, 
      }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        
        <Sky />
        <Island position={[0, -3, -5]} scale={0.05} rotation={[0, 0, 0]} />

        <AnimatedPlane 
          animationState={planeAnimation} 
          setAnimationState={setPlaneAnimation} 
        />
        
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.2} />
      </Suspense>
    </Canvas>
  );
}