# Deploying to Render

The whole application runs as **one free web service**. The Express server serves
both the REST API and the static frontend, so there is no second service, no CORS
to configure, and no hostname baked into the frontend.

**Total cost: £0 / ₦0.** No credit card required for either service.

---

## Why the database is not on Render

This application speaks **MySQL**. Render's free managed database is **PostgreSQL**,
and Render does not offer managed MySQL at all.

Two ways forward:

| Option | Work required | Verdict |
|---|---|---|
| **Aiven free MySQL** | **None** — same database engine | ✅ Recommended |
| Render free Postgres | Rewrite all 51 queries across 12 files + a new schema | Only if you want a single platform |

**SQLite is not an option here.** Render's free web service has an *ephemeral*
filesystem — every deploy, restart, or spin-down after 15 minutes of inactivity
wipes it, taking the database file with it. Persistent disks exist but are
**paid only**.

So: the app stays on MySQL, and the database comes from Aiven.

---

## Step 1 — Create the free MySQL database on Aiven

1. Go to **https://aiven.io** and click **Sign up**.
   No credit card is required.
2. Once you are in the console, click **Create service**.
3. Choose **MySQL** as the service type.
4. Choose a **plan**: select the **Free** plan.
   (1 CPU, 1 GB RAM, 1 GB disk, 76 max connections. Free indefinitely — not a trial.)
5. Choose a **cloud and region**. Pick one in **Europe** (e.g. Google
   `europe-west1` or AWS `eu-west-1`) — that is the closest to Nigeria, and the
   Render service is in Frankfurt. Do not pick a US region; the round trip to
   the database on every query will be slow.
6. Give the service a name, e.g. `restaurant-db`, and click **Create service**.
   It takes a couple of minutes to build.
7. When it is running, open the service and find the **Connection information**
   panel. You need five values:

   | Aiven calls it | Copy into |
   |---|---|
   | Host | `DB_HOST` |
   | Port | `DB_PORT` (usually `12674` or similar, **not** 3306) |
   | User | `DB_USER` (usually `avnadmin`) |
   | Password | `DB_PASSWORD` |
   | Database | `DB_NAME` — create one called `defaultdb` or use the one Aiven made |

   Aiven also shows a **CA certificate** and a full connection URI. Ignore the
   URI; you need the individual values.

> **Free services are powered off after long inactivity.** Aiven emails you first
> and you can power it back on from the console at any time. If the deployed app
> suddenly cannot reach the database, check the Aiven console first.

---

## Step 2 — Load your schema into the Aiven database

Your Aiven database is **empty**. Loading the schema into it is the step people
most often miss, and it is why a deployed app can load perfectly but refuse
every login: the `users` table does not exist yet.

**Run this from your own machine** (from `backend/`), pasting your own values:

```bash
npm run db:setup:remote -- --url="mysql://avnadmin:YOUR_PASSWORD@YOUR_HOST:YOUR_PORT/defaultdb"
```

For example:

```bash
npm run db:setup:remote -- --url="mysql://avnadmin:AVNS_abc123@mysql-1a2b3c4d-project.a.aivencloud.com:12674/defaultdb"
```

You can copy the whole connection string straight from the Aiven console — the
**Service URI** field — and paste it after `--url=`. If your password contains
special characters (`@`, `#`, `/`), the console's URI will already have them
escaped correctly, so copy rather than type it.

Expected output:

```
Connected to mysql-1a2b3c4d-project.a.aivencloud.com:12674 as "avnadmin".
Target database: defaultdb  (TLS)

Applying schema.sql ...
   schema.sql applied in 812 ms.

Applying seed.sql ...
   seed.sql applied in 1204 ms.

Database setup complete.
   tables in defaultdb: 12
   users in  defaultdb: 5
```

**Check that `tables` says 12 and `users` says 5.** If tables is 0, the schema
did not apply — read the error above it.

> **Why this instead of editing `.env`?** Because swapping your `.env` to the
> remote database and forgetting to swap it back is the easiest way to break
> local development. This command takes the target as an argument and never
> touches your `.env`.
>
> It also handles the database *name*: `schema.sql` hardcodes
> `CREATE DATABASE restaurant_system`, so this rewrites it to match whatever
> database your URL points at (Aiven gives you `defaultdb`).

Now confirm the app agrees. Visit:

```
https://<your-app>.onrender.com/api/health/db
```

It should say **`"verdict": "LOOKS GOOD"`**. If it says something else, that
endpoint names the problem directly.

---

## Step 3 — Deploy on Render

1. Push this repository to GitHub (see the git commands at the end of this file).
2. Go to **https://render.com** and sign up with GitHub.
3. In the dashboard, click **New +** → **Blueprint**.
4. Pick the repository. Render reads `render.yaml` and shows one web service,
   `restaurant-system`.
5. It will ask you for the values marked `sync: false` — the five `DB_*` values
   from Step 1. Paste them in.
6. Click **Apply** / **Create**.

Render installs dependencies, starts the server, and polls `/api/health` until it
answers. When it goes live you get a URL like:

```
https://restaurant-system-xxxx.onrender.com
```

That single URL serves **everything** — the sign-in page, the storefront, the
admin and staff workspaces, and the API.

---

## Step 4 — Check it works

Open the URL and sign in with a seeded account:

| Role | Email | Password |
|---|---|---|
| Administrator | `manager@restaurant.test` | `manager123` |
| Staff | `cashier@restaurant.test` | `cashier123` |
| Customer | `bola@example.com` | `bola123` |

Also worth checking: **`<your-url>/api/health`** should return
`{"status":"ok",...}`.

> **Change these passwords before showing the site to anyone.** They are in the
> public repository.

---

## Things to know about the free tier

**The service sleeps.** After 15 minutes with no traffic, Render spins it down.
The next request takes 30–60 seconds to wake it up. That is normal — not a bug.
If you are demoing to a lecturer, open the site once a minute beforehand to keep
it warm.

**Do not commit `.env`.** It holds the database password and the JWT signing key.
`.gitignore` already excludes it — the file to commit is `.env.example`.

**Changing `JWT_SECRET` logs everyone out.** It signs every login token, so
rotating it invalidates all existing sessions. That is the correct behaviour.

---

## Updating the deployed site

Render is set to `autoDeploy: true`, so pushing to the default branch redeploys
automatically:

```bash
git add .
git commit -m "describe the change"
git push
```

Watch the deploy in the Render dashboard under **Logs**.

---

## If you would rather use Render Postgres instead

It is possible, but it is a real piece of work rather than a config change:

| MySQL (now) | PostgreSQL (needed) |
|---|---|
| `?` placeholders | `$1, $2` |
| `AUTO_INCREMENT` | `GENERATED ... AS IDENTITY` |
| `ENUM('a','b')` | a `CREATE TYPE` per enum |
| `TINYINT(1)` | `BOOLEAN` |
| `CONCAT(a,' ',b)` | `\|\|` |
| `result.insertId` | `INSERT ... RETURNING id` |
| `result.affectedRows` | `rowCount` |
| `pool.getConnection()` | `pool.connect()` |

That touches all 12 route files, the schema, and the seed data. Do it only if
keeping everything on one platform matters more than the time it takes.
