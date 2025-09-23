import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as d3dag from "https://cdn.jsdelivr.net/npm/d3-dag@1.1.0/+esm";

const {
  graphStratify,
  sugiyama,
  layeringLongestPath,
  decrossOpt,
  coordQuad
} = d3dag;

const FONT_URL_REGEX = /url\((['"]?)(?!data:)([^'"\)]+?\.(?:woff2?|ttf))\1\)/gi;
const FONT_FACE_BLOCK_REGEX = /@font-face\s*{[^}]*}/gi;
const FONT_PROP_REGEX = /([\w-]+)\s*:\s*([^;]+);/g;

const loadedFontKeys = new Set();

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function getFontMimeType(url) {
  const normalized = url.split("?")[0].split("#")[0].toLowerCase();
  if (normalized.endsWith(".woff2")) return "font/woff2";
  if (normalized.endsWith(".woff")) return "font/woff";
  if (normalized.endsWith(".ttf")) return "font/ttf";
  return "application/octet-stream";
}

async function inlineFontSources(cssText) {
  const matches = Array.from(cssText.matchAll(FONT_URL_REGEX));
  if (!matches.length) return cssText;

  const urlToDataUri = new Map();
  await Promise.all(
    matches.map(async (match) => {
      const url = match[2];
      if (urlToDataUri.has(url)) return;
      try {
        const absoluteUrl = new URL(url, window.location.href).href;
        const response = await fetch(absoluteUrl);
        if (!response.ok) return;
        const fontBuffer = await response.arrayBuffer();
        const base64Font = arrayBufferToBase64(fontBuffer);
        const mimeType = getFontMimeType(url);
        urlToDataUri.set(url, `data:${mimeType};base64,${base64Font}`);
      } catch (err) {
        console.warn("Failed to inline font", url, err);
      }
    })
  );

  return cssText.replace(FONT_URL_REGEX, (match, quote, url) => {
    const dataUri = urlToDataUri.get(url);
    return dataUri ? `url(${quote}${dataUri}${quote})` : match;
  });
}

function cleanCssValue(value) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

async function ensureEmbeddedFontsLoaded(cssText) {
  if (typeof FontFace === "undefined") return;
  const blocks = cssText.match(FONT_FACE_BLOCK_REGEX);
  if (!blocks) return;

  const fontPromises = blocks.map(async (block) => {
    const descriptors = {};
    let family = null;
    let src = null;

    block.replace(FONT_PROP_REGEX, (_, prop, value) => {
      const key = prop.toLowerCase();
      if (key === "font-family") {
        family = cleanCssValue(value);
      } else if (key === "src") {
        src = value.trim();
      } else if (key === "font-style" || key === "font-weight" || key === "font-stretch") {
        descriptors[key.replace("font-", "")] = cleanCssValue(value);
      }
      return "";
    });

    if (!family || !src) return;

    if (/url\((['"]?)data:/i.test(src)) return;

    const fontKey = `${family}|${descriptors.style ?? "normal"}|${descriptors.weight ?? "400"}|${src}`;
    if (loadedFontKeys.has(fontKey)) return;

    try {
      const fontFace = new FontFace(family, src, descriptors);
      await fontFace.load();
      document.fonts.add(fontFace);
      loadedFontKeys.add(fontKey);
    } catch (err) {
      console.warn("Failed to load embedded font", family, err);
    }
  });

  await Promise.all(fontPromises);
}

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

  // Strip foreignObject nodes to avoid canvas tainting during PNG export
  clone.querySelectorAll("foreignObject").forEach((node) => node.remove());

  const vb = svgNode.viewBox?.baseVal;
  const rect = svgNode.getBoundingClientRect();
  let width = (vb && vb.width) || rect.width || svgNode.clientWidth || 640;
  let height = (vb && vb.height) || rect.height || svgNode.clientHeight || 480;

  clone.setAttribute("width", width);
  clone.setAttribute("height", height);

  const inlineCss = exportedStyles || (await exportedStylesPromise.catch(() => ""));
  await ensureEmbeddedFontsLoaded(inlineCss);
  if (inlineCss) {
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.setAttribute("type", "text/css");
    styleEl.textContent = inlineCss;
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
    let cssText = await (await fetch("styles.css")).text();
    const importRegex = /@import\s+url\(['"]?(.*?)['"]?\);/g;
    const importUrls = [];
    cssText = cssText.replace(importRegex, (_, url) => {
importUrls.push(url);
return '';
    });
    const importedCss = await Promise.all(
      importUrls.map(async (url) => {
        try {
          const res = await fetch(url);
          const text = await res.text();
          return inlineFontSources(text);
        } catch (err) {
          console.warn("Failed to load imported stylesheet", url, err);
          return "";
        }
      })
    );
    const mainCss = await inlineFontSources(cssText);
    exportedStyles = [...importedCss, mainCss].join("\n");
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
  note: "4h old (SLA 6h)",
  notePlacement: "below",
  noteFontSize: 13
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
  status: "reusable",
  note: "Within SLA"
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
  status: "reusable",
  note: "Within SLA"
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
      "Column-aware unique tests defined on staging are reused for downstream dims without re-running per model.",
    nodes: [
      {
        id: "src_customers",
        label: "src_customers",
        layer: "source",
        status: "fresh",
        note: "Raw feed with unique test on column customer_id",
        notePlacement: "below",
        noteFontSize: 13
      },
      {
        id: "stg_customers",
        label: "stg_customers",
        layer: "staging",
        status: "built",
        statusLabel: "Test ran",
        note: "Column-aware unique test runs here",
        notePlacement: "below"
      },
      {
        id: "dim_customers",
        label: "dim_customers",
        layer: "dim",
        status: "reusable",
        statusLabel: "Test reused",
        note: "Reuses staging unique test",
        notePlacement: "below"
      }
    ],
    links: [
      ["src_customers", "stg_customers"],
      ["stg_customers", "dim_customers"]
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
const TEST_NODE_HEIGHT = 170; // Much taller for test nodes
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
  const noteBelow = (node) => getNodeMeta(node)?.notePlacement === "below";

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
      const targetX = d3.mean(rowNodes, (n) => n.x);
      rowNodes.forEach((n) => {
        n.x = targetX;
      });
    }

    const testNode = nodes.find(
      (n) => getNodeMeta(n)?.id === "test_unique_customer_id"
    );
    if (testNode) {
      const rowX = rowNodes.length ? rowNodes[0].x : testNode.x;
      const minY = rowNodes.length ? d3.min(rowNodes, (n) => n.y) : testNode.y;
      const maxY = rowNodes.length ? d3.max(rowNodes, (n) => n.y) : testNode.y;
      const centerY = (minY + maxY) / 2;
      testNode.y = centerY;
      testNode.x = rowX - LAYOUT_NODE_HEIGHT * 0.9;
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
    .attr("y", (d) => isTestLayer(d) ? -TEST_NODE_HEIGHT / 2 : -NODE_HEIGHT / 2)
    .attr("width", NODE_WIDTH)
    .attr("height", (d) => isTestLayer(d) ? TEST_NODE_HEIGHT : NODE_HEIGHT)
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

  const layerBadgeCenterY = -NODE_HEIGHT / 2 + 12 + 16;
  const layerLabels = nonTestNodes
    .append("text")
    .attr("class", "layer-label")
    .attr("x", -NODE_WIDTH / 2 + 48)
    .attr("y", -NODE_HEIGHT / 2 + 12)
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

  layerLabels.each(function () {
    const textNode = d3.select(this);
    const bbox = this.getBBox();
    const currentCenter = bbox.y + bbox.height / 2;
    const offset = layerBadgeCenterY - currentCenter;
    textNode.attr("dy", offset);
  });

  const testNodes = node.filter(isTestLayer);

  // Center the text block vertically in the test node
  const testBlockHeight = 80; // total height of label+name+note
  const testBlockStart = -TEST_NODE_HEIGHT / 2 + (TEST_NODE_HEIGHT - testBlockHeight) / 2;
  const testLabelOffset = testBlockStart + 0;
  const testNameOffset = testBlockStart + 36;
  const testNoteOffset = testBlockStart + 72;

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
    .attr("alignment-baseline", (d) =>
      isTestLayer(d) ? "hanging" : "middle"
    )
    .attr("font-family", "Source Sans 3, Poppins, sans-serif")
    .attr("font-size", 16)
    .attr("font-weight", 400)
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
    .attr("y", (d) => (isTestLayer(d) ? testNoteOffset - 24 : 14))
    .attr("text-anchor", "start")
    .attr("alignment-baseline", (d) =>
      isTestLayer(d) ? "hanging" : "middle"
    )
    .attr("font-size", 13)
    .attr("font-weight", 500)
    .attr("fill", (d) => {
      const style = getNodeStyle(d);
      return style?.text ?? "#475569";
    })
    .text((d) => {
      const meta = getNodeMeta(d);
      const status = meta?.status;
      const customLabel = meta?.statusLabel;
      const style = statusStyles[status];
      return customLabel ?? style?.label ?? status ?? "";
    });

  node
    .append("text")
    .attr("x", (d) =>
isTestLayer(d)
        ? -NODE_WIDTH / 2 + 24
        : noteBelow(d)
        ? 0
        : -NODE_WIDTH / 2 + 96
    )
    .attr("y", (d) =>
      isTestLayer(d)
        ? testNoteOffset
        : noteBelow(d)
        ? NODE_HEIGHT / 2 + 20
        : 32
    )
    .attr("text-anchor", (d) =>
      isTestLayer(d) ? "start" : noteBelow(d) ? "middle" : "start"
    )
    .attr("alignment-baseline", (d) =>
      isTestLayer(d)
        ? "middle"
        : noteBelow(d)
        ? "hanging"
        : "middle"
    )
    .attr("font-size", (d) => {
      const meta = getNodeMeta(d);
      return meta?.noteFontSize ?? (noteBelow(d) ? 13 : 11);
    })
    .attr("fill", "#64748b")
    .attr("opacity", (d) => (getNodeMeta(d)?.note ? 1 : 0))
    .text((d) => getNodeMeta(d)?.note ?? "");
  node
    .append("foreignObject")
    .attr("x", (d) => isTestLayer(d) ? -NODE_WIDTH / 2 + 24 : -NODE_WIDTH / 2 + 96)
    .attr("y", (d) => (isTestLayer(d) ? testNoteOffset : 32))
    .attr("width", 180)
    .attr("height", 40)
    .attr("opacity", (d) => (getNodeMeta(d)?.note ? 1 : 0))
    .filter(isTestLayer)
    .append("xhtml:div")
    .style("font-size", "12px")
    .style("color", "#64748b")
    .style("font-family", "Source Sans 3, Poppins, sans-serif")
    .style("line-height", "1.3")
    .style("word-break", "break-word")
    .text((d) => getNodeMeta(d)?.note ?? "");
});
