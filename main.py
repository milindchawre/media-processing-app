from flask import Flask, render_template
from audio_app.audio_app import audio_bp
from media_app.media_app import media_bp

app = Flask(__name__)

# Register blueprints
app.register_blueprint(audio_bp, url_prefix='/audio')
app.register_blueprint(media_bp, url_prefix='/media')

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True) 