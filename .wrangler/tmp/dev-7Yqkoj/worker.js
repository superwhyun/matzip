var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    try {
      if (path === "/api/restaurants" && method === "GET") {
        const stmt = env.DB.prepare("SELECT * FROM restaurants ORDER BY created_at DESC");
        const { results } = await stmt.all();
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (path === "/api/restaurants" && method === "POST") {
        const data = await request.json();
        const { name, address, lat, lng, rating, review, model_url } = data;
        const cleanModelUrl = model_url === void 0 ? null : model_url;
        const stmt = env.DB.prepare(`
          INSERT INTO restaurants (name, address, lat, lng, rating, review, model_url)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const result = await stmt.bind(name, address, lat, lng, rating, review, cleanModelUrl).run();
        return new Response(JSON.stringify({
          id: result.meta.last_row_id,
          success: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (path.startsWith("/api/restaurants/") && method === "PUT") {
        try {
          const id = path.split("/")[3];
          const data = await request.json();
          const { name, address, lat, lng, rating, review, model_url } = data;
          const cleanModelUrl = model_url === void 0 ? null : model_url;
          console.log("Updating restaurant:", { id, name, address, lat, lng, rating, review, model_url: cleanModelUrl });
          const stmt = env.DB.prepare(`
            UPDATE restaurants 
            SET name = ?, address = ?, lat = ?, lng = ?, rating = ?, review = ?, model_url = ?, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `);
          const result = await stmt.bind(name, address, lat, lng, rating, review, cleanModelUrl, id).run();
          console.log("Update result:", result);
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (error) {
          console.error("Restaurant update error:", error);
          return new Response(JSON.stringify({
            error: "Failed to update restaurant",
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }
      if (path.startsWith("/api/restaurants/") && method === "DELETE") {
        const id = path.split("/")[3];
        const stmt = env.DB.prepare("DELETE FROM restaurants WHERE id = ?");
        await stmt.bind(id).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (path === "/api/search-place" && method === "POST") {
        const data = await request.json();
        const { query } = data;
        if (!query || !query.trim()) {
          return new Response(JSON.stringify({ error: "Query parameter is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        if (!env.VITE_KAKAO_API_KEY) {
          return new Response(JSON.stringify({
            error: "Kakao API key not configured",
            details: "VITE_KAKAO_API_KEY environment variable is missing"
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        try {
          console.log("Calling Kakao API with query:", query);
          const kakaoResponse = await fetch(
            `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`,
            {
              headers: {
                "Authorization": `KakaoAK ${env.VITE_KAKAO_API_KEY}`
              }
            }
          );
          console.log("Kakao API response status:", kakaoResponse.status);
          if (!kakaoResponse.ok) {
            const errorText = await kakaoResponse.text();
            console.log("Kakao API error response:", errorText);
            throw new Error(`Kakao API error: ${kakaoResponse.status} - ${errorText}`);
          }
          const kakaoData = await kakaoResponse.json();
          console.log("Kakao API success, documents count:", kakaoData.documents?.length || 0);
          return new Response(JSON.stringify(kakaoData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (error) {
          console.error("Search place error:", error);
          return new Response(JSON.stringify({
            error: "Failed to search place",
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }
      if (path === "/api/upload-model" && method === "POST") {
        try {
          const formData = await request.formData();
          const file = formData.get("model");
          if (!file) {
            return new Response(JSON.stringify({ error: "No file provided" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
          if (file.size > 10 * 1024 * 1024) {
            return new Response(JSON.stringify({ error: "File size exceeds 10MB limit" }), {
              status: 413,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
          if (!file.name.toLowerCase().endsWith(".spz")) {
            return new Response(JSON.stringify({ error: "Only SPZ files are allowed" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
          const timestamp = Date.now();
          const fileName = `${timestamp}_${file.name}`;
          const arrayBuffer = await file.arrayBuffer();
          await env.RESTAURANT_MODELS.put(fileName, arrayBuffer, {
            metadata: {
              originalName: file.name,
              size: file.size,
              uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          });
          const fileUrl = `/api/models/${fileName}`;
          return new Response(JSON.stringify({
            success: true,
            fileName,
            fileUrl,
            originalName: file.name,
            size: file.size
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (error) {
          console.error("File upload error:", error);
          return new Response(JSON.stringify({
            error: "File upload failed",
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }
      if (path.startsWith("/api/models/") && method === "GET") {
        const fileName = decodeURIComponent(path.split("/")[3]);
        try {
          const fileData = await env.RESTAURANT_MODELS.get(fileName, "arrayBuffer");
          const metadata = await env.RESTAURANT_MODELS.getWithMetadata(fileName);
          if (!fileData) {
            return new Response(JSON.stringify({ error: "File not found" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
          const safeFilename = encodeURIComponent(metadata.metadata?.originalName || fileName);
          return new Response(fileData, {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/octet-stream",
              "Content-Disposition": `attachment; filename*=UTF-8''${safeFilename}`,
              "Cache-Control": "public, max-age=31536000"
              // 1년 캐시
            }
          });
        } catch (error) {
          console.error("File serving error:", error);
          return new Response(JSON.stringify({
            error: "File serving failed",
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }
      if (!path.startsWith("/api/")) {
        try {
          if (env.ASSETS && env.ASSETS.fetch) {
            return await env.ASSETS.fetch(request);
          } else {
            const html = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>\uB9DB\uC9D1 \uC9C0\uB3C4 - Matzip Map</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  </head>
  <body>
    <div id="root">
      <h1>\uB85C\uCEEC \uAC1C\uBC1C \uBAA8\uB4DC</h1>
      <p>React \uC571: <code>npm run dev</code> (\uD3EC\uD2B8 5173)</p>
      <p>Worker API: <code>npx wrangler dev</code> (\uD3EC\uD2B8 8787)</p>
      <p>React \uC571\uC5D0\uC11C \uC774 Worker API\uB97C \uD638\uCD9C\uD569\uB2C8\uB2E4.</p>
    </div>
  </body>
</html>`;
            return new Response(html, {
              headers: { "Content-Type": "text/html; charset=utf-8" }
            });
          }
        } catch (e) {
          if (e.status === 404 && !path.includes(".")) {
            try {
              if (env.ASSETS && env.ASSETS.fetch) {
                const indexRequest = new Request(new URL("/", request.url), request);
                return await env.ASSETS.fetch(indexRequest);
              }
            } catch (indexError) {
            }
          }
          return new Response("Asset Error: " + e.message, { status: e.status || 500 });
        }
      }
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-8NfIwv/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-8NfIwv/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
