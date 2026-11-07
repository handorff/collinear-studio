"use strict";

const plot = document.querySelector(".plot");
const canvas = plot.querySelector("canvas");
const context = canvas.getContext("2d");
const details = document.querySelector("#project-details");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const darkMode = matchMedia("(prefers-color-scheme: dark)");
const points = [...plot.querySelectorAll(".project-point")];

// Rank grid directions once per load so resizing keeps the same preferred slope.
const angle = Math.random() * Math.PI;
const lineDirections = [
  [1, 0], [3, 1], [2, 1], [3, 2], [1, 1], [2, 3], [1, 2], [1, 3],
  [0, 1], [1, -3], [1, -2], [2, -3], [1, -1], [3, -2], [2, -1], [3, -1],
].map(([x, y]) => ({
  x,
  y,
  alignment: Math.abs(Math.cos(Math.atan2(y, x) - angle)),
})).sort((a, b) => b.alignment - a.alignment);

const detailsTitle = details.querySelector("#project-title");
const detailsSummary = details.querySelector("#project-summary");
const detailsLink = details.querySelector(".project-link");
const travelTime = 3.6;
const rippleDuration = 2.6;
const cycleTime = travelTime + rippleDuration + 0.35;

let activePoint;
let chart;
let dotColor;
let frame;
let lastFrame;
let relayTime = 0;

function positionDetails() {
  if (!activePoint) return;

  const edge = 12;
  const gap = 8;
  const field = plot.getBoundingClientRect();
  const point = activePoint.getBoundingClientRect();
  const center = point.left + point.width / 2 - field.left;
  const roomAbove = point.top - field.top - gap - edge;
  const roomBelow = field.bottom - point.bottom - gap - edge;
  const above = roomAbove > roomBelow;

  details.classList.toggle("is-above", above);
  details.style.setProperty("--tooltip-max-height", `${Math.max(0, above ? roomAbove : roomBelow)}px`);

  const { width, height } = details.getBoundingClientRect();
  const left = Math.max(edge, Math.min(center - width / 2, field.width - width - edge));
  const top = above ? point.top - gap - height : point.bottom + gap;
  details.style.left = `${left}px`;
  details.style.top = `${top - field.top}px`;
  details.style.setProperty("--tooltip-pointer", `${center - left}px`);
}

function closeProject(restoreFocus = false) {
  if (!activePoint) return;

  activePoint.setAttribute("aria-expanded", "false");
  if (restoreFocus) activePoint.focus({ preventScroll: true });
  details.hidden = true;
  activePoint = undefined;
}

function toggleProject(event) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  event.preventDefault();
  const point = event.currentTarget;
  if (activePoint === point) {
    closeProject(true);
    return;
  }

  closeProject();
  activePoint = point;
  point.setAttribute("aria-expanded", "true");
  detailsTitle.textContent = point.getAttribute("aria-label");
  detailsSummary.textContent = point.dataset.summary;
  detailsLink.href = point.href;
  detailsLink.firstElementChild.textContent = point.dataset.linkLabel;
  details.hidden = false;
  positionDetails();
  details.focus({ preventScroll: true });
}

for (const point of points) {
  point.setAttribute("aria-controls", details.id);
  point.setAttribute("aria-expanded", "false");
  point.addEventListener("click", toggleProject);
}

document.addEventListener("click", (event) => {
  if (!details.contains(event.target) && !event.target.closest(".project-point")) closeProject();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activePoint) {
    event.preventDefault();
    closeProject(true);
  }
});

function resizePlot() {
  const { width, height } = plot.getBoundingClientRect();
  if (!width || !height) return;

  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);

  const spacing = width < 520 ? 17 : 22;
  const columns = Math.max(0, Math.floor((width - 8) / spacing));
  const rows = Math.max(0, Math.floor((height - 8) / spacing));
  const originX = (width - columns * spacing) / 2;
  const originY = (height - rows * spacing) / 2;
  const inset = (points[0]?.offsetWidth ?? 0) / 2 + 12;
  const insetColumns = Math.max(0, Math.ceil((inset - originX) / spacing));
  const insetRows = Math.max(0, Math.ceil((inset - originY) / spacing));
  const usableColumns = Math.max(0, columns - 2 * insetColumns);
  const usableRows = Math.max(0, rows - 2 * insetRows);
  const gaps = points.length - 1;
  const intervals = Math.max(1, gaps);
  const minGap = 80;

  const layouts = lineDirections.map(({ x, y }) => {
    const horizontalLimit = x ? usableColumns / x : Infinity;
    const verticalLimit = y ? usableRows / Math.abs(y) : Infinity;
    const maxStep = Math.floor(Math.min(horizontalLimit, verticalLimit) / intervals);
    const stepLength = spacing * Math.hypot(x, y);
    return { x, y, maxStep, stepLength };
  });
  const layout = layouts.find(({ maxStep, stepLength }) => maxStep * stepLength >= minGap)
    ?? layouts.reduce((best, option) => (
      option.maxStep * option.stepLength > best.maxStep * best.stepLength ? option : best
    ));
  const minStep = Math.ceil(minGap / layout.stepLength);
  const step = Math.min(layout.maxStep, Math.max(minStep, Math.round(layout.maxStep * 0.62)));
  const stepX = layout.x * step;
  const stepY = layout.y * step;
  const firstColumn = Math.round((columns - gaps * stepX) / 2);
  const firstRow = Math.round((rows - gaps * stepY) / 2);
  const xAt = (column) => originX + column * spacing;
  const yAt = (row) => originY + row * spacing;
  const startX = xAt(firstColumn);
  const startY = yAt(firstRow);
  const directionLength = Math.hypot(layout.x, layout.y);
  const axisX = layout.x / directionLength;
  const axisY = layout.y / directionLength;
  const pointGap = step * layout.stepLength;
  const leadIn = spacing * 2.7;
  const travelLength = Math.max(0, gaps) * pointGap + 2 * leadIn;

  const markers = points.map((point, index) => {
    const x = startX + index * stepX * spacing;
    const y = startY + index * stepY * spacing;
    point.style.left = `${x}px`;
    point.style.top = `${y}px`;
    return { x, y, arrival: (leadIn + index * pointGap) / travelLength * travelTime };
  });

  const dots = [];
  for (let column = 0; column <= columns; column++) {
    const x = xAt(column);
    for (let row = 0; row <= rows; row++) {
      const y = yAt(row);
      const offsetX = x - startX;
      const offsetY = y - startY;
      const across = offsetY * axisX - offsetX * axisY;
      dots.push({
        x,
        y,
        along: offsetX * axisX + offsetY * axisY,
        lane: Math.exp(-0.5 * (across / (spacing * 0.58)) ** 2),
        distances: markers.map(marker => Math.hypot(x - marker.x, y - marker.y)),
      });
    }
  }

  chart = { width, height, spacing, leadIn, travelLength, markers, dots };
  plot.classList.add("is-drawn");
  draw();
  positionDetails();
}

function readColors() {
  dotColor = getComputedStyle(plot).getPropertyValue("--plot-dot").trim();
  draw();
}

function draw() {
  if (!chart) return;

  const { width, height, spacing, leadIn, travelLength, markers, dots } = chart;
  const still = reducedMotion.matches;
  const time = still ? travelTime + 0.45 : relayTime;
  const head = time / travelTime * travelLength - leadIn;
  const headFade = Math.max(0, Math.min(1, time / 0.2, (travelTime - time) / 0.26));
  const rippleSpeed = Math.min(172, height * 0.44);
  const echoDelay = spacing * 2.1;
  const ripples = markers.map(({ arrival }, index) => {
    const age = time - arrival;
    const glow = still ? 0 : Math.exp(-0.5 * (age / 0.15) ** 2);
    points[index].style.setProperty("--relay-scale", 1 + 0.22 * glow);
    return {
      index,
      radius: age * rippleSpeed,
      strength: Math.max(0, 1 - age / rippleDuration) * Math.max(0, Math.min(1, age / 0.14)),
    };
  }).filter(ripple => ripple.strength > 0);
  context.clearRect(0, 0, width, height);

  const levels = Array.from({ length: 16 }, () => []);
  for (const dot of dots) {
    const behind = head - dot.along;
    const headGlow = 0.94 * Math.exp(-0.5 * (behind / (spacing * 0.93)) ** 2);
    const trail = behind > 0 ? 0.37 * Math.exp(-behind / (spacing * 3.6)) : 0;
    let energy = dot.lane * (headGlow + trail) * headFade;

    for (const { index, radius, strength } of ripples) {
      const distanceFromCrest = dot.distances[index] - radius;
      const crest = distanceFromCrest / (spacing * 0.72);
      const echo = (distanceFromCrest + echoDelay) / (spacing * 0.58);
      const echoGlow = radius > echoDelay ? 0.34 * Math.exp(-0.5 * echo ** 2) : 0;
      energy += strength * (0.9 * Math.exp(-0.5 * crest ** 2) + echoGlow);
    }

    const intensity = Math.min(1, energy);
    levels[Math.round(intensity * (levels.length - 1))].push(dot);
  }

  context.fillStyle = dotColor;
  levels.forEach((level, index) => {
    const intensity = index / (levels.length - 1);
    const radius = 1.05 + intensity * 2.05;
    context.globalAlpha = 0.21 + intensity * 0.78;
    context.beginPath();
    for (const { x, y } of level) {
      context.moveTo(x + radius, y);
      context.arc(x, y, radius, 0, Math.PI * 2);
    }
    context.fill();
  });

  context.globalAlpha = 1;
}

function animate(now) {
  if (lastFrame === undefined || now - lastFrame >= 31) {
    if (lastFrame !== undefined) {
      relayTime = (relayTime + Math.min(now - lastFrame, 100) / 1000) % cycleTime;
    }
    lastFrame = now;
    draw();
  }
  frame = requestAnimationFrame(animate);
}

function syncMotion() {
  if (!context) return;

  const running = !reducedMotion.matches && !document.hidden;
  if (running && frame === undefined) {
    frame = requestAnimationFrame(animate);
  }
  if (!running && frame !== undefined) {
    cancelAnimationFrame(frame);
    frame = undefined;
    lastFrame = undefined;
  }
}

if (context) {
  readColors();
  resizePlot();
  reducedMotion.addEventListener("change", () => {
    syncMotion();
    draw();
  });
  darkMode.addEventListener("change", readColors);
  document.addEventListener("visibilitychange", syncMotion);
  syncMotion();
}

new ResizeObserver(context ? resizePlot : positionDetails).observe(plot);
