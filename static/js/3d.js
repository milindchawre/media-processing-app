let currentFileUrl = null;
let originalScene, processedScene, augmentedScene;
let originalRenderer, processedRenderer, augmentedRenderer;
let originalCamera, processedCamera, augmentedCamera;
let originalControls, processedControls, augmentedControls;

// Initialize Three.js scenes
function initScenes() {
    // Original viewer
    originalScene = new THREE.Scene();
    originalScene.background = new THREE.Color(0xf0f0f0);
    originalCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    originalRenderer = new THREE.WebGLRenderer({ antialias: true });
    originalRenderer.setSize(document.getElementById('originalViewer').clientWidth, 300);
    document.getElementById('originalViewer').appendChild(originalRenderer.domElement);
    originalControls = new THREE.OrbitControls(originalCamera, originalRenderer.domElement);
    originalCamera.position.z = 5;

    // Processed viewer
    processedScene = new THREE.Scene();
    processedScene.background = new THREE.Color(0xf0f0f0);
    processedCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    processedRenderer = new THREE.WebGLRenderer({ antialias: true });
    processedRenderer.setSize(document.getElementById('processedViewer').clientWidth, 300);
    document.getElementById('processedViewer').appendChild(processedRenderer.domElement);
    processedControls = new THREE.OrbitControls(processedCamera, processedRenderer.domElement);
    processedCamera.position.z = 5;

    // Augmented viewer
    augmentedScene = new THREE.Scene();
    augmentedScene.background = new THREE.Color(0xf0f0f0);
    augmentedCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    augmentedRenderer = new THREE.WebGLRenderer({ antialias: true });
    augmentedRenderer.setSize(document.getElementById('augmentedViewer').clientWidth, 300);
    document.getElementById('augmentedViewer').appendChild(augmentedRenderer.domElement);
    augmentedControls = new THREE.OrbitControls(augmentedCamera, augmentedRenderer.domElement);
    augmentedCamera.position.z = 5;

    // Add lights
    const light = new THREE.AmbientLight(0xffffff, 0.5);
    originalScene.add(light.clone());
    processedScene.add(light.clone());
    augmentedScene.add(light.clone());

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 1);
    originalScene.add(directionalLight.clone());
    processedScene.add(directionalLight.clone());
    augmentedScene.add(directionalLight.clone());

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    originalRenderer.render(originalScene, originalCamera);
    processedRenderer.render(processedScene, processedCamera);
    augmentedRenderer.render(augmentedScene, augmentedCamera);
}

function loadModel(url, scene, camera) {
    const loader = new THREE.OBJLoader();
    
    // Clear existing model
    while(scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }
    
    // Add lights back
    const light = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(light);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);
    
    return new Promise((resolve, reject) => {
        loader.load(
            url,
            function(object) {
                scene.add(object);
                centerCamera(object, camera);
                resolve(object);
            },
            undefined,
            function(error) {
                console.error('Error loading model:', error);
                reject(error);
            }
        );
    });
}

// Handle file upload
document.getElementById('fileInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/process_3d', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        currentFileUrl = data.file_url;
        await loadModel(currentFileUrl, originalScene, originalCamera);
    } catch (error) {
        console.error('Error uploading file:', error);
        alert('Error uploading file: ' + error.message);
    }
});

async function process3D() {
    if (!currentFileUrl) {
        alert('Please upload a 3D file first');
        return;
    }

    try {
        const loader = new THREE.OBJLoader();
        loader.load(
            currentFileUrl,
            function(object) {
                // Clear processed scene
                while(processedScene.children.length > 0) {
                    processedScene.remove(processedScene.children[0]);
                }

                // Add lights
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
                processedScene.add(ambientLight);
                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                directionalLight.position.set(1, 1, 1);
                processedScene.add(directionalLight);

                // Extract Features
                let modelStats = {
                    vertices: 0,
                    faces: 0,
                    edges: 0,
                    boundingBox: new THREE.Box3(),
                    materials: new Set(),
                    geometryCount: 0
                };

                // Analyze the model
                object.traverse(function(child) {
                    if (child instanceof THREE.Mesh) {
                        modelStats.geometryCount++;
                        const geometry = child.geometry;

                        // Compute necessary attributes
                        geometry.computeBoundingBox();
                        geometry.computeBoundingSphere();
                        geometry.computeVertexNormals();

                        // Count vertices and faces
                        modelStats.vertices += geometry.attributes.position.count;
                        modelStats.faces += geometry.index ? geometry.index.count / 3 : 0;
                        
                        // Update bounding box
                        modelStats.boundingBox.expandByObject(child);

                        // Track materials
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => modelStats.materials.add(mat.type));
                        } else {
                            modelStats.materials.add(child.material.type);
                        }

                        // Create analysis visualization
                        child.material = new THREE.MeshPhongMaterial({
                            color: 0x00ff00,
                            wireframe: true,
                            wireframeLinewidth: 1,
                            transparent: true,
                            opacity: 0.8
                        });
                    }
                });

                // Calculate dimensions
                const dimensions = new THREE.Vector3();
                modelStats.boundingBox.getSize(dimensions);

                // Calculate center
                const center = new THREE.Vector3();
                modelStats.boundingBox.getCenter(center);

                // Display features in a structured format
                const features = {
                    'Model Statistics': {
                        'Total Vertices': modelStats.vertices.toLocaleString(),
                        'Total Faces': modelStats.faces.toLocaleString(),
                        'Geometry Parts': modelStats.geometryCount,
                        'Material Types': modelStats.materials.size
                    },
                    'Dimensions': {
                        'Width': dimensions.x.toFixed(2) + ' units',
                        'Height': dimensions.y.toFixed(2) + ' units',
                        'Depth': dimensions.z.toFixed(2) + ' units',
                        'Volume': (dimensions.x * dimensions.y * dimensions.z).toFixed(2) + ' cubic units'
                    },
                    'Center Point': {
                        'X': center.x.toFixed(3),
                        'Y': center.y.toFixed(3),
                        'Z': center.z.toFixed(3)
                    },
                    'Normalization': {
                        'Bounding Box': 'Computed',
                        'Vertex Normals': 'Computed',
                        'Bounding Sphere': 'Computed'
                    }
                };

                // Add processed model to scene
                processedScene.add(object);
                centerCamera(object, processedCamera);

                // Display features
                displayFeatures(features);
            },
            // Progress callback
            function(xhr) {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            // Error callback
            function(error) {
                console.error('Error loading model:', error);
                alert('Error loading model: ' + error.message);
            }
        );

    } catch (error) {
        console.error('Error processing 3D model:', error);
        alert('Error processing 3D model: ' + error.message);
    }
}

function createRGBMaterials() {
    return [
        new THREE.MeshPhongMaterial({
            color: 0xff0000,  // Red
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        }),
        new THREE.MeshPhongMaterial({
            color: 0x00ff00,  // Green
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        }),
        new THREE.MeshPhongMaterial({
            color: 0x0000ff,  // Blue
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        })
    ];
}

async function augment3D() {
    if (!currentFileUrl) {
        alert('Please upload a 3D file first');
        return;
    }

    try {
        // Clear existing scene
        while(augmentedScene.children.length > 0) {
            augmentedScene.remove(augmentedScene.children[0]);
        }

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        augmentedScene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        augmentedScene.add(directionalLight);

        // Load the model three times with RGB colors
        const loader = new THREE.OBJLoader();
        const rgbMaterials = createRGBMaterials();
        const offset = 0.1; // Slight offset for RGB effect

        loader.load(
            currentFileUrl,
            function(originalObject) {
                // Create three slightly offset copies with RGB colors
                rgbMaterials.forEach((material, index) => {
                    const object = originalObject.clone();
                    
                    // Apply material
                    object.traverse(function(child) {
                        if (child instanceof THREE.Mesh) {
                            child.material = material;
                        }
                    });

                    // Apply offset based on color
                    object.position.x = (index - 1) * offset;
                    object.position.y = (index - 1) * offset;

                    augmentedScene.add(object);
                });

                // Center camera
                const box = new THREE.Box3().setFromObject(augmentedScene);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                
                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = augmentedCamera.fov * (Math.PI / 180);
                const cameraZ = Math.abs(maxDim / Math.tan(fov / 2));
                
                augmentedCamera.position.z = cameraZ * 2;
                augmentedCamera.lookAt(center);
                augmentedCamera.updateProjectionMatrix();

                // Add animation
                function animate() {
                    requestAnimationFrame(animate);
                    augmentedScene.children.forEach((child, index) => {
                        if (child instanceof THREE.Object3D && !(child instanceof THREE.Light)) {
                            child.rotation.y += 0.01 * (index + 1) * 0.5;
                        }
                    });
                    augmentedRenderer.render(augmentedScene, augmentedCamera);
                }
                animate();
            },
            undefined,
            function(error) {
                console.error('Error loading augmented model:', error);
                alert('Error loading augmented model: ' + error.message);
            }
        );
    } catch (error) {
        console.error('Error augmenting 3D model:', error);
        alert('Error augmenting 3D model: ' + error.message);
    }
}

function displayFeatures(features) {
    const container = document.getElementById('features');
    container.innerHTML = '<h4>3D Model Analysis</h4>';
    
    Object.entries(features).forEach(([category, categoryFeatures]) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'feature-category';
        
        const categoryTitle = document.createElement('h5');
        categoryTitle.textContent = category;
        categoryDiv.appendChild(categoryTitle);
        
        Object.entries(categoryFeatures).forEach(([key, value]) => {
            const p = document.createElement('p');
            p.innerHTML = `<span class="feature-name">${key}:</span> 
                          <span class="feature-value">${value}</span>`;
            categoryDiv.appendChild(p);
        });
        
        container.appendChild(categoryDiv);
    });
}

function centerCamera(model, camera) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const cameraZ = Math.abs(maxDim / Math.tan(fov / 2));
    
    camera.position.z = cameraZ * 1.5;
    camera.lookAt(center);
}

// Initialize on page load
initScenes();

// Handle window resize
window.addEventListener('resize', function() {
    const viewers = [
        { renderer: originalRenderer, element: 'originalViewer', camera: originalCamera },
        { renderer: processedRenderer, element: 'processedViewer', camera: processedCamera },
        { renderer: augmentedRenderer, element: 'augmentedViewer', camera: augmentedCamera }
    ];

    viewers.forEach(({ renderer, element, camera }) => {
        const width = document.getElementById(element).clientWidth;
        camera.aspect = width / 300;
        camera.updateProjectionMatrix();
        renderer.setSize(width, 300);
    });
}); 