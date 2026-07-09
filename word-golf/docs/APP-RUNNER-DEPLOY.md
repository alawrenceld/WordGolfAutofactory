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

- **URL:** https://wordgolffactory.launchdarklydemos.com (custom domain)
- **Default URL:** https://zbmvvkctmp.us-east-2.awsapprunner.com (also works)
- App Runner auto-provisions TLS on both; the URLs are stable across deploys.
- See [Custom domain](#custom-domain) for how the friendly name is wired up.

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

## Custom domain

The friendly URL is **https://wordgolffactory.launchdarklydemos.com**, wired to the
service via App Runner's custom-domain feature. App Runner requests + renews an ACM
cert automatically; we only add DNS records to the existing Route 53 public zone
`launchdarklydemos.com` (`Z04794713N147BEH1NVCF`, same account).

The binding is on the *service*, not the image, so it survives every deploy.

```bash
export AWS_PROFILE=admin-955116512041 AWS_REGION=us-east-2 AWS_DEFAULT_REGION=us-east-2
SVC=arn:aws:apprunner:us-east-2:955116512041:service/word-golf/436622e3ad2943e4b9ae9dc527a31ecd
DOMAIN=wordgolffactory.launchdarklydemos.com

# 1. Associate the domain — App Runner returns cert-validation records.
aws apprunner associate-custom-domain --service-arn "$SVC" --domain-name "$DOMAIN" --no-enable-www-subdomain

# 2. Read the validation records (poll until CertificateValidationRecords is populated).
aws apprunner describe-custom-domains --service-arn "$SVC" \
  --query "CustomDomains[?DomainName=='$DOMAIN'] | [0].{status:Status,records:CertificateValidationRecords}"

# 3. In Route 53 zone Z04794713N147BEH1NVCF, UPSERT (all CNAME, TTL 300):
#    - $DOMAIN                       -> zbmvvkctmp.us-east-2.awsapprunner.com   (the app)
#    - the 2 ACM validation records  -> *.acm-validations.aws.                  (cert proof)
#    (aws route53 change-resource-record-sets --hosted-zone-id Z04794713N147BEH1NVCF --change-batch file://records.json)

# 4. Domain flips creating -> pending_certificate_dns_validation -> binding_certificate -> active (~1 min).
aws apprunner describe-custom-domains --service-arn "$SVC" \
  --query "CustomDomains[?DomainName=='$DOMAIN'] | [0].Status" --output text
```

> The edge can serve intermittent TLS failures for a couple of minutes right after
> the domain goes `active` while the cert propagates — it settles on its own.

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
- **Merge → deploy uses a self-dispatch hop (not `on: push`):** the AutoFactory
  commits flag wiring/metrics to the PR branch as `github-actions[bot]`, and GitHub
  will not spawn a `push`-triggered run for a merge whose commits came from
  `GITHUB_TOKEN` — so a plain `on: push` to main silently skips factory-processed
  merges. Instead, a `redeploy-on-merge` job (on `pull_request` `closed` +
  `merged == true`) re-invokes the workflow via `workflow_dispatch` on `main`. That
  keeps the deploy running in the **main-branch OIDC context** (subject
  `…:ref:refs/heads/main`), so the IAM trust policy stays pinned to `main` and needs
  no widening, and it introduces **no long-lived credentials** — the dispatch uses the
  ephemeral `GITHUB_TOKEN` (`workflow_dispatch` is the documented exception that still
  fires when invoked by it). First rollout of this change needs one manual dispatch,
  since the merge that adds it is still governed by the old workflow on `main`.
- **Cost:** provisioned at 0.25 vCPU / 0.5 GB (App Runner minimum) — plenty for a
  static nginx site.
