from flask import Blueprint, render_template, request, jsonify
import librosa
import soundfile as sf
import numpy as np
import matplotlib.pyplot as plt
import io
import base64
import os

audio_bp = Blueprint('audio', __name__, 
                    template_folder='templates',
                    static_folder='static',
                    static_url_path='/audio/static')

# Keep your existing audio processing code here
# ... (all the audio processing functions and routes)

@audio_bp.route('/')
def audio_index():
    return render_template('audio.html')
