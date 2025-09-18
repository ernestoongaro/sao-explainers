# dbt Labs DAG Scenarios demo

The `public/` directory contains a standalone HTML page (`index.html`) that renders four directed acyclic graph (DAG) scenarios with [d3-dag](https://github.com/erikbrinkman/d3-dag):

1. **Scenario 1: Regular dbt run (not Fusion)** – everything downstream builds with a conventional `dbt run`.
2. **Scenario 2: State-Aware Orchestration** – Fusion detects the stale orders source and only skips the dependent path while continuing the fresh branch.
3. **Scenario 3: State-Aware Orchestration (Tuned Configuration)** – Fusion reuses the cached customers path while orders continue under a tuned SLA-aware config.
4. **Scenario 4: Column-Aware Testing** – column-aware primary-key tests defined on staging are reused for downstream dims without re-running per model.

## Running locally

Because everything is client-side JavaScript, you can open the file directly in a browser (the page loads `d3@7` and `d3-dag@1.1` from a CDN):

```sh
open public/index.html
```

If your browser enforces strict CORS rules for local files, load it via a simple static server instead (Node.js example):

```sh
npx http-server .
```

Then navigate to `http://localhost:8080/public/index.html`.

## Customising the scenarios

- Update the `scenarios` array in `public/app.js` to add or remove nodes, statuses, or connections.
- Adjust the `statusStyles` object to tweak colour coding.
- Change the `legendEntries` array to match any new statuses you introduce.
- Modify `layerStyles` if you add new dbt layers or want to adjust their accent colours.
