def interpret_truth_overrides(overrides: list) -> dict:
    """Simple interpreter that consolidates overrides into a strategy JSON.

    `overrides` is expected to be a list of dict-like objects from `TruthOverride`.
    """
    neighbors = []
    roads = []

    for o in overrides:
        attrs = o.get('attributes') or {}
        if attrs.get('type') == 'road' or attrs.get('road_width'):
            roads.append({'geometry': o.get('geometry'), 'width': attrs.get('road_width'), 'confidence': attrs.get('confidence', 1.0)})
        else:
            neighbors.append({'geometry': o.get('geometry'), 'parcel_id': attrs.get('parcel_id'), 'confidence': attrs.get('confidence', 1.0)})

    strategy = {
        'neighbors': neighbors,
        'roads': roads,
        'policy': 'truth_override_priority',
    }

    return strategy
