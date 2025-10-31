# Script to automatically farm Pair Extraordinaire achievement
# Creates PRs with co-authored commits and merges them automatically

param(
    [int]$Count = 24,  # Total PRs to create (24 for Gold level)
    [string]$CoAuthorEmail = "asadullokhnurullev@gmail.com",
    [string]$CoAuthorName = "asadullokhn"
)

# Default co-author: asadullokhn <asadullokhnurullev@gmail.com>

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Pair Extraordinaire Achievement Farmer" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if GitHub CLI is installed
$ghInstalled = Get-Command gh -ErrorAction SilentlyContinue

if (-not $ghInstalled) {
    Write-Host "Warning: GitHub CLI (gh) is not installed." -ForegroundColor Yellow
    Write-Host "The script will create branches but you'll need to create PRs manually." -ForegroundColor Yellow
    Write-Host "Install GitHub CLI: https://cli.github.com/" -ForegroundColor Yellow
    Write-Host ""
}

# Check current branch
$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne "master") {
    Write-Host "Switching to master branch..." -ForegroundColor Yellow
    git checkout master
    git pull origin master
}

Write-Host "Creating $Count PR branches with co-authored commits..." -ForegroundColor Green
Write-Host ""

$createdBranches = @()
$successCount = 0
$failedCount = 0

for ($i = 1; $i -le $Count; $i++) {
    $branchName = "feature/auto-pr-$i"
    
    Write-Host "[$i/$Count] Processing branch: $branchName" -ForegroundColor Cyan
    
    try {
        # Create branch
        git checkout -b $branchName 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [FAIL] Failed to create branch (might already exist)" -ForegroundColor Red
            $failedCount++
            continue
        }
        
        # Make a small change to README.md
        $readmePath = "README.md"
        if (Test-Path $readmePath) {
            # Add a comment at the end of file
            $content = Get-Content $readmePath -Raw
            $comment = "`n<!-- Auto-generated for Pair Extraordinaire PR #$i -->"
            
            # Check if comment already exists
            if ($content -notmatch "Auto-generated for Pair Extraordinaire PR #$i") {
                $content = $content.TrimEnd() + $comment
                Set-Content -Path $readmePath -Value $content -NoNewline
                
                # Stage changes
                git add $readmePath 2>&1 | Out-Null
                
                # Create commit with co-author (using here-string for proper formatting)
                $commitFile = [System.IO.Path]::GetTempFileName()
                $commitContent = @"
docs: auto-update for Pair Extraordinaire PR #$i

Co-authored-by: $CoAuthorName <$CoAuthorEmail>
"@
                Set-Content -Path $commitFile -Value $commitContent -NoNewline -Encoding UTF8
                
                git commit -F $commitFile 2>&1 | Out-Null
                
                # Clean up temp file
                Remove-Item $commitFile -Force -ErrorAction SilentlyContinue
                
                if ($LASTEXITCODE -eq 0) {
                    # Push branch
                    git push origin $branchName 2>&1 | Out-Null
                    
                    if ($LASTEXITCODE -eq 0) {
                        $createdBranches += $branchName
                        $successCount++
                        Write-Host "  [OK] Branch created and pushed successfully" -ForegroundColor Green
                        
                        # Create PR if GitHub CLI is available
                        if ($ghInstalled) {
                            $prTitle = "docs: auto-update for Pair Extraordinaire PR #$i"
                            
                            # Create PR body file for proper multi-line content
                            $prBodyFile = [System.IO.Path]::GetTempFileName()
                            $prBodyContent = @"
Auto-generated PR for Pair Extraordinaire achievement.

Co-authored-by: $CoAuthorName <$CoAuthorEmail>
"@
                            Set-Content -Path $prBodyFile -Value $prBodyContent -NoNewline -Encoding UTF8
                            
                            Write-Host "  Creating PR..." -ForegroundColor Yellow
                            $prResult = gh pr create --title $prTitle --body-file $prBodyFile --base master --head $branchName 2>&1
                            
                            # Clean up temp file
                            Remove-Item $prBodyFile -Force -ErrorAction SilentlyContinue
                            
                            $prNumber = $null
                            if ($LASTEXITCODE -eq 0) {
                                Write-Host "  [OK] PR created" -ForegroundColor Green
                                
                                # Extract PR number from output
                                if ($prResult -match 'pull/(\d+)') {
                                    $prNumber = $matches[1]
                                }
                                
                                if ($prNumber) {
                                    Write-Host "  Merging PR #$prNumber..." -ForegroundColor Yellow
                                    gh pr merge $prNumber --merge --delete-branch 2>&1 | Out-Null
                                    
                                    if ($LASTEXITCODE -eq 0) {
                                        Write-Host "  [OK] PR merged and branch deleted" -ForegroundColor Green
                                        
                                        # Clean up local branch
                                        git branch -D $branchName 2>&1 | Out-Null
                                    } else {
                                        Write-Host "  ⚠ PR created but merge failed" -ForegroundColor Yellow
                                    }
                                } else {
                                    Write-Host "  ⚠ Could not extract PR number from output" -ForegroundColor Yellow
                                }
                            } else {
                                Write-Host "  [WARN] Failed to create PR (check GitHub CLI auth)" -ForegroundColor Yellow
                                Write-Host "  Error: $prResult" -ForegroundColor Red
                            }
                        }
                    } else {
                    Write-Host "  [FAIL] Failed to push branch" -ForegroundColor Red
                    $failedCount++
                }
            } else {
                Write-Host "  [FAIL] Failed to create commit" -ForegroundColor Red
                    $failedCount++
                }
            } else {
                Write-Host "  [SKIP] Branch already processed, skipping" -ForegroundColor Yellow
                git checkout master 2>&1 | Out-Null
                git branch -D $branchName 2>&1 | Out-Null
            }
        } else {
            Write-Host "  [FAIL] README.md not found" -ForegroundColor Red
            $failedCount++
        }
        
        # Return to master
        git checkout master 2>&1 | Out-Null
        
    } catch {
        Write-Host "  [ERROR] Error: $_" -ForegroundColor Red
        $failedCount++
        git checkout master 2>&1 | Out-Null
    }
    
    # Small delay to avoid rate limiting
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Green
Write-Host "  Successfully created: $successCount branches" -ForegroundColor Green
Write-Host "  Failed: $failedCount branches" -ForegroundColor $(if ($failedCount -gt 0) { "Red" } else { "Green" })
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

if (-not $ghInstalled) {
    Write-Host "Next steps (manual):" -ForegroundColor Yellow
    Write-Host "1. Install GitHub CLI: https://cli.github.com/" -ForegroundColor White
    Write-Host "2. Authenticate: gh auth login" -ForegroundColor White
    Write-Host "3. Create PRs manually via GitHub web interface" -ForegroundColor White
    Write-Host ""
    Write-Host "Created branches:" -ForegroundColor Yellow
    foreach ($branch in $createdBranches) {
        Write-Host "  - $branch" -ForegroundColor White
        Write-Host "    PR URL: https://github.com/FROWNINGdev/BazarMonitoring/compare/master...$branch" -ForegroundColor Gray
    }
} else {
    Write-Host "All PRs should be created and merged automatically!" -ForegroundColor Green
    Write-Host "Check progress: https://github.com/FROWNINGdev/BazarMonitoring/pulls?q=is%3Apr+is%3Amerged" -ForegroundColor Cyan
    Write-Host "Check achievements: https://github.com/settings/achievements" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Achievement progress:" -ForegroundColor Yellow
Write-Host "  Bronze: 1 merged PR" -ForegroundColor White
Write-Host "  Silver: 10 merged PRs" -ForegroundColor White
Write-Host "  Gold: 24 merged PRs" -ForegroundColor White
Write-Host ""

