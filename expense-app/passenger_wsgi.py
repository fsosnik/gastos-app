import sys, os

# Point to the virtual environment python executable
# Adjust 'venv' to the name of your virtual environment folder if different
# We check if venv exists to avoid infinite loops or errors if missing
venv_path = os.getcwd() + "/venv/bin/python"
if os.path.exists(venv_path) and sys.executable != venv_path:
    os.execl(venv_path, venv_path, *sys.argv)

sys.path.append(os.getcwd())

from app import app as application
