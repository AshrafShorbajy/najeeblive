import express from "express";
import helmet from "helmet";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: [/^http:\/\/localhost:\d+$/, /^https?:\/\/.*$/],
    methods: ["POST"],
  })
);

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

function isInstalled() {
  try {
    const f = path.join(__dirname, "installed.json");
    if (!fs.existsSync(f)) return false;
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    return !!j?.installed;
  } catch {
    return false;
  }
}

app.get("/api/installed", (req, res) => {
  res.json({ installed: isInstalled() });
});

function isValidUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol.startsWith("http");
  } catch {
    return false;
  }
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function isStrongPassword(p) {
  if (typeof p !== "string") return false;
  const lengthOk = p.length >= 12;
  const upperOk = /[A-Z]/.test(p);
  const lowerOk = /[a-z]/.test(p);
  const numberOk = /[0-9]/.test(p);
  const symbolOk = /[^A-Za-z0-9]/.test(p);
  return lengthOk && upperOk && lowerOk && numberOk && symbolOk;
}

function canonicalizeProjectUrl(u) {
  try {
    const parsed = new URL(String(u).trim());
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

app.post("/api/install", async (req, res) => {
  try {
    const { supabaseUrl, serviceRoleKey, supabasePat, dbPassword, adminEmail, adminPassword } = req.body || {};
    const baseUrl = canonicalizeProjectUrl(supabaseUrl);
    if (!baseUrl || !isValidUrl(baseUrl)) {
      return res.status(400).json({ success: false, error: { code: "INVALID_URL" } });
    }
    const srk = typeof serviceRoleKey === "string" ? serviceRoleKey.trim() : serviceRoleKey;
    if (!srk || typeof srk !== "string" || srk.length < 20) {
      return res.status(400).json({ success: false, error: { code: "INVALID_SERVICE_ROLE_KEY" } });
    }
    if (!isValidEmail(adminEmail)) {
      return res.status(400).json({ success: false, error: { code: "INVALID_EMAIL" } });
    }
    if (!isStrongPassword(adminPassword)) {
      return res.status(400).json({ success: false, error: { code: "WEAK_PASSWORD" } });
    }

    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    const sqlEndpoint = `${baseUrl.replace(/\/+$/, "")}/sql/v1`;
    const projectRef = new URL(baseUrl).host.split(".")[0];
    const pat = typeof supabasePat === "string" && supabasePat.trim().length >= 20 ? supabasePat.trim() : process.env.SUPABASE_PAT;

    {
      if (dbPassword && typeof dbPassword === "string" && dbPassword.trim().length >= 6) {
        const connConfigs = [
          { host: `db.${projectRef}.supabase.co`, port: 5432 },
          { host: `db.${projectRef}.supabase.co`, port: 6543 },
        ];
        let connected = false;
        for (const cfg of connConfigs) {
          const pool = new pg.Pool({
            host: cfg.host,
            port: cfg.port,
            user: "postgres",
            password: dbPassword.trim(),
            database: "postgres",
            ssl: { rejectUnauthorized: false },
            max: 1,
          });
          let client;
          try {
            client = await pool.connect();
          } catch (e) {
            await pool.end().catch(() => {});
            if (e && e.code === "28P01") {
              return res.status(500).json({ success: false, error: { code: "DB_AUTH_FAILED" } });
            }
            continue;
          }
          try {
            await client.query(schema);
          } catch {
            client.release();
            await pool.end().catch(() => {});
            return res.status(500).json({ success: false, error: { code: "MIGRATION_SYNTAX_ERROR" } });
          }
          client.release();
          await pool.end().catch(() => {});
          connected = true;
          break;
        }
        if (!connected) {
          return res.status(500).json({ success: false, error: { code: "DB_CONNECTION_FAILED" } });
        }
      } else {
        const usingPat = !!pat;
        let r;
        try {
          r = usingPat
            ? await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/sql`, {
                method: "POST",
                headers: { authorization: `Bearer ${pat}`, "content-type": "application/json", accept: "application/json" },
                body: JSON.stringify({ query: schema }),
              })
            : await fetch(sqlEndpoint, {
                method: "POST",
                headers: {
                  authorization: `Bearer ${srk}`,
                  apikey: srk,
                  "content-type": "application/json",
                  accept: "application/json",
                },
                body: JSON.stringify({ query: schema }),
              });
        } catch {
          return res.status(500).json({ success: false, error: { code: "NETWORK_ERROR" } });
        }
        if (!r.ok) {
          const status = r.status;
          const code =
            status === 401
              ? usingPat
                ? "INVALID_PAT"
                : "INVALID_SERVICE_ROLE_KEY"
              : status === 404
              ? "INVALID_URL"
              : status === 400
              ? "MIGRATION_SYNTAX_ERROR"
              : "MIGRATION_FAILED";
          return res.status(500).json({ success: false, error: { code } });
        }
        const resp = await r.json().catch(() => null);
        if (resp && resp.error) {
          return res.status(500).json({ success: false, error: { code: "MIGRATION_ERROR", details: {} } });
        }
      }
    }

    let supabase;
    try {
      supabase = createClient(baseUrl, srk);
    } catch {
      return res.status(500).json({ success: false, error: { code: "CLIENT_INIT_FAILED" } });
    }

    let userRes;
    try {
      userRes = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      });
    } catch {
      return res.status(500).json({ success: false, error: { code: "CREATE_USER_FAILED" } });
    }
    if (userRes.error) {
      return res.status(500).json({ success: false, error: { code: "CREATE_USER_FAILED" } });
    }
    const userId = userRes.data.user.id;

    let profileRes;
    try {
      profileRes = await supabase
        .from("profiles")
        .upsert({ id: userId, email: adminEmail, role: "admin" }, { onConflict: "id" });
    } catch {
      return res.status(500).json({ success: false, error: { code: "ASSIGN_ROLE_FAILED" } });
    }
    if (profileRes.error) {
      return res.status(500).json({ success: false, error: { code: "ASSIGN_ROLE_FAILED" } });
    }

    try {
      fs.writeFileSync(path.join(__dirname, "installed.json"), JSON.stringify({ installed: true, at: new Date().toISOString() }), "utf8");
    } catch {}
    return res.json({ success: true, message: "Installation completed successfully" });
  } catch {
    return res.status(500).json({ success: false, error: { code: "UNEXPECTED_ERROR" } });
  }
});

// Serve production build if available
const distDir = path.join(__dirname, "../dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    const indexPath = path.join(distDir, "index.html");
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    return res.status(404).send("Build not found");
  });
}

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port);
