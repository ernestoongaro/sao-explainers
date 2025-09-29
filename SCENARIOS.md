# dbt Labs DAG Scenarios demo

The `public/` directory contains a standalone HTML page (`index.html`) that renders six directed acyclic graph (DAG) scenarios with [d3-dag](https://github.com/erikbrinkman/d3-dag):

- **Scenario 1: Regular dbt run (not Fusion)** - everything downstream builds with a conventional `dbt run`.
- **Scenario 2: State-Aware Orchestration** - Fusion detects the stale orders source and only skips the dependent path while continuing the fresh branch.
- **Scenario 3: State-Aware Orchestration (Tuned Configuration)** - Fusion reuses the cached customers path while orders continue under a tuned SLA-aware config.
- **Scenario 4: Column-Aware Testing** - column-aware primary-key tests defined on staging are reused for downstream dims without re-running per model.
- **Scenario 5: Slim CI (Table-aware builds)** - Slim CI rebuilds only the tables changed in a pull request and keeps the rest of the graph cached.
- **Scenario 6: Slimmer CI (Table + Column awareness)** - Fusion follows column-level lineage so only consumers that touch the changed column rebuild while unaffected models are reused.

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
