import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function GlobeLoginVisual() {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const container = ref.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 3;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(360, 360);
    container.appendChild(renderer.domElement);

    const loader = new THREE.TextureLoader();
    const material = new THREE.MeshStandardMaterial({
      color: 0x999999,
      roughness: 0.8,
      metalness: 0.1,
      map: loader.load('/textures/earth_atmos_2048.jpg', undefined, undefined, () => {}),
      normalMap: loader.load('/textures/earth_normal_2048.jpg', undefined, undefined, () => {}),
      metalnessMap: loader.load('/textures/earth_specular_2048.jpg', undefined, undefined, () => {})
    });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.15, 64, 64), material);
    globe.rotation.z = -0.41;
    scene.add(globe);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const light = new THREE.DirectionalLight(0xcc0000, 2.2);
    light.position.set(2, 1.5, 3);
    scene.add(light);
    const grid = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(1.17, 24, 12)), new THREE.LineBasicMaterial({ color: 0x8b0000, transparent: true, opacity: 0.28 }));
    grid.rotation.z = -0.41;
    scene.add(grid);

    let frame;
    function animate() {
      globe.rotation.y += 0.0028;
      grid.rotation.y += 0.0028;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      cancelAnimationFrame(frame);
      renderer.dispose();
      container.replaceChildren();
    };
  }, []);

  return <div className="globe-panel" ref={ref} aria-hidden="true" />;
}
