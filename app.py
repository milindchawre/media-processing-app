from flask import Flask, render_template, request, jsonify, send_from_directory
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import wordnet
import tiktoken
from PIL import Image
import io
import base64
import numpy as np
import librosa
import librosa.display
import matplotlib
matplotlib.use('Agg')  # This must come before importing pyplot
import matplotlib.pyplot as plt
import soundfile as sf
from scipy import signal
import os
from werkzeug.utils import secure_filename
import json

app = Flask(__name__)

# Download NLTK data
nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('averaged_perceptron_tagger')
nltk.download('wordnet')
nltk.download('omw-1.4')

# Add these configurations
UPLOAD_FOLDER = 'static/uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/media')
def media():
    return render_template('media.html')

@app.route('/audio')
def audio():
    return render_template('audio.html')

# Text Processing Routes
@app.route('/process_text', methods=['POST'])
def process_text():
    text = request.json.get('text', '')
    enc = tiktoken.get_encoding("cl100k_base")
    tokens = enc.encode(text)
    return jsonify({
        'tokens': tokens,
        'token_text': [enc.decode([token]) for token in tokens]
    })

@app.route('/augment_text', methods=['POST'])
def augment_text():
    text = request.json.get('text', '')
    words = word_tokenize(text)
    
    augmented_words = []
    for word in words:
        synonyms = []
        for syn in wordnet.synsets(word):
            for lemma in syn.lemmas():
                if lemma.name() != word:
                    synonyms.append(lemma.name())
        
        if synonyms:
            augmented_words.append(f"{word} ({', '.join(set(synonyms[:3]))})")
        else:
            augmented_words.append(word)
    
    return jsonify({'augmented_text': ' '.join(augmented_words)})

# Image Processing Routes
@app.route('/process_image', methods=['POST'])
def process_image():
    try:
        image_data = request.json.get('image', '')
        img = get_image_from_base64(image_data)
        resized_img = img.resize((128, 128), Image.Resampling.LANCZOS)
        processed_image = image_to_base64(resized_img)
        return jsonify({'processed_image': processed_image})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/augment_image', methods=['POST'])
def augment_image():
    try:
        image_data = request.json.get('image', '')
        img = get_image_from_base64(image_data)
        img = img.resize((128, 128), Image.Resampling.LANCZOS)
        
        gray_img = img.convert('L')
        rotated_img = img.rotate(-90, expand=True)
        
        return jsonify({
            'gray': image_to_base64(gray_img),
            'rotated': image_to_base64(rotated_img)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

def get_image_from_base64(base64_string):
    if 'base64,' in base64_string:
        base64_string = base64_string.split('base64,')[1]
    image_bytes = base64.b64decode(base64_string)
    image = Image.open(io.BytesIO(image_bytes))
    return image

def image_to_base64(image, format='PNG'):
    buffered = io.BytesIO()
    image.save(buffered, format=format)
    return base64.b64encode(buffered.getvalue()).decode()

# Audio Processing Routes
@app.route('/process_audio', methods=['POST'])
def process_audio():
    try:
        audio_data = request.json.get('audio')
        if not audio_data:
            return jsonify({'error': 'No audio data provided'}), 400

        # Convert base64 to audio
        audio_bytes = base64.b64decode(audio_data.split(',')[1])
        
        # Save temporarily
        temp_path = 'temp_audio.wav'
        with open(temp_path, 'wb') as f:
            f.write(audio_bytes)
        
        # Load the audio file
        y, sr = librosa.load(temp_path)
        
        # Create spectrogram
        D = librosa.stft(y)
        D_db = librosa.amplitude_to_db(np.abs(D), ref=np.max)
        
        # Create the figure
        plt.figure(figsize=(10, 4))
        librosa.display.specshow(D_db, sr=sr, x_axis='time', y_axis='hz')
        plt.colorbar(format='%+2.0f dB')
        
        # Save plot to bytes
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100)
        plt.close()
        buf.seek(0)
        
        # Extract features
        features = {
            'Duration (s)': float(len(y) / sr),
            'Mean Frequency (Hz)': float(np.mean(np.abs(librosa.fft_frequencies(sr=sr)))),
            'Max Amplitude': float(np.max(np.abs(y))),
            'RMS Energy': float(np.sqrt(np.mean(y**2))),
            'Zero Crossing Rate': float(np.mean(librosa.feature.zero_crossing_rate(y)))
        }
        
        # Clean up
        os.remove(temp_path)
        
        return jsonify({
            'spectrogram': base64.b64encode(buf.getvalue()).decode(),
            'features': features
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/augment_audio', methods=['POST'])
def augment_audio():
    try:
        audio_data = request.json.get('audio')
        if not audio_data:
            return jsonify({'error': 'No audio data provided'}), 400

        # Convert base64 to audio
        audio_bytes = base64.b64decode(audio_data.split(',')[1])
        
        # Save temporarily
        temp_path = 'temp_audio.wav'
        with open(temp_path, 'wb') as f:
            f.write(audio_bytes)
        
        # Load the audio file
        y, sr = librosa.load(temp_path)
        
        # Create high frequency version (pitch shift up)
        y_high = librosa.effects.pitch_shift(y=y, sr=sr, n_steps=4)
        
        # Create low frequency version (pitch shift down)
        y_low = librosa.effects.pitch_shift(y=y, sr=sr, n_steps=-4)
        
        # Save augmented versions
        high_buf = io.BytesIO()
        low_buf = io.BytesIO()
        
        sf.write(high_buf, y_high, sr, format='WAV')
        sf.write(low_buf, y_low, sr, format='WAV')
        
        high_buf.seek(0)
        low_buf.seek(0)
        
        # Clean up
        os.remove(temp_path)
        
        return jsonify({
            'high_freq': base64.b64encode(high_buf.getvalue()).decode(),
            'low_freq': base64.b64encode(low_buf.getvalue()).decode()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# 3D Processing Routes
@app.route('/3d')
def threed():
    return render_template('3d.html')

@app.route('/process_3d', methods=['POST'])
def process_3d():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        if file:
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # Get file URL
            file_url = f'/static/uploads/{filename}'
            
            # Extract features
            features = {
                'filename': filename,
                'size': os.path.getsize(filepath),
                'format': filename.split('.')[-1].upper(),
                'path': file_url
            }
            
            return jsonify({
                'success': True,
                'file_url': file_url,
                'features': features
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/augment_3d', methods=['POST'])
def augment_3d():
    try:
        file_url = request.json['file_url']
        # For demonstration, we'll return the same model
        # In a real application, you would process the model here
        return jsonify({
            'success': True,
            'augmented_url': file_url
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
