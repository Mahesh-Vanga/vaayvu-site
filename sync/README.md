# Vaayvu Sync

Run one instance for all your devices. It stores accounts, bookmarks and each device’s most recently synced regular tabs in a local SQLite database. Clients sign in with the same username and password at the same server address. Each client has its own 30-day session.

## Try it on this Mac

Requires Node.js 22.13 or later with built-in SQLite. From the project root, run

```sh
node sync/server.mjs
```

In Vaayvu’s sync settings, enter `http://127.0.0.1:8787` and create an account. A phone’s loopback address points to the phone itself. For multiple physical devices, use the same reachable HTTPS address on each one.

## Connect your devices

### Personal HTTPS deployment with Docker Compose

On a host you control, install Docker with Compose v2.17+ and point a hostname’s DNS records to that host. The host must accept inbound TCP traffic on ports 80 and 443. If those ports already serve an existing reverse proxy, use the existing-proxy instructions below. Caddy obtains and renews the certificate for your hostname. [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)

From `sync/deploy`, create a file named `.env` with your actual hostname:

```dotenv
VAAYVU_DOMAIN=sync.example.com
VAAYVU_REGISTRATION=open
```

Run `docker compose up -d`, then enter `https://sync.example.com` using your own hostname in Vaayvu and create your ID. After creating your account, change `VAAYVU_REGISTRATION` to `closed` in `.env` and run `docker compose up -d` again. Existing accounts can sign in on additional devices. While registration is open, anyone who can reach the service can create an account.

Caddy exposes HTTP and HTTPS. The sync service binds to loopback inside Caddy's network namespace and uses a named volume for its database. Caddy's certificate state has its own volume. Keep these volumes across restarts and back them up while the stack is stopped. For page questions, optionally place both `VAAYVU_OLLAMA_URL` and `VAAYVU_OLLAMA_MODEL` in the same `.env` file. The model URL must be reachable from inside the containers. [Compose networking](https://docs.docker.com/reference/compose-file/services/#network_mode)

### Existing proxy or direct TLS

Use a hostname that all your devices can reach and a TLS certificate that they trust. Run Vaayvu Sync as a dedicated user with write access to its data directory. If your host already provides an HTTPS reverse proxy, keep the default loopback listener and forward the complete `/v1/` path to port 8787. To limit access to existing accounts, set `VAAYVU_REGISTRATION=closed` when restarting the service.

For direct HTTPS, point the following variables at your own certificate chain and private key, then start the service. The command listens on port 8787, so include that port in Vaayvu’s server address when connecting directly.

```sh
HOST=0.0.0.0 PORT=8787 \
TLS_CERT=/path/to/fullchain.pem TLS_KEY=/path/to/private-key.pem \
SYNC_DB=/path/to/persistent/vaayvu.sqlite node sync/server.mjs
```

Use your host’s process manager to restart the service after a reboot. Restart the service after replacing certificates. For a consistent offline backup, stop the service, copy its entire data directory, then restart. Restore the directory with permissions restricted to the service user. The default database path is `sync/data/vaayvu.sqlite`. A database created at the previous default (`sync/data/vaayvu.sqlite`) is still honored when the new path does not exist yet. Legacy `VAAYVU_*` environment names keep working as fallbacks. Synced URLs and titles are readable by the server operator. Keep backups private.

## Optional page questions

Configure an Ollama instance and a model installed on it. Set the following variables alongside your sync server configuration when starting it. The model name must match one listed by your own Ollama instance.

```sh
VAAYVU_OLLAMA_URL=http://127.0.0.1:11434 \
VAAYVU_OLLAMA_MODEL=your-installed-model node sync/server.mjs
```

When you send a page question, Vaayvu sends the selected page text and question to the signed-in sync server, which forwards them to its configured model. Vaayvu Sync keeps both in memory for that request. It sends the text as reference material, allows no model tools, and returns the model’s answer. Use a trusted connection to the model host. The model host controls its own logging. See the [Ollama chat API](https://docs.ollama.com/api/chat).

## HTTP API

Send JSON with `Content-Type: application/json`. Authentication uses the `Authorization: Bearer <token>` header. Each error response includes an `error` string. The bundled Apple, Android and Windows browser interface origins are allowed by default. To test a separately hosted development UI, list its exact origin in `SYNC_ORIGINS` when starting the server. Multiple origins are comma-separated. CORS never sends cookies.

| Method and path | Body | Success |
| --- | --- | --- |
| `POST /v1/register` | `{username,password}` | `{username,token}` |
| `POST /v1/login` | `{username,password}` | A new session |
| `POST /v1/logout` | Empty | Revokes the current token |
| `GET /v1/sync` | Empty | `{bookmarks,devices}` |
| `POST /v1/sync` | `{bookmarks,device:{id,name,tabs}}` | Merged snapshot |
| `POST /v1/send` | `{from,to,page:{title,url}}` | Queues a regular page for another device on this account |
| `POST /v1/dismiss` | `{device,id}` | Removes a delivered page from the receiving device’s inbox |
| `POST /v1/ask` | `{question,text}` | `{answer}` |

Usernames are case-insensitive and contain 3–48 ASCII letters, digits, dots, underscores or hyphens. Passwords contain 12–256 characters. Password verification uses salted scrypt. The database stores session token hashes.

Send regular bookmarks as `{id,title,url,updatedAt}` and deletions as `{id,deleted:true,updatedAt}`. Each bookmark ID has one winning record. A newer Unix millisecond timestamp wins. When timestamps tie, deletion wins, then URL and title provide stable ordering. A tombstone remains in the snapshot so that an offline device can learn about the deletion. Privacy-sensitive fields such as page contents, session cookies, passwords, and browsing history are outside the sync schema.

Each device owns its `{id,name,tabs}` snapshot. Tabs contain only `{title,url}`. Send the current device’s complete regular-tab list when updating, including an empty array after closing the last tab. Serialize a single device’s writes. The server assigns the device timestamp.

Each account supports 24 devices and 2,000 bookmark records including tombstones. Each request supports 2 MiB and 256 tabs per device. Ask accepts up to 2,000 question characters and 32,000 page characters, with 12 requests per account per 15 minutes. Sign-in and registration share 30 attempts per socket source IP per 15 minutes. Behind a reverse proxy that allowance is shared by clients reaching the same proxy.

Run the local integration checks from the project root.

```sh
node --test sync/server.test.mjs
```

A successful sync POST also returns an `incoming` array for the requesting device. A handoff contains its sender’s device name, page title, address, ID, and creation time. Undismissed handoffs expire after seven days.
