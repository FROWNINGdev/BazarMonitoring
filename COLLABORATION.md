# 👥 Collaboration Guide

This document describes the process of collaborative work on the project and creating co-authored commits.

## 🤝 Co-authored Commits

### Method 1: Through Commit Message (GitHub UI)

When creating a commit through the GitHub interface, add co-authors:

```
feat: add new feature

Co-authored-by: Colleague Name <email@example.com>
```

GitHub will automatically recognize this and show both authors in the commit history.

### Method 2: Through Command Line

#### Option A: Co-authored-by trailer

```bash
git commit -m "feat: collaborative work on feature

Detailed description of changes...

Co-authored-by: Colleague Name <email@example.com>"
```

#### Option B: Multiple authors

```bash
git commit -m "feat: add new feature

Co-authored-by: First Participant <first@example.com>
Co-authored-by: Second Participant <second@example.com>"
```

### Method 3: Git config setup

If you work together regularly:

```bash
# Set multiple authors
git config user.name "Your Name and Colleague Name"
git config user.email "your-email@example.com"

# Or use for specific commit
git -c user.name="Your Name and Colleague Name" \
    -c user.email="your-email@example.com" \
    commit -m "feat: collaborative work"
```

## 📝 Commit Message Examples

### With one co-author

```bash
git commit -m "feat: add camera monitoring feature

Implemented camera statistics with ROI for each bazaar.
Added detailed information to Excel export List 2.

Co-authored-by: Your Colleague <colleague@example.com>"
```

### With multiple co-authors

```bash
git commit -m "refactor: refactor API endpoints

Optimized database operations.
Improved error handling.

Co-authored-by: Developer 1 <dev1@example.com>
Co-authored-by: Developer 2 <dev2@example.com>
Co-authored-by: Tester <tester@example.com>"
```

### Bug fix

```bash
git commit -m "fix: fix database migration error

Resolved issue with non-existent revision 038284fc03d5.
Added reset_migrations.py script to reset migrations.

Co-authored-by: Your Colleague <colleague@example.com>"
```

## 🔄 Collaboration Process

### Step 1: Agreement on Changes

Before starting work:
- Discuss the task in Issues or Discussion
- Divide responsibility between participants
- Agree on implementation approach

### Step 2: Create Branch

```bash
# One participant creates a branch
git checkout -b feature/joint-feature

# Or use a shared branch
git checkout -b feature/collaboration-$(date +%Y%m%d)
```

### Step 3: Work on Code

Each participant works on their part:
- Participant 1: Backend changes
- Participant 2: Frontend changes
- Or pair programming

### Step 4: Commits

#### Option A: Separate commits from each

```bash
# Participant 1 makes commit
git commit -m "feat(backend): add new endpoint"

# Participant 2 makes commit
git commit -m "feat(frontend): add UI for new endpoint"
```

#### Option B: Joint commit

```bash
# One participant creates commit with co-authors
git add .
git commit -m "feat: complete feature implementation

Backend: added API endpoint
Frontend: added UI component

Co-authored-by: Backend Dev <backend@example.com>
Co-authored-by: Frontend Dev <frontend@example.com>"
```

### Step 5: Push and Pull Request

```bash
# Push branch
git push origin feature/joint-feature

# Create Pull Request on GitHub
# Mention all participants in PR description
```

## 📋 Pull Request Template for Collaboration

```markdown
## Description
Brief description of changes you worked on together.

## Participants
- @username1 - backend work
- @username2 - frontend work
- @username3 - testing

## Type of Changes
- [ ] New features
- [ ] Bug fixes
- [ ] Refactoring
- [ ] Documentation

## How to Test
1. Step 1
2. Step 2
3. Step 3

## Screenshots (if applicable)
[Add screenshots]

## Checklist
- [ ] Code tested
- [ ] Documentation updated
- [ ] No conflicts
- [ ] All participants agree with changes
```

## ✅ Verify Co-authored Commits

After creating a commit, verify:

```bash
# View last commit
git show

# View history with authors
git log --format="%h %an <%ae> %s"

# Check on GitHub
# Go to repository -> Insights -> Contributors
```

## 🎯 Best Practices

1. **Always specify co-authors** in important changes
2. **Use clear commit messages**
3. **Discuss changes** before committing
4. **Test together** before submitting PR
5. **Review each other's code**

## 📚 Additional Resources

- [GitHub Co-authored commits](https://github.blog/2018-01-29-commit-together-with-co-authors/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Documentation](https://git-scm.com/doc)

---

Happy collaborating! 🚀
