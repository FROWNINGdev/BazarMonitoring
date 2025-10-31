# Скрипт для автоматического создания GitHub Release
# Использование: .\create_release.ps1 [версия]

param(
    [string]$Version = "1.0.0",
    [string]$GitHubToken = $env:GITHUB_TOKEN,
    [string]$RepoOwner = "FROWNINGdev",
    [string]$RepoName = "bazarmonitoring"
)

Write-Host "=== Создание релиза v$Version ===" -ForegroundColor Green

# 1. Создаем git tag
Write-Host "`n1. Создание git tag v$Version..." -ForegroundColor Yellow
$tagMessage = Get-Content -Path "release_tag_message.txt" -Raw -Encoding UTF8
git tag -a "v$Version" -F "release_tag_message.txt"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при создании tag" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Tag v$Version создан" -ForegroundColor Green

# 2. Push tag в GitHub
Write-Host "`n2. Отправка tag в GitHub..." -ForegroundColor Yellow
git push origin "v$Version"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при отправке tag" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Tag отправлен в GitHub" -ForegroundColor Green

# 3. Создание GitHub Release (если есть токен)
if ($GitHubToken) {
    Write-Host "`n3. Создание GitHub Release..." -ForegroundColor Yellow
    
    $releaseNotes = @"
## 🎉 Release v$Version - BazarMonitoring

### ✨ Main Features

- ✅ **Real-time bazaar monitoring**
- 🗺️ **Interactive map** of Uzbekistan with regional boundaries
- 📊 **Statistics** on cameras and ROI
- 📄 **Excel export** with detailed reports
- 🛠️ **Administrative panel** for bazaar management
- 🌍 **Multi-language support** (RU/UZ/EN)
- 🌙 **Dark/light theme**

### 📦 Installation

\`\`\`bash
git clone https://github.com/$RepoOwner/$RepoName.git
cd $RepoName
docker-compose up --build
\`\`\`

### 📚 Documentation

Full documentation available in [README.md](README.md)

### 👥 Authors

- **FROWNINGdev** - Lead Developer
- **asadullokhn** - Co-Developer

### 🔗 Links

- [Documentation](README.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Issues](https://github.com/$RepoOwner/$RepoName/issues)
"@

    $body = @{
        tag_name = "v$Version"
        name = "Release v$Version"
        body = $releaseNotes
        draft = $false
        prerelease = $false
    } | ConvertTo-Json

    $headers = @{
        "Authorization" = "token $GitHubToken"
        "Accept" = "application/vnd.github.v3+json"
    }

    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/releases" `
            -Method Post -Headers $headers -Body $body -ContentType "application/json"
        
        Write-Host "✓ GitHub Release создан: $($response.html_url)" -ForegroundColor Green
    } catch {
        Write-Host "⚠ Ошибка при создании GitHub Release: $_" -ForegroundColor Yellow
        Write-Host "  Создайте релиз вручную на GitHub: https://github.com/$RepoOwner/$RepoName/releases/new" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n3. GitHub Token не установлен" -ForegroundColor Yellow
    Write-Host "  Установите переменную окружения GITHUB_TOKEN для автоматического создания релиза" -ForegroundColor Yellow
    Write-Host "  Или создайте релиз вручную: https://github.com/$RepoOwner/$RepoName/releases/new" -ForegroundColor Yellow
}

Write-Host "`n=== Релиз v$Version готов! ===" -ForegroundColor Green
Write-Host "Tag отправлен: v$Version" -ForegroundColor Cyan
if ($GitHubToken) {
    Write-Host "GitHub Release создан" -ForegroundColor Cyan
} else {
    Write-Host "Создайте GitHub Release вручную: https://github.com/$RepoOwner/$RepoName/releases/new" -ForegroundColor Cyan
}

