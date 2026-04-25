from pathlib import Path
from flask import Flask, jsonify, render_template

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__, template_folder=str(BASE_DIR / 'templates'), static_folder=str(BASE_DIR / 'assets'))


@app.route('/')
def login_page():
    return render_template('login.html')


@app.route('/dashboard')
def dashboard_page():
    return render_template('dashboard.html')


@app.route('/selection-live')
def selection_live_page():
    return render_template('selection_live.html')


@app.route('/health')
def health_check():
    return jsonify({
        'status': 'ok',
        'service': 'blueorion-qms-python-entry',
        'message': 'Templates and static assets are wired.'
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
