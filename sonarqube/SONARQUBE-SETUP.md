# SonarQube Setup Notes

SonarQube already runs as a Docker container on the Jenkins EC2 instance
(installed automatically by `scripts/install-jenkins.sh`, exposed on port 9000).

## One-time manual setup (after `terraform apply`)

1. Open `http://<jenkins-ec2-ip>:9000` → login with default `admin` / `admin` → it will force a password change.
2. Go to **Administration → Security → Users → Tokens** → generate a token for `admin`.
   This token is what Jenkins uses to authenticate (`sonarqube-token` credential in Jenkins).
3. Go to **Administration → Configuration → Webhooks** → add:
   - Name: `jenkins-webhook`
   - URL: `http://<jenkins-ec2-ip>:8080/sonarqube-webhook/`
   This is what lets Sonar tell Jenkins "quality gate passed/failed" instantly instead of Jenkins polling.
4. In Jenkins → **Manage Jenkins → System** → add a SonarQube server named `sonarqube-server`
   pointing to `http://<jenkins-ec2-ip>:9000`, using the token as credential.
5. Install the "SonarQube Scanner" plugin in Jenkins, and configure the `sonar-scanner` CLI tool
   under **Manage Jenkins → Tools** (or install it via the Jenkins container/EC2 directly:
   `wget` the sonar-scanner-cli zip and add it to PATH).

## What it checks (explain this in interview)

- **Bugs** - actual code defects (e.g. null pointer risks, unreachable code)
- **Vulnerabilities** - security-related issues (e.g. hardcoded secrets, SQL injection patterns)
- **Code Smells** - maintainability issues (duplicated code, high complexity, dead code)
- **Coverage** - % of code exercised by unit tests (from the lcov.info reports)
- **Duplications** - % of duplicated code blocks

## Quality Gate

The pipeline uses `waitForQualityGate abortPipeline: true` — this means if SonarQube's
default quality gate (e.g. "no new bugs, coverage on new code >= 80%, no new vulnerabilities")
fails, **the entire pipeline stops** and the Docker image is never built/pushed. This is the
"shift-left" principle — catching issues before they even reach a container image.
