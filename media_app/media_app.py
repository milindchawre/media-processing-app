from flask import Blueprint, render_template, request, jsonify
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import wordnet
import tiktoken
from PIL import Image
import io
import base64

# Create the blueprint
media_bp = Blueprint('media', __name__,
                    template_folder='templates',
                    static_folder='static',
                    static_url_path='/media/static')

# Download NLTK data
nltk.download('punkt')
nltk.download('averaged_perceptron_tagger')
nltk.download('wordnet')
nltk.download('omw-1.4')

@media_bp.route('/')
def media_index():
    return render_template('media.html')

@media_bp.route('/process_text', methods=['POST'])
def process_text():
    text = request.json.get('text', '')
    enc = tiktoken.get_encoding("cl100k_base")
    tokens = enc.encode(text)
    return jsonify({
        'tokens': tokens,
        'token_text': [enc.decode([token]) for token in tokens]
    })

@media_bp.route('/augment_text', methods=['POST'])
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

@media_bp.route('/process_image', methods=['POST'])
def process_image():
    try:
        image_data = request.json.get('image', '')
        img = get_image_from_base64(image_data)
        resized_img = img.resize((128, 128), Image.Resampling.LANCZOS)
        processed_image = image_to_base64(resized_img)
        return jsonify({'processed_image': processed_image})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@media_bp.route('/augment_image', methods=['POST'])
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
