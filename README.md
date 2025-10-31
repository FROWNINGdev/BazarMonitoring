# 🏪 BazarMonitoring - Bazaar Monitoring System for Uzbekistan

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3+-green.svg)](https://flask.palletsprojects.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-success.svg)](https://opensource.org/)

> Modern web platform for monitoring and managing a network of bazaars across Uzbekistan with interactive maps, statistics, and analytics.

## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### 🎯 Monitoring and Management
- ✅ **Real-time monitoring** - track status of all bazaars online/offline
- ✅ **Interactive map** - visualize bazaars on Uzbekistan map with regional boundaries
- ✅ **Detailed statistics** - analytics on cameras, ROI (regions of interest), statuses
- ✅ **Automatic logging** - complete history of status changes and events

### 📊 Analytics and Reports
- 📈 **General statistics** - bazaars, cameras, availability
- 📊 **Regional statistics** - data breakdown by regions of Uzbekistan
- 📄 **Excel export** - detailed reports with data for each bazaar
- 🎥 **Camera information** - count, status (online/offline), ROI

### 🛠️ Administrative Functions
- ➕ **Add bazaars** - simple interface for adding new services
- ✏️ **Edit** - modify bazaar data (contacts, coordinates, ports)
- 🗑️ **Delete** - manage bazaar list
- 📞 **Contact information** - store Click and SCC contacts

### 🎨 User Interface
- 🌙 **Dark/light theme** - toggle between themes
- 🌍 **Multi-language** - support for Russian, Uzbek, and English
- 📱 **Responsive design** - works on all devices
- ⚡ **Fast performance** - optimized performance

## 🛠️ Technology Stack

### Backend
- **Python 3.11** - main programming language
- **Flask** - web framework
- **SQLAlchemy** - ORM for database operations
- **Flask-Migrate** - database migration management
- **Flask-RESTX** - REST API with Swagger documentation
- **SQLite** - database

### Frontend
- **HTML5/CSS3** - markup and styling
- **JavaScript (ES6+)** - interactivity
- **Leaflet.js** - interactive maps
- **Chart.js** - charts and diagrams
- **SheetJS (XLSX)** - Excel export

### DevOps
- **Docker** - containerization
- **Docker Compose** - container orchestration
- **Nginx** - web server for frontend

## 🚀 Quick Start

### Prerequisites

- [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/)
- Or Python 3.11+ for local installation

### Run with Docker (recommended)

```bash
# Clone the repository
git clone https://github.com/FROWNINGdev/bazarmonitoring.git
cd bazarmonitoring

# Run the application
docker-compose up --build

# Application will be available at:
# Frontend: http://localhost:80
# Backend API: http://localhost:5000
# API Docs: http://localhost:5000/docs/
```

### Local Installation

```bash
# 1. Clone the repository
git clone https://github.com/FROWNINGdev/bazarmonitoring.git
cd bazarmonitoring

# 2. Install backend dependencies
cd backend
pip install -r requirements.txt

# 3. Initialize database
python reset_migrations.py

# 4. Run backend
python app.py

# 5. In another terminal, run frontend
cd frontend
python -m http.server 8080
```

## 📖 Installation

### Step-by-step Installation

1. **Clone repository**
   ```bash
   git clone https://github.com/FROWNINGdev/bazarmonitoring.git
   cd bazarmonitoring
   ```

2. **Configure environment variables** (optional)
   ```bash
   # Create .env file in backend/
   SQLALCHEMY_DATABASE_URI=sqlite:///instance/bazar_monitoring.db
   FLASK_ENV=development
   ```

3. **Build and run Docker containers**
   ```bash
   docker-compose up --build -d
   ```

4. **Verify installation**
   ```bash
   # Check API
   curl http://localhost:5000/api/health
   
   # Check frontend
   curl http://localhost/
   ```

## 🎮 Usage

### Web Interface

1. Open browser and navigate to `http://localhost:80`
2. Use filters to search for bazaars
3. Click on a bazaar on the map to view detailed information
4. Use menu to access:
   - General statistics
   - System logs
   - Administrative panel

### API Usage

```bash
# Get list of all bazaars
curl http://localhost:5000/api/bazars

# Get statistics
curl http://localhost:5000/api/statistics

# Get logs
curl http://localhost:5000/api/logs?limit=50

# Add new bazaar
curl -X POST http://localhost:5000/api/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bazaar Name",
    "city": "City",
    "ip": "192.168.1.100",
    "port": 80,
    "backend_port": 8200,
    "pg_port": 5400
  }'
```

## 📚 API Documentation

Full API documentation is available through Swagger UI:
- **URL**: `http://localhost:5000/docs/`
- Interactive API endpoint testing
- Description of all parameters and responses

### Main Endpoints

| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/api/bazars` | Get list of all bazaars |
| GET | `/api/status` | Get status from database |
| GET | `/api/statistics` | General statistics |
| GET | `/api/cameras/statistics` | Camera statistics |
| GET | `/api/logs` | Get logs |
| POST | `/api/services` | Add new service |
| PUT | `/api/services/<id>` | Update service |
| DELETE | `/api/services/<id>` | Delete service |

## 📦 GitHub Packages

The project automatically publishes packages to GitHub Packages:

- **🐳 Docker Images** - ready-to-use backend and frontend containers
- **📦 npm Package** - frontend components for npm
- **🐍 Python Package** - backend API for pip

Detailed usage instructions: [PACKAGES.md](PACKAGES.md)

### Quick Install via Docker

```bash
# Backend
docker pull ghcr.io/frowningdev/bazarmonitoring-backend:latest

# Frontend
docker pull ghcr.io/frowningdev/bazarmonitoring-frontend:latest
```

## 📁 Project Structure

```
bazarmonitoring/
├── backend/                 # Backend application
│   ├── app.py              # Main Flask application file
│   ├── init_db.py          # Database initialization
│   ├── migrate.py           # Migration script
│   ├── reset_migrations.py # Migration reset
│   ├── docker-entrypoint.sh # Docker entrypoint
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile          # Docker image for backend
│   └── instance/           # SQLite database
│
├── frontend/                # Frontend application
│   ├── index.html          # Main page
│   ├── script.js           # JavaScript logic
│   ├── styles.css          # Styles
│   ├── nginx.conf          # Nginx configuration
│   ├── Dockerfile          # Docker image for frontend
│   └── Uzb/                # GeoJSON data for map
│
├── docker-compose.yml      # Docker Compose configuration
├── README.md               # This file
├── LICENSE                 # MIT License
└── CONTRIBUTING.md         # Contributor guide
```

## 🤝 Contributing

We welcome any contributions to the project! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

See also [PAIR_EXTRAORDINAIRE.md](PAIR_EXTRAORDINAIRE.md) for information about collaborative development.

### How to Contribute

1. **Fork** the repository
2. Create a **branch** for your feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. Open a **Pull Request**

### Code Style

- Python: follow [PEP 8](https://pep8.org/)
- JavaScript: use ESLint configuration
- Commits: use clear messages in English

## 👥 Authors

- **FROWNINGdev** - *Lead Developer* - [GitHub](https://github.com/FROWNINGdev)
- **asadullokhn** - *Co-Developer* - [GitHub](https://github.com/asadullokhn)

See also the list of [contributors](https://github.com/FROWNINGdev/bazarmonitoring/contributors) who participated in this project.

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Leaflet.js](https://leafletjs.com/) for excellent mapping library
- [Flask](https://flask.palletsprojects.com/) for simple and powerful framework
- Open source community for inspiration and support

## 📞 Contact

- **Email**: support@bazar-monitoring.uz
- **Issues**: [GitHub Issues](https://github.com/FROWNINGdev/bazarmonitoring/issues)
- **Discussions**: [GitHub Discussions](https://github.com/FROWNINGdev/bazarmonitoring/discussions)

## ⭐ Project Status

![GitHub stars](https://img.shields.io/github/stars/FROWNINGdev/bazarmonitoring?style=social)
![GitHub forks](https://img.shields.io/github/forks/FROWNINGdev/bazarmonitoring?style=social)
![GitHub issues](https://img.shields.io/github/issues/FROWNINGdev/bazarmonitoring)
![GitHub pull requests](https://img.shields.io/github/issues-pr/FROWNINGdev/bazarmonitoring)

---

⭐ If this project was helpful, please give it a star on GitHub!

<!-- Updated for Pair Extraordinaire achievement -->
<!-- Auto-generated for Pair Extraordinaire PR #10 -->