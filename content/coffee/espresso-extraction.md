---
title: "The Physics of Espresso Extraction"
description: "Exploring pressure profiles, grind distribution, and extraction dynamics."
published: "2024-01-10"
---

> [!note] Testing Note
> This sample article demonstrates Obsidian syntax features and can be safely deleted.

%% This is an Obsidian comment that should be completely stripped from the published output %%

Espresso is an emulsion created by forcing near-boiling water through a finely ground, tamped bed of roasted coffee beans at high pressure (typically 6 to 9 bars).

See also our guide on [[pour-over-brewing|Mastering the V60 Pour Over Technique]] and check out [[pour-over-brewing#The Recipe|the V60 recipe]]. Here is a broken wikilink test: [[non-existent-note|Unknown Article]].

Related tags: #coffee #espresso #fluid-dynamics

## Extraction Dynamics & Math

The resistance of the coffee puck can be modeled using Darcy's law for flow through porous media:

$$Q = \frac{-\kappa A}{\mu} \frac{\Delta P}{L}$$

Where:
- $Q$ is fluid flow rate (yield per second)
- $\kappa$ is puck permeability
- $A$ is basket surface area
- $\Delta P$ is pump extraction pressure ($9 \text{ bar} \approx 900 \text{ kPa}$)
- $\mu$ is water viscosity at $93^\circ\text{C}$

==Proper puck preparation is essential== to avoid channeling, which degrades total dissolved solids (TDS)[^1].

## Brewing Workflow Diagram

```mermaid
graph LR
  Bean[Whole Roasted Beans] --> Grind[Precision Grinder]
  Grind --> WDT[WDT Distribution]
  WDT --> Tamp[Level Tamp 25 lbs]
  Tamp --> Pull[9 Bar Extraction]
  Pull --> Cup[36g Balanced Espresso]
```

## Dialing Checklist

- [x] Measure 18.0g whole beans on calibrated scale
- [x] Distribute grounds evenly with 0.3mm needles
- [ ] Record shot time and target 1:2 extraction ratio

## Callouts Showcase

> [!tip]+ Expandable Pro Tip (Starts Open)
> Aligning your flat burrs with shims increases unimodal grind distribution and enhances sweet clarity in light roasts.

> [!warning]- Collapsible Water Quality Notice (Starts Folded)
> If total dissolved solids in brew water exceed 150 ppm, mineral scaling will accelerate and extraction yield will drop significantly.

> [!danger] Safety Warning
> Never loosen portafilter while group head pump is engaged under 9 bars of pressure.

[^1]: Total Dissolved Solids (TDS) measures the concentration of soluble coffee flavor compounds in the beverage, typically ranging from 8% to 12% in espresso.
