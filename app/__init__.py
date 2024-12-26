from flask import Flask

app = Flask(__name__, 
           static_folder='static',  # Look directly in static directory
           static_url_path='/static')    # URL prefix for static files

from app import routes