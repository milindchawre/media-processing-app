let currentFileType = null;
let currentFileData = null;

document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    
    // Clear previous content
    document.getElementById('textContent').textContent = '';
    document.getElementById('imageContent').style.display = 'none';
    document.getElementById('tokenContent').textContent = '';
    document.getElementById('processedImage').style.display = 'none';
    document.getElementById('augmentedText').textContent = '';
    document.getElementById('augmentedImages').style.display = 'none';
    
    if (file.type.startsWith('image/')) {
        handleImageFile(file);
    } else {
        handleTextFile(file);
    }
});

function handleImageFile(file) {
    currentFileType = 'image';
    const reader = new FileReader();
    
    reader.onload = function(e) {
        currentFileData = e.target.result;
        const img = document.getElementById('imageContent');
        img.src = currentFileData;
        img.style.display = 'block';
    };
    
    reader.readAsDataURL(file);
}

function handleTextFile(file) {
    currentFileType = 'text';
    const reader = new FileReader();
    
    reader.onload = function(e) {
        document.getElementById('textContent').textContent = e.target.result;
    };
    
    reader.readAsText(file);
}

async function processContent() {
    if (currentFileType === 'image') {
        await processImage();
    } else {
        await processText();
    }
}

async function augmentContent() {
    if (currentFileType === 'image') {
        await augmentImage();
    } else {
        await augmentText();
    }
}

async function processText() {
    const text = document.getElementById('textContent').textContent;
    
    const response = await fetch('/media/process_text', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text })
    });
    
    const data = await response.json();
    const tokenDisplay = data.tokens.map((token, index) => 
        `${token} (${data.token_text[index]})`
    ).join('\n');
    
    document.getElementById('tokenContent').innerHTML = tokenDisplay;
}

async function processImage() {
    try {
        const response = await fetch('/media/process_image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: currentFileData })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        const img = document.getElementById('processedImage');
        img.src = 'data:image/png;base64,' + data.processed_image;
        img.style.display = 'block';
    } catch (error) {
        console.error('Error processing image:', error);
        alert('Error processing image: ' + error.message);
    }
}

async function augmentText() {
    const text = document.getElementById('textContent').textContent;
    
    const response = await fetch('/media/augment_text', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text })
    });
    
    const data = await response.json();
    document.getElementById('augmentedText').textContent = data.augmented_text;
}

async function augmentImage() {
    try {
        const response = await fetch('/media/augment_image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: currentFileData })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        document.getElementById('augmentedImages').style.display = 'block';
        document.getElementById('grayImage').src = 'data:image/png;base64,' + data.gray;
        document.getElementById('rotatedImage').src = 'data:image/png;base64,' + data.rotated;
    } catch (error) {
        console.error('Error augmenting image:', error);
        alert('Error augmenting image: ' + error.message);
    }
} 