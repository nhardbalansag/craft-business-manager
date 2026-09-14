# Initial Data Model

## Materials

A material represents anything purchased or stocked: plaster, water, wax, fragrance, paint, wick, glass cup, plastic cup, stainless cup, label, box, etc.

All stock is normalized internally to a base unit (`g`, `mL`, or `pc`). User-entered units may include `kg`, `L`, or `cup`.

## Calibrations

Dry-material volume is material-specific. A calibration records how cup measurements map to weight. This avoids assuming that 1 cup of plaster has the same mass as 1 cup of another powder.

## Mold yield samples

A mold does not need a known physical volume. A sample can record:

```text
primary material used = 3 cups (converted to base quantity)
good pieces = 8
rejected pieces = 1
```

The system derives material used per good piece from the sample.

## Products

Product categories:

1. Paintable art for kids
2. Candle pot
3. Candle

A product may use a main mix, recipe items, and zero-to-many components.

## Product components

Components solve the multiple-vessel requirement. A component can reference either:

- a stocked material (glass/plastic/stainless cup), or
- another product (a handmade molded pot/component).

This allows one candle design to contain many mini molded components without adding fixed vessel columns.

## Production capacity

Capacity is calculated for every applicable required input and the lowest capacity wins.

```text
primary material capacity
secondary material capacity
recipe-item capacities
component/vessel capacities
            ↓
minimum applicable capacity
            ↓
estimated complete sellable products
```

Non-applicable components are represented as `null`, not fake values such as `1,000,000,000`.
