# Deploying Word Golf to AWS App Runner

The [`Deploy Word Golf (AWS App Runner)`](../../.github/workflows/deploy-aws.yml)
workflow builds the web app image, pushes it to **Amazon ECR**, and triggers an
**App Runner** deployment on every merge to `main` (and on manual dispatch).
Pull requests only build the image to validate the Dockerfile.

Auth is keyless via **GitHub OIDC → an IAM role** — no AWS keys are stored. GitHub
mints a short-lived OIDC token that AWS STS exchanges for credentials scoped to
one role, usable only from `main` of this repo.

```
merge to main ─▶ deploy-aws.yml ─▶ build image (linux/amd64)
                                  ─▶ push  <acct>.dkr.ecr.us-east-2.amazonaws.com/word-golf
                                  ─▶ apprunner start-deployment → wait → URL
```

## Live service

- **URL:** https://zbmvvkctmp.us-east-2.awsapprunner.com
- App Runner auto-provisions TLS + a stable subdomain; the URL is stable across deploys.

## Fixed settings

| Setting | Value |
|---------|-------|
| AWS account | `955116512041` |
| Region | `us-east-2` |
| ECR repo | `word-golf` |
| App Runner service | `word-golf` |
| Image | `linux/amd64`, tags `latest` + commit SHA, port `8080` |
| ECR access role | `AppRunnerECRAccessRole` (App Runner pulls the image) |
| CI deploy role | `wordgolf-github-deployer` (assumed via OIDC) |

The workflow reads four **repository variables**: `AWS_DEPLOY_ROLE_ARN`,
`AWS_REGION`, `ECR_REPO`, `AWS_APPRUNNER_SERVICE_ARN`.

## One-time setup (already applied to account 955116512041)

Requires an **Administrator** role (App Runner + IAM). The demo `PowerUser`
permission set is **not** sufficient — it can't use App Runner or create IAM
roles/OIDC providers. Recorded here so it's reproducible in another account.

```bash
export AWS_PROFILE=admin-955116512041 AWS_REGION=us-east-2 AWS_DEFAULT_REGION=us-east-2
ACCOUNT=955116512041 REGION=us-east-2 REPO=word-golf GH_REPO=alawrenceld/WordGolfAutofactory

# 1. ECR repository
aws ecr create-repository --repository-name "$REPO" --image-scanning-configuration scanOnPush=true

# 2. Build + push the first image (App Runner needs an image to exist first).
#    App Runner requires linux/amd64; disable provenance so it's a plain manifest.
aws ecr get-login-password | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
docker buildx build --platform linux/amd64 --provenance=false --sbom=false \
  -f word-golf/Dockerfile \
  -t "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${REPO}:latest" --push word-golf

# 3. App Runner service (uses the pre-existing AppRunnerECRAccessRole to pull ECR).
ACCESS_ROLE=$(aws iam get-role --role-name AppRunnerECRAccessRole --query 'Role.Arn' --output text)
aws apprunner create-service --service-name word-golf \
  --source-configuration "{\"ImageRepository\":{\"ImageIdentifier\":\"${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${REPO}:latest\",\"ImageRepositoryType\":\"ECR\",\"ImageConfiguration\":{\"Port\":\"8080\"}},\"AutoDeploymentsEnabled\":false,\"AuthenticationConfiguration\":{\"AccessRoleArn\":\"${ACCESS_ROLE}\"}}" \
  --instance-configuration '{"Cpu":"256","Memory":"512"}' \
  --health-check-configuration '{"Protocol":"HTTP","Path":"/","Interval":10,"Timeout":5,"HealthyThreshold":1,"UnhealthyThreshold":5}'

# 4. GitHub OIDC provider (skip if it already exists in the account).
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# 5. CI deploy role, trusted only from main of this repo, with ECR push +
#    App Runner deploy permissions (see the trust + inline policy JSON we used).
#    Role: wordgolf-github-deployer

# 6. Repo variables the workflow reads:
gh variable set AWS_DEPLOY_ROLE_ARN --body "arn:aws:iam::955116512041:role/wordgolf-github-deployer"
gh variable set AWS_REGION --body "us-east-2"
gh variable set ECR_REPO --body "word-golf"
gh variable set AWS_APPRUNNER_SERVICE_ARN --body "arn:aws:apprunner:us-east-2:955116512041:service/word-golf/436622e3ad2943e4b9ae9dc527a31ecd"
```

CI deploy role trust (who can assume it) and permissions (what it can do):

- **Trust:** `token.actions.githubusercontent.com` with
  `sub == repo:alawrenceld/WordGolfAutofactory:ref:refs/heads/main`.
- **Permissions:** `ecr:GetAuthorizationToken` (all), ECR push/pull on the
  `word-golf` repo, and `apprunner:StartDeployment|DescribeService|ListOperations`
  on the service ARN.

## Deploying

```bash
# Manually:
gh workflow run "Deploy Word Golf (AWS App Runner)"
# …or merge any PR that touches word-golf/** to main.
```

Watch it, then grab the URL:

```bash
gh run watch "$(gh run list --workflow=deploy-aws.yml --limit 1 --json databaseId -q '.[0].databaseId')"
aws apprunner describe-service \
  --service-arn arn:aws:apprunner:us-east-2:955116512041:service/word-golf/436622e3ad2943e4b9ae9dc527a31ecd \
  --query 'Service.ServiceUrl' --output text
```

## Notes

- **Public access:** App Runner services are internet-facing by default; the URL
  is open. To restrict, attach a VPC connector or WAF / make it private.
- **Rollbacks:** every deploy also pushes an immutable `:<sha>` tag. To roll back,
  point the service at a prior tag (`aws apprunner update-service --source-configuration …`)
  or re-run the workflow on an older commit. (Phase 2 / Beacon will automate
  metric-guarded rollback.)
- **Auto-deploy is off:** the workflow triggers deployments explicitly so CI can
  wait on and report the result. Flip `AutoDeploymentsEnabled` to `true` on the
  service if you'd rather App Runner redeploy on any ECR push.
- **Cost:** provisioned at 0.25 vCPU / 0.5 GB (App Runner minimum) — plenty for a
  static nginx site.
