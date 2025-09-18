# dbt Labs DAG Scenarios demo

This folder contains a standalone HTML page (`presentation.html`) that renders three directed acyclic graph (DAG) scenarios with [d3-dag](https://github.com/erikbrinkman/d3-dag):

1. **All Models Built** – every downstream model is fresh.
2. **Partial Build (Source Down)** – a stale source blocks dependent models.
3. **SLA-Compliant Staleness** – a stale source still meets the SLA, so downstream models run but the fact table is flagged.
4. **Column-Aware Testing** – primary key tests defined on staging are reused for downstream marts instead of re-running per model.

## Running locally

Because everything is client-side JavaScript, you can open the file directly in a browser (the page loads `d3@7` and `d3-dag@1.1` from a CDN):

```sh
open examples/presentation.html
```

If your browser enforces strict CORS rules for local files, load it via a simple static server instead (Node.js example):

```sh
npx http-server .
```

Then navigate to `http://localhost:8080/examples/presentation.html`.

## Customising the scenarios

- Update the `scenarios` array in `presentation.html` to add or remove nodes, statuses, or connections.
- Adjust the `statusStyles` object to tweak colour coding.
- Change the `legendEntries` array to match any new statuses you introduce.
- Modify `layerStyles` if you add new dbt layers or want to adjust their accent colours.
