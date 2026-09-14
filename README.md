# Craft Business Manager

Desktop-first business costing, inventory, production-yield, and pricing manager for a craft business producing:

- Paintable plaster art and mold toys for kids
- Handmade candle pots / vessels
- Candles using handmade or purchased vessels

## Project direction

The application is designed as a **React + TypeScript + Vite** frontend wrapped by **Tauri** for safe local file access. Version 1 uses an Excel workbook (`.xlsx`) as the persisted business-data file through a storage adapter, while keeping business logic independent from storage so SQLite can be introduced later without rebuilding the application.

## Core business requirements

- Materials and supplier/package costing
- Standard units: grams, kilograms, mL, liters, cups, and pieces
- Material-specific cup-to-weight calibration
- Reusable mix ratios
- Mold/design sample-yield calibration without requiring mold volume
- Safety/waste allowance
- Product recipes and add-ons
- Multiple vessels/components per candle product
- Handmade molded pots reusable as candle vessels
- Inventory-based producible-quantity calculation
- Unit cost, batch cost, base price, markup/margin, and profit computation
- Excel import/export and local backups

## Architecture

```text
React UI
   ↓
Application / Business Services
   ↓
Domain Models + Costing Engine
   ↓
Storage Port
   ├── ExcelStorage (v1)
   └── SQLiteStorage (future)
   ↓
Tauri filesystem boundary
```

## Initial domain model

- `Material`
- `MaterialCalibration`
- `MixPreset`
- `Product`
- `ProductRecipeItem`
- `ProductVessel`
- `MoldYieldSample`
- `InventoryItem`
- `ProductionPlan`
- `PricingPolicy`

A candle may have **zero, one, or many vessel/components**. For example, one sellable design may contain one glass cup plus several mini molded candle components. Production capacity is determined by the most constrained required component.

## Yield model

Mold volume is optional. Yield can be learned from actual samples, for example:

```text
3 cups plaster → 8 good bears
```

After cup-to-weight calibration, the system can estimate grams per finished piece, cost per piece, waste-adjusted material requirements, and producible quantity from current stock.

## Branching

- `main` — stable/releasable
- `develop` — integration branch
- `feature/*` — implementation work

## Status

Repository foundation initialized. The next implementation phase is the React/Tauri application scaffold and domain/storage contracts.
