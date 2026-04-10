# Deployment Guide — From Gitea Repo to Live Website

This guide walks you through every step needed to get your site running on the school server (`3kant-server`) using Gitea, Docker, and Gitea Actions.

> **What happens at the end:** every time you push code to your `main` branch, the server automatically builds a new Docker image of your site, pushes it to the school's container registry, and restarts your container — so your live site updates automatically.

---

## Prerequisites

- A Gitea account on `http://3kant-server.cv.local:1103/`
- A repo on that Gitea instance that contains the site files, a `dockerfile`, a `docker-compose.yaml`, and a `.gitea/workflows/deploy.yml` (see below if you are starting fresh)
- Your site should at minimum have an `index.html`

---

## Overview of the pipeline

```
You push to main
       │
       ▼
Gitea Actions runner picks up the workflow
       │
       ├─► Builds a Docker image of your site
       │
       ├─► Pushes the image to the school's container registry
       │         (3kant-server.cv.local:1103)
       │
       └─► Runs docker compose up → your site is live on your port
```

---

## Step 1 — Create or fork the repo in Gitea

1. Open `http://3kant-server.cv.local:1103/` and log in.
2. Either:
   - **Fork** an existing repo (e.g. `mara/edu-site`): click the **Fork** button on the repo page, or
   - **Create a new repo**: click the **+** icon → *New Repository*. Give it a name (e.g. `my-website`), set it to *Private* or *Public* as instructed, and click *Create Repository*.
3. If you created a new repo, clone it to your machine and add your site files. At minimum you need `index.html`.

---

## Step 2 — Add the required files

Your repo needs three infrastructure files. If you forked `mara/edu-site` they are already there — but you **must** edit them (see Steps 3 and 4).

### `dockerfile`

No changes needed. This file tells Docker how to package your site into an nginx image.

```dockerfile
FROM nginx:latest

COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### `docker-compose.yaml`

This file tells Docker how to run your container on the server. **You must customize it** — see Step 3.

### `.gitea/workflows/deploy.yml`

This file defines the automated pipeline. **You must customize it** — see Step 4.

---

## Step 3 — Customize `docker-compose.yaml`

Open `docker-compose.yaml`. It looks like this:

```yaml
services:
  edu-site:
    image: 3kant-server.cv.local:1103/mara/edu-site:latest
    container_name: mara-edu-container
    ports:
      - "1104:80"
    restart: unless-stopped
```

You need to change **three things** so your container does not clash with anyone else's:

| Field | What to change | Example |
|---|---|---|
| `image` | Replace `mara/edu-site` with your **Gitea username** and your **repo name** | `3kant-server.cv.local:1103/anna/my-website:latest` |
| `container_name` | Use your own unique name | `anna-my-website-container` |
| `ports` | Choose a port number **assigned to you** (replace `1104`) | `"2050:80"` |

The port on the **left** of the `:` is the public port your site will be reachable on. The `80` on the right must stay as-is (that is nginx's port inside the container).

**Example — after editing:**

```yaml
services:
  my-website:
    image: 3kant-server.cv.local:1103/anna/my-website:latest
    container_name: anna-my-website-container
    ports:
      - "2050:80"
    restart: unless-stopped
```

---

## Step 4 — Customize `.gitea/workflows/deploy.yml`

Open `.gitea/workflows/deploy.yml`. It looks like this:

```yaml
name: Build and Deploy

on:
  push:
    branches:
      - main

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Log in to Gitea container registry
        uses: docker/login-action@v3
        with:
          registry: 3kant-server.cv.local:1103
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./dockerfile
          push: true
          tags: 3kant-server.cv.local:1103/mara/edu-site:latest

      - name: Deploy — pull new image and restart container
        run: |
          docker compose pull
          docker compose up -d
```

You need to change **one line** — the `tags:` value under *Build and push Docker image*. Change it to match the `image:` value you set in `docker-compose.yaml`:

```yaml
          tags: 3kant-server.cv.local:1103/anna/my-website:latest
```

> **Important:** the `tags:` value in the workflow and the `image:` value in `docker-compose.yaml` must be **identical**. If they differ, the runner will push the image under one name but try to run a different one.

Everything else in the workflow stays the same — the `${{ secrets.REGISTRY_USERNAME }}` and `${{ secrets.REGISTRY_PASSWORD }}` references will be filled in from your repo's secrets, which you set up in the next step.

---

## Step 5 — Add secrets to your Gitea repo

Your workflow needs your Gitea credentials to push to the registry. You store them as *secrets* — encrypted values that Actions can read but that are never visible in logs or code.

1. In your repo on Gitea, click **Settings** (top-right of the repo page).
2. In the left sidebar, click **Actions** → **Secrets**.
3. Click **Add Secret** and add the following two secrets:

| Secret name | Value |
|---|---|
| `REGISTRY_USERNAME` | Your Gitea username (e.g. `anna`) |
| `REGISTRY_PASSWORD` | Your Gitea password |

4. After adding both, the secrets page should list `REGISTRY_USERNAME` and `REGISTRY_PASSWORD`. The values are hidden — that is expected.

> **Never put your password directly in the workflow file.** Always use secrets.

---

## Step 6 — Push to `main` and watch it deploy

1. Commit and push all your changes (the updated `docker-compose.yaml`, `.gitea/workflows/deploy.yml`, and your site files) to the `main` branch.
2. In your repo on Gitea, click the **Actions** tab. You should see a workflow run appear within a few seconds.
3. Click on the run to expand it and watch the steps execute:
   - **Checkout code** — the runner fetches your repo
   - **Log in to Gitea container registry** — authenticates using your secrets
   - **Build and push Docker image** — builds the nginx image and pushes it to the registry
   - **Deploy** — pulls the new image and starts your container

A green ✔ next to every step means success.

> If a step fails, click it to expand the log. The error message will tell you what went wrong. Common issues are listed at the bottom of this guide.

---

## Step 7 — Verify your site is live

Open a browser and go to:

```
http://3kant-server.cv.local:<your-port>/
```

Replace `<your-port>` with the port you chose in Step 3 (e.g. `http://3kant-server.cv.local:2050/`).

You should see your `index.html`. 🎉

From now on, **every push to `main` triggers an automatic redeploy** — you never need to do Steps 6–7 manually again.

---

## How subsequent deploys work

After the first deploy, the server is already running your container. When you push again:

1. The runner builds a **new** Docker image with your latest code.
2. It pushes the new image to the registry (overwriting `:latest`).
3. `docker compose pull` downloads the new image to the server.
4. `docker compose up -d` recreates the container using the new image — with zero manual steps on your part.

---

## Troubleshooting

### The Actions tab shows no workflow run after I pushed

- Make sure your workflow file is saved at exactly `.gitea/workflows/deploy.yml` (the `.gitea` folder must be at the root of the repo).
- Check that you pushed to the `main` branch (not `master` or another branch).

### Step: "Log in to Gitea container registry" fails

- Double-check that both secrets (`REGISTRY_USERNAME`, `REGISTRY_PASSWORD`) are set correctly in **Settings → Actions → Secrets** of *your* repo.
- Make sure the username and password match your Gitea login exactly (case-sensitive).

### Step: "Build and push Docker image" fails with `denied` or `unauthorized`

- The `tags:` value in the workflow must start with your own username. You cannot push to another user's namespace (e.g. `mara/edu-site`) unless you own it.

### Step: "Deploy" fails with `port is already allocated`

- The port you chose in `docker-compose.yaml` is already in use by someone else's container. Choose a different port and push again.

### The workflow succeeds but the site shows nginx's default page

- Make sure `index.html` is in the **root** of your repo (not inside a subfolder). The `dockerfile` copies everything to `/usr/share/nginx/html`, and nginx serves `index.html` from there by default.

### I visit my port but get "connection refused"

- The container may have exited after starting. On the workflow run page, check the log of the *Deploy* step for error output from Docker.
