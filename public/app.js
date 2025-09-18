import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as d3dag from "https://cdn.jsdelivr.net/npm/d3-dag@1.1.0/+esm";

const {
  graphStratify,
  sugiyama,
  layeringLongestPath,
  decrossOpt,
  coordQuad
} = d3dag;

async function exportDagAsPng(svgNode, filename) {
  if (!svgNode) return;

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (err) {
      console.warn("Fonts may not have fully loaded", err);
    }
  }

  const clone = svgNode.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const vb = svgNode.viewBox?.baseVal;
  const rect = svgNode.getBoundingClientRect();
  let width = (vb && vb.width) || rect.width || svgNode.clientWidth || 640;
  let height = (vb && vb.height) || rect.height || svgNode.clientHeight || 480;

  clone.setAttribute("width", width);
  clone.setAttribute("height", height);

  const inlineCss = exportedStyles || (await exportedStylesPromise.catch(() => ''));
  if (inlineCss) {
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.setAttribute("type", "text/css");
    styleEl.innerHTML = inlineCss;
    clone.insertBefore(styleEl, clone.firstChild);
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });

  const url = URL.createObjectURL(svgBlob);
  const image = new Image();
  image.crossOrigin = 'anonymous';
  const scale = window.devicePixelRatio || 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  image.onload = () => {
    context.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
if (!blob) return;
const downloadUrl = URL.createObjectURL(blob);
const anchor = document.createElement("a");
anchor.href = downloadUrl;
anchor.download = filename;
document.body.appendChild(anchor);
anchor.click();
document.body.removeChild(anchor);
URL.revokeObjectURL(downloadUrl);
    }, "image/png");
  };

  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
}


let exportedStyles = '';
const exportedStylesPromise = (async () => {
  try {
    let cssText = await (await fetch('styles.css')).text();
    const importRegex = /@import\s+url\(['"]?(.*?)['"]?\);/g;
    const importUrls = [];
    cssText = cssText.replace(importRegex, (_, url) => {
importUrls.push(url);
return '';
    });
    const importedCss = await Promise.all(
importUrls.map((url) =>
  fetch(url)
    .then((res) => res.text())
    .catch(() => '')
)
    );
    exportedStyles = [...importedCss, cssText].join('\n');
    return exportedStyles;
  } catch (err) {
    console.warn('Failed to load styles for export', err);
    return '';
  }
})();

const scenarios = [
  {
    id: "all-built",
    title: "Scenario 1: Regular dbt run (not Fusion)",
    description: "Everything downstream is ready for analytics without Fusion orchestration.",
    nodes: [
{
  id: "src_orders",
  label: "src_orders",
  layer: "source",
  status: "stale"
},
{
  id: "src_customers",
  label: "src_customers",
  layer: "source",
  status: "fresh"
},
{
  id: "stg_orders",
  label: "stg_orders",
  layer: "staging",
  status: "built"
},
{
  id: "stg_customers",
  label: "stg_customers",
  layer: "staging",
  status: "built"
},
{
  id: "int_orders",
  label: "int_orders",
  layer: "intermediate",
  status: "built"
},
{
  id: "dim_customers",
  label: "dim_customers",
  layer: "dim",
  status: "built"
},
{
  id: "fct_orders",
  label: "cust_orders",
  layer: "fact",
  status: "built"
}
    ],
    links: [
["src_orders", "stg_orders"],
["src_customers", "stg_customers"],
["stg_orders", "int_orders"],
["stg_customers", "dim_customers"],
["int_orders", "fct_orders"],
["dim_customers", "fct_orders"]
    ]
  },
  {
    id: "partial-build-source-down",
    title: "Scenario 2: State-Aware Orchestration",
    description:
"Fusion identifies the stale orders source and only skips dependent nodes while building fresh paths.",
    nodes: [
{
  id: "src_orders",
  label: "src_orders",
  layer: "source",
  status: "stale"
},
{
  id: "src_customers",
  label: "src_customers",
  layer: "source",
  status: "fresh"
},
{
  id: "stg_orders",
  label: "stg_orders",
  layer: "staging",
  status: "reusable"
},
{
  id: "stg_customers",
  label: "stg_customers",
  layer: "staging",
  status: "built"
},
{
  id: "int_orders",
  label: "int_orders",
  layer: "intermediate",
  status: "reusable"
},
{
  id: "dim_customers",
  label: "dim_customers",
  layer: "dim",
  status: "built"
},
{
  id: "fct_orders",
  label: "cust_orders",
  layer: "fact",
  status: "built"
}
    ],
    links: [
["src_orders", "stg_orders"],
["src_customers", "stg_customers"],
["stg_orders", "int_orders"],
["stg_customers", "dim_customers"],
["int_orders", "fct_orders"],
["dim_customers", "fct_orders"]
    ]
  },
  {
    id: "partial-build-with-sla",
    title: "Scenario 3: State-Aware Orchestration (Tuned Configuration)",
    description:
"Fusion honors the SLA-aware configuration by reusing the cached customers path while orders continue.",
    nodes: [
{
  id: "src_orders",
  label: "src_orders",
  layer: "source",
  status: "stale"
},
{
  id: "src_customers",
  label: "src_customers",
  layer: "source",
  status: "sla-ok",
  note: "4h old (SLA 6h)"
},
{
  id: "stg_orders",
  label: "stg_orders",
  layer: "staging",
  status: "reusable"
},
{
  id: "stg_customers",
  label: "stg_customers",
  layer: "staging",
  status: "reusable"
},
{
  id: "int_orders",
  label: "int_orders",
  layer: "intermediate",
  status: "reusable"
},
{
  id: "dim_customers",
  label: "dim_customers",
  layer: "dim",
  status: "reusable"
},
{
  id: "fct_orders",
  label: "cust_orders",
  layer: "fact",
  status: "reusable"
}
    ],
    links: [
["src_orders", "stg_orders"],
["src_customers", "stg_customers"],
["stg_orders", "int_orders"],
["stg_customers", "dim_customers"],
["int_orders", "fct_orders"],
["dim_customers", "fct_orders"]
    ]
  },
  {
    id: "column-aware-testing",
    title: "Scenario 4: Column-Aware Testing",
    description:
"Column-aware primary key tests defined on staging are reused for downstream dims without re-running per model.",
    nodes: [
{
  id: "src_customers",
  label: "src_customers",
  layer: "source",
  status: "fresh"
},
{
  id: "stg_customers",
  label: "stg_customers",
  layer: "staging",
  status: "built"
},
{
  id: "dim_customers",
  label: "dim_customers",
  layer: "dim",
  status: "built"
},
{
  id: "test_unique_customer_id",
  label: "test_unique_customer_id",
  layer: "test",
  status: "reusable",
  note: "Reused for stg + dim"
}
    ],
    links: [
["src_customers", "stg_customers"],
["stg_customers", "dim_customers"],
["stg_customers", "test_unique_customer_id"],
["dim_customers", "test_unique_customer_id"]
    ]
  }
];

const statusStyles = {
  fresh: {
    fill: "#d1fae5",
    text: "#03543f",
    stroke: "#6ee7b7",
    label: "Source fresh"
  },
  built: {
    fill: "#ffe7d8",
    text: "#7c2d12",
    stroke: "#fe6703",
    label: "Model built"
  },
  blocked: {
    fill: "#ffe4e6",
    text: "#9f1239",
    stroke: "#fb7185",
    label: "Build blocked"
  },
  stale: {
    fill: "#fff7d6",
    text: "#92400e",
    stroke: "#fcd34d",
    label: "Source stale"
  },
  "sla-ok": {
    fill: "#ede9fe",
    text: "#4338ca",
    stroke: "#c4b5fd",
    label: "Within SLA"
  },
  warning: {
    fill: "#fef3c7",
    text: "#92400e",
    stroke: "#f59e0b",
    label: "Downstream warning"
  },
  "test-pass": {
    fill: "#dbeafe",
    text: "#075985",
    stroke: "#38bdf8",
    label: "Test passed"
  },
  reusable: {
    fill: "#f8fafc",
    text: "#475569",
    stroke: "#94a3b8",
    label: "Reused"
  }
};

const layerStyles = {
  source: {
    label: "Source",
    fill: "rgba(255, 255, 255, 0.92)",
    text: "#0f172a"
  },
  staging: {
    label: "Staging",
    fill: "rgba(255, 255, 255, 0.92)",
    text: "#0f172a"
  },
  intermediate: {
    label: "Int",
    fill: "rgba(255, 255, 255, 0.92)",
    text: "#0f172a"
  },
  dim: {
    label: "Mart",
    fill: "rgba(255, 255, 255, 0.92)",
    text: "#0f172a"
  },
  fact: {
    label: "Mart",
    fill: "rgba(255, 255, 255, 0.92)",
    text: "#0f172a"
  },
  test: {
    label: "Test",
    fill: "rgba(219, 234, 254, 0.65)",
    text: "#075985"
  }
};

const NODE_WIDTH = 248;
const NODE_HEIGHT = 80;
const LAYER_WIDTH = 84;
const LAYOUT_NODE_WIDTH = NODE_HEIGHT + 220;
const LAYOUT_NODE_HEIGHT = NODE_WIDTH + 60;

const dagContainer = d3.select("#dag-container");

scenarios.forEach((scenario) => {
  const nodeMeta = new Map(
    scenario.nodes.map((node) => [node.id, node])
  );

  const getNodeMeta = (node) =>
    nodeMeta.get(node.data?.id ?? node.data ?? node.id);

  const getNodeStyle = (node) => {
    const status = getNodeMeta(node)?.status;
    return statusStyles[status] ?? null;
  };

  const getLayer = (node) => getNodeMeta(node)?.layer;
  const isTestLayer = (node) => getLayer(node) === "test";

  const wrapper = dagContainer
    .append("div")
    .attr("class", "scenario")
    .attr("id", scenario.id);

  let svg = null;

  const controls = wrapper
    .append("div")
    .attr("class", "scenario-controls");

  controls
    .append("button")
    .attr("type", "button")
    .attr("class", "export-button")
    .text("Download PNG")
    .on("click", () => {
if (svg) {
  exportDagAsPng(svg.node(), `${scenario.id}.png`).catch((err) => console.error('PNG export failed', err));
}
    });

  wrapper.append("h2").text(scenario.title);
  wrapper.append("p").text(scenario.description);
  svg = wrapper.append("svg");

  const stratify = graphStratify()
    .id((d) => d.id)
    .parentIds((d) => d.parentIds ?? []);
  const dagInput = scenario.nodes.map((node) => {
    const parents = scenario.links
.filter((link) => link[1] === node.id)
.map((link) => link[0]);
    return {
id: node.id,
parentIds: parents
    };
  });
  const dag = stratify(dagInput);

  const layout = sugiyama()
    .layering(layeringLongestPath())
    .decross(decrossOpt())
    .coord(coordQuad())
    .nodeSize([LAYOUT_NODE_WIDTH, LAYOUT_NODE_HEIGHT]);

  layout(dag);

  const nodes = Array.from(dag.nodes());
  const links = Array.from(dag.links());

if (scenario.id === "column-aware-testing") {
    const stagingNodes = nodes.filter((n) => getLayer(n) === "staging");
    const dimNodes = nodes.filter((n) => getLayer(n) === "dim");
    const rowNodes = stagingNodes.concat(dimNodes);

    if (rowNodes.length) {
      const targetY = d3.mean(rowNodes, (n) => n.y);
      rowNodes.forEach((n) => {
        n.y = targetY;
      });
    }

    const testNode = nodes.find(
      (n) => getNodeMeta(n)?.id === "test_unique_customer_id"
    );
    if (testNode) {
      const rowY = rowNodes.length ? rowNodes[0].y : testNode.y;
      const minX = rowNodes.length ? d3.min(rowNodes, (n) => n.x) : testNode.x;
      const maxX = rowNodes.length ? d3.max(rowNodes, (n) => n.x) : testNode.x;
      const centerX = (minX + maxX) / 2;
      testNode.x = centerX;
      testNode.y = rowY - LAYOUT_NODE_HEIGHT * 0.9;
    }
  }

  const getX = (node) => node.y;
  const getY = (node) => node.x;
  const xMin = d3.min(nodes, getX);
  const xMax = d3.max(nodes, getX);
  const yMin = d3.min(nodes, getY);
  const yMax = d3.max(nodes, getY);
  const horizontalPadding = 150;
  const verticalPadding = 210;
  const width = Math.max(640, xMax - xMin + horizontalPadding * 2);
  const height = Math.max(540, yMax - yMin + verticalPadding * 2);
  const offsetX = -xMin + horizontalPadding;
  const offsetY = -yMin + verticalPadding;

  svg.attr("viewBox", [0, 0, width, height]);

  const defs = svg.append("defs");
  const arrowId = `arrowhead-${scenario.id}`;
  defs
    .append("marker")
    .attr("id", arrowId)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("fill", "#ea580c")
    .attr("d", "M0,-5L10,0L0,5");

  const testArrowId = `arrowhead-test-${scenario.id}`;
  defs
    .append("marker")
    .attr("id", testArrowId)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("fill", "#38bdf8")
    .attr("d", "M0,-5L10,0L0,5");

  const linkLine = d3
    .line()
    .x((point) => point[1] + offsetX)
    .y((point) => point[0] + offsetY)
    .curve(d3.curveMonotoneX);

  links.forEach((link) => {
    const src = link.source;
    const tgt = link.target;
    if (isTestLayer(tgt)) {
      const elbowY = tgt.y + NODE_HEIGHT / 2;
      link.points = [[src.x, src.y], [src.x, elbowY], [tgt.x, elbowY], [tgt.x, tgt.y]];
    } else {
      link.points = [[src.x, src.y], [tgt.x, tgt.y]];
    }
  });

  svg
    .append("g")
    .attr("fill", "none")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("d", (d) => linkLine(d.points))
    .attr("stroke-width", 3.2)
    .attr("stroke", (d) =>
isTestLayer(d.target) ? "#38bdf8" : "#ea580c"
    )
    .attr("stroke-opacity", (d) =>
isTestLayer(d.target) ? 0.95 : 0.92
    )
    .attr("stroke-dasharray", (d) =>
isTestLayer(d.target) ? "12 6" : null
    )
    .attr("marker-end", (d) =>
`url(#${isTestLayer(d.target) ? testArrowId : arrowId})`
    );

  const node = svg
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("transform", (d) => `translate(${getX(d) + offsetX}, ${getY(d) + offsetY})`);

  node
    .append("rect")
    .attr("x", -NODE_WIDTH / 2)
    .attr("y", -NODE_HEIGHT / 2)
    .attr("width", NODE_WIDTH)
    .attr("height", NODE_HEIGHT)
    .attr("rx", (d) => (isTestLayer(d) ? 18 : NODE_HEIGHT / 2))
    .attr("fill", (d) => {
const style = getNodeStyle(d);
return style?.fill ?? "#ffe7d8";
    })
    .attr("stroke", (d) => {
const style = getNodeStyle(d);
return style?.stroke ?? "#fe6703";
    })
    .attr("stroke-width", 1.4);

  const nonTestNodes = node.filter((d) => !isTestLayer(d));

  nonTestNodes
    .append("rect")
    .attr("x", -NODE_WIDTH / 2 + 16)
    .attr("y", -NODE_HEIGHT / 2 + 12)
    .attr("width", 64)
    .attr("height", 32)
    .attr("rx", 16)
    .attr("fill", (d) => {
const style = getNodeStyle(d);
return style?.fill ?? "#ffe7d8";
    })
    .attr("opacity", 0.18);

  nonTestNodes
    .append("line")
    .attr("x1", -NODE_WIDTH / 2 + LAYER_WIDTH)
    .attr("x2", -NODE_WIDTH / 2 + LAYER_WIDTH)
    .attr("y1", -NODE_HEIGHT / 2 + 8)
    .attr("y2", NODE_HEIGHT / 2 - 8)
    .attr("stroke", "rgba(15, 23, 42, 0.12)")
    .attr("stroke-width", 1);

  nonTestNodes
    .append("text")
    .attr("x", -NODE_WIDTH / 2 + 48)
    .attr("y", -NODE_HEIGHT / 2 + 30)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .attr("font-weight", 600)
    .attr("fill", (d) => {
const layer = layerStyles[getLayer(d)];
return layer?.text ?? "#0f172a";
    })
    .text((d) => {
const layer = layerStyles[getLayer(d)];
return layer?.label ?? "Layer";
    });

  const testNodes = node.filter(isTestLayer);

  const testLabelOffset = -NODE_HEIGHT / 2 + 24;
  const testNameOffset = testLabelOffset + 42;
  const testNoteOffset = testNameOffset + 30;

  testNodes
    .append("text")
    .attr("x", -NODE_WIDTH / 2 + 24)
    .attr("y", testLabelOffset)
    .attr("text-anchor", "start")
    .attr("font-size", 12)
    .attr("font-weight", 600)
    .attr("fill", layerStyles.test.text)
    .text(layerStyles.test.label);

  node
    .append("text")
    .attr("x", (d) =>
isTestLayer(d) ? -NODE_WIDTH / 2 + 24 : -NODE_WIDTH / 2 + 96
    )
    .attr("y", (d) => (isTestLayer(d) ? testNameOffset : -4))
    .attr("text-anchor", "start")
    .attr("alignment-baseline", "middle")
    .attr("font-family", "Source Sans 3, Poppins, sans-serif")
    .attr("font-size", 16)
    .attr("font-weight", 600)
    .attr("fill", "#0f172a")
    .text((d) => {
const label = getNodeMeta(d)?.label;
const fallbackId = d.data?.id ?? d.data ?? d.id;
return label ?? fallbackId;
    });

  node
    .append("text")
    .attr("x", (d) =>
isTestLayer(d) ? -NODE_WIDTH / 2 + 24 : -NODE_WIDTH / 2 + 96
    )
    .attr("y", (d) => (isTestLayer(d) ? testNameOffset + 30 : 14))
    .attr("text-anchor", "start")
    .attr("alignment-baseline", "middle")
    .attr("font-size", 12)
    .attr("font-weight", 500)
    .attr("fill", (d) => {
const style = getNodeStyle(d);
return style?.text ?? "#475569";
    })
    .text((d) => {
const status = getNodeMeta(d)?.status;
const style = statusStyles[status];
return style?.label ?? status ?? "";
    });

  node
    .append("text")
    .attr("x", (d) =>
isTestLayer(d) ? -NODE_WIDTH / 2 + 24 : -NODE_WIDTH / 2 + 96
    )
    .attr("y", (d) => (isTestLayer(d) ? testNoteOffset : 32))
    .attr("text-anchor", "start")
    .attr("alignment-baseline", "middle")
    .attr("font-size", 11)
    .attr("fill", "#64748b")
    .attr("opacity", (d) => (getNodeMeta(d)?.note ? 1 : 0))
    .text((d) => getNodeMeta(d)?.note ?? "");
});
