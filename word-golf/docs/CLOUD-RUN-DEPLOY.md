# Deploying Word Golf to Google Cloud Run

The [`Deploy Word Golf`](../../.github/workflows/deploy.yml) workflow builds the
web app image, pushes it to **Google Artifact Registry**, and deploys a new
**Cloud Run** revision on every merge to `main` (and on manual dispatch). Pull
requests only build the image to validate the Dockerfile.

Auth is keyless via **Workload Identity Federation (WIF)** — no service-account
key is stored anywhere. GitHub mints a short-lived OIDC token that GCP exchanges
for credentials scoped to one service account, usable only from this repo.

```
merge to main ─▶ deploy.yml ─▶ build image
                              ─▶ push  us-central1-docker.pkg.dev/ajl-wordparautofactory/word-golf/web
                              ─▶ deploy Cloud Run service "word-golf" (us-central1)
```

## Fixed settings (already in the workflow)

| Setting | Value |
|---------|-------|
| GCP project | `ajl-wordparautofactory` |
| Region | `us-central1` |
| Artifact Registry repo | `word-golf` |
| Image | `web` (tags: `latest` + commit SHA) |
| Cloud Run service | `word-golf` |

The workflow reads two **repository variables** you set at the end of setup:
`GCP_WIF_PROVIDER` and `GCP_DEPLOY_SA`.

## One-time setup

Run these once (locally with the gcloud CLI, or in [Cloud Shell](https://shell.cloud.google.com/)).
They are idempotent enough to re-run if a step fails.

### 0. Variables

```bash
export PROJECT_ID=ajl-wordparautofactory
export REGION=us-central1
export AR_REPO=word-golf
export SA_NAME=wordgolf-deployer
export POOL_ID=github-pool
export PROVIDER_ID=github-provider
export GITHUB_REPO=alawrenceld/WordGolfAutofactory   # owner/repo

gcloud config set project "$PROJECT_ID"
export PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
```

### 1. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  iam.googleapis.com
```

### 2. Create the Artifact Registry repo

```bash
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Word Golf container images"
```

### 3. Create the deployer service account + grant roles

```bash
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="Word Golf CI deployer"

for ROLE in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE"
done
```

- `run.admin` — create/update Cloud Run services (and set the public invoker policy).
- `artifactregistry.writer` — push images.
- `iam.serviceAccountUser` — act as the Cloud Run runtime service account.

### 4. Create the Workload Identity pool + provider

The attribute condition restricts token exchange to **this repo only**.

```bash
gcloud iam workload-identity-pools create "$POOL_ID" \
  --location=global \
  --display-name="GitHub Actions pool"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${GITHUB_REPO}'"
```

### 5. Let the GitHub repo impersonate the deployer SA

```bash
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}"
```

### 6. Set the two GitHub repository variables

```bash
gh variable set GCP_WIF_PROVIDER \
  --body "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"

gh variable set GCP_DEPLOY_SA --body "$SA_EMAIL"
```

(Or set them under **Settings → Secrets and variables → Actions → Variables**.)

## First deploy

With setup done, trigger the workflow:

```bash
# Manually, without a code change:
gh workflow run "Deploy Word Golf"

# …or just merge any PR that touches word-golf/** to main.
```

Watch it and grab the URL:

```bash
gh run watch "$(gh run list --workflow=deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')"
gcloud run services describe word-golf --region us-central1 --format='value(status.url)'
```

## Notes

- **Public access:** the service deploys with `--allow-unauthenticated` so the
  demo URL is open. Drop that flag in `deploy.yml` to require auth.
- **Rollbacks:** every deploy pins the image to the commit SHA, so each revision
  is reproducible. `gcloud run services update-traffic word-golf --to-revisions=REV=100`
  rolls back instantly. (Phase 2 / Beacon will automate metric-guarded rollback.)
- **Org policy:** if `--allow-unauthenticated` is blocked by a Domain Restricted
  Sharing org policy, the deploy step fails setting the invoker policy — grant an
  exception or deploy authenticated.
