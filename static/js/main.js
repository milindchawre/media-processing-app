let currentFileType = null;
let currentFileData = null;

document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    
    // Clear all previous content
    clearAllContent();
    
    if (file.type.startsWith('image/')) {
        handleImageFile(file);
    } else if (file.type.startsWith('audio/')) {
        handleAudioFile(file);
    } else {
        handleTextFile(file);
    }
});

function clearAllContent() {
    // Clear previous content
    document.getElementById('textContent').textContent = '';
    document.getElementById('imageContent').style.display = 'none';
    document.getElementById('tokenContent').textContent = '';
    document.getElementById('processedImage').style.display = 'none';
    document.getElementById('augmentedText').textContent = '';
    document.getElementById('augmentedImages').style.display = 'none';
    document.getElementById('audioContent').style.display = 'none';
    document.getElementById('processedAudio').style.display = 'none';
    document.getElementById('augmentedAudio').style.display = 'none';
}

function handleAudioFile(file) {
    currentFileType = 'audio';
    const reader = new FileReader();
    
    reader.onload = function(e) {
        currentFileData = e.target.result;
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.src = currentFileData;
        document.getElementById('audioContent').style.display = 'block';
        
        // Clear other content areas
        document.getElementById('processedAudio').style.display = 'none';
        document.getElementById('augmentedAudio').style.display = 'none';
    };
    
    reader.onerror = function(e) {
        console.error('Error reading audio file:', e);
        alert('Error reading audio file');
    };
    
    reader.readAsDataURL(file);
}

async function processContent() {
    if (currentFileType === 'audio') {
        try {
            const response = await fetch('/process_audio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ audio: currentFileData })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            
            document.getElementById('processedAudio').style.display = 'block';
            document.getElementById('spectrogramImage').src = 'data:image/png;base64,' + data.spectrogram;
            
            const featuresHtml = Object.entries(data.features)
                .map(([key, value]) => `<p>${key.replace('_', ' ').toUpperCase()}: ${value.toFixed(2)}</p>`)
                .join('');
            document.getElementById('audioFeatures').innerHTML = featuresHtml;
        } catch (error) {
            console.error('Error processing audio:', error);
            alert('Error processing audio: ' + error.message);
        }
    } else {
        await preprocessText();
    }
}

async function augmentContent() {
    if (currentFileType === 'audio') {
        try {
            const response = await fetch('/augment_audio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ audio: currentFileData })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            
            document.getElementById('augmentedAudio').style.display = 'block';
            document.getElementById('highFreqAudio').src = 'data:audio/wav;base64,' + data.high_freq;
            document.getElementById('lowFreqAudio').src = 'data:audio/wav;base64,' + data.low_freq;
        } catch (error) {
            console.error('Error augmenting audio:', error);
            alert('Error augmenting audio: ' + error.message);
        }
    } else {
        await augmentText();
    }
}

async function preprocessText() {
    const text = document.getElementById('textContent').textContent;
    
    const response = await fetch('/process', {
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

async function augmentText() {
    const text = document.getElementById('textContent').textContent;
    
    const response = await fetch('/augment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text })
    });
    
    const data = await response.json();
    document.getElementById('augmentedText').textContent = data.augmented_text;
}
